import crypto from 'node:crypto';

export const generateOtp = (length = 6): string => {
  const digits = '0123456789';
  return Array.from({ length }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
};

export const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const compareOtp = (candidate: string, targetHash: string): boolean => {
  return hashOtp(candidate) === targetHash;
};
