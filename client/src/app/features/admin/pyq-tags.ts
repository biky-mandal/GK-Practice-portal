// Previous-year papers are identified by question tags; keep in sync with server/src/models/pyq.ts.
export const PYQ_YEARS = [2022, 2024];

export const PYQ_PAPERS = [
  { id: 'g3-p3', label: 'Grade-III · Paper-III (HSSLC)', tags: ['GRADE 3', 'PAPER 3', 'HSSLC'] },
  { id: 'g3-p4', label: 'Grade-III · Paper-IV (Degree)', tags: ['GRADE 3', 'PAPER 4', 'DEGREE'] },
  { id: 'g3-p5', label: 'Grade-III · Paper-V (Driver)', tags: ['GRADE 3', 'PAPER 5', 'DRIVER'] },
  { id: 'g4-p1', label: 'Grade-IV · Paper-I (HSLC)', tags: ['GRADE 4', 'PAPER 1', 'HSLC'] },
  { id: 'g4-p2', label: 'Grade-IV · Paper-II (Class VIII)', tags: ['GRADE 4', 'PAPER 2', 'CLASS VIII'] }
];

export const MOCK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const norm = (tag: string) => String(tag).toUpperCase().replace(/[\s_-]+/g, ' ').trim();
const MOCK_TAG = /^MOCK 0*(\d+)$/;
const mockNumber = (tag: string) => {
  const match = MOCK_TAG.exec(norm(tag));
  return match && MOCK_NUMBERS.includes(Number(match[1])) ? match[1].replace(/^0+/, '') : '';
};

const PYQ_TAGS = new Set(['PYQ', ...PYQ_YEARS.map((y) => `ADRE ${y}`), ...PYQ_PAPERS.flatMap((p) => p.tags)]);

export interface TagState {
  year: string;
  paper: string;
  mock: string;
  other: string;
}

export function readTags(tags: unknown): TagState {
  const list = Array.isArray(tags) ? tags.map(String) : [];
  const normalized = list.map(norm);
  const year = PYQ_YEARS.find((y) => normalized.includes(`ADRE ${y}`));
  const paper = PYQ_PAPERS.find((p) => p.tags.every((t) => normalized.includes(t)));
  const mock = list.map(mockNumber).find(Boolean) ?? '';
  return {
    year: year ? String(year) : '',
    paper: paper?.id ?? '',
    mock,
    other: list.filter((t) => !PYQ_TAGS.has(norm(t)) && !mockNumber(t)).join(', ')
  };
}

export function buildTags(state: TagState): string[] {
  const paper = PYQ_PAPERS.find((p) => p.id === state.paper);
  const pyq = state.year || paper ? ['PYQ', ...(state.year ? [`ADRE ${state.year}`] : []), ...(paper?.tags ?? [])] : [];
  const mock = state.mock ? [`MOCK ${state.mock}`] : [];
  const other = state.other.split(',').map((t) => t.trim()).filter(Boolean);
  return [...new Set([...pyq, ...mock, ...other])];
}

// A previous-year question needs both the exam year and the paper.
export const pyqIncomplete = (state: TagState) => Boolean(state.year) !== Boolean(state.paper);
