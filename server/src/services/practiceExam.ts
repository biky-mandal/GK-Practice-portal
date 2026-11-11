import { listQuestionExams } from './questionExamService.js';
import { normalizeExams } from '../models/questionExams.js';
import { type ScoringRule } from '../utils/scoring.js';

export type PracticeExam = 'adre' | 'police-forest';

export const practicePack = (exam: PracticeExam, mock: boolean) =>
  exam === 'police-forest' ? (mock ? 'police-mock' : 'police-subject') : (mock ? 'mock' : 'subject');

export const practiceExamFilter = async (exam: PracticeExam) => {
  await listQuestionExams();
  const names = normalizeExams(exam === 'police-forest' ? 'Assam Police and Forest' : 'ADRE 3.0');
  // Untagged legacy questions remain available to ADRE, never to the new exam.
  return exam === 'police-forest'
    ? { exams: { $in: names } }
    : { $or: [{ exams: { $in: names } }, { exams: { $exists: false } }, { exams: { $size: 0 } }] };
};

export const POLICE_MOCK_SECONDS = 90 * 60;
export const POLICE_MOCK_QUESTIONS = 100;
export const POLICE_MOCK_SCORING: ScoringRule = { correct: 0.5, incorrect: 0, unanswered: 0, maxMarks: 50 };
