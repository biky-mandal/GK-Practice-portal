import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';
import { authenticateAccessToken, revokeAllSessions, rotateRefreshToken, issueRefreshToken, signAccessToken } from '../services/tokenService.js';
import { findOrCreateUser } from '../services/userService.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const createUser = async (email: string) =>
  User.create({ email, name: 'Test', passwordHash: await hashPassword('CorrectHorse1'), role: 'user' });

describe('passwords', () => {
  it('accepts the right password and rejects a wrong or missing hash', async () => {
    const hash = await hashPassword('CorrectHorse1');
    expect(hash).not.toContain('CorrectHorse1');
    await expect(verifyPassword('CorrectHorse1', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    await expect(verifyPassword('wrong-password', undefined)).resolves.toBe(false);
  });
});

describe('access tokens', () => {
  it('authenticates a valid token and uses the role stored in the database', async () => {
    const user = await createUser('access@example.com');
    const principal = await authenticateAccessToken(signAccessToken(user));
    expect(principal).toMatchObject({ id: String(user._id), role: 'user' });

    await User.updateOne({ _id: user._id }, { role: 'admin' });
    await expect(authenticateAccessToken(signAccessToken(user))).resolves.toMatchObject({ role: 'admin' });
  });

  it('rejects tokens issued before a sign-out-everywhere', async () => {
    const user = await createUser('revoked@example.com');
    const token = signAccessToken(user);
    await revokeAllSessions(String(user._id));
    await expect(authenticateAccessToken(token)).rejects.toThrow();
  });

  it('rejects garbage tokens', async () => {
    await expect(authenticateAccessToken('not.a.token')).rejects.toThrow();
  });
});

describe('refresh tokens', () => {
  it('rotates once and revokes the whole family when an old token is replayed', async () => {
    const user = await createUser('refresh@example.com');
    const first = await issueRefreshToken(String(user._id), {});

    const rotated = await rotateRefreshToken(first, {});
    expect(rotated.refreshToken).not.toBe(first);

    // Replaying the already-used token is treated as theft.
    await expect(rotateRefreshToken(first, {})).rejects.toThrow();
    // The legitimate successor is revoked too.
    await expect(rotateRefreshToken(rotated.refreshToken, {})).rejects.toThrow();
  });
});

describe('legacy phone accounts', () => {
  it('creates a user on first login and reuses it on return', async () => {
    const first = await findOrCreateUser('+919876543212');
    const second = await findOrCreateUser('+919876543212');
    expect(String(first._id)).toBe(String(second._id));
    expect(first.phoneNumber).toBe('+919876543212');
  });
});
