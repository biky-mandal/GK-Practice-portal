import { Setting } from '../models/Setting.js';

export interface AppSettings {
  dailyFreeQuestionCount: number;
  secondsPerQuestion: number;
  /** Category every logged-in learner may practise without buying Subject Wise Practice. Empty disables it. */
  freeSubjectCategory: string;
}

const DEFAULTS: AppSettings = { dailyFreeQuestionCount: 10, secondsPerQuestion: 60, freeSubjectCategory: 'Assam Polity' };
const CACHE_MS = 30_000;

let cache: { value: AppSettings; at: number } | null = null;

export const getSettings = async (): Promise<AppSettings> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await Setting.findOne({ key: 'app' }).lean().exec();
  const value = {
    dailyFreeQuestionCount: doc?.dailyFreeQuestionCount ?? DEFAULTS.dailyFreeQuestionCount,
    secondsPerQuestion: doc?.secondsPerQuestion ?? DEFAULTS.secondsPerQuestion,
    freeSubjectCategory: doc?.freeSubjectCategory ?? DEFAULTS.freeSubjectCategory
  };
  cache = { value, at: Date.now() };
  return value;
};

export const updateSettings = async (patch: Partial<AppSettings>) => {
  await Setting.findOneAndUpdate({ key: 'app' }, { $set: patch, $setOnInsert: { key: 'app' } }, { upsert: true, runValidators: true }).exec();
  cache = null;
  return getSettings();
};

export const isFreeSubject = (categories: string[] | undefined, free: string) =>
  !!free.trim() && categories?.length === 1 && categories[0].trim().toLowerCase() === free.trim().toLowerCase();
