import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { User } from '../models/User.js';
import { QuestionDraft } from '../models/QuestionDraft.js';
import { signAccessToken } from '../services/tokenService.js';

let mongo: MongoMemoryServer;
let server: Server;
let base = '';
let token = '';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const admin = await User.create({ email: 'a@example.com', name: 'A', passwordHash: 'x', role: 'admin' });
  token = signAccessToken(admin);
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}/api/admin/questions/drafts`;
});

afterAll(async () => {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
});

const call = async (path: string, method: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

describe('draft sets', () => {
  it('assigns a 12-character alphanumeric ID to uploaded drafts without one', async () => {
    const response = await call('', 'POST', {
      questions: [{ content: { questionText: 'Question without an ID' } }],
      setTitle: 'Generated IDs'
    });

    expect(response.status, JSON.stringify(response.json)).toBe(201);
    expect(response.json.data[0].record.id).toMatch(/^[A-Za-z0-9]{12}$/);
    await QuestionDraft.deleteOne({ _id: response.json.data[0].id });
  });

  it('creates, renames and deletes sets', async () => {
    expect((await call('', 'POST', { questions: [{ a: 1 }, { a: 2 }], setTitle: 'One' })).status).toBe(201);
    expect((await call('', 'POST', { questions: [{ a: 3 }], setTitle: 'Two' })).status).toBe(201);
    await QuestionDraft.collection.insertOne({ record: { a: 9 }, createdAt: new Date(), updatedAt: new Date() });

    const rename = await call('/rename-set', 'POST', { from: 'One', to: 'Uno' });
    expect(rename.status, JSON.stringify(rename.json)).toBe(200);
    const del = await call('/delete-set', 'POST', { title: 'Two' });
    expect(del.status, JSON.stringify(del.json)).toBe(200);
    const legacy = await call('/delete-set', 'POST', { title: 'Untitled set' });
    expect(legacy.status, JSON.stringify(legacy.json)).toBe(200);

    const list = await call('', 'GET');
    expect(list.json.data.map((d: any) => d.setTitle)).toEqual(['Uno', 'Uno']);
  });
});
