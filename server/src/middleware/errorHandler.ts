import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error.'
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Unexpected server error.'
  });
};
