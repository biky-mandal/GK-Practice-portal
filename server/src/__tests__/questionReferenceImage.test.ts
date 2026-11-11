import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Category } from '../models/Category.js';
import { Question } from '../models/Question.js';
import { QuestionDraft } from '../models/QuestionDraft.js';
import { User } from '../models/User.js';
import { referenceImageSchema } from '../models/referenceImage.js';
import { normalizeQuestionImport } from '../services/questionService.js';
import { signAccessToken } from '../services/tokenService.js';
import { refreshCategories } from '../services/categoryService.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const replacement = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 224, 0, 16]).toString('base64')}`;
const record = {
  id: 'REFERENCE-Q1',
  content: { questionText: 'Which place is shown?', options: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Second' }] },
  answerKey: { correctOptionIds: ['A'] },
  classification: { subjects: ['History'], difficulty: 'Easy' }
};

let mongo: MongoMemoryServer | undefined;
let server: Server | undefined;
let base: string;
let token: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
  await mongoose.connect(mongo.getUri());
  const admin = await User.create({ email: 'image-admin@example.com', name: 'Admin', passwordHash: 'x', role: 'superadmin' });
  token = signAccessToken(admin);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}/api/admin`;
}, 120000);

beforeEach(async () => {
  await Question.deleteMany({});
  await QuestionDraft.deleteMany({});
  await Category.deleteMany({});
  await Category.create({ name: 'History' });
  await refreshCategories();
});

afterAll(async () => {
  const runningServer = server;
  if (runningServer) await new Promise<void>((resolve, reject) => runningServer.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

const call = async (path: string, method = 'GET', body?: unknown) => {
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
};

describe('Question reference images', () => {
  it('keeps images optional and preserves them through normalization', () => {
    expect(normalizeQuestionImport(record)).not.toHaveProperty('referenceImage');
    expect(normalizeQuestionImport({ ...record, referenceImage: image }).referenceImage).toBe(image);
    expect(normalizeQuestionImport({ ...record, referenceImage: null }).referenceImage).toBeNull();
  });

  it.each([
    '', 'https://example.com/image.png', 'data:image/svg+xml;base64,PHN2Zy8+',
    'data:image/png;base64,bm90IGFuIGltYWdl',
    `data:image/png;base64,${Buffer.alloc(512 * 1024 + 1).toString('base64')}`,
    123
  ])('rejects invalid, unsupported and oversized image input (%#)', (value) => {
    expect(referenceImageSchema.safeParse(value).success).toBe(false);
    expect(() => normalizeQuestionImport({ ...record, referenceImage: value })).toThrow('Reference image must be');
  });

  it('accepts the exact 512 KB limit and checks WebP signatures', () => {
    const bytes = Buffer.alloc(512 * 1024);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    expect(referenceImageSchema.safeParse(`data:image/png;base64,${bytes.toString('base64')}`).success).toBe(true);
    expect(referenceImageSchema.safeParse(`data:image/webp;base64,${Buffer.from('RIFFxxxxWEBP').toString('base64')}`).success).toBe(true);
    expect(referenceImageSchema.safeParse(replacement).success).toBe(true);
  });

  it('persists an image from draft review through publishing and admin retrieval', async () => {
    const created = await call('/questions/drafts', 'POST', { questions: [record], setTitle: 'Images' });
    expect(created.status).toBe(201);
    const id = created.json.data[0].id;
    const edited = await call(`/questions/drafts/${id}`, 'PUT', { record: { ...record, referenceImage: image } });
    expect(edited.status).toBe(200);
    expect((await call('/questions/drafts')).json.data[0].record.referenceImage).toBe(image);
    const published = await call('/questions/drafts/publish', 'POST', { ids: [id] });
    expect(published.status, JSON.stringify(published.json)).toBe(200);
    expect(published.json.data.created).toBe(1);
    const question = await Question.findOne({ questionId: record.id }).orFail();
    expect(question.referenceImage).toBe(image);
    expect((await call(`/manage/questions/${question.id}`)).json.data.referenceImage).toBe(image);
  });

  it('creates a question with an image and allows replacing, keeping and removing it when editing', async () => {
    const created = await call('/questions', 'POST', { ...record, referenceImage: image });
    expect(created.status, JSON.stringify(created.json)).toBe(201);
    expect(created.json.data.referenceImage).toBe(image);
    const id = created.json.data.id;
    const update = {
      localized: { en: { questionText: 'Edited question', options: ['First', 'Second'] } },
      correctOption: 1, categories: ['History'], exams: [], difficulty: 'Easy', isActive: true
    };
    expect((await call(`/manage/questions/${id}`, 'PUT', { ...update, referenceImage: replacement })).status).toBe(200);
    expect((await call(`/manage/questions/${id}`)).json.data.referenceImage).toBe(replacement);
    expect((await call(`/manage/questions/${id}`, 'PUT', update)).status).toBe(200);
    expect((await call(`/manage/questions/${id}`)).json.data.referenceImage).toBe(replacement);
    expect((await call(`/manage/questions/${id}`, 'PUT', { ...update, referenceImage: null })).status).toBe(200);
    expect((await call(`/manage/questions/${id}`)).json.data.referenceImage).toBeNull();
  });

  it.each([false, true])('returns images for regular simulation with %s exact-question selection, but not portrait simulation', async (selectExact) => {
    const docs = await Question.create([
      { ...normalizeQuestionImport(record), referenceImage: image, isActive: true },
      { ...normalizeQuestionImport({ ...record, id: 'NO-IMAGE' }), isActive: true }
    ]);
    const payload = {
      category: 'History', count: 2, language: 'both',
      ...(selectExact ? { questionIds: docs.map((doc) => String(doc._id)) } : {})
    };
    const regular = await call('/manage/simulation', 'POST', { ...payload, mode: 'landscape' });
    expect(regular.status, JSON.stringify(regular.json)).toBe(200);
    expect(regular.json.data.items.find((item: { questionId: string }) => item.questionId === record.id).referenceImage).toBe(image);
    expect(regular.json.data.items.find((item: { questionId: string }) => item.questionId === 'NO-IMAGE').referenceImage).toBeNull();
    const portrait = await call('/manage/simulation', 'POST', { ...payload, mode: 'portrait' });
    expect(portrait.status).toBe(200);
    expect(portrait.json.data.items.every((item: object) => !('referenceImage' in item))).toBe(true);
  });

  it('rejects invalid images before saving drafts, creating or editing questions', async () => {
    const badImage = 'data:image/png;base64,bm90LWEtcG5n';
    expect((await call('/questions/drafts', 'POST', { questions: [{ ...record, referenceImage: badImage }], setTitle: 'Bad' })).status).toBe(400);
    expect((await call('/questions', 'POST', { ...record, referenceImage: badImage })).status).toBe(400);
    const draft = await QuestionDraft.create({ record, setTitle: 'Valid' });
    expect((await call(`/questions/drafts/${draft.id}`, 'PUT', { record: { ...record, referenceImage: badImage } })).status).toBe(400);
    expect((await QuestionDraft.findById(draft.id).orFail()).record.referenceImage).toBeUndefined();
    const question = await Question.create({ questionText: 'Original', options: ['A', 'B'], referenceImage: image });
    const update = { localized: { en: { questionText: 'Edited', options: ['A', 'B'] } }, correctOption: 0, categories: [], exams: [], difficulty: 'Easy', isActive: true, referenceImage: badImage };
    expect((await call(`/manage/questions/${question.id}`, 'PUT', update)).status).toBe(400);
    expect((await call(`/questions/${question.id}`, 'PATCH', { referenceImage: badImage })).status).toBe(400);
    expect((await Question.findById(question.id).orFail()).referenceImage).toBe(image);
  });
});
