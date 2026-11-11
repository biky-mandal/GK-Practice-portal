import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { WebSocket, type RawData, type WebSocketServer } from 'ws';
import { app } from '../app.js';
import { attachPracticeSocket } from '../ws/practiceSocket.js';
import { Question } from '../models/Question.js';
import { QuestionExam } from '../models/QuestionExam.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { User } from '../models/User.js';
import { PackPrice } from '../models/PackPrice.js';
import { listQuestionExams, renameQuestionExam } from '../services/questionExamService.js';
import { listPrices, setPrice } from '../services/pricingService.js';
import { assertPackForSale, grantPack, resolveEntitlements } from '../services/entitlementService.js';
import { getMockSummaries, getQuestionCategories, startPracticeAttempt, submitAttempt } from '../services/testService.js';
import { signAccessToken } from '../services/tokenService.js';
import { updateSettings } from '../services/settingsService.js';

let mongo: MongoMemoryServer;
let server: Server;
let wss: WebSocketServer;
let base: string;
let userId: string;
let token: string;
let adminToken: string;
const sockets = new Set<WebSocket>();

const question = (id: string, exams: string[], tags: string[] = []) => ({
  questionId: id, questionText: `Practice ${id}`, options: ['A', 'B', 'C', 'D'],
  correctOption: 0, categories: ['Polity'], languages: ['en'], exams, tags, isActive: true
});

const request = async (path: string, method = 'GET', body?: unknown, auth = token) => {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};

const send = (socket: WebSocket, payload: Record<string, unknown>) => new Promise<Record<string, any>>((resolve, reject) => {
  const timer = setTimeout(() => { socket.off('message', receive); reject(new Error('Socket response timed out')); }, 5000);
  const receive = (raw: RawData) => {
    const message = JSON.parse(raw.toString());
    if (message.type === 'presence.list') return;
    clearTimeout(timer);
    socket.off('message', receive);
    resolve(message);
  };
  socket.on('message', receive);
  socket.send(JSON.stringify(payload));
});

const connect = async () => {
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws/practice');
  sockets.add(socket);
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  expect((await send(socket, { type: 'auth', token })).type).toBe('auth.ok');
  return socket;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([QuestionExam.init(), PackPrice.init(), User.init()]);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  base = `http://127.0.0.1:${address.port}`;
  wss = attachPracticeSocket(server);
  const admin = await User.create({ email: 'police-admin@example.com', passwordHash: 'x', role: 'superadmin' });
  adminToken = signAccessToken(admin);
});

beforeEach(async () => {
  for (const socket of sockets) socket.terminate();
  sockets.clear();
  await Promise.all([Question.deleteMany({}), TestAttempt.deleteMany({}), QuestionExam.deleteMany({}), PackPrice.deleteMany({})]);
  await listQuestionExams();
  const user = await User.create({ email: `learner-${new mongoose.Types.ObjectId()}@example.com`, passwordHash: 'x', role: 'user' });
  userId = String(user._id);
  token = signAccessToken(user);
});

afterAll(async () => {
  for (const socket of sockets) socket.terminate();
  await new Promise<void>((resolve) => wss.close(() => resolve()));
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

describe('Assam Police and Forest packages', () => {
  it('exposes catalog summaries to guests but protects private dashboard and attempts', async () => {
    for (const path of ['/purchases/prices', '/tests/packages', '/tests/categories', '/tests/pyq', '/tests/mocks', '/tests/mocks?exam=police-forest', '/reviews']) {
      const response = await fetch(`${base}/api${path}`);
      expect(response.status, path).toBe(200);
      const json = await response.json();
      expect(JSON.stringify(json)).not.toContain('correctOption');
      if (path === '/tests/packages') expect(json.data.every((pack: { owned: boolean }) => !pack.owned)).toBe(true);
      if (path === '/reviews') expect(Object.values(json.data).every((review) => (review as { mine: unknown }).mine === null)).toBe(true);
    }
    for (const path of ['/dashboard/stats', '/dashboard/recent-attempts', '/tests/daily-free', '/purchases']) {
      expect((await fetch(`${base}/api${path}`)).status, path).toBe(401);
    }
    const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws/practice');
    sockets.add(socket);
    await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    expect(await send(socket, { type: 'session.start', categories: ['Assam Polity'] })).toMatchObject({ type: 'error', code: 'UNAUTHORIZED' });
    expect(await TestAttempt.countDocuments()).toBe(0);
  });

  it('lists only the latest submitted tests for the owner and reopens their answer review', async () => {
    const savedQuestion = await Question.create(question('history', ['ADRE 3.0']));
    const submitted = await TestAttempt.insertMany(Array.from({ length: 12 }, (_, index) => ({
      userId, status: 'submitted', selectedQuestionIds: [savedQuestion._id],
      selectedAnswers: { [String(savedQuestion._id)]: 1 }, correctCount: 0, incorrectCount: 1,
      submittedAt: new Date(Date.UTC(2026, 9, index + 1)), mock: 1
    })));
    await TestAttempt.create({ userId, status: 'in_progress', startedAt: new Date('2027-01-01'), selectedQuestionIds: [savedQuestion._id] });
    const other = await User.create({ email: `other-${new mongoose.Types.ObjectId()}@example.com`, passwordHash: 'x', role: 'user' });
    const foreign = await TestAttempt.create({ userId: other._id, status: 'submitted', submittedAt: new Date('2027-01-01'), selectedQuestionIds: [savedQuestion._id] });

    const history = await request('/dashboard/recent-attempts');
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(10);
    expect(history.body.data.map((item: { id: string }) => item.id)).toEqual(submitted.slice(2).reverse().map((attempt) => String(attempt._id)));
    expect(history.body.data[0]).toMatchObject({ status: 'submitted', mock: 1, totalQuestions: 1 });
    expect((await request(`/tests/${foreign._id}/result`)).status).toBe(404);

    const result = await request(`/tests/${submitted[11]._id}/result`);
    expect(result.body.data.review[0]).toMatchObject({
      questionText: 'Practice history', options: ['A', 'B', 'C', 'D'], selectedAnswer: 1, correctOption: 0, isCorrect: false
    });
    await Question.deleteOne({ _id: savedQuestion._id });
    const missing = await request(`/tests/${submitted[11]._id}/result`);
    expect(missing.body.data).toMatchObject({ totalQuestions: 1, unavailableQuestions: 1, maxMarks: 1, review: [] });
  });

  it('makes the admin-chosen free subject playable without granting other subjects', async () => {
    const free = (id: string, exams: string[]) => ({ ...question(id, exams), categories: ['Assam Polity'] });
    await Question.insertMany([
      ...Array.from({ length: 15 }, (_, index) => free(`a-${index}`, ['ADRE 3.0'])),
      ...Array.from({ length: 15 }, (_, index) => free(`p-${index}`, ['Assam Police and Forest'])),
      question('a-paid', ['ADRE 3.0']),
      question('p-paid', ['Assam Police and Forest'])
    ]);
    try {
      for (const exam of ['adre', 'police-forest']) {
        const listed = (await request(`/tests/categories?exam=${exam}`)).body.data as Array<{ name: string; free: boolean }>;
        expect(listed.find((category) => category.name === 'Assam Polity')?.free).toBe(true);
        expect(listed.find((category) => category.name === 'Polity')?.free).toBe(false);
      }

      const socket = await connect();
      for (const exam of ['adre', 'police-forest']) {
        const started = await send(socket, { type: 'session.start', exam, categories: [' assam polity '], questionCount: 10 });
        expect(started).toMatchObject({ type: 'session.started', totalQuestions: 10 });
        expect(started.questions.every((entry: { correctOption?: number }) => entry.correctOption === undefined)).toBe(true);
        const picked = await Question.find({ _id: { $in: started.questions.map((entry: { id: string }) => entry.id) } }).lean();
        expect(picked.every((entry) => entry.categories?.includes('Assam Polity'))).toBe(true);
        expect((await send(socket, { type: 'session.start', exam, questionCount: 10 })).type).toBe('error');
        expect((await send(socket, { type: 'session.start', exam, categories: ['Polity'] })).type).toBe('error');
        expect((await send(socket, { type: 'session.start', exam, categories: ['Assam Polity', 'Polity'] })).type).toBe('error');
      }

      expect((await request('/admin/manage/settings', 'PUT', { dailyFreeQuestionCount: 10, secondsPerQuestion: 60, freeSubjectCategory: 'Not A Subject' }, adminToken)).status).toBe(400);
      const saved = await request('/admin/manage/settings', 'PUT', { dailyFreeQuestionCount: 10, secondsPerQuestion: 60, freeSubjectCategory: 'polity' }, adminToken);
      expect(saved.body.data.freeSubjectCategory).toBe('Polity');
      expect((await send(socket, { type: 'session.start', categories: ['Polity'] })).type).toBe('session.started');
      expect((await send(socket, { type: 'session.start', categories: ['Assam Polity'] })).type).toBe('error');

      await request('/admin/manage/settings', 'PUT', { dailyFreeQuestionCount: 10, secondsPerQuestion: 60, freeSubjectCategory: '' }, adminToken);
      expect((await send(socket, { type: 'session.start', categories: ['Polity'] })).type).toBe('error');
    } finally {
      await updateSettings({ freeSubjectCategory: 'Assam Polity' });
    }
  });

  it('unlocks only Mock 1 and the first listed PYQ paper for non-purchasers', async () => {
    await Question.insertMany([
      question('mock-one', ['ADRE 3.0'], ['MOCK 1']),
      question('mock-two', ['ADRE 3.0'], ['MOCK 2']),
      question('free-pyq', ['ADRE 3.0'], ['PYQ', 'ADRE 2024', 'GRADE 3', 'PAPER 3', 'HSSLC']),
      question('paid-pyq', ['ADRE 3.0'], ['PYQ', 'ADRE 2022', 'GRADE 3', 'PAPER 3', 'HSSLC']),
      ...Array.from({ length: 100 }, (_, index) => question(`police-${index}`, ['Assam Police and Forest'], ['MOCK 1']))
    ]);
    const socket = await connect();
    for (const exam of ['adre', 'police-forest']) {
      const first = await send(socket, { type: 'session.start', exam, mock: 1 });
      expect(first).toMatchObject({ type: 'session.started', totalQuestions: exam === 'adre' ? 1 : 100 });
      expect((await send(socket, { type: 'session.start', exam, mock: 2 })).type).toBe('error');
      expect((await send(socket, { type: 'session.start', exam, mock: 2, categories: ['Assam Polity'] })).type).toBe('error');
    }
    expect((await send(socket, { type: 'session.start', pyq: { year: 2024, paper: 'g3-p3' } })).type).toBe('session.started');
    expect((await send(socket, { type: 'session.start', pyq: { year: 2022, paper: 'g3-p3' } })).type).toBe('error');
    expect((await send(socket, { type: 'session.start', pyq: { year: 2024, paper: 'g3-p4' } })).type).toBe('error');
  });

  it('adds defaults to existing registries and keeps renamed and deleted exam entries', async () => {
    await QuestionExam.deleteMany({});
    await QuestionExam.create({ name: 'ADRE 3.0', aliases: ['adre'] });
    const exams = await listQuestionExams();
    const police = exams.find((exam) => exam.name === 'Assam Police and Forest')!;
    await renameQuestionExam(String(police._id), 'Police Written Practice');
    await Question.create(question('police', ['Police Written Practice']));
    expect((await startPracticeAttempt({ userId, exam: 'police-forest', questionCount: 10 })).questions).toHaveLength(1);
    await QuestionExam.updateOne({ _id: police._id }, { isDeleted: true });
    expect((await listQuestionExams()).map((exam) => exam.name)).toEqual(['ADRE 3.0']);
    expect((await startPracticeAttempt({ userId, exam: 'police-forest', questionCount: 10 })).questions).toHaveLength(0);
  });

  it('lists two editable prices and keeps entitlements independent and grants idempotent', async () => {
    const prices = await listPrices();
    expect(prices.filter((price) => price.pack.startsWith('police-')).map((price) => price.price)).toEqual([499, 399]);
    await grantPack(userId, 'police-subject', 499);
    await grantPack(userId, 'police-subject', 499);
    const user = await User.findById(userId).lean();
    expect(resolveEntitlements(user).packs).toEqual(['police-subject']);
    expect(user?.purchases).toHaveLength(1);
    await setPrice('police-mock', { price: 250, enabled: false });
    await expect(assertPackForSale('police-mock')).rejects.toThrow('not currently on sale');
    const adminPrices = await request('/admin/manage/pricing', 'GET', undefined, adminToken);
    expect(adminPrices.status).toBe(200);
    expect(adminPrices.body.data).toHaveLength(5);
  });

  it('uses the checkout route for a free admin-priced pack and rejects disabled purchases', async () => {
    await listPrices();
    await setPrice('police-subject', { price: 0 });
    const result = await request('/purchases/order', 'POST', { pack: 'police-subject' });
    expect(result.status).toBe(201);
    expect(result.body.data.entitlements.packs).toEqual(['police-subject']);
    expect((await request('/purchases/order', 'POST', { pack: 'police-subject' })).status).toBe(409);
    await setPrice('police-mock', { enabled: false });
    expect((await request('/purchases/order', 'POST', { pack: 'police-mock' })).status).toBe(409);
  });

  it('supports admin grants and package-specific reviews', async () => {
    expect((await request(`/admin/manage/users/${userId}/purchases`, 'POST', { pack: 'police-mock', amount: 399 }, adminToken)).status).toBe(201);
    expect((await request('/reviews/police-mock', 'PUT', { rating: 5, comment: 'Useful practice.' })).status).toBe(200);
    expect((await request('/reviews/police-subject', 'PUT', { rating: 5, comment: '' })).status).toBe(403);
  });

  it('isolates category counts, subject samples and identically numbered mocks', async () => {
    await Question.insertMany([
      question('adre', ['ADRE 3.0'], ['MOCK 1']),
      question('legacy', []),
      question('police', ['Assam Police and Forest'], ['MOCK 1']),
      question('both', ['Assam Police and Forest', 'ADRE 3.0']),
      question('other', ['APSC'])
    ]);
    const police = await startPracticeAttempt({ userId, questionCount: 50, exam: 'police-forest', categories: ['Polity'] });
    expect(police.questions.map((q) => q.questionId).sort()).toEqual(['both', 'police']);
    expect(police.attempt.pack).toBe('police-subject');
    const adre = await startPracticeAttempt({ userId, questionCount: 50 });
    expect(adre.questions.map((q) => q.questionId).sort()).toEqual(['adre', 'both', 'legacy']);
    expect((await getQuestionCategories('police-forest')).find((category) => category.name === 'Polity')?.count).toBe(2);
    expect((await getMockSummaries('police-forest'))[0].count).toBe(1);
    expect((await getMockSummaries())[0].count).toBe(1);
    expect((await request('/tests/categories?exam=unknown')).status).toBe(400);
  });

  it('requires exactly 100 active questions before starting a Constable mock', async () => {
    await Question.insertMany(Array.from({ length: 99 }, (_, index) => question(String(index), ['Assam Police and Forest'], ['MOCK 1'])));
    await expect(startPracticeAttempt({ userId, questionCount: 10, mock: 1, exam: 'police-forest' })).rejects.toThrow('Exactly 100');
    expect(await TestAttempt.countDocuments()).toBe(0);
    await Question.insertMany([question('100', ['Assam Police and Forest'], ['MOCK 1']), question('101', ['Assam Police and Forest'], ['MOCK 1'])]);
    await expect(startPracticeAttempt({ userId, questionCount: 10, mock: 1, exam: 'police-forest' })).rejects.toThrow('Exactly 100');
  });

  it('enforces separate ownership over WebSocket and surfaces incomplete paper errors', async () => {
    await grantPack(userId, 'subject', 499);
    await grantPack(userId, 'mock', 399);
    const socket = await connect();
    expect((await send(socket, { type: 'session.start', exam: 'police-forest', questionCount: 10 })).type).toBe('error');
    expect((await send(socket, { type: 'session.start', exam: 'police-forest', mock: 1 })).type).toBe('error');
    await grantPack(userId, 'police-mock', 399);
    await Question.create(question('active', ['ADRE 3.0']));
    const active = await startPracticeAttempt({ userId, questionCount: 10 });
    const incomplete = await send(socket, { type: 'session.start', exam: 'police-forest', mock: 1 });
    expect(incomplete).toMatchObject({ type: 'error', code: 'REJECTED' });
    expect(incomplete.message).toContain('Exactly 100');
    expect((await TestAttempt.findById(active.attempt._id))?.status).toBe('in_progress');
    expect((await send(socket, { type: 'session.start', exam: 'police-forest', daily: true })).type).toBe('error');
  });

  it('starts, resumes and scores the full mock with the practice timer and correct maximum', async () => {
    await Question.insertMany(Array.from({ length: 100 }, (_, index) => question(String(index).padStart(3, '0'), ['Assam Police and Forest'], ['MOCK 1'])));
    const socket = await connect();
    const started = await send(socket, { type: 'session.start', exam: 'police-forest', mock: 1 });
    expect(started).toMatchObject({ type: 'session.started', pack: 'police-mock', totalQuestions: 100, timer: { totalSeconds: 5400 } });
    expect(started.questions[0].correctOption).toBeUndefined();
    await send(socket, { type: 'answer.submit', attemptId: started.attemptId, questionId: started.questions[0].id, selectedAnswer: 0 });
    await send(socket, { type: 'answer.submit', attemptId: started.attemptId, questionId: started.questions[1].id, selectedAnswer: 1 });
    await send(socket, { type: 'session.pause' });
    const resumed = await send(socket, { type: 'session.resume', attemptId: started.attemptId });
    expect(resumed.pack).toBe('police-mock');
    expect(resumed.answers[started.questions[0].id]).toBe(0);
    const completed = await send(socket, { type: 'session.finish', attemptId: started.attemptId });
    expect(completed).toMatchObject({ type: 'session.completed', score: 0.5, percentage: 1, correctCount: 1, incorrectCount: 1, unansweredCount: 98 });
    const result = await request(`/tests/${started.attemptId}/result`);
    expect(result.body.data).toMatchObject({ score: 0.5, maxMarks: 50, totalQuestions: 100 });
  });

  it('preserves one-mark scoring for subject practice and ADRE mocks', async () => {
    await Question.create(question('adre', ['ADRE 3.0'], ['MOCK 1']));
    const { attempt, questions } = await startPracticeAttempt({ userId, questionCount: 10, mock: 1 });
    attempt.selectedAnswers = { [String(questions[0]._id)]: 0 };
    await attempt.save();
    expect((await submitAttempt(String(attempt._id), userId)).result).toMatchObject({ score: 1, percentage: 100 });
  });
});
