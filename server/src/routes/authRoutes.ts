import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { confirmAccountDeletionCode, deleteUserAccount, requestAccountDeletionCode } from '../services/accountDeletionService.js';
import { hashPassword, verifyPassword } from '../services/passwordService.js';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService.js';
import {
  ACCESS_TOKEN_SECONDS,
  REFRESH_TOKEN_SECONDS,
  issueRefreshToken,
  revokeAllSessions,
  revokeRefreshFamily,
  rotateRefreshToken,
  signAccessToken
} from '../services/tokenService.js';
import { serializeUser } from '../services/userService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const COOKIE_NAME = 'refreshToken';

const password = z
  .string()
  .min(4, 'Password must be at least 4 characters.')
  .max(72, 'Password must be at most 72 characters.');

const email = z.string().trim().toLowerCase().email().max(254);

const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(72) });
const deletionRequestSchema = z.object({ email });
const deletionConfirmSchema = z.object({ email, code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });
const deleteAccountSchema = z.object({ password: z.string().min(1).max(72), confirmation: z.literal(true) });

const deletionRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many deletion requests. Please try again later.' }
});

const deletionConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' }
});

// Brute-force protection per IP; account lockout below covers distributed guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }
});

const refreshCookie = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth'
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, { ...refreshCookie, maxAge: REFRESH_TOKEN_SECONDS * 1000 });
};

// A custom header cannot be sent cross-site without CORS approval, which blocks cookie-riding requests.
const requireAjax = (req: Request) => {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    throw new ApiError(403, 'Invalid request.');
  }
};

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

const sessionResponse = (user: Parameters<typeof signAccessToken>[0] & Parameters<typeof serializeUser>[0], token: string) => ({
  success: true,
  data: { user: serializeUser(user), token, expiresIn: ACCESS_TOKEN_SECONDS }
});

router.post('/register', authLimiter, validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { name, email: address, password: plain } = req.body as z.infer<typeof registerSchema>;

    if (await User.exists({ email: address })) {
      throw new ApiError(409, 'An account with this email already exists.');
    }

    // Role is never taken from the request; admins are created by an operator script.
    let user;
    try {
      user = await User.create({ name, email: address, passwordHash: await hashPassword(plain), role: 'user', lastLoginAt: new Date() });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new ApiError(409, 'An account with this email already exists.');
      throw error;
    }

    setRefreshCookie(res, await issueRefreshToken(String(user._id), meta(req)));
    return res.status(201).json(sessionResponse(user, signAccessToken(user)));
  } catch (error) {
    return next(error);
  }
});

router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email: address, password: plain } = req.body as z.infer<typeof loginSchema>;
    const invalid = new ApiError(401, 'Invalid email or password.');

    const user = await User.findOne({ email: address }).select('+passwordHash').exec();

    // First sign-in with an unknown email creates the account, named after the part before "@".
    if (!user) {
      if (plain.length < 4) throw new ApiError(400, 'Password must be at least 4 characters.');
      const name = (address.split('@')[0] || 'User').slice(0, 80);
      let created;
      try {
        created = await User.create({ name, email: address, passwordHash: await hashPassword(plain), role: 'user', lastLoginAt: new Date() });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) throw invalid;
        throw error;
      }
      setRefreshCookie(res, await issueRefreshToken(String(created._id), meta(req)));
      return res.status(201).json(sessionResponse(created, signAccessToken(created)));
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      throw new ApiError(429, 'Too many failed attempts. Please try again later.');
    }

    const matches = await verifyPassword(plain, user.passwordHash);

    if (!user.passwordHash || !matches) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        user.failedLoginCount = 0;
      }
      await user.save();
      throw invalid;
    }

    user.failedLoginCount = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    setRefreshCookie(res, await issueRefreshToken(String(user._id), meta(req)));
    return res.status(200).json(sessionResponse(user, signAccessToken(user)));
  } catch (error) {
    return next(error);
  }
});

const forgotSchema = z.object({ email });
const resetSchema = z.object({ email, otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'), password });

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' }
});

router.post('/forgot-password', resetLimiter, validateRequest(forgotSchema), async (req, res, next) => {
  try {
    await requestPasswordReset((req.body as z.infer<typeof forgotSchema>).email);
    return res.status(200).json({ success: true, message: 'If an account exists for that email, a code has been sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', resetLimiter, validateRequest(resetSchema), async (req, res, next) => {
  try {
    const { email: address, otp, password: plain } = req.body as z.infer<typeof resetSchema>;
    await resetPassword(address, otp, plain);
    return res.status(200).json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    requireAjax(req);
    const token = req.cookies?.[COOKIE_NAME];
    if (!token || typeof token !== 'string') {
      throw new ApiError(401, 'Not signed in.');
    }

    const { user, refreshToken } = await rotateRefreshToken(token, meta(req));
    setRefreshCookie(res, refreshToken);
    return res.status(200).json(sessionResponse(user, signAccessToken(user)));
  } catch (error) {
    res.clearCookie(COOKIE_NAME, refreshCookie);
    return next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    requireAjax(req);
    const token = req.cookies?.[COOKIE_NAME];
    if (typeof token === 'string') await revokeRefreshFamily(token).catch(() => undefined);
    res.clearCookie(COOKIE_NAME, refreshCookie);
    return res.status(200).json({ success: true, message: 'Logged out.' });
  } catch (error) {
    return next(error);
  }
});

// Signs the account out everywhere, including already-issued access tokens.
router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await revokeAllSessions(String(req.user?.id));
    res.clearCookie(COOKIE_NAME, refreshCookie);
    return res.status(200).json({ success: true, message: 'Signed out of all devices.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/delete-account/request', deletionRequestLimiter, validateRequest(deletionRequestSchema), async (req, res, next) => {
  try {
    await requestAccountDeletionCode((req.body as z.infer<typeof deletionRequestSchema>).email);
    return res.status(200).json({
      success: true,
      message: 'If an eligible account exists for that email, a verification code will be sent.'
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/delete-account/confirm', deletionConfirmLimiter, validateRequest(deletionConfirmSchema), async (req, res, next) => {
  try {
    const { email: address, code } = req.body as z.infer<typeof deletionConfirmSchema>;
    await confirmAccountDeletionCode(address, code);
    return res.status(200).json({ success: true, message: 'Your account and associated learning data have been deleted.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/me', requireAuth, validateRequest(deleteAccountSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id).select('+passwordHash').exec();
    if (!user || user.role !== 'user') {
      throw new ApiError(403, 'Only learner accounts can be deleted here.');
    }
    if (!(await verifyPassword((req.body as z.infer<typeof deleteAccountSchema>).password, user.passwordHash))) {
      throw new ApiError(401, 'Your current password is incorrect.');
    }

    await deleteUserAccount(String(user._id), 'authenticated_password');
    res.clearCookie(COOKIE_NAME, refreshCookie);
    return res.status(200).json({ success: true, message: 'Your account and associated learning data have been deleted.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      throw new ApiError(404, 'User not found.');
    }

    return res.status(200).json({ success: true, data: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
