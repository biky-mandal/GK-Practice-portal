import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { listPrices, requirePackage } from '../services/pricingService.js';
import { PackageReview } from '../models/PackageReview.js';
import { loadEntitlements, ownsPack } from '../services/entitlementService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().default('')
});

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reviews. Please try again later.' }
});

const firstName = (value?: string | null) => (value?.trim().split(/\s+/)[0] || 'Learner');

// Ratings and the latest comments for every package, plus the caller's own review.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id);
    const packIds = (await listPrices()).map((entry) => entry.pack);
    const [stats, recent, mine] = await Promise.all([
      PackageReview.aggregate([{ $group: { _id: '$pack', avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      Promise.all(packIds.map((pack) =>
        PackageReview.find({ pack, comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(10).populate('userId', 'name').lean().exec()
      )),
      req.user ? PackageReview.find({ userId }).lean().exec() : Promise.resolve([])
    ]);

    const data = Object.fromEntries(packIds.map((pack, index) => {
      const stat = stats.find((s) => s._id === pack);
      const own = mine.find((r) => r.pack === pack);
      return [pack, {
        average: stat ? Math.round(stat.avg * 10) / 10 : 0,
        count: stat?.count ?? 0,
        mine: own ? { rating: own.rating, comment: own.comment } : null,
        recent: recent[index].map((r: any) => ({
          name: firstName(r.userId?.name),
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt
        }))
      }];
    }));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.put('/:pack', requireAuth, reviewLimiter, validateRequest(reviewSchema), async (req, res, next) => {
  try {
    const pack = String(req.params.pack);
    await requirePackage(pack);
    const entitlements = await loadEntitlements({ id: String(req.user?.id), role: String(req.user?.role) });
    if (!ownsPack(entitlements, pack)) throw new ApiError(403, 'Only learners who bought this Test Series can review it.');

    const { rating, comment } = req.body as z.infer<typeof reviewSchema>;
    await PackageReview.findOneAndUpdate(
      { userId: req.user?.id, pack },
      { $set: { rating, comment } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({ success: true, message: 'Thanks for your review!' });
  } catch (error) {
    return next(error);
  }
});

export default router;
