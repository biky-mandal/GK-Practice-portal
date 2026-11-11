import { z } from 'zod';
import { PACK_IDS, PACKS } from '../models/packages.js';
import { PackPrice } from '../models/PackPrice.js';
import { ApiError } from '../utils/ApiError.js';
import { contentIdSchema, resolvePackageContent } from './packageContentService.js';

export const packageIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
export const packageSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000),
  perks: z.array(z.string().trim().min(1).max(250)).max(20),
  group: z.enum(['adre', 'police-forest']),
  access: z.array(z.enum(PACK_IDS)).min(1).max(PACK_IDS.length).transform((ids) => [...new Set(ids)]),
  contentOptions: z.array(contentIdSchema).min(1).max(100).transform((ids) => [...new Set(ids)]).optional(),
  price: z.number().min(0).max(100000).multipleOf(0.01),
  originalPrice: z.number().min(0).max(100000).multipleOf(0.01).nullable(),
  enabled: z.boolean(),
  visible: z.boolean(),
  archived: z.boolean(),
  highlight: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000)
}).refine((value) => value.originalPrice === null || value.originalPrice > value.price, {
  message: 'Original price must be greater than the selling price.', path: ['originalPrice']
});

// Creates a price row for every package the first time it is needed.
export const listPrices = async () => {
  await Promise.all(
    PACKS.map((pack, sortOrder) =>
      PackPrice.updateOne({ pack: pack.id }, { $setOnInsert: { pack: pack.id, price: pack.defaultPrice, enabled: true, sortOrder, highlight: pack.id === 'subject' || pack.id === 'police-subject' } }, { upsert: true })
    )
  );
  const rows = await PackPrice.find().lean().exec();
  return rows.map((row) => {
    const index = PACKS.findIndex((pack) => pack.id === row.pack);
    const legacy = PACKS[index];
    return {
      pack: row.pack, name: row.name ?? legacy?.name ?? row.pack,
      description: row.description ?? '', perks: row.perks,
      group: row.group ?? (row.pack.startsWith('police-') ? 'police-forest' : 'adre'),
      access: row.access ?? (legacy ? [legacy.id] : []),
      ...(row.contentOptions ? { contentOptions: row.contentOptions } : {}),
      price: row.price, originalPrice: row.originalPrice ?? null, enabled: row.enabled,
      visible: row.visible !== false, archived: row.archived === true,
      highlight: row.highlight ?? (row.pack === 'subject' || row.pack === 'police-subject'),
      sortOrder: row.sortOrder ?? (index < 0 ? 100 : index)
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.pack.localeCompare(b.pack));
};

export const getPrice = async (pack: string) => (await listPrices()).find((entry) => entry.pack === pack) ?? null;

export const requirePackage = async (pack: string) => {
  const entry = await getPrice(pack);
  if (!entry) throw new ApiError(404, 'Test Series not found.');
  return entry;
};

export const setPrice = async (pack: string, patch: { price?: number; originalPrice?: number | null; enabled?: boolean }) => {
  const current = await requirePackage(pack);
  const updated = { ...current, ...patch };
  if (updated.originalPrice !== null && updated.originalPrice <= updated.price) {
    throw new ApiError(400, 'Original price must be greater than the selling price.');
  }
  return PackPrice.findOneAndUpdate({ pack }, { $set: patch }, { new: true, runValidators: true }).exec();
};

export const savePackage = async (pack: string, input: z.infer<typeof packageSchema>, create: boolean) => {
  const current = create ? null : await requirePackage(pack);
  if (input.contentOptions) {
    input = { ...input, access: await resolvePackageContent(input.contentOptions, current?.contentOptions ?? current?.access ?? []) };
  }
  const builtIn = PACKS.find((entry) => entry.id === pack);
  if (builtIn && !input.access.includes(builtIn.id)) {
    throw new ApiError(400, 'An existing content package must retain its own content type.');
  }
  await listPrices();
  if (create) {
    if (await PackPrice.exists({ pack })) throw new ApiError(409, 'This package ID already exists.');
    try {
      await PackPrice.create({ pack, ...input });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) throw new ApiError(409, 'This package ID already exists.');
      throw error;
    }
  } else {
    const changedAccess = current && (current.access.length !== input.access.length || current.access.some((mode) => !input.access.some((entry) => entry === mode)));
    await PackPrice.updateOne({ pack }, {
      $set: input,
      ...(!input.contentOptions && changedAccess ? { $unset: { contentOptions: 1 } } : {})
    }, { runValidators: true });
  }
  return listPrices();
};

export const priceMap = async () => Object.fromEntries((await listPrices()).map((entry) => [entry.pack, entry.price]));
