import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ContactMessage, type IContactMessage } from '../models/ContactMessage.js';
import { User } from '../models/User.js';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export const isMailConfigured = () => Boolean(config.SMTP_HOST && config.SMTP_FROM);

async function recipients(): Promise<string[]> {
  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, email: { $exists: true, $ne: null } }).select('email').lean();
  const extra = config.CONTACT_NOTIFY_EMAILS.split(',');
  return [...new Set([...admins.map((a) => a.email as string), ...extra].map((e) => e?.trim().toLowerCase()).filter(Boolean))];
}

async function notifyAdmins(entry: IContactMessage): Promise<boolean> {
  if (!isMailConfigured()) return false;
  const to = await recipients();
  if (!to.length) return false;

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
  });

  await transport.sendMail({
    from: config.SMTP_FROM,
    to,
    replyTo: entry.email,
    subject: `New contact message from ${entry.name.replace(/[\r\n]+/g, ' ')}`,
    text: `Name: ${entry.name}\nEmail: ${entry.email}\n\n${entry.message}`,
    html: `<p><strong>Name:</strong> ${escapeHtml(entry.name)}<br><strong>Email:</strong> ${escapeHtml(entry.email)}</p><p style="white-space:pre-wrap">${escapeHtml(entry.message)}</p>`
  });
  return true;
}

export async function submitContactMessage(input: { name: string; email: string; message: string }) {
  const entry = await ContactMessage.create(input);

  // The message is already saved; a mail failure must not fail the visitor's request.
  try {
    if (await notifyAdmins(entry)) {
      entry.emailed = true;
      await entry.save();
    }
  } catch (error) {
    logger.error('Could not email contact notification', error);
  }
  return entry;
}
