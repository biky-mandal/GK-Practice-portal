import type { NextFunction, Request, Response } from 'express';
import { authenticateAccessToken } from '../services/tokenService.js';
import { ApiError } from '../utils/ApiError.js';

export const optionalAuth = (req: Request, res: Response, next: NextFunction) =>
  req.headers.authorization ? requireAuth(req, res, next) : next();

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new ApiError(401, 'Authentication required.'));
  }

  try {
    req.user = await authenticateAccessToken(token);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return next(new ApiError(403, 'Admin access required.'));
  }

  return next();
};

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role !== 'superadmin') {
    return next(new ApiError(403, 'Super admin access required.'));
  }

  return next();
};
