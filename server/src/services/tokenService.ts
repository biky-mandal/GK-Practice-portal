import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { config } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const ISSUER = 'gk-practice-portal';
const AUDIENCE = 'gk-practice-portal-web';
export const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_SECONDS = 7 * 24 * 60 * 60;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (user: { _id: unknown; role: string; tokenVersion?: number }) =>
  jwt.sign({ sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 }, config.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_SECONDS,
    issuer: ISSUER,
    audience: AUDIENCE
  });

// Verifies the signature, then checks the user still exists and the token was not revoked.
export const authenticateAccessToken = async (token: string) => {
  let payload: JwtPayload & { ver?: number };
  try {
    payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE }) as JwtPayload & { ver?: number };
  } catch {
    throw new ApiError(401, 'Invalid or expired access token.');
  }

  const user = payload.sub ? await User.findById(payload.sub).select('role email name tokenVersion').lean().exec() : null;
  if (!user || (user.tokenVersion ?? 0) !== (payload.ver ?? 0)) {
    throw new ApiError(401, 'Invalid or expired access token.');
  }

  // Role comes from the database so a demotion takes effect immediately.
  return { id: String(user._id), email: user.email, name: user.name, role: user.role };
};

export const issueRefreshToken = async (userId: string, meta: { ip?: string; userAgent?: string }, familyId: string = crypto.randomUUID()) => {
  const token = jwt.sign({ sub: userId, fid: familyId, jti: crypto.randomUUID() }, config.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_SECONDS,
    issuer: ISSUER
  });

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_SECONDS * 1000),
    createdByIp: meta.ip
  });

  return token;
};

// Each refresh token works once. Replaying a used one means it was stolen, so the whole family is revoked.
export const rotateRefreshToken = async (token: string, meta: { ip?: string; userAgent?: string }) => {
  let payload: JwtPayload & { fid?: string };
  try {
    payload = jwt.verify(token, config.JWT_REFRESH_SECRET, { algorithms: ['HS256'], issuer: ISSUER }) as JwtPayload & { fid?: string };
  } catch {
    throw new ApiError(401, 'Invalid or expired session.');
  }

  const record = await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(token), revoked: false, expiresAt: { $gt: new Date() } },
    { $set: { revoked: true } }
  ).exec();

  if (!record) {
    if (payload.fid) await RefreshToken.updateMany({ familyId: payload.fid }, { $set: { revoked: true } });
    throw new ApiError(401, 'Invalid or expired session.');
  }

  const user = await User.findById(record.userId).exec();
  if (!user) throw new ApiError(401, 'Invalid or expired session.');

  return { user, refreshToken: await issueRefreshToken(String(user._id), meta, record.familyId) };
};

export const revokeRefreshFamily = async (token: string) => {
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) }).exec();
  if (record) await RefreshToken.updateMany({ familyId: record.familyId }, { $set: { revoked: true } });
};

export const revokeAllSessions = async (userId: string) => {
  await RefreshToken.updateMany({ userId }, { $set: { revoked: true } });
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
};
