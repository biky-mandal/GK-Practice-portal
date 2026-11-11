import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword } from './passwordService.js';
import { revokeAllSessions } from './tokenService.js';

const OTP_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

const hashCode = (email: string, otp: string) =>
  crypto.createHmac('sha256', config.JWT_ACCESS_SECRET).update(`${email}:${otp}`).digest('hex');

const sendMail = async (to: string, otp: string) => {
  if (!config.SMTP_HOST || !config.SMTP_FROM) {
    // Without SMTP there is no way to deliver mail; surface the code in dev logs only.
    if (config.NODE_ENV !== 'production') logger.warn(`[DEV] Password reset OTP for ${to}: ${otp}`);
    else logger.error('SMTP is not configured; cannot send password reset email.');
    return;
  }

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
  });

  await transport.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: "Your Let's Crack ADRE password reset code",
    text: `Your password reset code is ${otp}. It expires in ${OTP_MINUTES} minutes. If you did not request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e3e8ef;border-radius:12px">
      <h2 style="margin:0 0 8px;color:#173b5b">Let's Crack ADRE</h2>
      <p style="color:#44546a">Use this code to reset your password:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#173b5b;margin:16px 0">${otp}</p>
      <p style="color:#44546a;font-size:13px">It expires in ${OTP_MINUTES} minutes. If you did not request this, you can ignore this email.</p>
    </div>`
  });
};

// Always resolves the same way so the response never reveals whether an account exists.
export const requestPasswordReset = async (email: string) => {
  const user = await User.findOne({ email }).select('_id').lean();
  if (!user) return;

  const existing = await PasswordReset.findOne({ email });
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_SECONDS * 1000) return;

  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await PasswordReset.findOneAndUpdate(
    { email },
    { otpHash: hashCode(email, otp), attempts: 0, expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000), lastSentAt: new Date() },
    { upsert: true }
  );

  try {
    await sendMail(email, otp);
  } catch (error) {
    logger.error('Could not send password reset email', error);
  }
};

export const resetPassword = async (email: string, otp: string, newPassword: string) => {
  const invalid = new ApiError(400, 'Invalid or expired code.');
  const record = await PasswordReset.findOne({ email });
  if (!record || record.expiresAt.getTime() < Date.now()) throw invalid;

  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  }

  const expected = Buffer.from(record.otpHash);
  const actual = Buffer.from(hashCode(email, otp));
  if (!crypto.timingSafeEqual(expected, actual)) {
    record.attempts += 1;
    await record.save();
    throw invalid;
  }

  const user = await User.findOne({ email });
  if (!user) throw invalid;

  user.passwordHash = await hashPassword(newPassword);
  user.failedLoginCount = 0;
  user.lockUntil = null;
  await user.save();
  await record.deleteOne();
  await revokeAllSessions(String(user._id));
};
