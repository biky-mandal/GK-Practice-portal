export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  cta: string;
  perks: string[];
  description?: string;
}

export const PYQ_PAPER_COUNT = 10;
export const MOCK_COUNT = 10;

export const PYQ_PITCH = {
  title: 'Previous Year Question papers',
  text: 'Solve the real ADRE 1.0 (2022) and ADRE 2.0 (2024) papers in the original order, timed like the exam. All five papers for each year: Grade-III Paper-III, IV and V, Grade-IV Paper-I and II.',
  points: ['Original ADRE 1.0 (2022) and ADRE 2.0 (2024) questions', `${PYQ_PAPER_COUNT} full PYQ papers: 5 papers from each exam`, 'Original question order with a real exam timer']
};

// Placeholder amounts: the live prices come from the admin. Packages are one-time purchases, never subscriptions.
export const PLANS: PricingPlan[] = [
  {
    id: 'subject',
    name: 'ADRE 3.0 Subject Wise Practice',
    price: '₹499',
    period: 'one-time payment',
    highlight: true,
    cta: 'Buy Subject Wise Practice',
    perks: [
      'Subject-wise and category-wise ADRE 3.0 questions',
      'English and Assamese shown together on every question',
      '10, 20 and 50-question timed sessions',
      'Pause and resume any session',
      'Category accuracy analytics',
      'Detailed explanations after you submit',
      'Lifetime access and free updates'
    ]
  },
  {
    id: 'pyq',
    name: 'ADRE 1.0 (2022) & ADRE 2.0 (2024) PYQ Practice',
    price: '₹299',
    period: 'one-time payment',
    highlight: false,
    cta: 'Buy PYQ Practice',
    perks: [
      '10 full papers: ADRE 1.0 (2022) and ADRE 2.0 (2024), 5 papers each',
      'Original question order with a real exam timer',
      'English and Assamese shown together on every question',
      'Detailed explanations after you submit',
      'Lifetime access'
    ]
  },
  {
    id: 'mock',
    name: 'ADRE 3.0 10 Full Length Mock',
    price: '₹399',
    period: 'one-time payment',
    highlight: false,
    cta: 'Buy Mock Tests',
    perks: [
      'Mock 1 to Mock 10, each a full-length exam-style paper',
      'Real exam timer and instant scoring',
      'English and Assamese shown together on every question',
      'Detailed explanations after you submit',
      'Lifetime access'
    ]
  },
  {
    id: 'police-subject',
    name: 'Assam Police and Forest Subject Wise Practice Test Series',
    price: '₹499',
    period: 'one-time payment',
    highlight: true,
    cta: 'Buy Subject Wise Practice',
    perks: [
      'Constable written-test subjects: Arithmetic, English, Reasoning, Assam GK and General Awareness',
      '10, 20 and 50-question timed practice sessions',
      'English and Assamese questions with answer explanations',
      'Pause, resume and track category accuracy',
      'Lifetime access; SI/Forest-specific patterns not included yet'
    ]
  },
  {
    id: 'police-mock',
    name: 'Assam Police and Forest 10 Full Length Mocks',
    price: '₹399',
    period: 'one-time payment',
    highlight: false,
    cta: 'Buy 10 Constable Mocks',
    perks: [
      'Mock 1 to Mock 10 based on the supplied Constable pattern',
      '100 MCQs, 50 marks, 0.5 mark per correct answer',
      'No negative marking',
      '90-minute practice timer (not an official duration)',
      'Answer review and explanations after submission',
      'Lifetime access; SI/Forest-specific patterns not included yet'
    ]
  }
];

export const ADRE_PLANS = PLANS.filter((plan) => !plan.id.startsWith('police-'));
export const POLICE_PLANS = PLANS.filter((plan) => plan.id.startsWith('police-'));

export const NO_SUBSCRIPTION_NOTE = 'No subscriptions. No recurring charges. Pay once and keep access for good.';
export const LANGUAGE_NOTE = 'Every question is shown in English and Assamese together. A free sample is available before you buy.';
