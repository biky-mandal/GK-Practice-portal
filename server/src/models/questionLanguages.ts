export const LANGUAGES = ['en', 'as'] as const;
export type QuestionLanguage = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<QuestionLanguage, string> = {
  en: 'English',
  as: 'Assamese'
};

// English and Assamese questions are stored as separate records; unknown values fall back to English.
export const normalizeLanguage = (value: unknown): QuestionLanguage => {
  const text = String(value ?? '').trim().toLowerCase();
  if (['as', 'asm', 'assamese', 'অসমীয়া'].includes(text)) return 'as';
  return 'en';
};
