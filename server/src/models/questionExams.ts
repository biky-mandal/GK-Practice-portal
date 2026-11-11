export const DEFAULT_QUESTION_EXAMS = [
  { name: 'ADRE 3.0', description: 'Assam Direct Recruitment Examination 3.0' },
  { name: 'Assam Police and Forest', description: 'SLPRB Assam Police and Forest preparation' }
] as const;

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const DEFAULT_EXAM_ALIASES = [
  ['adre', 'ADRE 3.0'],
  ['adre3', 'ADRE 3.0'],
  ['adre30', 'ADRE 3.0'],
  ['assamdirectrecruitmentexamination', 'ADRE 3.0'],
  ['assampoliceandforest', 'Assam Police and Forest'],
  ['assampolice', 'Assam Police and Forest'],
  ['policeforest', 'Assam Police and Forest']
] as const;

let names: string[] = DEFAULT_QUESTION_EXAMS.map((exam) => exam.name);
let lookup = new Map<string, string>(DEFAULT_EXAM_ALIASES);

export const getExamNames = (): string[] => [...names];

export const setQuestionExams = (exams: Array<{ name: string; aliases: string[] }>) => {
  names = exams.map((exam) => exam.name);
  lookup = new Map(exams.flatMap((exam) => [...exam.aliases, exam.name].map((alias) => [key(alias), exam.name] as const)));
};

// A question may be eligible for several exams; unknown labels are ignored.
export const normalizeExams = (...inputs: unknown[]): string[] => {
  const found = new Set<string>();
  for (const input of inputs.flat(2)) {
    if (typeof input !== 'string') continue;
    const match = lookup.get(key(input));
    if (match) found.add(match);
  }
  return Array.from(found);
};
