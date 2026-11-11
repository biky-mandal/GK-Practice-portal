import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';
import { signAccessToken } from '../services/tokenService.js';

let mongo: MongoMemoryServer;
let server: Server;
let base = '';
let token = '';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const admin = await User.create({ email: 'bulk-admin@example.com', name: 'Admin', passwordHash: 'x', role: 'admin' });
  token = signAccessToken(admin);
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}/api/admin/manage/questions/bulk`;
});

afterAll(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

const call = async (body: unknown) => {
  const response = await fetch(base, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  return { status: response.status, json: await response.json() };
};

describe('bulk question metadata updates', () => {
  it('updates selected metadata and leaves omitted fields unchanged', async () => {
    const questions = await Question.create([
      { questionText: 'Question one', categories: ['Geography'], exams: ['ADRE 3.0'], difficulty: 'Easy', tags: ['old'], isActive: true },
      { questionText: 'Question two', categories: ['Economy'], exams: [], difficulty: 'Hard', tags: ['other'], isActive: true }
    ]);

    const response = await call({
      ids: questions.map((question) => String(question._id)),
      updates: { categories: ['Polity'], difficulty: 'Medium', isActive: false, tags: ['ADRE 2024'] }
    });

    expect(response.status, JSON.stringify(response.json)).toBe(200);
    expect(response.json.data.matchedCount).toBe(2);
    const updated = await Question.find({ _id: { $in: questions.map((question) => question._id) } }).sort({ questionText: 1 }).lean();
    expect(updated.map(({ categories, difficulty, isActive, tags, exams }) => ({ categories, difficulty, isActive, tags, exams }))).toEqual([
      { categories: ['Polity'], difficulty: 'Medium', isActive: false, tags: ['ADRE 2024'], exams: ['ADRE 3.0'] },
      { categories: ['Polity'], difficulty: 'Medium', isActive: false, tags: ['ADRE 2024'], exams: [] }
    ]);
    expect(updated.every((question) => question.classification?.tags?.join(',') === 'ADRE 2024')).toBe(true);
  });

  it('rejects unknown categories without changing any questions', async () => {
    const question = await Question.create({ questionText: 'Unchanged question', categories: ['Geography'] });
    const response = await call({ ids: [String(question._id)], updates: { categories: ['Not a category'] } });
    expect(response.status).toBe(400);
    await expect(Question.findById(question._id).lean()).resolves.toMatchObject({ categories: ['Geography'] });
  });
});

describe('admin question pagination', () => {
      const list = async (query: string) => {
        const response = await fetch(`${base.replace(/\/bulk$/, '')}?${query}`, {
          headers: { authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
        return (await response.json()).data;
      };

      it('loads all matching questions beyond the normal 50-question limit', async () => {
        await Question.create(Array.from({ length: 55 }, (_, index) => ({
          questionText: `Pagination fixture ${index}`,
          isActive: index < 52
        })));

        const first = await list('search=Pagination%20fixture&pageSize=50');
        const second = await list('search=Pagination%20fixture&pageSize=50&page=2');
        expect(first.items).toHaveLength(50);
        expect(second.items).toHaveLength(5);
        expect(new Set([...first.items, ...second.items].map((question: { id: string }) => question.id)).size).toBe(55);

        const all = await list('search=Pagination%20fixture&pageSize=all&page=2');
        expect(all.items).toHaveLength(55);
        expect(all).toMatchObject({ page: 1, pageSize: 55, total: 55 });

        const filtered = await list('search=Pagination%20fixture&pageSize=all&status=active');
        expect(filtered.items).toHaveLength(52);
        expect(filtered.total).toBe(52);
      });

      it('honors every numeric page length up to 500 and preserves page offsets', async () => {
        await Question.create(Array.from({ length: 505 }, (_, index) => ({
          questionText: `Extended pagination fixture ${index}`
        })));

        for (const pageSize of [20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]) {
          const first = await list(`search=Extended%20pagination%20fixture&pageSize=${pageSize}`);
          const second = await list(`search=Extended%20pagination%20fixture&pageSize=${pageSize}&page=2`);
          expect(first).toMatchObject({ page: 1, pageSize, total: 505 });
          expect(first.items).toHaveLength(pageSize);
          expect(second).toMatchObject({ page: 2, pageSize, total: 505 });
          expect(second.items).toHaveLength(Math.min(pageSize, 505 - pageSize));
          expect(new Set([...first.items, ...second.items].map((question: { id: string }) => question.id)).size)
            .toBe(first.items.length + second.items.length);
        }

        const capped = await list('search=Extended%20pagination%20fixture&pageSize=1000');
        expect(capped.pageSize).toBe(500);
        expect(capped.items).toHaveLength(500);
      });

      it('returns a valid single empty page for All when nothing matches', async () => {
        const data = await list('search=no-matching-pagination-fixture&pageSize=all');
        expect(data).toMatchObject({ page: 1, pageSize: 1, total: 0, items: [] });
      });
      it('returns localized list text and identifies unavailable translations', async () => {
        await Question.create([
          {
            questionText: 'Language fixture bilingual',
            languages: ['en', 'as'],
            localized: {
              en: { questionText: 'English question', options: ['private option'] },
              as: { questionText: '\u0985\u09b8\u09ae', explanation: 'private explanation' }
            }
          },
          { questionText: 'Language fixture legacy', languages: ['en'] },
          { questionText: 'Language fixture Assamese only', languages: ['as'] }
        ]);
        const data = await list('search=Language%20fixture&pageSize=all');
        expect(data.items).toHaveLength(3);
        const bilingual = data.items.find((question: { questionText: string }) => question.questionText === 'Language fixture bilingual');
        expect(bilingual).toMatchObject({ questionTextEn: 'English question', questionTextAs: '\u0985\u09b8\u09ae' });
        expect(bilingual).not.toHaveProperty('localized');
        expect(data.items.find((question: { questionText: string }) => question.questionText === 'Language fixture legacy'))
          .toMatchObject({ questionTextEn: 'Language fixture legacy', questionTextAs: null });
        expect(data.items.find((question: { questionText: string }) => question.questionText === 'Language fixture Assamese only'))
          .toMatchObject({ questionTextEn: null, questionTextAs: 'Language fixture Assamese only' });
      });
    });
