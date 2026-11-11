import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { config } from '../config/env.js';
import { Question } from '../models/Question.js';
import { QuestionVerification } from '../models/QuestionVerification.js';
import { User } from '../models/User.js';
import { signAccessToken } from '../services/tokenService.js';
import { verificationInputSchema, verifyQuestion } from '../services/questionVerificationService.js';

const nativeFetch = globalThis.fetch;
const originalKey = config.OPENAI_API_KEY;
const input = { language: 'en' as const, questionText: 'Which option is correct?', options: ['First', 'Second'], correctOption: 0, asOfDate: '' };
const sources = [
  { title: 'Primary source', url: 'https://primary.example/fact', evidence: 'The primary record supports the second option.' },
  { title: 'Independent reference', url: 'https://reference.example/fact', evidence: 'The independent reference also supports the second option.' }
];
const assessment = { verdict: 'likely_incorrect', suggestedOption: 1, explanation: 'Two references support the second option.', sources };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const research = (urls = sources.map((source) => source.url)) => ({
  status: 'completed',
  output: [
    { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: urls.map((url) => ({ type: 'url', url })) } },
    { type: 'message', content: [{ type: 'output_text', text: 'Research supporting option 1, with source evidence.', annotations: [] }] }
  ]
});
const extraction = (value: unknown = assessment) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }]
});

let mongo: MongoMemoryServer;
let server: Server;
let base = '';
let token = '';
let questionId = '';
let responses: Response[] = [];
let requests: Array<Record<string, unknown>> = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  base = `http://127.0.0.1:${address.port}/api/admin/manage/questions`;
});

beforeEach(async () => {
  config.OPENAI_API_KEY = 'test-key-not-real';
  responses = [];
  requests = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).startsWith(base)) return nativeFetch(url, init);
    if (String(url) !== 'https://api.openai.com/v1/responses') throw new Error('Unexpected external request in test');
    requests.push(JSON.parse(String(init?.body)));
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider request');
    return response;
  });
  const admin = await User.create({ email: `${new mongoose.Types.ObjectId()}@example.com`, name: 'Admin', passwordHash: 'x', role: 'admin' });
  token = signAccessToken(admin);
  const question = await Question.create({ questionText: input.questionText, options: input.options, correctOption: 0 });
  questionId = String(question._id);
});

afterEach(() => {
  config.OPENAI_API_KEY = originalKey;
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

const call = async (method = 'GET', body?: unknown, auth = token, id = questionId) => {
  const response = await fetch(`${base}/${id}/verification`, {
    method,
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() };
};

describe('grounded question verification', () => {
  it('forces web research, validates the extracted assessment and disables provider storage', async () => {
    responses.push(json(research()), json(extraction()));
    const result = await verifyQuestion(input);
    expect(result).toMatchObject(assessment);
    expect(result.model).toBe(config.OPENAI_VERIFICATION_MODEL);
    expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      store: false, tools: [{ type: 'web_search' }], tool_choice: 'required',
      include: ['web_search_call.action.sources']
    });
    expect(requests[1]).toMatchObject({ store: false, text: { format: { type: 'json_schema', strict: true } } });
  });

  it('supports a consistent confirmation of the currently selected answer', async () => {
    responses.push(json(research()), json(extraction({ ...assessment, verdict: 'supported', suggestedOption: 0 })));
    await expect(verifyQuestion(input)).resolves.toMatchObject({ verdict: 'supported', suggestedOption: 0 });
  });

  it('retains an explicitly inconclusive assessment without suggesting an answer', async () => {
    responses.push(json(research()), json(extraction({ ...assessment, verdict: 'inconclusive', suggestedOption: null })));
    await expect(verifyQuestion(input)).resolves.toMatchObject({ verdict: 'inconclusive', suggestedOption: null });
  });

  it('downgrades fabricated source URLs and never exposes them as evidence', async () => {
    responses.push(json(research([sources[0].url])), json(extraction()));
    const result = await verifyQuestion(input);
    expect(result.verdict).toBe('inconclusive');
    expect(result.suggestedOption).toBeNull();
    expect(result.sources).toEqual([sources[0]]);
  });

  it('does not count two pages on the same host as independent sources', async () => {
    const sameHostSources = [sources[0], { ...sources[1], url: 'https://primary.example/other-page' }];
    responses.push(json(research(sameHostSources.map((source) => source.url))), json(extraction({ ...assessment, sources: sameHostSources })));
    await expect(verifyQuestion(input)).resolves.toMatchObject({ verdict: 'inconclusive', suggestedOption: null });
  });

  it('accepts native citation URLs when search sources are not present', async () => {
    responses.push(json({
      status: 'completed',
      output: [
        { type: 'web_search_call', status: 'completed' },
        { type: 'message', content: [{ type: 'output_text', text: 'Research', annotations: sources.map((source) => ({ type: 'url_citation', url: source.url })) }] }
      ]
    }), json(extraction()));
    await expect(verifyQuestion(input)).resolves.toMatchObject({ verdict: 'likely_incorrect', sources });
  });

  it('downgrades an internally inconsistent verdict', async () => {
    responses.push(json(research()), json(extraction({ ...assessment, verdict: 'supported', suggestedOption: 1 })));
    await expect(verifyQuestion(input)).resolves.toMatchObject({ verdict: 'inconclusive', suggestedOption: null });
  });

  it('rejects out-of-range suggested answers instead of returning a correction', async () => {
    responses.push(json(research()), json(extraction({ ...assessment, suggestedOption: 5 })));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('rejects unsafe evidence links', async () => {
    responses.push(json(research()), json(extraction({ ...assessment, sources: [{ ...sources[0], url: 'javascript:alert(1)' }] })));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('fails if the provider answers without searching', async () => {
    responses.push(json(extraction()));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 502 });
    expect(requests).toHaveLength(1);
  });

  it.each([401, 403, 429, 500])('surfaces provider status %i explicitly', async (status) => {
    responses.push(json({ error: 'Do not expose provider details' }, status));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: status === 500 ? 502 : 503 });
  });

  it('rejects incomplete or refused provider responses', async () => {
    responses.push(json({ ...research(), status: 'incomplete' }));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 502 });
    responses.push(json(research()), json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 502 });
  });

  it('surfaces connection failures without pretending verification succeeded', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'));
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 504 });
  });

  it('requires a server API key before making any provider request', async () => {
    config.OPENAI_API_KEY = '';
    await expect(verifyQuestion(input)).rejects.toMatchObject({ statusCode: 503 });
    expect(requests).toHaveLength(0);
  });

  it.each([
    { ...input, correctOption: 2 },
    { ...input, options: ['only one'] },
    { ...input, options: ['', 'Second'] },
    { ...input, asOfDate: '2024-02-30' },
    { ...input, asOfDate: 'not-a-date' },
    { ...input, questionText: '' }
  ])('validates question input %#', (invalid) => {
    expect(verificationInputSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('admin verification endpoint and persistence', () => {
  it('requires admin authentication and does not call the provider for students', async () => {
    expect((await call('POST', input, '')).status).toBe(401);
    const user = await User.create({ email: 'verification-student@example.com', name: 'Student', passwordHash: 'x', role: 'user' });
    expect((await call('POST', input, signAccessToken(user))).status).toBe(403);
    expect(requests).toHaveLength(0);
  });

  it('shows configuration status without exposing the API key', async () => {
    config.OPENAI_API_KEY = '';
    expect((await call()).body.data).toEqual({ configured: false, report: null });
    expect((await call('POST', input)).status).toBe(503);
    expect(requests).toHaveLength(0);
  });

  it('saves the exact normalized editor snapshot and reloads it without another paid call', async () => {
    const datedInput = { ...input, language: 'as', asOfDate: '2024-08-01', questionText: '  Unsaved editor text  ' };
    responses.push(json(research()), json(extraction()));
    const response = await call('POST', datedInput);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data.input).toEqual({ ...datedInput, questionText: 'Unsaved editor text' });
    const loaded = await call();
    expect(loaded.body.data.report).toEqual(response.body.data);
    expect(requests).toHaveLength(2);
    await expect(Question.findById(questionId).lean()).resolves.toMatchObject({ questionText: input.questionText, correctOption: 0 });
    expect(await QuestionVerification.countDocuments({ questionId })).toBe(1);
  });

  it('does not overwrite a successful report or change the answer when a recheck fails', async () => {
    responses.push(json(research()), json(extraction()));
    await call('POST', input);
    const saved = (await call()).body.data.report;
    responses.push(json({}, 429));
    expect((await call('POST', input)).status).toBe(503);
    expect((await call()).body.data.report).toEqual(saved);
    await expect(Question.findById(questionId).lean()).resolves.toMatchObject({ correctOption: 0 });
  });

  it('rejects invalid requests and missing questions before calling the provider', async () => {
    expect((await call('POST', { ...input, correctOption: -1 })).status).toBe(400);
    expect((await call('POST', input, token, 'invalid')).status).toBe(400);
    expect((await call('POST', input, token, String(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect(requests).toHaveLength(0);
  });

  it('limits paid requests per admin while allowing saved-report reads', async () => {
    config.OPENAI_API_KEY = '';
    for (let count = 0; count < 6; count++) expect((await call('POST', input)).status).toBe(503);
    expect((await call('POST', input)).status).toBe(429);
    expect((await call()).status).toBe(200);
    expect(requests).toHaveLength(0);
  });
});
