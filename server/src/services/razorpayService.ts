import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const razorpayConfigured = () => Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const hmac = (secret: string, payload: string | Buffer) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

// Orders are created server-side so the amount can never be set by the browser.
export const createRazorpayOrder = async (input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<RazorpayOrder> => {
  if (!razorpayConfigured()) throw new ApiError(503, 'Payments are not configured yet.');

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`
    },
    body: JSON.stringify({ amount: input.amountPaise, currency: 'INR', receipt: input.receipt, notes: input.notes })
  });

  if (!response.ok) throw new ApiError(502, 'Could not start the payment. Please try again.');
  return (await response.json()) as RazorpayOrder;
};

// Checkout returns order_id|payment_id signed with the key secret.
export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string) =>
  razorpayConfigured() && safeEqual(hmac(config.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);

// Webhooks are signed over the raw request body with the webhook secret.
export const verifyWebhookSignature = (rawBody: Buffer, signature: string) =>
  Boolean(config.RAZORPAY_WEBHOOK_SECRET) && safeEqual(hmac(config.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);
