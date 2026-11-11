import { User } from '../models/User.js';
import { normalizePhoneNumber } from '../utils/phone.js';

// Legacy phone-number accounts; email accounts are created through the auth routes.
export const findOrCreateUser = async (phoneNumber: string) => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  return User.findOneAndUpdate(
    { phoneNumber: normalizedPhone },
    {
      $setOnInsert: { phoneNumber: normalizedPhone },
      $set: { lastLoginAt: new Date() }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

export const serializeUser = (user: {
  _id: unknown;
  email?: string | null;
  name?: string | null;
  phoneNumber?: string | null;
  role: string;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}) => ({
  id: String(user._id),
  email: user.email ?? null,
  name: user.name ?? null,
  phoneNumber: user.phoneNumber ?? null,
  role: user.role,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt ?? null
});

// Older databases enforce a non-partial unique phone index, which blocks accounts without a phone.
export const migrateUserIndexes = async () => {
  await User.collection.dropIndex('phoneNumber_1').catch(() => undefined);
  await User.createIndexes();
};
