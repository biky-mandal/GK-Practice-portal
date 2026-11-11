import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Question } from '../models/Question.js';
import { PYQ_PAPERS } from '../models/pyq.js';
import { getMockSummaries, getPyqSummaries, getQuestionCategories, startPracticeAttempt } from '../services/testService.js';

const userId = new mongoose.Types.ObjectId().toString();

const make = (questionId: string, tags: string[], extra: Record<string, unknown> = {}) =>
  Question.create({
    questionId,
    questionText: `Question ${questionId}`,
    options: ['A', 'B', 'C', 'D'],
    correctOption: 1,
    languages: ['en'],
    categories: ['Polity'],
    exams: ['ADRE 3.0'],
    tags,
    ...extra
  });

describe('Previous-year question papers', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Question.deleteMany({});
    await make('200', ['PYQ', 'ADRE 2022', 'GRADE 3', 'PAPER 3', 'HSSLC']);
    await make('100', ['pyq', 'adre-2022', 'Grade-3', 'Paper_3', 'hsslc']);
    await make('300', ['PYQ', 'ADRE 2024', 'GRADE 3', 'PAPER 3', 'HSSLC']);
    await make('400', ['PYQ', 'ADRE 2022', 'GRADE 3', 'PAPER 4', 'DEGREE']);
    await make('500', ['PYQ', 'ADRE 2024', 'GRADE 4', 'PAPER 2', 'CLASS VIII']);
    await make('600', ['constitution']);
    await make('701', ['MOCK 1']);
    await make('702', ['mock-1']);
    await make('703', ['Mock_2']);
  });

  it('counts questions per year and paper from their tags', async () => {
    const summary = await getPyqSummaries();
    const count = (year: number, id: string) => summary.find((s) => s.year === year)!.papers.find((p) => p.id === id)!.count;

    expect(count(2022, 'g3-p3')).toBe(2);
    expect(count(2024, 'g3-p3')).toBe(1);
    expect(count(2022, 'g3-p4')).toBe(1);
    expect(count(2024, 'g4-p2')).toBe(1);
    expect(count(2022, 'g3-p5')).toBe(0);
    expect(summary.map((s) => s.papers.length)).toEqual([PYQ_PAPERS.length, PYQ_PAPERS.length]);
  });

  it('starts a full paper with only that paper\'s questions, in original order', async () => {
    const { attempt, questions } = await startPracticeAttempt({
      userId,
      questionCount: 10,
      pyq: { year: 2022, paperId: 'g3-p3' }
    });

    expect(questions.map((q) => q.questionId)).toEqual(['100', '200']);
    expect(attempt.pyq?.year).toBe(2022);
    expect(attempt.pyq?.paperId).toBe('g3-p3');
  });

  it('keeps previous-year and mock questions in subject practice and counts', async () => {
    const { questions } = await startPracticeAttempt({ userId, questionCount: 50, categories: ['Polity'] });
    expect(questions).toHaveLength(9);

    const categories = await getQuestionCategories();
    expect(categories.find((c) => c.name === 'Polity')?.count).toBe(9);
  });

  it('summarises and starts mock tests from MOCK n tags', async () => {
    const mocks = await getMockSummaries();
    expect(mocks).toHaveLength(10);
    expect(mocks.find((m) => m.number === 1)?.count).toBe(2);
    expect(mocks.find((m) => m.number === 2)?.count).toBe(1);

    const { attempt, questions } = await startPracticeAttempt({ userId, questionCount: 10, mock: 1 });
    expect(questions.map((q) => q.questionId)).toEqual(['701', '702']);
    expect(attempt.mock).toBe(1);
  });

  it('rejects an unknown mock', async () => {
    await expect(startPracticeAttempt({ userId, questionCount: 10, mock: 11 })).rejects.toThrow('Unknown mock test.');
  });

  it('rejects an unknown paper', async () => {
    await expect(
      startPracticeAttempt({ userId, questionCount: 10, pyq: { year: 2022, paperId: 'nope' } })
    ).rejects.toThrow('Unknown previous-year paper.');
  });
});
