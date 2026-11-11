import mongoose from 'mongoose';
import { z } from 'zod';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { PACK_IDS } from '../models/packages.js';
import { hashPassword } from '../services/passwordService.js';

// Usage: npm run user:create -- --email a@b.com --name "Admin" --role admin
// Provide the password with the USER_PASSWORD environment variable (keeps it out of shell history).
// Optional: --pack subject | pyq | mock | all to grant packages without payment (test accounts).
const readArgs = () => {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1] ?? '';
  return out;
};

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(80).default('User'),
  role: z.enum(['user', 'admin', 'superadmin']).default('user'),
  pack: z.enum([...PACK_IDS, 'all']).optional(),
  password: z.string().min(4).max(72)
});

const run = async () => {
  const input = schema.parse({ ...readArgs(), password: process.env.USER_PASSWORD ?? readArgs().password });
  await mongoose.connect(config.MONGO_URI);

  const packs = input.pack === 'all' ? [...PACK_IDS] : input.pack ? [input.pack] : [];
  const user = (await User.findOne({ email: input.email }).exec()) ?? new User({ email: input.email });

  user.name = input.name;
  user.role = input.role;
  user.passwordHash = await hashPassword(input.password);
  user.failedLoginCount = 0;
  user.lockUntil = null;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  for (const pack of packs) {
    if (!user.purchases.some((purchase) => purchase.pack === pack)) {
      user.purchases.push({ pack, amount: 0, purchasedAt: new Date() });
    }
  }
  await user.save();

  console.log(`Saved ${input.role} ${input.email}${packs.length ? ` with packs: ${packs.join(', ')}` : ''}`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error instanceof z.ZodError ? error.flatten().fieldErrors : error);
  process.exit(1);
});
