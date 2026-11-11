import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { User } from '../models/User.js';
import { PackPrice } from '../models/PackPrice.js';
import { Payment } from '../models/Payment.js';
import { PackageReview } from '../models/PackageReview.js';
import { PackageContent } from '../models/PackageContent.js';
import { signAccessToken } from '../services/tokenService.js';
import { loadEntitlements, resolveEntitlements } from '../services/entitlementService.js';
import { listPrices } from '../services/pricingService.js';
import { settlePayment } from '../services/paymentService.js';

let mongo: MongoMemoryServer;
let server: Server;
let base: string;
let adminToken: string;
let learnerToken: string;
let learnerId: string;

const details = {
  name: 'ADRE Complete', description: 'Subject practice and PYQ in one package.',
  perks: ['Two practice modes', 'Lifetime access'], group: 'adre',
  access: ['subject', 'pyq'], price: 0, originalPrice: 999,
  enabled: true, visible: true, archived: false, highlight: true, sortOrder: 6
};

const request = async (path: string, method = 'GET', body?: unknown, token = adminToken) => {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};
const create = () => request('/admin/manage/packages', 'POST', { pack: 'adre-complete', details });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), PackPrice.init(), Payment.init(), PackageReview.init(), PackageContent.init()]);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), PackPrice.deleteMany({}), Payment.deleteMany({}), PackageReview.deleteMany({}), PackageContent.deleteMany({})]);
  const admin = await User.create({ email: 'admin@packages.test', role: 'superadmin' });
  const learner = await User.create({ email: 'learner@packages.test' });
  adminToken = signAccessToken(admin);
  learnerToken = signAccessToken(learner);
  learnerId = String(learner._id);
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('dynamic package management', () => {
  const content = {
    name: 'ADRE Revision', description: 'Subject practice and previous papers', group: 'adre',
    access: ['subject', 'pyq'], archived: false, sortOrder: 6
  };

  it('manages persistent content options with authorization, validation and stable defaults', async () => {
    expect((await request('/admin/manage/package-content', 'GET', undefined, learnerToken)).status).toBe(403);
    const catalog = await request('/admin/manage/package-content');
    expect(catalog.body.data.options).toHaveLength(5);
    expect(catalog.body.data.modes).toHaveLength(5);
    expect((await request('/admin/manage/package-content', 'POST', { id: 'revision', details: content })).status).toBe(201);
    expect((await request('/admin/manage/package-content', 'POST', { id: 'revision', details: content })).status).toBe(409);
    expect((await request('/admin/manage/package-content', 'POST', { id: 'invalid', details: { ...content, access: ['unknown'] } })).status).toBe(400);
    expect((await request('/admin/manage/package-content/missing', 'PUT', content)).status).toBe(404);
    expect((await request('/admin/manage/package-content/subject', 'PUT', { ...content, access: ['mock'] })).status).toBe(400);
    const updated = { ...content, name: 'Renamed practice', group: 'police-forest', archived: true };
    expect((await request('/admin/manage/package-content/subject', 'PUT', updated)).status).toBe(200);
    const reloaded = await request('/admin/manage/package-content');
    expect(reloaded.body.data.options.find((option: { id: string }) => option.id === 'subject')).toMatchObject(updated);
  });

  it('resolves dynamic selections on the server and snapshots access across content mapping edits', async () => {
    await request('/admin/manage/package-content', 'POST', { id: 'revision', details: content });
    const selected = { ...details, contentOptions: ['revision'], access: ['mock'] };
    const created = await request('/admin/manage/packages', 'POST', { pack: 'revision-pack', details: selected });
    expect(created.status).toBe(201);
    expect(created.body.data.find((entry: { pack: string }) => entry.pack === 'revision-pack'))
      .toMatchObject({ contentOptions: ['revision'], access: ['subject', 'pyq'] });
    await request('/admin/manage/package-content/revision', 'PUT', { ...content, access: ['mock'] });
    const saved = (await listPrices()).find((entry) => entry.pack === 'revision-pack')!;
    expect(saved.access).toEqual(['subject', 'pyq']);
    const purchase = await request('/purchases/order', 'POST', { pack: 'revision-pack' }, learnerToken);
    expect(purchase.body.data.entitlements.packs).toEqual(['subject', 'pyq']);
    await request('/admin/manage/packages/revision-pack', 'PUT', selected);
    expect((await listPrices()).find((entry) => entry.pack === 'revision-pack')?.access).toEqual(['mock']);
    expect((await loadEntitlements({ id: learnerId, role: 'user' })).packs).toEqual(['subject', 'pyq']);
    expect((await request('/admin/manage/packages/revision-pack', 'PUT', { ...selected, contentOptions: ['missing'] })).status).toBe(400);
    expect((await request('/admin/manage/packages/revision-pack', 'PUT', { ...selected, contentOptions: [] })).status).toBe(400);
    const mapped = (await listPrices()).find((entry) => entry.pack === 'revision-pack')!;
    const { contentOptions, ...legacyDetails } = mapped;
    await request('/admin/manage/packages/revision-pack', 'PUT', { ...legacyDetails, perks: [], archived: true });
    expect((await listPrices()).find((entry) => entry.pack === 'revision-pack')?.contentOptions).toEqual(['revision']);
    await request('/admin/manage/packages/revision-pack', 'PUT', { ...legacyDetails, perks: [], access: ['subject'] });
    expect((await listPrices()).find((entry) => entry.pack === 'revision-pack')?.contentOptions).toBeUndefined();
  });

  it('retains archived selections on existing packages but rejects them for new selections', async () => {
    await request('/admin/manage/package-content', 'POST', { id: 'revision', details: content });
    const selected = { ...details, contentOptions: ['revision'] };
    await request('/admin/manage/packages', 'POST', { pack: 'revision-pack', details: selected });
    await request('/admin/manage/package-content/revision', 'PUT', { ...content, archived: true });
    expect((await request('/admin/manage/packages/revision-pack', 'PUT', selected)).status).toBe(200);
    expect((await request('/admin/manage/packages', 'POST', { pack: 'new-pack', details: selected })).status).toBe(400);
  });

  it('preserves existing live prices and seeds defaults without resurrecting archived packages', async () => {
    await PackPrice.create({ pack: 'subject', price: 123, enabled: false });
    const prices = await listPrices();
    expect(prices).toHaveLength(5);
    expect(prices.find((row) => row.pack === 'subject')).toMatchObject({ price: 123, enabled: false, access: ['subject'] });
    const mock = prices.find((row) => row.pack === 'mock')!;
    expect((await request('/admin/manage/packages/mock', 'PUT', { ...mock, perks: [], archived: true })).status).toBe(200);
    expect((await listPrices()).find((row) => row.pack === 'mock')?.archived).toBe(true);
  });

  it('restricts management to admins and rejects duplicate IDs, invalid access and invalid prices', async () => {
    expect((await request('/admin/manage/packages', 'POST', { pack: 'test', details }, learnerToken)).status).toBe(403);
    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(409);
    for (const patch of [{ access: [] }, { access: ['unknown'] }, { price: -1 }, { price: 1.001 }, { originalPrice: 0 }]) {
      expect((await request('/admin/manage/packages/adre-complete', 'PUT', { ...details, ...patch })).status).toBe(400);
    }
    expect((await request('/admin/manage/packages/missing', 'PUT', details)).status).toBe(404);
    expect((await request('/admin/manage/packages', 'POST', { pack: '../invalid', details })).status).toBe(400);
  });

  it('publishes live metadata, allows free bundle purchases and grants only selected content', async () => {
    await create();
    const publicPrices = await request('/purchases/prices', 'GET', undefined, '');
    expect(publicPrices.body.data.find((row: { pack: string }) => row.pack === 'adre-complete'))
      .toMatchObject({ ...details, pack: 'adre-complete' });
    const order = await request('/purchases/order', 'POST', { pack: 'adre-complete' }, learnerToken);
    expect(order.status).toBe(201);
    expect(order.body.data.free).toBe(true);
    expect(order.body.data.entitlements.packs).toEqual(['subject', 'pyq']);
    const state = await loadEntitlements({ id: learnerId, role: 'user' });
    expect(state.purchases).toHaveLength(1);
    expect(state.purchases[0]).toMatchObject({ pack: 'adre-complete', access: ['subject', 'pyq'] });
    expect((await request('/purchases/order', 'POST', { pack: 'adre-complete' }, learnerToken)).status).toBe(409);
    expect((await request('/reviews/adre-complete', 'PUT', { rating: 5, comment: 'Great bundle' }, learnerToken)).status).toBe(200);
    const reviews = await request('/reviews', 'GET', undefined, learnerToken);
    expect(reviews.body.data['adre-complete'].count).toBe(1);
    const adminReviews = await request('/admin/manage/reviews?pack=adre-complete');
    expect(adminReviews.body.data.items).toHaveLength(1);
  });

  it('blocks new purchases for hidden, disabled and archived packages', async () => {
    await create();
    for (const patch of [{ visible: false }, { enabled: false }, { archived: true }]) {
      await request('/admin/manage/packages/adre-complete', 'PUT', { ...details, ...patch });
      expect((await request('/purchases/order', 'POST', { pack: 'adre-complete' }, learnerToken)).status).toBe(409);
    }
    expect((await request('/purchases/order', 'POST', { pack: 'missing' }, learnerToken)).status).toBe(404);
  });

  it('snapshots paid-order access across edits and archives and settles idempotently', async () => {
    await create();
    await Payment.create({ userId: learnerId, pack: 'adre-complete', access: ['subject', 'pyq'], amountPaise: 25000, orderId: 'bundle-order' });
    await request('/admin/manage/packages/adre-complete', 'PUT', { ...details, access: ['police-mock'], archived: true });
    await settlePayment('bundle-order', 'bundle-payment', 25000);
    await settlePayment('bundle-order', 'bundle-payment', 25000);
    const state = await loadEntitlements({ id: learnerId, role: 'user' });
    expect(state.packs).toEqual(['subject', 'pyq']);
    expect(state.purchases).toHaveLength(1);
    expect(state.purchases[0].amount).toBe(250);
    await request('/admin/manage/packages/adre-complete', 'PUT', { ...details, access: ['mock'] });
    expect((await loadEntitlements({ id: learnerId, role: 'user' })).packs).toEqual(['subject', 'pyq']);
  });

  it('supports dynamic grants, user creation and revocation without changing legacy entitlements', async () => {
    await create();
    const grant = await request(`/admin/manage/users/${learnerId}/purchases`, 'POST', { pack: 'adre-complete' });
    expect(grant.status).toBe(201);
    expect((await loadEntitlements({ id: learnerId, role: 'user' })).packs).toEqual(['subject', 'pyq']);
    const created = await request('/admin/manage/users', 'POST', {
      email: 'new@packages.test', name: 'New Learner', password: 'StrongPass123!', packs: ['adre-complete']
    });
    expect(created.status).toBe(201);
    expect((await User.findOne({ email: 'new@packages.test' }))?.purchases[0].access).toEqual(['subject', 'pyq']);
    expect((await request(`/admin/manage/users/${learnerId}/purchases/adre-complete`, 'DELETE')).status).toBe(200);
    expect((await loadEntitlements({ id: learnerId, role: 'user' })).packs).toEqual([]);
    expect(resolveEntitlements({ role: 'user', purchases: [{ pack: 'mock', amount: 399, purchasedAt: new Date() }] }).packs).toEqual(['mock']);
  });

  it('settles legacy orders with their original content rather than an edited bundle', async () => {
    const original = (await listPrices()).find((entry) => entry.pack === 'subject')!;
    await request('/admin/manage/packages/subject', 'PUT', { ...original, perks: [], access: ['subject', 'pyq'] });
    await Payment.create({ userId: learnerId, pack: 'subject', amountPaise: 49900, orderId: 'legacy-order' });
    await settlePayment('legacy-order', 'legacy-payment', 49900);
    expect((await loadEntitlements({ id: learnerId, role: 'user' })).packs).toEqual(['subject']);
  });
});
