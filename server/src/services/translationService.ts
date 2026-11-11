import { decodeHTML } from 'entities';
import { z } from 'zod';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

type Provider = 'google' | 'mymemory';
type FailureKind = 'quota' | 'configuration' | 'temporary' | 'invalid-response';

class TranslationFailure extends Error {
  constructor(readonly provider: Provider, readonly kind: FailureKind, readonly status?: number, readonly reason?: string) {
    super(`${provider}:${kind}`);
  }
}

const googleResponse = z.object({
  data: z.object({ translations: z.array(z.object({ translatedText: z.string() })) })
});
const googleError = z.object({
  error: z.object({
    status: z.string().optional(),
    message: z.string().optional(),
    errors: z.array(z.object({ reason: z.string().optional() })).optional()
  })
});
const memoryResponse = z.object({
  responseStatus: z.union([z.number(), z.string()]),
  quotaFinished: z.boolean().optional(),
  mtLangSupported: z.boolean().nullable().optional(),
  responseData: z.object({ translatedText: z.string().nullable().optional() }).optional()
});

// Keep original whitespace and punctuation, splitting only between Unicode code points.
export const splitTranslationText = (text: string, maxBytes = 450): string[] => {
  const chunks: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const point of text) {
    const size = Buffer.byteLength(point, 'utf8');
    if (size > maxBytes) throw new RangeError('Translation chunk size is too small.');
    if (bytes + size > maxBytes) {
      const sentence = [...chunk.matchAll(/[.!?\u0964]\s+/gu)].at(-1);
      const last = sentence ?? [...chunk.matchAll(/\s+/gu)].at(-1);
      const boundary = last ? last.index + last[0].length : chunk.length;
      chunks.push(chunk.slice(0, boundary));
      chunk = chunk.slice(boundary);
      bytes = Buffer.byteLength(chunk, 'utf8');
    }
    // The remainder plus a multi-byte code point may still exceed the byte limit.
    if (bytes + size > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += point;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
};

const validTranslation = (text: string, provider: Provider) => {
  const decoded = decodeHTML(text);
  if (!decoded.trim()) throw new TranslationFailure(provider, 'invalid-response');
  return decoded;
};

const googleFailure = (status: number, body: unknown): TranslationFailure => {
  const parsed = googleError.safeParse(body);
  const error = parsed.success ? parsed.data.error : undefined;
  const reasons = error?.errors?.map((entry) => entry.reason?.toLowerCase()) ?? [];
  const quotaReason = reasons.find((reason) => reason && [
    'userratelimitexceeded', 'ratelimitexceeded', 'dailylimitexceeded', 'quotaexceeded'
  ].includes(reason));
  const quota = !!quotaReason || error?.status === 'RESOURCE_EXHAUSTED'
    || (status === 403 && /\b(?:quota|(?:user |daily )?rate limit)\b/i.test(error?.message ?? ''));
  if (status === 429 || quota) return new TranslationFailure('google', 'quota', status, quotaReason);
  if ([408, 500, 502, 503, 504].includes(status)) return new TranslationFailure('google', 'temporary', status);
  return new TranslationFailure('google', 'configuration', status);
};

// A single service instance serializes requests and shares its cooldown within a Node process.
export class TranslationService {
  private googleUnavailableUntil = 0;
  private googleQuotaFailure: TranslationFailure | undefined;
  private queue: Promise<void> = Promise.resolve();
  private readonly inFlight = new Map<string, Promise<string[]>>();

  translate(texts: string[]): Promise<string[]> {
    const key = JSON.stringify(texts);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    if (this.inFlight.size >= 32) {
      logger.warn('Translation queue is full');
      return Promise.reject(new ApiError(503, 'Translation is busy. Please retry shortly.'));
    }
    const request = this.queue.then(() => this.translateAll(texts));
    this.inFlight.set(key, request);
    this.queue = request.then(() => undefined, () => undefined);
    void request.finally(() => this.inFlight.delete(key)).catch(() => undefined);
    return request;
  }

  private async request(provider: Provider, url: string | URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    } catch {
      // Fetch errors can include the request URL (and its API key), so never log them.
      logger.warn('Translation upstream network failure or timeout', { provider });
      throw new TranslationFailure(provider, 'temporary');
    }
  }

  private async json(response: Response, provider: Provider): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new TranslationFailure(provider, 'invalid-response', response.status);
    }
  }

  private async google(texts: string[]): Promise<string[]> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.request('google', 'https://translation.googleapis.com/language/translate/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': config.GOOGLE_TRANSLATE_API_KEY.trim() },
          body: JSON.stringify({ q: texts, source: 'en', target: 'as', format: 'text' })
        });
        if (!response.ok) {
          // A non-JSON upstream error must not mask its HTTP classification.
          const body: unknown = await response.json().catch(() => null);
          throw googleFailure(response.status, body);
        }
        const parsed = googleResponse.safeParse(await this.json(response, 'google'));
        if (!parsed.success || parsed.data.data.translations.length !== texts.length) {
          throw new TranslationFailure('google', 'invalid-response', response.status);
        }
        const result = parsed.data.data.translations.map((entry) => validTranslation(entry.translatedText, 'google'));
        logger.info('Google translation succeeded', { count: texts.length });
        return result;
      } catch (error) {
        if (!(error instanceof TranslationFailure)) throw error;
        logger.warn('Google translation failed', { kind: error.kind, status: error.status, reason: error.reason, attempt: attempt + 1 });
        if (error.kind === 'quota') {
          this.googleQuotaFailure = error;
          this.googleUnavailableUntil = Date.now() + config.TRANSLATION_GOOGLE_COOLDOWN_SECONDS * 1000;
        }
        if (error.kind !== 'temporary' || attempt >= 2) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
  }

  private async myMemory(text: string): Promise<string> {
    const parts: string[] = [];
    for (const chunk of splitTranslationText(text)) {
      if (!chunk.trim()) {
        parts.push(chunk);
        continue;
      }
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('langpair', 'en|as');
      url.searchParams.set('q', chunk.trim());
      const response = await this.request('mymemory', url, {});
      if (!response.ok) {
        throw new TranslationFailure('mymemory', response.status === 429 ? 'quota' : 'temporary', response.status);
      }
      const parsed = memoryResponse.safeParse(await this.json(response, 'mymemory'));
      if (!parsed.success) throw new TranslationFailure('mymemory', 'invalid-response');
      const body = parsed.data;
      if (body.quotaFinished || Number(body.responseStatus) === 429) throw new TranslationFailure('mymemory', 'quota');
      if (body.mtLangSupported === false || Number(body.responseStatus) !== 200 || !body.responseData?.translatedText) {
        throw new TranslationFailure('mymemory', 'invalid-response');
      }
      const translated = validTranslation(body.responseData.translatedText, 'mymemory').trim();
      parts.push((chunk.match(/^\s*/u)?.[0] ?? '') + translated + (chunk.match(/\s*$/u)?.[0] ?? ''));
    }
    return validTranslation(parts.join(''), 'mymemory');
  }

  private async translateAll(texts: string[]): Promise<string[]> {
    const unique = [...new Set(texts.filter((text) => text.trim()))];
    if (!unique.length) return [...texts];
    let googleProblem: TranslationFailure | undefined;
    if (config.GOOGLE_TRANSLATE_API_KEY.trim()) {
      if (Date.now() < this.googleUnavailableUntil) {
        googleProblem = this.googleQuotaFailure;
      } else {
        try {
          const translated = await this.google(unique);
          const byText = new Map(unique.map((text, index) => [text, translated[index]]));
          return texts.map((text) => text.trim() ? byText.get(text)! : text);
        } catch (error) {
          if (!(error instanceof TranslationFailure)) throw error;
          googleProblem = error;
          if (error.kind === 'configuration') {
            logger.error('Translation failed: primary provider configuration', { status: error.status });
            throw new ApiError(503, 'Translation is not configured correctly. Contact the site administrator.');
          }
        }
      }
    }
    logger.info('MyMemory translation fallback activated', { reason: googleProblem?.kind ?? 'primary-not-configured' });
    try {
      const byText = new Map<string, string>();
      for (const text of unique) byText.set(text, await this.myMemory(text));
      logger.info('MyMemory translation succeeded', { count: unique.length });
      return texts.map((text) => text.trim() ? byText.get(text)! : text);
    } catch (error) {
      if (!(error instanceof TranslationFailure)) throw error;
      logger.error('MyMemory translation failed', { kind: error.kind, status: error.status });
      logger.error('Final translation failure', {
        primary: googleProblem ? { kind: googleProblem.kind, status: googleProblem.status, reason: googleProblem.reason } : 'not-configured',
        fallback: { kind: error.kind, status: error.status }
      });
      throw new ApiError(503, error.kind === 'quota'
        ? 'Translation capacity is temporarily exhausted. Please retry later; your existing translations have not changed.'
        : 'Translation is temporarily unavailable. Please retry later; your existing translations have not changed.');
    }
  }
}

export const translationService = new TranslationService();
