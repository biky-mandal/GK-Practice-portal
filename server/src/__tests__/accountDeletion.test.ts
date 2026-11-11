import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { AccountDeletionAudit } from '../models/AccountDeletionAudit.js';
import { AccountDeletionChallenge } from '../models/AccountDeletionChallenge.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { OtpRecord } from '../models/OtpRecord.js';
import { PackageReview } from '../models/PackageReview.js';
import { PACK_IDS } from '../models/packages.js';
import { Payment } from '../models/Payment.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { QuestionFlag } from '../models/QuestionFlag.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/passwordService.js';
import { issueRefreshToken, signAccessToken } from '../services/tokenService.js';

const mailCapture = vi.hoisted(() => ({ text: '' }));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (message: { text: string }) => {
        mailCapture.text = message.text;
      }
    })
  }
}));

vi.mock('../services/contactService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/contactService.js')>();
  return { ...actual, isMailConfigured: () => true };
});

let mongo: MongoMemoryReplSet;
let server: Server;
let base: string;

const request = async (path: string, method: string, body: unknown, token?: string) => {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() as { success: boolean; message?: string } };
};

const clearData = async () => {
  await Promise.all([
    AccountDeletionAudit.deleteMany({}),
    AccountDeletionChallenge.deleteMany({}),
    ContactMessage.deleteMany({}),
    OtpRecord.deleteMany({}),
    PackageReview.deleteMany({}),
    Payment.deleteMany({}),
    PasswordReset.deleteMany({}),
    QuestionFlag.deleteMany({}),
    RefreshToken.deleteMany({}),
    TestAttempt.deleteMany({}),
    User.deleteMany({})
  ]);
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  base = `http://127.0.0.1:${address.port}`;
});

beforeEach(clearData);

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('account deletion', () => {
  it('requires the current password and removes account-owned records transactionally', async () => {
    const user = await User.create({
      email: 'delete-me@example.com',
      name: 'Learner',
      phoneNumber: '+919876543210',
      passwordHash: await hashPassword('CorrectHorse1'),
      role: 'user'
    });
    const token = signAccessToken(user);
    await TestAttempt.create({ userId: user._id, selectedQuestionIds: [], markedForReview: [], status: 'submitted' });
    await issueRefreshToken(String(user._id), {});
    await Payment.create({ userId: user._id, amountPaise: 49900, currency: 'INR', orderId: 'delete-order', status: 'paid' });
    await PackageReview.create({ userId: user._id, pack: PACK_IDS[0], rating: 5, comment: 'Good' });
    await QuestionFlag.create({
      questionId: new mongoose.Types.ObjectId(),
      userId: user._id,
      reason: 'wrong_answer',
      note: 'Incorrect key'
    });
    await ContactMessage.create({ name: 'Learner', email: user.email, message: 'Please help.' });
    await PasswordReset.create({
      email: user.email,
      otpHash: 'reset-hash',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      lastSentAt: new Date()
    });
    await OtpRecord.create({
      phoneNumber: user.phoneNumber,
      otpHash: 'phone-hash',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });

    const rejected = await request('/auth/me', 'DELETE', { password: 'wrong-password', confirmation: true }, token);
    expect(rejected.status).toBe(401);
    expect(await User.countDocuments({ _id: user._id })).toBe(1);
    expect(await TestAttempt.countDocuments({ userId: user._id })).toBe(1);

    const deleted = await request('/auth/me', 'DELETE', { password: 'CorrectHorse1', confirmation: true }, token);
    expect(deleted).toMatchObject({ status: 200, body: { success: true } });
    expect(await User.countDocuments({ _id: user._id })).toBe(0);
    expect(await TestAttempt.countDocuments({ userId: user._id })).toBe(0);
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(0);
    expect(await Payment.countDocuments({ userId: user._id })).toBe(0);
    expect(await PackageReview.countDocuments({ userId: user._id })).toBe(0);
    expect(await QuestionFlag.countDocuments({ userId: user._id })).toBe(0);
    expect(await ContactMessage.countDocuments({ email: user.email })).toBe(0);
    expect(await PasswordReset.countDocuments({ email: user.email })).toBe(0);
    expect(await OtpRecord.countDocuments({ phoneNumber: user.phoneNumber })).toBe(0);

    const audit = await AccountDeletionAudit.findOne().lean().exec();
    expect(audit?.accountHash).not.toContain(String(user._id));
    expect(audit?.method).toBe('authenticated_password');
  }, 20_000);

  it('sends a generic public request and deletes only after the emailed code is verified', async () => {
    const user = await User.create({ email: 'verified-delete@example.com', name: 'Learner', role: 'user' });
    const email = user.email!;
    const initiated = await request('/auth/delete-account/request', 'POST', { email });
    expect(initiated).toMatchObject({ status: 200, body: { success: true } });
    expect(initiated.body.message).not.toContain(email);
    const code = mailCapture.text.match(/\b\d{6}\b/)?.[0];
    expect(code).toBeDefined();

    const invalid = await request('/auth/delete-account/confirm', 'POST', { email, code: '000000' });
    expect(invalid.status).toBe(400);
    expect(await User.countDocuments({ _id: user._id })).toBe(1);

    const confirmed = await request('/auth/delete-account/confirm', 'POST', { email, code });
    expect(confirmed).toMatchObject({ status: 200, body: { success: true } });
    expect(await User.countDocuments({ _id: user._id })).toBe(0);
    expect(await AccountDeletionChallenge.countDocuments({ email })).toBe(0);
    expect(await AccountDeletionAudit.findOne().lean().exec()).toMatchObject({ method: 'email_verification' });
  });

  it('does not allow public requests to bypass code validation', async () => {
    const response = await fetch(`${base}/api/auth/delete-account/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', code: 'not-a-code' })
    });
    expect(response.status).toBe(400);
    expect(await User.countDocuments({})).toBe(0);
  });

  it('uses the same cleanup when a superadmin deletes a learner account', async () => {
    const admin = await User.create({ email: 'deletion-admin@example.com', name: 'Admin', role: 'superadmin' });
    const user = await User.create({ email: 'admin-deleted@example.com', name: 'Learner', role: 'user' });
    await TestAttempt.create({ userId: user._id, selectedQuestionIds: [], markedForReview: [], status: 'submitted' });
    await Payment.create({ userId: user._id, amountPaise: 49900, currency: 'INR', orderId: 'admin-delete-order', status: 'paid' });

    const response = await request(`/admin/manage/users/${user._id}`, 'DELETE', {}, signAccessToken(admin));
    expect(response).toMatchObject({ status: 200, body: { success: true } });
    expect(await User.countDocuments({ _id: user._id })).toBe(0);
    expect(await TestAttempt.countDocuments({ userId: user._id })).toBe(0);
    expect(await Payment.countDocuments({ userId: user._id })).toBe(0);
    expect(await AccountDeletionAudit.findOne().lean().exec()).toMatchObject({ method: 'administrator' });
  }, 20_000);
});
