import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { QuestionDraft } from '../models/QuestionDraft.js';
import { QuestionExam } from '../models/QuestionExam.js';
import { normalizeExams } from '../models/questionExams.js';
import { listQuestionExams } from '../services/questionExamService.js';
import { normalizeQuestionImport } from '../services/questionService.js';
import { signAccessToken } from '../services/tokenService.js';

let mongo: MongoMemoryServer;
let server: Server;
let base = '';
let token = '';
let learnerToken = '';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await QuestionExam.init();
  const admin = await User.create({ email: 'exam-admin@example.com', name: 'Admin', passwordHash: 'x', role: 'admin' });
  const learner = await User.create({ email: 'exam-learner@example.com', name: 'Learner', passwordHash: 'x', role: 'user' });
  token = signAccessToken(admin);
  learnerToken = signAccessToken(learner);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}/api/admin/manage`;
});

beforeEach(async () => {
  await Question.deleteMany({});
  await QuestionDraft.deleteMany({});
  await QuestionExam.deleteMany({});
  await listQuestionExams();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

const call = async (path: string, method = 'GET', body?: unknown, authToken = token) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${authToken}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
};

describe('question exam management', () => {
  it('seeds the default, adds custom exams, and rejects duplicate or invalid names', async () => {
    const initial = await call('/exams');
    expect(initial.status).toBe(200);
    expect(initial.json.data).toHaveLength(2);
    expect(initial.json.data[0]).toMatchObject({ name: 'ADRE 3.0', count: 0 });
    expect((await call('/exams', 'POST', { name: '  APSC  ' })).status).toBe(201);
    expect((await call('/exams', 'POST', { name: 'apsc' })).status).toBe(409);
    expect((await call('/exams', 'POST', { name: '' })).status).toBe(400);
    expect(normalizeExams('APSC', 'adre')).toEqual(['APSC', 'ADRE 3.0']);
    expect(normalizeQuestionImport({ classification: { exams: ['APSC'] } }))
      .toMatchObject({ exams: ['APSC'], classification: { exam: ['APSC'] } });
  });

  it('renames and deletes assignments in questions and saved drafts without reseeding', async () => {
    const initial = await call('/exams');
    const id = initial.json.data[0].id;
    const question = await Question.create({
      questionText: 'Exam assignment', exams: ['ADRE 3.0'], classification: { exam: ['ADRE 3.0'] }
    });
    const draft = await QuestionDraft.create({
      record: {
        exams: ['ADRE 3.0'], classification: { exams: ['ADRE 3.0'], examCategories: ['ADRE 3.0'] },
        examCompatibility: { eligibleExamIds: ['ADRE 3.0'] }
      }
    });
    expect((await call(`/exams/${id}`, 'PUT', { name: 'ADRE 4.0' })).status).toBe(200);
    expect(await Question.findById(question._id).lean())
      .toMatchObject({ exams: ['ADRE 4.0'], classification: { exam: ['ADRE 4.0'] } });
    expect(await QuestionDraft.findById(draft._id).lean())
      .toMatchObject({ record: { exams: ['ADRE 4.0'], classification: { exams: ['ADRE 4.0'], examCategories: ['ADRE 4.0'] } } });
    expect(normalizeExams('ADRE 3.0', 'adre')).toEqual(['ADRE 4.0']);
    expect((await call('/exams')).json.data[0]).toMatchObject({ name: 'ADRE 4.0', count: 1 });
    expect((await call(`/exams/${id}`, 'DELETE')).status).toBe(200);
    const policeId = initial.json.data.find((exam: { name: string }) => exam.name === 'Assam Police and Forest').id;
    expect((await call(`/exams/${policeId}`, 'DELETE')).status).toBe(200);
    expect(await Question.findById(question._id).lean()).toMatchObject({ exams: [], classification: { exam: [] } });
    expect(await QuestionDraft.findById(draft._id).lean()).toMatchObject({ record: { exams: [], classification: { exams: [], examCategories: [] } } });
    expect((await call('/exams')).json.data).toEqual([]);
    expect((await call('/exams')).json.data).toEqual([]);
    expect(normalizeExams('ADRE 3.0', 'adre')).toEqual([]);
    expect((await call('/exams', 'POST', { name: 'ADRE 4.0' })).status).toBe(201);
  });

  it('accepts custom exams in bulk and individual question updates and filters', async () => {
    await call('/exams', 'POST', { name: 'APSC' });
    const question = await Question.create({ questionText: 'Editable question', exams: [] });
    const id = String(question._id);
    expect((await call('/questions/bulk', 'PATCH', { ids: [id], updates: { exams: ['APSC'] } })).status).toBe(200);
    expect((await call('/questions?exam=APSC')).json.data.total).toBe(1);
    expect((await call(`/questions/${id}`, 'PUT', {
      localized: { en: { questionText: 'Editable question', options: ['A', 'B'] } },
      correctOption: 0, categories: [], exams: ['APSC'], difficulty: 'Easy', isActive: true
    })).status).toBe(200);
    expect((await call('/questions/bulk', 'PATCH', { ids: [id], updates: { exams: ['Unknown'] } })).status).toBe(400);
    expect(await Question.findById(id).lean()).toMatchObject({ exams: ['APSC'], classification: { exam: ['APSC'] } });
  });

  it('restricts exam management to admins', async () => {
    expect((await call('/exams', 'GET', undefined, learnerToken)).status).toBe(403);
    expect((await call('/exams', 'POST', { name: 'APSC' }, learnerToken)).status).toBe(403);
    expect((await call(`/exams/${new mongoose.Types.ObjectId()}`, 'PUT', { name: 'Missing' })).status).toBe(404);
  });
});
