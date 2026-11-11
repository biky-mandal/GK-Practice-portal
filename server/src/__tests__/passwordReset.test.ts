import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { User } from '../models/User.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const captureOtp = async (email: string) => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  await requestPasswordReset(email);
  const message = String(warn.mock.calls[0]?.[0] ?? '');
  warn.mockRestore();
  return message.match(/(\d{6})$/)?.[1];
};

describe('password reset', () => {
  it('resets the password with the emailed code and rejects reuse', async () => {
    await User.create({ email: 'reset@example.com', name: 'R', passwordHash: await hashPassword('OldPassword1'), role: 'user' });
    const otp = await captureOtp('reset@example.com');
    expect(otp).toBeDefined();

    await expect(resetPassword('reset@example.com', otp === '000000' ? '111111' : '000000', 'NewPassword12')).rejects.toThrow();
    await resetPassword('reset@example.com', otp as string, 'NewPassword12');

    const user = await User.findOne({ email: 'reset@example.com' }).select('+passwordHash');
    await expect(verifyPassword('NewPassword12', user?.passwordHash)).resolves.toBe(true);
    await expect(resetPassword('reset@example.com', otp as string, 'AnotherPass123')).rejects.toThrow();
  });

  it('does nothing for unknown emails', async () => {
    await requestPasswordReset('nobody@example.com');
    expect(await PasswordReset.countDocuments({ email: 'nobody@example.com' })).toBe(0);
  });
});
