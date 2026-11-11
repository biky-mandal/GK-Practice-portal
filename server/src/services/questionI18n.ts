import { LANGUAGES, type QuestionLanguage } from '../models/questionLanguages.js';

export type Bilingual = Partial<Record<QuestionLanguage, string>>;
export type BilingualList = Partial<Record<QuestionLanguage, string[]>>;

export interface LocalizedContent {
  questionText: string;
  options: string[];
  explanation: string;
  optionExplanations: string[];
  commonMisconceptions: string[];
}

// Accepts a plain string (treated as English) or an { en, as } object.
export const toBilingual = (value: unknown): Bilingual => {
  if (typeof value === 'string') return value.trim() ? { en: value.trim() } : {};
  const out: Bilingual = {};
  if (value && typeof value === 'object') {
    for (const language of LANGUAGES) {
      const text = (value as Record<string, unknown>)[language];
      if (typeof text === 'string' && text.trim()) out[language] = text.trim();
    }
  }
  return out;
};

export const toBilingualList = (value: unknown): BilingualList => {
  const clean = (list: unknown) => (Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []);
  if (Array.isArray(value)) return { en: clean(value) };
  const out: BilingualList = {};
  if (value && typeof value === 'object') {
    for (const language of LANGUAGES) {
      const list = clean((value as Record<string, unknown>)[language]);
      if (list.length) out[language] = list;
    }
  }
  return out;
};

export const firstText = (value: Bilingual): string => value.en ?? value.as ?? '';

// Picks the requested language, falling back to English then to the top-level (English) fields.
export const localizeQuestion = (question: any, language: QuestionLanguage = 'en') => {
  const chosen = question?.localized?.[language];
  const english = question?.localized?.en;
  const pick = chosen ?? english;
  return {
    questionText: pick?.questionText ?? question.questionText ?? '',
    options: pick?.options ?? question.options ?? [],
    explanation: pick?.explanation ?? question.explanation ?? '',
    optionExplanations: pick?.optionExplanations ?? [],
    commonMisconceptions: pick?.commonMisconceptions ?? []
  } as LocalizedContent;
};

// Learners see English and Assamese together: English (or whichever exists) first, Assamese as the translation.
export const bilingualQuestion = (question: any) => {
  const hasAssamese = Boolean(question?.localized?.as?.questionText);
  const hasEnglish = Boolean(question?.localized?.en?.questionText) || !hasAssamese;
  const primary = localizeQuestion(question, hasEnglish ? 'en' : 'as');
  const translation = hasEnglish && hasAssamese ? localizeQuestion(question, 'as') : null;
  return { ...primary, translation, language: (hasEnglish ? 'en' : 'as') as QuestionLanguage };
};
