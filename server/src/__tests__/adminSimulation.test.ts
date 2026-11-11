import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Category } from '../models/Category.js';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';
import { signAccessToken } from '../services/tokenService.js';
import { translationService } from '../services/translationService.js';
import { ApiError } from '../utils/ApiError.js';

let mongo: MongoMemoryServer;
let server: Server;
let base = '';
let token = '';
let otherAdminToken = '';
let learnerToken = '';
let adminToken = '';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri());
  const users = await User.create([
    { email: 'sim-admin@example.com', name: 'Superadmin', passwordHash: 'x', role: 'superadmin' },
    { email: 'sim-other@example.com', name: 'Other superadmin', passwordHash: 'x', role: 'superadmin' },
    { email: 'sim-learner@example.com', name: 'Learner', passwordHash: 'x', role: 'user' },
    { email: 'sim-regular-admin@example.com', name: 'Admin', passwordHash: 'x', role: 'admin' }
  ]);
  [token, otherAdminToken, learnerToken, adminToken] = users.map(signAccessToken);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}/api/admin/manage`;
}, 120000);

beforeEach(async () => {
  await Question.deleteMany({});
  await Category.deleteMany({});
  await Category.create([{ name: 'History' }, { name: 'Science' }]);
  await Question.create(Array.from({ length: 10 }, (_, index) => ({
    questionText: `History question ${index}`, categories: ['History'],
    options: ['A', 'B'], correctOption: 1, explanation: 'Answer B',
    localized: {
      en: { questionText: `English ${index}`, options: ['A', 'B'], explanation: 'English explanation' },
      as: { questionText: `Translated ${index}`, options: ['C', 'D'], explanation: 'Translated explanation' }
    },
    isActive: true
  })));
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

const call = async (path: string, method = 'GET', body?: unknown, authToken = token) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${authToken}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
};
const start = (count = 5, category = 'History', language = 'en', authToken = token) =>
  call('/simulation', 'POST', { category, count, language }, authToken);
const reset = (category = 'History') => call('/simulation/reset', 'POST', { category });
const ids = (result: { json: { data: { items: { id: string }[] } } }): string[] =>
  result.json.data.items.map((item) => item.id);

describe('admin simulation history', () => {
  it('preserves the translation endpoint contract and admin authorization', async () => {
    const translate = vi.spyOn(translationService, 'translate').mockResolvedValue(['অসমীয়া', '', 'উত্তৰ']);
    try {
      const body = { texts: ['Question', '', 'Answer'] };
      expect(await call('/translate', 'POST', body, adminToken)).toMatchObject({
        status: 200, json: { success: true, data: { translations: ['অসমীয়া', '', 'উত্তৰ'] } }
      });
      expect(translate).toHaveBeenCalledWith(body.texts);
      expect((await call('/translate', 'POST', body, learnerToken)).status).toBe(403);
      expect((await call('/translate', 'POST', body, '')).status).toBe(401);
      expect((await call('/translate', 'POST', { texts: [123] })).status).toBe(400);
      translate.mockRejectedValueOnce(new ApiError(503, 'Translation capacity is temporarily exhausted.'));
      expect(await call('/translate', 'POST', body)).toMatchObject({
        status: 503, json: { success: false, message: 'Translation capacity is temporarily exhausted.' }
      });
    } finally {
      translate.mockRestore();
    }
  });

  const startMode = (mode: 'landscape' | 'portrait', count = 5, authToken = token) =>
    call('/simulation', 'POST', { category: 'History', count, language: 'both', mode }, authToken);
  const history = async (mode: 'landscape' | 'portrait') => {
    const result = await call(`/simulation/categories?mode=${mode}`);
    expect(result.status).toBe(200);
    return result.json.data.find((category: { name: string }) => category.name === 'History');
  };

  it('keeps existing regular history while starting portrait history empty', async () => {
    const regular = await start(10);
    await Category.collection.updateOne({ name: 'History' }, {
      $unset: { shortsSimulationUsedQuestionIds: '', shortsSimulationRevision: '' }
    });
    expect(await history('landscape')).toMatchObject({ remaining: 0, canReset: true });
    expect(await history('portrait')).toMatchObject({ remaining: 10, canReset: false });
    const portrait = await startMode('portrait', 10);
    expect(portrait.status).toBe(200);
    expect(new Set(ids(portrait))).toEqual(new Set(ids(regular)));
    expect(await history('portrait')).toMatchObject({ remaining: 0, canReset: true });
    expect((await start()).status).toBe(409);
  });

  it.each(['landscape', 'portrait'] as const)('resets only %s history and preserves the other format', async (mode) => {
    const other = mode === 'portrait' ? 'landscape' : 'portrait';
    await startMode(mode, 10);
    await startMode(other, 10);
    const before = await Category.findOne({ name: 'History' }).lean().orFail();
    expect((await call('/simulation/reset', 'POST', { category: 'History', mode })).status).toBe(200);
    expect(await history(mode)).toMatchObject({ remaining: 10, canReset: false });
    expect(await history(other)).toMatchObject({ remaining: 0, canReset: true });
    const after = await Category.findOne({ name: 'History' }).lean().orFail();
    const otherUsed = other === 'portrait' ? 'shortsSimulationUsedQuestionIds' : 'simulationUsedQuestionIds';
    const otherRevision = other === 'portrait' ? 'shortsSimulationRevision' : 'simulationRevision';
    expect(after[otherUsed]).toEqual(before[otherUsed]);
    expect(after[otherRevision]).toBe(before[otherRevision]);
    expect((await startMode(other, 1)).status).toBe(409);
    expect(ids(await startMode(mode, 10))).toHaveLength(10);
  });

  it('reserves non-overlapping portrait batches across admins and languages concurrently', async () => {
    const results = await Promise.all([
      startMode('portrait'),
      call('/simulation', 'POST', { category: 'History', count: 5, language: 'as', mode: 'portrait' }, otherAdminToken)
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(new Set(results.flatMap(ids)).size).toBe(10);
    expect((await startMode('portrait', 1)).status).toBe(409);
    expect(await history('landscape')).toMatchObject({ remaining: 10, canReset: false });
  });

  it('reserves both formats simultaneously without consuming the other history', async () => {
    const results = await Promise.all([startMode('landscape', 10), startMode('portrait', 10)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(new Set(ids(results[0]))).toEqual(new Set(ids(results[1])));
    expect(await history('landscape')).toMatchObject({ remaining: 0 });
    expect(await history('portrait')).toMatchObject({ remaining: 0 });
  });

  it('rejects invalid modes for all endpoints without changing either history', async () => {
    for (const mode of ['invalid', null, ['portrait']]) {
      expect((await call('/simulation', 'POST', { category: 'History', count: 1, mode })).status).toBe(400);
      expect((await call('/simulation/reset', 'POST', { category: 'History', mode })).status).toBe(400);
    }
    expect((await call('/simulation/categories?mode=invalid')).status).toBe(400);
    expect((await call('/simulation/categories?mode=portrait&mode=landscape')).status).toBe(400);
    expect(await history('landscape')).toMatchObject({ remaining: 10, canReset: false });
    expect(await history('portrait')).toMatchObject({ remaining: 10, canReset: false });
  });

  it('returns English and matching Assamese questions and options together by default', async () => {
    const result = await call('/simulation', 'POST', { category: 'History', count: 10 });
    expect(result.status).toBe(200);
    expect(result.json.data.items).toHaveLength(10);
    for (const item of result.json.data.items) {
      const index = item.questionText.replace('English ', '');
      expect(item).toMatchObject({
        language: 'en', options: ['A', 'B'], correctOption: 1,
        explanation: 'English explanation',
        translation: { questionText: `Translated ${index}`, options: ['C', 'D'], explanation: 'Translated explanation' }
      });
    }
    expect((await start(1, 'History', 'both')).status).toBe(409);
  });

  it('lists available questions with English and Assamese text and correct answers', async () => {
    const result = await call('/simulation/questions?category=History&mode=landscape');
    expect(result.status).toBe(200);
    expect(result.json.data).toHaveLength(10);
    expect(result.json.data.find((item: { questionText: string }) => item.questionText === 'English 0')).toMatchObject({
      assameseQuestionText: 'Translated 0',
      options: ['A', 'B'],
      assameseOptions: ['C', 'D'],
      correctAnswer: 'B',
      assameseCorrectAnswer: 'D'
    });
    await start(5);
    const remaining = await call('/simulation/questions?category=History&mode=landscape');
    expect(remaining.json.data).toHaveLength(5);
  });

  it('reserves the exact selected question IDs and rejects unavailable selections', async () => {
    const listed = await call('/simulation/questions?category=History&mode=landscape');
    const chosen = listed.json.data.slice(2, 5).map((question: { id: string }) => question.id);
    const result = await call('/simulation', 'POST', {
      category: 'History', count: chosen.length, language: 'both', mode: 'landscape', questionIds: chosen
    });
    expect(result.status).toBe(200);
    expect(ids(result)).toEqual(chosen);
    expect((await call('/simulation/questions?category=History&mode=landscape')).json.data).toHaveLength(7);
    expect((await call('/simulation', 'POST', {
      category: 'History', count: 1, language: 'both', mode: 'landscape', questionIds: [chosen[0]]
    })).status).toBe(409);
    expect((await call('/simulation', 'POST', {
      category: 'History', count: 2, language: 'both', mode: 'landscape', questionIds: [chosen[0]]
    })).status).toBe(400);
  });

  it('prevents two admins from reserving the same manually selected question', async () => {
    const listed = await call('/simulation/questions?category=History&mode=landscape');
    const questionId = listed.json.data[0].id;
    const body = { category: 'History', count: 1, language: 'both', mode: 'landscape', questionIds: [questionId] };
    const results = await Promise.all([
      call('/simulation', 'POST', body),
      call('/simulation', 'POST', body, otherAdminToken)
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  });

  it('shows available content without duplicate translations for single-language and legacy questions', async () => {
    await Question.deleteMany({});
    await Question.create([
      {
        questionText: 'English only', options: ['A', 'B'], categories: ['History'],
        localized: { en: { questionText: 'English only', options: ['A', 'B'] } }, isActive: true
      },
      {
        questionText: 'অসমৰ ৰাজধানী কি?', options: ['দিছপুৰ', 'যোৰহাট'], categories: ['History'],
        localized: { as: { questionText: 'অসমৰ ৰাজধানী কি?', options: ['দিছপুৰ', 'যোৰহাট'] } }, isActive: true
      },
      { questionText: 'Legacy', options: ['C', 'D'], categories: ['History'], isActive: true }
    ]);
    const result = await start(10, 'History', 'both');
    expect(result.status).toBe(200);
    expect(result.json.data.items).toHaveLength(3);
    expect(result.json.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionText: 'English only', language: 'en', options: ['A', 'B'], translation: null }),
      expect.objectContaining({ questionText: 'অসমৰ ৰাজধানী কি?', language: 'as', options: ['দিছপুৰ', 'যোৰহাট'], translation: null }),
      expect.objectContaining({ questionText: 'Legacy', language: 'en', options: ['C', 'D'], translation: null })
    ]));
  });

  it('lists ordered summaries including empty subjects without exposing history IDs', async () => {
    await Category.updateOne({ name: 'Science' }, { $set: { order: -1 } });
    await Category.collection.updateOne({ name: 'History' }, {
      $unset: { simulationUsedQuestionIds: '', simulationRevision: '' }
    });
    const categories = await call('/simulation/categories');
    expect(categories.status).toBe(200);
    expect(categories.json.data).toEqual([
      { id: expect.any(String), name: 'Science', count: 0, active: 0, remaining: 0, canReset: false },
      { id: expect.any(String), name: 'History', count: 10, active: 10, remaining: 10, canReset: false }
    ]);
  });

  it('reserves disjoint batches across admins and languages and never automatically repeats', async () => {
    const first = await start();
    const second = await start(5, 'History', 'as', otherAdminToken);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(ids(first)).toHaveLength(5);
    expect(ids(second)).toHaveLength(5);
    expect(new Set([...ids(first), ...ids(second)]).size).toBe(10);
    expect(first.json.data.items[0]).toMatchObject({ options: ['A', 'B'], correctOption: 1, explanation: 'English explanation' });
    expect(second.json.data.items[0]).toMatchObject({ options: ['C', 'D'], correctOption: 1, explanation: 'Translated explanation' });
    expect(first.json.data.items[0].translation).toBeNull();
    expect(second.json.data.items[0].translation).toBeNull();
    const exhausted = await start();
    expect(exhausted.status).toBe(409);
    expect(exhausted.json.message).toContain('Reset');
    const categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ count: 10, active: 10, remaining: 0, canReset: true });
  });

  it('returns only the remaining unused active questions when fewer remain', async () => {
    await Question.create({ questionText: 'Inactive', categories: ['History'], isActive: false });
    await start(8);
    const remaining = await start(5);
    expect(remaining.status).toBe(200);
    expect(ids(remaining)).toHaveLength(2);
    expect((await start()).status).toBe(409);
    const categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ count: 11, active: 10, remaining: 0 });
  });

  it('resets only the selected subject and makes its used questions available again', async () => {
    const shared = await Question.create({ questionText: 'Shared', categories: ['History', 'Science'], options: ['A', 'B'] });
    await start(500);
    const science = await start(1, 'Science');
    expect(ids(science)).toEqual([String(shared._id)]);
    expect((await reset()).status).toBe(200);
    const categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ remaining: 11, canReset: false });
    expect((await start(1, 'Science')).status).toBe(409);
    expect(ids(await start(500))).toHaveLength(11);
  });

  it('atomically reserves non-overlapping batches for simultaneous starts', async () => {
    const results = await Promise.all([start(), start(5, 'History', 'en', otherAdminToken)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(new Set(results.flatMap(ids)).size).toBe(10);
    expect((await Category.findOne({ name: 'History' }).lean())?.simulationUsedQuestionIds).toHaveLength(10);
  });

  it('preserves history through category renames and allows newly published questions', async () => {
    const first = await start(10);
    const category = await Category.findOne({ name: 'History' }).orFail();
    expect((await call(`/categories/${category._id}`, 'PUT', { name: 'Renamed' })).status).toBe(200);
    expect((await start(1, 'Renamed')).status).toBe(409);
    const fresh = await Question.create({ questionText: 'Fresh', categories: ['Renamed'], options: ['A', 'B'] });
    expect(ids(await start(5, 'Renamed'))).toEqual([String(fresh._id)]);
    expect(ids(first)).not.toContain(String(fresh._id));
  });

  it('supports existing categories without history fields and excludes deactivated questions', async () => {
    await Category.collection.updateOne({ name: 'History' }, { $unset: { simulationRevision: '', simulationUsedQuestionIds: '' } });
    const inactive = await Question.findOne({ categories: 'History' }).orFail();
    await Question.updateOne({ _id: inactive._id }, { $set: { isActive: false } });
    const result = await start(10);
    expect(result.status).toBe(200);
    expect(ids(result)).toHaveLength(9);
    expect(ids(result)).not.toContain(String(inactive._id));
    expect((await start()).status).toBe(409);
    await reset();
    expect(ids(await start(10))).toHaveLength(9);
  });

  it('retains reset availability when all used questions are inactive or deleted', async () => {
    await start(10);
    await Question.updateMany({}, { $set: { isActive: false } });
    let categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ count: 10, active: 0, remaining: 0, canReset: true });
    await Question.deleteMany({});
    categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ count: 0, active: 0, remaining: 0, canReset: true });
    expect((await reset()).status).toBe(200);
    categories = await call('/simulation/categories');
    expect(categories.json.data.find((category: { name: string }) => category.name === 'History'))
      .toMatchObject({ canReset: false });
  });

  it('validates input without consuming history and restricts all endpoints to superadmins', async () => {
    expect((await start(0)).status).toBe(400);
    expect((await start(501)).status).toBe(400);
    expect((await start(1, 'Missing')).status).toBe(404);
    expect((await reset('Missing')).status).toBe(404);
    expect((await reset('')).status).toBe(400);
    expect((await call('/simulation', 'POST', { category: 'History', count: 1 }, learnerToken)).status).toBe(403);
    expect((await call('/simulation/categories', 'GET', undefined, learnerToken)).status).toBe(403);
    expect((await call('/simulation/reset', 'POST', { category: 'History' }, learnerToken)).status).toBe(403);
    expect((await call('/simulation', 'POST', { category: 'History', count: 1 }, '')).status).toBe(401);
    expect((await Category.findOne({ name: 'History' }).lean())?.simulationUsedQuestionIds).toHaveLength(0);
  });

  it('denies regular admins access to categories, starts and resets without changing history', async () => {
    await start(2);
    const before = await Category.findOne({ name: 'History' }).lean().orFail();
    for (const [path, method, body] of [
      ['/simulation/categories', 'GET', undefined],
      ['/simulation', 'POST', { category: 'History', count: 1 }],
      ['/simulation/reset', 'POST', { category: 'History' }]
    ] as const) {
      const response = await call(path, method, body, adminToken);
      expect(response.status).toBe(403);
      expect(response.json.message).toBe('Super admin access required.');
    }
    const after = await Category.findOne({ name: 'History' }).lean().orFail();
    expect(after.simulationUsedQuestionIds).toEqual(before.simulationUsedQuestionIds);
    expect(after.simulationRevision).toBe(before.simulationRevision);
    for (const [path, method, body] of [
      ['/simulation/categories', 'GET', undefined],
      ['/simulation/reset', 'POST', { category: 'History' }]
    ] as const) {
      expect((await call(path, method, body, '')).status).toBe(401);
    }
  });
});
