import type { NextFunction, Request, Response } from 'express';
import { z, type ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export const validateRequest = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.flatten();
    return next(new ApiError(400, 'Validation failed', false));
  }

  req.body = result.data;
  return next();
};
