// Keep in sync with client/src/app/shared/pricing.ts.
export const PACKS = [
  { id: 'subject', name: 'ADRE 3.0 Subject Wise Practice', defaultPrice: 499 },
  { id: 'pyq', name: 'ADRE 1.0 (2022) & ADRE 2.0 (2024) PYQ Practice', defaultPrice: 299 },
  { id: 'mock', name: 'ADRE 3.0 10 Full Length Mock', defaultPrice: 399 },
  { id: 'police-subject', name: 'Assam Police and Forest Subject Wise Practice Test Series', defaultPrice: 499 },
  { id: 'police-mock', name: 'Assam Police and Forest 10 Full Length Mocks', defaultPrice: 399 }
] as const;

export type PackId = (typeof PACKS)[number]['id'];
export const PACK_IDS = PACKS.map((pack) => pack.id) as [PackId, ...PackId[]];

export const findPack = (id: string) => PACKS.find((pack) => pack.id === id);
