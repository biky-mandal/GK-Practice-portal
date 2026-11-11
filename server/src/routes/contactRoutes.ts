import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { submitContactMessage } from '../services/contactService.js';

const router = Router();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().min(5).max(1000)
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please try again later.' }
});

router.post('/', contactLimiter, validateRequest(contactSchema), async (req, res, next) => {
  try {
    await submitContactMessage(req.body);
    res.status(201).json({ success: true, message: 'Thanks! Your message has been sent.' });
  } catch (error) {
    next(error);
  }
});

export default router;
