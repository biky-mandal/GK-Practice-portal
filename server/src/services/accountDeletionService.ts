import crypto from 'node:crypto';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AccountDeletionAudit } from '../models/AccountDeletionAudit.js';
import { AccountDeletionChallenge } from '../models/AccountDeletionChallenge.js';
import { ContactMessage } from '../models/ContactMessage.js';
import { OtpRecord } from '../models/OtpRecord.js';
import { PackageReview } from '../models/PackageReview.js';
import { Payment } from '../models/Payment.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { QuestionFlag } from '../models/QuestionFlag.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { isMailConfigured } from './contactService.js';

const CODE_MINUTES = 15;
const CODE_RESEND_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

const codeHash = (email: string, code: string) =>
  crypto.createHmac('sha256', config.JWT_ACCESS_SECRET).update(`account-deletion:${email}:${code}`).digest('hex');

const accountHash = (userId: string) =>
  crypto.createHmac('sha256', config.JWT_ACCESS_SECRET).update(`deleted-account:${userId}`).digest('hex');

const safeEqual = (left: string, right: string) => {
  const expected = Buffer.from(left, 'hex');
  const actual = Buffer.from(right, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const sendCode = async (email: string, code: string) => {
  if (!isMailConfigured()) {
    throw new ApiError(503, 'Email verification is temporarily unavailable. Please contact support.');
  }

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
  });

  await transport.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: "Your Let's Crack ADRE account deletion code",
    text: `Your account deletion verification code is ${code}. It expires in ${CODE_MINUTES} minutes. If you did not request account deletion, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e3e8ef;border-radius:12px"><h2 style="margin:0 0 8px;color:#173b5b">Let's Crack ADRE</h2><p style="color:#44546a">Use this code to verify your account deletion request:</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#173b5b;margin:16px 0">${code}</p><p style="color:#44546a;font-size:13px">It expires in ${CODE_MINUTES} minutes. If you did not request account deletion, ignore this email.</p></div>`
  });
};

export const requestAccountDeletionCode = async (email: string): Promise<void> => {
  if (!isMailConfigured()) {
    throw new ApiError(503, 'Email verification is temporarily unavailable. Please contact support.');
  }

  const user = await User.findOne({ email, role: 'user' }).select('_id').lean().exec();
  if (!user) return;

  const now = new Date();
  const existing = await AccountDeletionChallenge.findOne({ email }).exec();
  if (existing && now.getTime() - existing.lastSentAt.getTime() < CODE_RESEND_SECONDS * 1000) return;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const challenge = await AccountDeletionChallenge.findOneAndUpdate(
    { email },
    {
      userId: user._id,
      email,
      codeHash: codeHash(email, code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
      lastSentAt: now
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  try {
    await sendCode(email, code);
  } catch (error) {
    logger.error('Could not send account deletion verification email', error instanceof Error ? error.name : 'Unknown error');
    await AccountDeletionChallenge.deleteOne({ _id: challenge._id }).exec();
  }
};

export const confirmAccountDeletionCode = async (email: string, code: string): Promise<void> => {
  const invalid = new ApiError(400, 'The verification code is invalid or expired. Request a new code and try again.');
  const challenge = await AccountDeletionChallenge.findOne({ email }).select('+codeHash').exec();
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    throw invalid;
  }

  if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
    await challenge.deleteOne();
    throw new ApiError(429, 'Too many incorrect codes. Request a new code and try again.');
  }

  if (!safeEqual(challenge.codeHash, codeHash(email, code))) {
    challenge.attempts += 1;
    await challenge.save();
    throw invalid;
  }

  await deleteUserAccount(String(challenge.userId), 'email_verification');
};

export const deleteUserAccount = async (
  userId: string,
  method: DeletionMethod
): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: userId, role: 'user' }).select('email phoneNumber').session(session).exec();
      if (!user) {
        throw new ApiError(404, 'Account not found.');
      }

      const accountId = user._id;
      const email = user.email;
      await TestAttempt.deleteMany({ userId: accountId }, { session });
      await RefreshToken.deleteMany({ userId: accountId }, { session });
      await Payment.deleteMany({ userId: accountId }, { session });
      await PackageReview.deleteMany({ userId: accountId }, { session });
      await QuestionFlag.deleteMany({ $or: [{ userId: accountId }, { resolvedBy: accountId }] }, { session });
      if (email) {
        await ContactMessage.deleteMany({ email }, { session });
        await PasswordReset.deleteMany({ email }, { session });
      }
      if (user.phoneNumber) await OtpRecord.deleteMany({ phoneNumber: user.phoneNumber }, { session });
      await AccountDeletionChallenge.deleteMany({ userId: accountId }, { session });

      await AccountDeletionAudit.create([{ accountHash: accountHash(userId), method }], { session });
      const deletion = await User.deleteOne({ _id: accountId, role: 'user' }, { session }).exec();
      if (deletion.deletedCount !== 1) {
        throw new ApiError(409, 'The account could not be deleted. Please try again.');
      }
    });
  } finally {
    await session.endSession();
  }
};

type DeletionMethod = 'email_verification' | 'authenticated_password' | 'administrator';
