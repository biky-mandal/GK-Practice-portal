export const DEFAULT_QUESTION_CATEGORIES: readonly string[] = [
  'Polity',
  'Ancient Indian History',
  'Medieval Indian History',
  'Modern Indian History',
  'Geography',
  'Environment',
  'Economy',
  'Art & Culture',
  'Science & Technology',
  'Assam Ancient History',
  'Assam Modern History',
  'Assam Medieval History',
  'Assam Polity',
  'Assam Economy',
  'Assam Geography',
  'Social Studies',
  'General Knowledge',
  'Logical Reasoning and Mental Ability',
  'General English',
  'General Mathematics',
  'Road Transport',
  'World History',
  'Sports',
  'Assam Culture and Traditions'
];

export type QuestionCategory = string;

const key = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/mediaval|medieval/g, 'medieval')
    .replace(/[^a-z0-9]+/g, '');

const aliases: Record<string, string> = {
  'Indian Polity': 'Polity',
  'Indian Constitution': 'Polity',
  'Ancient History': 'Ancient Indian History',
  'Medieval History': 'Medieval Indian History',
  'Modern History': 'Modern Indian History',
  'Indian Geography': 'Geography',
  'Ecology': 'Environment',
  'Indian Economy': 'Economy',
  'Art and Culture': 'Art & Culture',
  'Culture': 'Art & Culture',
  'Science and Technology': 'Science & Technology',
  'General Science': 'Science & Technology'
};

// In-memory copy of the categories stored in the database; refreshed by categoryService.
let names: string[] = [...DEFAULT_QUESTION_CATEGORIES];
let lookup = new Map<string, string>();

const rebuild = () => {
  lookup = new Map(names.map((name) => [key(name), name]));
  for (const [alias, target] of Object.entries(aliases)) {
    if (names.includes(target)) lookup.set(key(alias), target);
  }
};
rebuild();

export const getCategoryNames = (): string[] => [...names];

export const setCategoryNames = (next: string[]) => {
  names = [...next];
  rebuild();
};

// Unknown labels are dropped; one question may belong to several categories.
export const normalizeCategories = (...inputs: unknown[]): string[] => {
  const found = new Set<string>();
  for (const input of inputs.flat(2)) {
    if (typeof input !== 'string') continue;
    const match = lookup.get(key(input));
    if (match) found.add(match);
  }
  return Array.from(found);
};