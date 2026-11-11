// Previous-year papers are identified purely by question tags: PYQ, ADRE <year>, GRADE <n>, PAPER <n> and the level.
export const PYQ_YEARS = [2022, 2024] as const;
export const PYQ_EXAM = 'ADRE 3.0';
export type PyqYear = (typeof PYQ_YEARS)[number];

export const PYQ_PAPERS = [
  { id: 'g3-p3', grade: 'Grade-III', paper: 'Paper-III', level: 'HSSLC', tags: ['GRADE 3', 'PAPER 3', 'HSSLC'] },
  { id: 'g3-p4', grade: 'Grade-III', paper: 'Paper-IV', level: 'Degree', tags: ['GRADE 3', 'PAPER 4', 'DEGREE'] },
  { id: 'g3-p5', grade: 'Grade-III', paper: 'Paper-V', level: 'Driver', tags: ['GRADE 3', 'PAPER 5', 'DRIVER'] },
  { id: 'g4-p1', grade: 'Grade-IV', paper: 'Paper-I', level: 'HSLC', tags: ['GRADE 4', 'PAPER 1', 'HSLC'] },
  { id: 'g4-p2', grade: 'Grade-IV', paper: 'Paper-II', level: 'Class VIII', tags: ['GRADE 4', 'PAPER 2', 'CLASS VIII'] }
] as const;

export type PyqPaper = (typeof PYQ_PAPERS)[number];
export const PYQ_PAPER_IDS = PYQ_PAPERS.map((paper) => paper.id) as [string, ...string[]];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Tolerates case and spacing differences, so "Grade-3", "grade 3" and "GRADE_3" all match.
const tagPattern = (tag: string) => new RegExp(`^${tag.split(/\s+/).map(escape).join('[\\s_-]*')}$`, 'i');

export const PYQ_TAG = tagPattern('PYQ');

export const findPyqPaper = (id: string) => PYQ_PAPERS.find((paper) => paper.id === id);

export const pyqTagsFor = (year: number, paper: PyqPaper) => [PYQ_TAG, tagPattern(`ADRE ${year}`), ...paper.tags.map(tagPattern)];

// Mongo condition selecting every question of one paper in one year.
export const pyqFilter = (year: number, paper: PyqPaper) => ({ tags: { $all: pyqTagsFor(year, paper) } });

// Condition that keeps previous-year questions out of regular practice and the daily test.
export const excludePyq = { tags: { $nin: [PYQ_TAG] } };
