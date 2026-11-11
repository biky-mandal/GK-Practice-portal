import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { Question } from '../models/Question.js';
import { FLAG_REASONS, QuestionFlag } from '../models/QuestionFlag.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const objectIdString = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid id.');

const flagSchema = z.object({
  questionId: objectIdString,
  attemptId: objectIdString.optional(),
  reason: z.enum(FLAG_REASONS),
  note: z.string().trim().max(500).optional().default('')
});

const flagLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reports. Please try again later.' }
});

router.post('/', requireAuth, flagLimiter, validateRequest(flagSchema), async (req, res, next) => {
  try {
    const { questionId, attemptId, reason, note } = req.body as z.infer<typeof flagSchema>;
    const userId = String(req.user?.id);

    if (!(await Question.exists({ _id: questionId }))) throw new ApiError(404, 'Question not found.');

    await QuestionFlag.findOneAndUpdate(
      { questionId, userId, reason, status: 'open' },
      { $set: { note, ...(attemptId ? { attemptId } : {}) }, $setOnInsert: { questionId, userId, reason, status: 'open' } },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, message: 'Thanks! Your report was sent to our team.' });
  } catch (error) {
    return next(error);
  }
});

export default router;
