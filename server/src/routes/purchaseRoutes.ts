import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { Payment } from '../models/Payment.js';
import { assertPackForSale, grantPack, loadEntitlements, ownsPack } from '../services/entitlementService.js';
import { settlePayment } from '../services/paymentService.js';
import { listPrices, packageIdSchema, priceMap } from '../services/pricingService.js';
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from '../services/razorpayService.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// Public so the landing and ADRE pages can show the current prices.
router.get('/prices', async (_req, res, next) => {
  try {
    return res.status(200).json({ success: true, data: await listPrices() });
  } catch (error) {
    return next(error);
  }
});

const purchaseSchema = z.object({
  pack: packageIdSchema
});

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200)
});

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const entitlements = await loadEntitlements({ id: String(req.user?.id), role: String(req.user?.role) });
    return res.status(200).json({ success: true, data: { ...entitlements, prices: await priceMap() } });
  } catch (error) {
    return next(error);
  }
});

// Step 1: the server prices the order and registers it with Razorpay.
router.post('/order', requireAuth, orderLimiter, validateRequest(purchaseSchema), async (req, res, next) => {
  try {
    if (req.user?.role === 'admin' || req.user?.role === 'superadmin') throw new ApiError(403, 'Admin accounts cannot purchase Test Series.');
    const userId = String(req.user?.id);
    const { pack: packId } = req.body as z.infer<typeof purchaseSchema>;

    const entitlements = await loadEntitlements({ id: userId, role: String(req.user?.role) });
    if (ownsPack(entitlements, packId)) throw new ApiError(409, 'You already own this Test Series.');

    const pack = await assertPackForSale(packId);
    if (pack.price <= 0) {
      return res.status(201).json({ success: true, data: { free: true, entitlements: await grantPack(userId, packId, 0, undefined, pack.access) } });
    }

    const amountPaise = Math.round(pack.price * 100);
    const order = await createRazorpayOrder({
      amountPaise,
      receipt: `rcpt_${Date.now()}_${userId.slice(-6)}`,
      notes: { userId, pack: packId }
    });

    await Payment.create({ userId, pack: packId, access: pack.access, amountPaise, currency: order.currency, orderId: order.id });

    return res.status(201).json({
      success: true,
      data: {
        free: false,
        keyId: config.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "Let's Crack ADRE",
        description: pack.name,
        prefill: { email: req.user?.email }
      }
    });
  } catch (error) {
    return next(error);
  }
});

// Step 2: the pack is granted only after the payment signature checks out.
router.post('/verify', requireAuth, validateRequest(verifySchema), async (req, res, next) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body as z.infer<typeof verifySchema>;

    const payment = await Payment.findOne({ orderId, userId: req.user?.id }).exec();
    if (!payment) throw new ApiError(404, 'Order not found.');
    if (!verifyPaymentSignature(orderId, paymentId, signature)) throw new ApiError(400, 'Payment verification failed.');

    const result = await settlePayment(orderId, paymentId);
    return res.status(200).json({ success: true, data: result?.entitlements });
  } catch (error) {
    return next(error);
  }
});

// Backup path: Razorpay calls this even if the customer closes the tab before verification.
router.post('/webhook', async (req, res, next) => {
  try {
    const raw = req.body as Buffer;
    const signature = String(req.headers['x-razorpay-signature'] ?? '');
    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
      throw new ApiError(400, 'Invalid signature.');
    }

    const event = JSON.parse(raw.toString('utf8')) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } } };
    const entity = event.payload?.payment?.entity;
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity?.id && entity.order_id) {
      await settlePayment(entity.order_id, entity.id, entity.amount);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
