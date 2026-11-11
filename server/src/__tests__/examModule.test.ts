import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Question } from '../models/Question.js';
import { Exam } from '../models/Exam.js';
import { serializeQuestionPractice, validateQuestionPayload } from '../services/questionService.js';
import { createExamRecord, startExamAttempt } from '../services/examService.js';

describe('Exam module integrity', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('keeps answer keys out of public practice serialization', async () => {
    const question = await Question.create({
      questionId: 'test-q-1',
      questionText: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      category: 'General Knowledge',
      subject: 'Mathematics',
      topic: 'Arithmetic',
      answerKey: { correctOptionIds: ['opt-2'] },
      questionFormat: { type: 'single_correct', answerMode: 'single_select' },
      workflow: { status: 'published', reviewStatus: 'accepted' }
    });

    const publicView = serializeQuestionPractice(question);
    expect(publicView.content).toBeTruthy();
    expect(publicView).not.toHaveProperty('answerKey');
    expect(publicView).not.toHaveProperty('correctOption');
  });

  it('validates single-correct question structure', () => {
    expect(() => validateQuestionPayload({
      questionFormat: { type: 'single_correct' },
      answerKey: { correctOptionIds: ['opt-1', 'opt-2'] }
    })).toThrow();

    expect(() => validateQuestionPayload({
      questionFormat: { type: 'single_correct' },
      answerKey: { correctOptionIds: ['opt-1'] }
    })).not.toThrow();
  });

  it('creates an exam and starts an attempt for it', async () => {
    await Question.deleteMany({});
    await Exam.deleteMany({});

    const q1 = await Question.create({
      questionId: 'question-a',
      questionText: 'Capital of India?',
      options: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'],
      category: 'General Knowledge',
      subject: 'Geography',
      topic: 'India',
      answerKey: { correctOptionIds: ['opt-1'] },
      questionFormat: { type: 'single_correct', answerMode: 'single_select' },
      workflow: { status: 'published', reviewStatus: 'accepted' }
    });

    const exam = await createExamRecord({
      examId: 'exam-1',
      title: 'Indian Polity Mock',
      totalDurationMinutes: 30,
      totalMarks: 10,
      questionCount: 1,
      questionIds: [String(q1._id)],
      published: true
    }, 'admin-user');

    const result = await startExamAttempt({ userId: new mongoose.Types.ObjectId().toString(), examId: exam.examId });
    expect(result.attempt.status).toBe('in_progress');
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
