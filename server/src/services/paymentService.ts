import { Payment } from '../models/Payment.js';
import { PACKS } from '../models/packages.js';
import { grantPack } from './entitlementService.js';

// Idempotent: the browser verify call and the Razorpay webhook may both settle the same order.
export const settlePayment = async (orderId: string, paymentId: string, expectedPaise?: number) => {
  const payment = await Payment.findOne({ orderId }).exec();
  if (!payment) return null;
  if (expectedPaise !== undefined && expectedPaise !== payment.amountPaise) return null;

  const pack = payment.pack ?? 'subject';
  const legacyPack = PACKS.find((entry) => entry.id === pack);
  const access = payment.access ?? (legacyPack ? [legacyPack.id] : undefined);
  const entitlements = await grantPack(String(payment.userId), pack, payment.amountPaise / 100, paymentId, access);

  if (payment.status !== 'paid') {
    payment.status = 'paid';
    payment.paymentId = paymentId;
    payment.paidAt = new Date();
    await payment.save();
  }

  return { payment, entitlements };
};
