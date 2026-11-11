export interface CategoryMeta {
  icon: string;
  from: string;
  to: string;
}

const FALLBACK: CategoryMeta = { icon: '📚', from: '#8aa4c8', to: '#5d7ba3' };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'Polity': { icon: '⚖️', from: '#5b8def', to: '#3a5fcd' },
  'Ancient Indian History': { icon: '🏛️', from: '#e8a64d', to: '#c27a1a' },
  'Medieval Indian History': { icon: '🏰', from: '#b07cc6', to: '#7d4a99' },
  'Modern Indian History': { icon: '🚂', from: '#4cb7a5', to: '#2a8576' },
  'Geography': { icon: '🌍', from: '#4fb3e8', to: '#1f84bd' },
  'Environment': { icon: '🌿', from: '#6bc46d', to: '#3a9a43' },
  'Economy': { icon: '💹', from: '#f0c04a', to: '#c9981a' },
  'Art & Culture': { icon: '🎨', from: '#f27a9b', to: '#cc4a72' },
  'Science & Technology': { icon: '🔬', from: '#7a7ff0', to: '#4f54c9' },
  'Assam Ancient History': { icon: '🛕', from: '#e98a5a', to: '#c2592a' },
  'Assam Modern History': { icon: '🚩', from: '#e5645f', to: '#b9332e' },
  'Assam Medieval History': { icon: '⚔️', from: '#9a8cc2', to: '#6a5a9c' },
  'Assam Polity': { icon: '🏢', from: '#4f8fb8', to: '#2d6485' },
  'Assam Economy': { icon: '🍵', from: '#7fb069', to: '#52853d' },
  'Assam Geography': { icon: '🏞️', from: '#45b6b0', to: '#1f8a84' },
  'Social Studies': { icon: '👥', from: '#5fa8d3', to: '#35789f' },
  'General Knowledge': { icon: '💡', from: '#f2b84b', to: '#c98a14' },
  'Logical Reasoning and Mental Ability': { icon: '🧩', from: '#8a7ae8', to: '#5b4bc0' },
  'General English': { icon: '🔤', from: '#e8738f', to: '#bd4666' },
  'General Mathematics': { icon: '➗', from: '#4cb79a', to: '#2a876f' },
  'Road Transport': { icon: '🚗', from: '#6f8aa6', to: '#46607a' },
  'World History': { icon: '🌐', from: '#c9894f', to: '#9a5c26' },
  'Sports': { icon: '🏅', from: '#ef8354', to: '#c2542a' },
  'Assam Culture and Traditions': { icon: '🎭', from: '#d96aa7', to: '#a63d78' }
};

export const categoryMeta = (name: string): CategoryMeta => CATEGORY_META[name] ?? FALLBACK;

export const EXAM_META: Record<string, CategoryMeta> = {
  'ADRE 3.0': { icon: '🎓', from: '#3a5fcd', to: '#7a4fc9' }
};

const ASSAMESE_META: Record<string, CategoryMeta> = {
  'ADRE 3.0': { icon: '📖', from: '#d9622b', to: '#a83a6b' }
};

export const examMeta = (name: string, language = 'en'): CategoryMeta =>
  (language === 'as' ? ASSAMESE_META[name] : EXAM_META[name]) ?? FALLBACK;
