import { Category } from '../models/Category.js';
import { Question } from '../models/Question.js';
import { DEFAULT_QUESTION_CATEGORIES, setCategoryNames } from '../models/questionCategories.js';
import { getSettings, updateSettings } from './settingsService.js';
import { ApiError } from '../utils/ApiError.js';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Loads categories from the database (seeding the defaults on first run) and refreshes the in-memory copy.
export const refreshCategories = async (): Promise<string[]> => {
  if ((await Category.estimatedDocumentCount()) === 0) {
    await Category.insertMany(DEFAULT_QUESTION_CATEGORIES.map((name, order) => ({ name, order })), { ordered: false }).catch(() => undefined);
  }
  const docs = await Category.find().select('name').sort({ order: 1, name: 1 }).lean().exec();
  const names = docs.map((doc) => doc.name);
  setCategoryNames(names);
  return names;
};

export const listCategories = async () => {
  await refreshCategories();
  return Category.find().sort({ order: 1, name: 1 }).lean().exec();
};

const assertUnique = async (name: string, exceptId?: string) => {
  const all = await Category.find().select('name').lean().exec();
  if (all.some((c) => String(c._id) !== exceptId && same(c.name, name))) throw new ApiError(409, 'A category with this name already exists.');
};

export const createCategory = async (rawName: string) => {
  const name = rawName.trim();
  await assertUnique(name);
  const last = await Category.findOne().sort({ order: -1 }).lean().exec();
  const doc = await Category.create({ name, order: (last?.order ?? -1) + 1 });
  await refreshCategories();
  return doc;
};

export const renameCategory = async (id: string, rawName: string) => {
  const name = rawName.trim();
  const existing = await Category.findById(id).exec();
  if (!existing) throw new ApiError(404, 'Category not found.');
  await assertUnique(name, id);
  const oldName = existing.name;
  if (oldName !== name) {
    existing.name = name;
    await existing.save();
    await Question.updateMany({ categories: oldName }, { $set: { 'categories.$[c]': name } }, { arrayFilters: [{ c: oldName }] });
    // Keep the free subject pointing at the renamed category.
    if (same((await getSettings()).freeSubjectCategory, oldName)) {
      await updateSettings({ freeSubjectCategory: name });
    }
  }
  await refreshCategories();
  return existing;
};

export const deleteCategory = async (id: string) => {
  const existing = await Category.findByIdAndDelete(id).exec();
  if (!existing) throw new ApiError(404, 'Category not found.');
  await Question.updateMany({ categories: existing.name }, { $pull: { categories: existing.name } });
  await refreshCategories();
};
