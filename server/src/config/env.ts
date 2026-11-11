import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/gk-practice-portal'),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-please-change'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-please-change'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:4200'),
  OTP_PROVIDER: z.enum(['mock', 'twilio']).default('mock'),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_AUTH_TOKEN: z.string().optional(),
  SMS_FROM: z.string().optional(),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  OTP_RATE_LIMIT_PER_PHONE: z.coerce.number().default(3),
  OTP_RATE_LIMIT_PER_IP: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(30),
  MAX_OTP_ATTEMPTS: z.coerce.number().default(5),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  // Optional SMTP settings for emailing admins about contact-form messages.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  // Comma-separated extra recipients; admin users' emails are always included.
  CONTACT_NOTIFY_EMAILS: z.string().default(''),
  // Google is primary; quota/temporary failures use the free MyMemory fallback.
  GOOGLE_TRANSLATE_API_KEY: z.string().default(''),
  TRANSLATION_GOOGLE_COOLDOWN_SECONDS: z.coerce.number().int().min(1).max(86400).default(300),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_VERIFICATION_MODEL: z.string().trim().min(1).default('gpt-5.5')
});

export const config = envSchema.parse(process.env);

// FRONTEND_ORIGIN may list several origins, e.g. the apex domain and www.
export const allowedOrigins = [
  ...config.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  ...(config.NODE_ENV === 'production' ? [] : ['http://localhost:4201'])
];

if (config.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT secrets must be configured in production.');
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured in production.');
  }

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET || config.JWT_ACCESS_SECRET.includes('development')) {
    throw new Error('JWT access and refresh secrets must be distinct, strong values in production.');
  }
}
