import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { splitTranslationText, TranslationService } from '../services/translationService.js';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
});
const google = (...texts: string[]) => response({ data: { translations: texts.map((translatedText) => ({ translatedText })) } });
const memory = (translatedText = 'অসমৰ ৰাজধানী কি?') => response({
  responseStatus: 200, quotaFinished: false, responseData: { translatedText }
});
const quota = (reason = 'userRateLimitExceeded', status = 403) => response({
  error: { code: status, message: 'User Rate Limit Exceeded', errors: [{ reason }] }
}, status);

let service: TranslationService;
let http: ReturnType<typeof vi.fn<typeof fetch>>;
const originalKey = config.GOOGLE_TRANSLATE_API_KEY;
const originalCooldown = config.TRANSLATION_GOOGLE_COOLDOWN_SECONDS;

beforeEach(() => {
  config.GOOGLE_TRANSLATE_API_KEY = 'test-key-not-a-real-credential';
  config.TRANSLATION_GOOGLE_COOLDOWN_SECONDS = 300;
  service = new TranslationService();
  http = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', http);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  config.GOOGLE_TRANSLATE_API_KEY = originalKey;
  config.TRANSLATION_GOOGLE_COOLDOWN_SECONDS = originalCooldown;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('English to Assamese provider orchestration', () => {
  it('uses Google in one batch, preserves order, duplicates and blank strings, and decodes entities', async () => {
    http.mockResolvedValueOnce(google('প্ৰথম &amp; &#x9AC;', 'দ্বিতীয়'));
    expect(await service.translate(['first', '', 'second', 'first', ' \n'])).toEqual([
      'প্ৰথম & ব', '', 'দ্বিতীয়', 'প্ৰথম & ব', ' \n'
    ]);
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0];
    expect(String(url)).not.toContain('key=');
    expect(JSON.parse(String(init?.body))).toEqual({ q: ['first', 'second'], source: 'en', target: 'as', format: 'text' });
  });

  it.each(['userRateLimitExceeded', 'rateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded'])(
    'falls back without retry for Google quota reason %s', async (reason) => {
      http.mockResolvedValueOnce(quota(reason)).mockResolvedValueOnce(memory());
      expect(await service.translate(['What is the capital of Assam?'])).toEqual(['অসমৰ ৰাজধানী কি?']);
      expect(http).toHaveBeenCalledTimes(2);
      expect(new URL(String(http.mock.calls[1][0])).searchParams.get('langpair')).toBe('en|as');
    }
  );

  it('falls back for HTTP 429 even when the error body is not JSON', async () => {
    http.mockResolvedValueOnce(new Response('Too many requests', { status: 429 })).mockResolvedValueOnce(memory());
    await expect(service.translate(['question'])).resolves.toEqual(['অসমৰ ৰাজধানী কি?']);
    expect(http).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 400])('does not retry or fall back on permanent Google HTTP %s', async (status) => {
    http.mockResolvedValueOnce(response({
      error: { status: 'PERMISSION_DENIED', message: 'API is not enabled', errors: [{ reason: 'accessNotConfigured' }] }
    }, status));
    await expect(service.translate(['question'])).rejects.toMatchObject({
      statusCode: 503, message: 'Translation is not configured correctly. Contact the site administrator.'
    });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('retries network failures with bounded exponential backoff then uses the fallback', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const times: number[] = [];
    http.mockImplementation(async () => {
      times.push(Date.now());
      if (times.length <= 3) throw new DOMException('timeout', 'TimeoutError');
      return memory();
    });
    const result = service.translate(['question']);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toEqual(['অসমৰ ৰাজধানী কি?']);
    expect(http).toHaveBeenCalledTimes(4);
    expect(times).toEqual([0, 250, 750, 750]);
    expect(logger.warn).toHaveBeenCalledWith('Translation upstream network failure or timeout', { provider: 'google' });
  });

  it('recovers from a transient Google 503 within its retry bound', async () => {
    vi.useFakeTimers();
    http.mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(google('অসমীয়া'));
    const result = service.translate(['question']);
    await vi.runAllTimersAsync();
    expect(await result).toEqual(['অসমীয়া']);
    expect(http).toHaveBeenCalledTimes(2);
  });

  it('uses a cooldown across queued requests and retries Google after expiry', async () => {
    vi.useFakeTimers();
    http.mockResolvedValueOnce(quota()).mockResolvedValueOnce(memory('এক'))
      .mockResolvedValueOnce(memory('দুই')).mockResolvedValueOnce(google('তিনি'));
    await service.translate(['one']);
    await service.translate(['two']);
    expect(http.mock.calls.filter(([url]) => String(url).includes('googleapis'))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(300000);
    expect(await service.translate(['three'])).toEqual(['তিনি']);
    expect(http.mock.calls.filter(([url]) => String(url).includes('googleapis'))).toHaveLength(2);
  });

  it('uses MyMemory directly without a key and serializes unique input strings', async () => {
    config.GOOGLE_TRANSLATE_API_KEY = '';
    http.mockResolvedValueOnce(memory('দুই')).mockResolvedValueOnce(memory('এক'));
    expect(await service.translate(['two', '', 'one', 'two'])).toEqual(['দুই', '', 'এক', 'দুই']);
    expect(http.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('q'))).toEqual(['two', 'one']);
  });

  it('deduplicates concurrent identical requests without retaining completed results', async () => {
    http.mockResolvedValueOnce(google('এক'));
    const first = service.translate(['one']);
    const duplicate = service.translate(['one']);
    expect(duplicate).toBe(first);
    expect(await first).toEqual(['এক']);
    expect(http).toHaveBeenCalledTimes(1);
    http.mockResolvedValueOnce(google('এক'));
    await service.translate(['one']);
    expect(http).toHaveBeenCalledTimes(2);
  });

  it('serializes distinct requests and allows retry after a failed job', async () => {
    let release!: (response: Response) => void;
    http.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockResolvedValueOnce(google('দুই'));
    const first = service.translate(['one']);
    const second = service.translate(['two']);
    const rejected = expect(first).rejects.toMatchObject({ statusCode: 503 });
    await Promise.resolve();
    expect(http).toHaveBeenCalledTimes(1);
    release(response({}, 401));
    await rejected;
    expect(await second).toEqual(['দুই']);
    http.mockResolvedValueOnce(google('এক'));
    expect(await service.translate(['one'])).toEqual(['এক']);
  });

  it('falls back for a Google RESOURCE_EXHAUSTED status', async () => {
    http.mockResolvedValueOnce(response({ error: { status: 'RESOURCE_EXHAUSTED' } }, 403))
      .mockResolvedValueOnce(memory());
    await expect(service.translate(['question'])).resolves.toEqual(['অসমৰ ৰাজধানী কি?']);
  });

  it('avoids provider requests for all-empty input', async () => {
    expect(await service.translate(['', ' ', '\n'])).toEqual(['', ' ', '\n']);
    expect(http).not.toHaveBeenCalled();
  });

  it('reports both failures without leaking the original provider message, key or input', async () => {
    http.mockResolvedValueOnce(quota()).mockResolvedValueOnce(response({ responseStatus: 429, quotaFinished: true }));
    await expect(service.translate(['private question'])).rejects.toMatchObject({
      statusCode: 503, message: expect.stringContaining('capacity is temporarily exhausted')
    });
    expect(logger.error).toHaveBeenCalledWith('Final translation failure', {
      primary: { kind: 'quota', status: 403, reason: 'userratelimitexceeded' }, fallback: { kind: 'quota', status: undefined }
    });
    const logs = JSON.stringify([
      vi.mocked(logger.info).mock.calls, vi.mocked(logger.warn).mock.calls, vi.mocked(logger.error).mock.calls
    ]);
    expect(logs).not.toContain(config.GOOGLE_TRANSLATE_API_KEY);
    expect(logs).not.toContain('private question');
  });

  it.each([
    { responseStatus: 200, responseData: { translatedText: ' ' } },
    { responseStatus: 200, mtLangSupported: false, responseData: { translatedText: 'unsupported' } },
    { responseStatus: 500, responseData: { translatedText: 'upstream error' } },
    {}
  ])('rejects invalid or unsupported MyMemory results (%j)', async (body) => {
    config.GOOGLE_TRANSLATE_API_KEY = '';
    http.mockResolvedValueOnce(response(body));
    await expect(service.translate(['question'])).rejects.toMatchObject({ statusCode: 503 });
  });

  it('rejects empty or incomplete Google translations and tries the fallback', async () => {
    http.mockResolvedValueOnce(google('')).mockResolvedValueOnce(memory('অসমীয়া'));
    expect(await service.translate(['question'])).toEqual(['অসমীয়া']);
  });

  it('safely splits long text into byte-limited chunks and preserves boundary whitespace', async () => {
    config.GOOGLE_TRANSLATE_API_KEY = '';
    const text = '  First sentence! \n'.repeat(65) + '😀'.repeat(150) + ' End?  ';
    const chunks = splitTranslationText(text);
    expect(chunks.join('')).toBe(text);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 450)).toBe(true);
    expect(chunks.some((chunk) => chunk.includes('\uFFFD'))).toBe(false);
    http.mockImplementation(async (url) => memory(new URL(String(url)).searchParams.get('q') ?? ''));
    expect(await service.translate([text])).toEqual([text]);
    expect(http.mock.calls.every(([url]) => Buffer.byteLength(new URL(String(url)).searchParams.get('q') ?? '', 'utf8') <= 500)).toBe(true);
  });
});
