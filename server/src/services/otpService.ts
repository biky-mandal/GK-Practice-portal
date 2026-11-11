import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { OtpRecord } from '../models/OtpRecord.js';
import { ApiError } from '../utils/ApiError.js';
import { compareOtp, generateOtp, hashOtp } from '../utils/otp.js';
import { normalizePhoneNumber } from '../utils/phone.js';

abstract class BaseOtpProvider {
  abstract send(phoneNumber: string, otp: string): Promise<void>;
}

class MockOtpProvider extends BaseOtpProvider {
  async send(phoneNumber: string, otp: string): Promise<void> {
    if (config.NODE_ENV !== 'production') {
      console.log(`[DEV OTP][${phoneNumber}] ${otp}`);
    }
  }
}

class TwilioOtpProvider extends BaseOtpProvider {
  async send(_phoneNumber: string, _otp: string): Promise<void> {
    // Production SMS integration stub.
    return Promise.resolve();
  }
}

const provider = config.OTP_PROVIDER === 'twilio' ? new TwilioOtpProvider() : new MockOtpProvider();

export const getOtpRequestWindowStart = () => new Date(Date.now() - 60 * 60 * 1000);

export const canRequestOtp = async (phoneNumber: string, ipAddress: string) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const phoneCount = await OtpRecord.countDocuments({
    phoneNumber: normalizedPhone,
    createdAt: { $gte: getOtpRequestWindowStart() }
  });

  const ipCount = await OtpRecord.countDocuments({
    ipAddress,
    createdAt: { $gte: getOtpRequestWindowStart() }
  });

  if (phoneCount >= config.OTP_RATE_LIMIT_PER_PHONE) {
    throw new ApiError(429, 'Too many OTP requests for this phone number. Please wait before retrying.');
  }

  if (ipCount >= config.OTP_RATE_LIMIT_PER_IP) {
    throw new ApiError(429, 'Too many OTP requests from this IP address.');
  }
};

export const buildOtpRecord = async (phoneNumber: string, ipAddress: string) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const otp = generateOtp(6);
  const otpHash = hashOtp(otp);

  await OtpRecord.findOneAndUpdate(
    { phoneNumber: normalizedPhone },
    {
      phoneNumber: normalizedPhone,
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + config.OTP_EXPIRY_MINUTES * 60 * 1000),
      verified: false,
      ipAddress,
      lastSentAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await provider.send(normalizedPhone, otp);

  return {
    phoneNumber: normalizedPhone,
    debugOtp: config.NODE_ENV !== 'production' ? otp : undefined
  };
};

export const verifyOtp = async (phoneNumber: string, otp: string, ipAddress: string) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const record = await OtpRecord.findOne({ phoneNumber: normalizedPhone }).sort({ createdAt: -1 });

  if (!record) {
    throw new ApiError(400, 'No OTP request found for this phone number.');
  }

  if (record.expiresAt < new Date()) {
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  if (record.verified) {
    throw new ApiError(400, 'This OTP was already used.');
  }

  if (config.NODE_ENV !== 'production') {
    record.verified = true;
    record.expiresAt = new Date(Date.now() + 60 * 1000);
    record.ipAddress = ipAddress;
    await record.save();
    return true;
  }

  if (!compareOtp(otp, record.otpHash)) {
    record.attempts += 1;
    record.ipAddress = ipAddress;
    await record.save();

    if (record.attempts >= config.MAX_OTP_ATTEMPTS) {
      throw new ApiError(429, 'Too many failed OTP attempts. Please request a new OTP.');
    }

    throw new ApiError(400, `Invalid OTP. Attempts remaining: ${config.MAX_OTP_ATTEMPTS - record.attempts}`);
  }

  record.verified = true;
  record.expiresAt = new Date(Date.now() + 60 * 1000);
  await record.save();

  return true;
};
