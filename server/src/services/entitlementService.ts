import mongoose from 'mongoose';
import { PACK_IDS, type PackId } from '../models/packages.js';
import { User, type Purchase } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { getPrice } from './pricingService.js';

export type Tier = 'admin' | 'guest' | 'member';

export interface Entitlements {
  isAdmin: boolean;
  tier: Tier;
  packs: PackId[];
  purchases: Purchase[];
}

export const resolveEntitlements = (user: { role?: string; purchases?: Purchase[] } | null): Entitlements => {
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const purchases = (user?.purchases ?? []).map((purchase) => ({
    pack: purchase.pack,
    amount: purchase.amount,
    purchasedAt: purchase.purchasedAt,
    ...(purchase.access ? { access: purchase.access } : {})
  }));
  const owned = new Set(purchases.flatMap((purchase) => [purchase.pack, ...(purchase.access ?? [])]));
  const packs = PACK_IDS.filter((id) => isAdmin || owned.has(id));
  const tier: Tier = isAdmin ? 'admin' : packs.length ? 'member' : 'guest';
  return { isAdmin, tier, packs, purchases };
};

export const loadEntitlements = async (reqUser: { id: string; role: string }) => {
  if (!mongoose.isValidObjectId(reqUser.id)) return resolveEntitlements({ role: reqUser.role });
  const user = await User.findById(reqUser.id).lean().exec();
  return resolveEntitlements(user ? { role: user.role, purchases: user.purchases } : { role: reqUser.role });
};

export const ownsPack = (entitlements: Entitlements, pack: string) => entitlements.isAdmin || entitlements.packs.some((id) => id === pack) || entitlements.purchases.some((purchase) => purchase.pack === pack);

// Returns the pack if it exists and is on sale; used before creating a payment order.
export const assertPackForSale = async (pack: string) => {
  const price = await getPrice(pack);
  if (!price) throw new ApiError(404, 'Test Series not found.');
  if (!price.enabled || !price.visible || price.archived) throw new ApiError(409, 'This Test Series is not currently on sale.');
  return price;
};

export const grantPack = async (userId: string, pack: string, amount: number, paymentId?: string, access?: string[]) => {
  const grantedAccess = access ?? (await getPrice(pack))?.access;
  if (!grantedAccess?.length) throw new ApiError(404, 'Test Series not found.');
  // The filter makes this idempotent, so a verify call and a webhook can both run safely.
  await User.updateOne(
    { _id: userId, purchases: { $not: { $elemMatch: { pack } } } },
    { $push: { purchases: { pack, access: grantedAccess, amount, purchasedAt: new Date(), ...(paymentId ? { paymentId } : {}) } } }
  );
  const user = await User.findById(userId).lean().exec();
  if (!user) throw new ApiError(404, 'User not found.');
  return resolveEntitlements(user);
};

// Earlier versions sold English and Assamese packs per exam; both included subject practice and the PYQ papers.
export const migrateLegacyPurchases = async () => {
  const users = await User.collection.find({ purchases: { $elemMatch: { pack: { $exists: false } } } }).toArray();
  for (const user of users) {
    const next = new Map<string, Record<string, unknown>>();
    for (const purchase of (user.purchases ?? []) as Array<Record<string, unknown>>) {
      if (typeof purchase.pack === 'string') {
        if (!next.has(purchase.pack)) next.set(purchase.pack, { pack: purchase.pack, amount: purchase.amount, purchasedAt: purchase.purchasedAt, ...(Array.isArray(purchase.access) ? { access: purchase.access } : {}), ...(purchase.paymentId ? { paymentId: purchase.paymentId } : {}) });
        continue;
      }
      const base = { purchasedAt: purchase.purchasedAt, ...(purchase.paymentId ? { paymentId: purchase.paymentId } : {}) };
      if (!next.has('subject')) next.set('subject', { pack: 'subject', amount: purchase.amount ?? 0, ...base });
      if (!next.has('pyq')) next.set('pyq', { pack: 'pyq', amount: 0, ...base });
    }
    await User.collection.updateOne({ _id: user._id }, { $set: { purchases: Array.from(next.values()) } });
  }
};
