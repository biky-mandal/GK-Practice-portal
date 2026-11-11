import { z } from 'zod';
import { PackageContent } from '../models/PackageContent.js';
import { PACK_IDS } from '../models/packages.js';
import { ApiError } from '../utils/ApiError.js';

export const contentIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
export const contentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  group: z.enum(['adre', 'police-forest']),
  access: z.array(z.enum(PACK_IDS)).min(1).max(PACK_IDS.length).transform((ids) => [...new Set(ids)]),
  archived: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000)
});

const defaults = [
  { id: 'subject', name: 'Subject-wise practice', description: 'ADRE 3.0 questions organised by subject and category.', group: 'adre' },
  { id: 'pyq', name: 'Previous-year papers', description: 'ADRE 1.0 (2022) and ADRE 2.0 (2024) original papers.', group: 'adre' },
  { id: 'mock', name: 'Full-length mocks', description: 'All 10 ADRE 3.0 timed mock tests.', group: 'adre' },
  { id: 'police-subject', name: 'Subject-wise practice', description: 'Assam Police and Forest Constable written-test subjects.', group: 'police-forest' },
  { id: 'police-mock', name: 'Full-length mocks', description: 'All 10 Assam Police and Forest Constable mock tests.', group: 'police-forest' }
];

export const listPackageContent = async () => {
  await Promise.all(defaults.map((entry, sortOrder) => PackageContent.updateOne(
    { id: entry.id }, { $setOnInsert: { ...entry, access: [entry.id], archived: false, sortOrder } }, { upsert: true }
  )));
  return PackageContent.find().sort({ sortOrder: 1, id: 1 }).lean().exec();
};

export const savePackageContent = async (id: string, input: z.infer<typeof contentSchema>, create: boolean) => {
  const builtIn = PACK_IDS.find((mode) => mode === id);
  if (builtIn && !input.access.includes(builtIn)) throw new ApiError(400, 'An original content option must retain its own practice mode.');
  await listPackageContent();
  if (create) {
    try {
      await PackageContent.create({ id, ...input });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) throw new ApiError(409, 'This content option ID already exists.');
      throw error;
    }
  } else {
    const result = await PackageContent.updateOne({ id }, { $set: input }, { runValidators: true });
    if (!result.matchedCount) throw new ApiError(404, 'Content option not found.');
  }
  return listPackageContent();
};

export const resolvePackageContent = async (ids: string[], retainedIds: string[] = []) => {
  const options = await listPackageContent();
  const access = new Set<(typeof PACK_IDS)[number]>();
  for (const id of ids) {
    const option = options.find((entry) => entry.id === id);
    if (!option) throw new ApiError(400, `Content option "${id}" does not exist.`);
    if (option.archived && !retainedIds.includes(id)) throw new ApiError(400, `Content option "${option.name}" is archived.`);
    for (const mode of PACK_IDS) {
      if (option.access.includes(mode)) access.add(mode);
    }
  }
  if (!access.size) throw new ApiError(400, 'Select at least one usable content option.');
  return [...access];
};
