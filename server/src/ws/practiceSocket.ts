import type { Server } from 'http';
import mongoose from 'mongoose';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { z } from 'zod';
import { allowedOrigins, config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Question } from '../models/Question.js';
import { MOCK_COUNT } from '../models/mock.js';
import { practicePack } from '../services/practiceExam.js';
import { ApiError } from '../utils/ApiError.js';
import { PYQ_PAPER_IDS, PYQ_PAPERS, PYQ_YEARS } from '../models/pyq.js';
import { loadEntitlements, ownsPack } from '../services/entitlementService.js';
import { bilingualQuestion } from '../services/questionI18n.js';
import { authenticateAccessToken } from '../services/tokenService.js';
import { TestAttempt } from '../models/TestAttempt.js';
import { answersToRecord, dayKeyIST, findDailyAttempt, frozenElapsedSeconds, liveElapsedSeconds, remainingSeconds, startPracticeAttempt, submitAttempt } from '../services/testService.js';
import { getSettings, isFreeSubject } from '../services/settingsService.js';
import { flushPresenceTime, isAdminRole, joinPresence, leavePresence, updatePresence } from './adminPresence.js';

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), 'Invalid id.');

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth'), token: z.string().min(1) }),
  z.object({
    type: z.literal('session.start'),
    exam: z.enum(['adre', 'police-forest']).default('adre'),
    categories: z.array(z.string().trim().max(100)).max(100).optional(),
    daily: z.boolean().optional(),
    pyq: z.object({ year: z.union([z.literal(2022), z.literal(2024)]), paper: z.enum(PYQ_PAPER_IDS) }).optional(),
    mock: z.number().int().min(1).max(MOCK_COUNT).optional(),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
    questionCount: z.number().int().min(1).max(50).default(10)
  }),
  z.object({ type: z.literal('session.resume'), attemptId: objectId.optional() }),
  z.object({ type: z.literal('answer.submit'), attemptId: objectId, questionId: objectId, selectedAnswer: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal('answer.clear'), attemptId: objectId, questionId: objectId }),
  z.object({ type: z.literal('review.toggle'), attemptId: objectId, questionId: objectId, marked: z.boolean() }),
  z.object({ type: z.literal('session.finish'), attemptId: objectId }),
  z.object({ type: z.literal('session.pause') }),
  z.object({ type: z.literal('presence.update'), activeSet: z.string().trim().max(120).nullable() }),
  z.object({ type: z.literal('ping') })
]);

type ClientMessage = z.infer<typeof messageSchema>;

interface Connection {
  socket: WebSocket;
  userId: string | null;
  role: string;
  alive: boolean;
  attemptId: string | null;
  resumedAt: Date | null;
  timer: ReturnType<typeof setTimeout> | null;
}

class SocketError extends Error {}

const send = (socket: WebSocket, type: string, payload: Record<string, unknown> = {}) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
};

// Answer keys must never leave the server before the learner answers.
const toPublicQuestion = (question: any) => {
  const content = bilingualQuestion(question);
  return {
    id: String(question._id),
    questionText: content.questionText,
    options: content.options,
    translation: content.translation ? { questionText: content.translation.questionText, options: content.translation.options } : null,
    subject: question.subject,
    topic: question.topic,
    difficulty: question.difficulty,
    language: content.language,
    passage: question.content?.passage ?? null,
    media: question.content?.media ?? []
  };
};

const loadAttempt = async (attemptId: string, userId: string) => {
  const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).exec();
  if (!attempt) throw new SocketError('Attempt not found.');
  return attempt;
};

const ensureInProgress = (status: string) => {
  if (status !== 'in_progress') throw new SocketError('Attempt is no longer in progress.');
};

const sendSessionState = async (socket: WebSocket, attempt: Awaited<ReturnType<typeof loadAttempt>>, remaining: number) => {
  const found = await Question.find({ _id: { $in: attempt.selectedQuestionIds } }).lean().exec();
  const byId = new Map(found.map((question: any) => [String(question._id), question]));
  const ordered = attempt.selectedQuestionIds.map((id) => byId.get(String(id))).filter(Boolean);
  const answers = answersToRecord(attempt.selectedAnswers);

  send(socket, 'session.started', {
    attemptId: String(attempt._id),
    totalQuestions: ordered.length,
    categories: attempt.categories ?? [],
    pack: attempt.pack ?? null,
    mock: attempt.mock ?? null,
    pyq: attempt.pyq?.year ? { year: attempt.pyq.year, paperId: attempt.pyq.paperId } : null,
    kind: attempt.kind ?? 'practice',
    questions: ordered.map((question) => toPublicQuestion(question)),
    answers,
    timer: { totalSeconds: attempt.totalSeconds, remainingSeconds: remaining },
    markedForReview: attempt.markedForReview.map(String)
  });
};

const clearTimer = (connection: Connection) => {
  if (connection.timer) clearTimeout(connection.timer);
  connection.timer = null;
};

// Freezes the clock; only the connection that owns the running clock may stop it.
const pauseClock = async (connection: Connection) => {
  clearTimer(connection);
  const attemptId = connection.attemptId;
  const resumedAt = connection.resumedAt;
  connection.attemptId = null;
  connection.resumedAt = null;
  if (!attemptId) return;

  const attempt = await TestAttempt.findOne({ _id: attemptId, status: 'in_progress' }).exec();
  if (!attempt?.lastResumedAt || attempt.lastResumedAt.getTime() !== resumedAt?.getTime()) return;

  attempt.elapsedSeconds = liveElapsedSeconds(attempt);
  attempt.lastResumedAt = null;
  attempt.lastActiveAt = null;
  await attempt.save();
};

const finishAttempt = async (connection: Connection, attemptId: string, autoSubmitted: boolean) => {
  await pauseClock(connection);
  const { result } = await submitAttempt(attemptId, String(connection.userId));
  send(connection.socket, 'session.completed', { attemptId, autoSubmitted, ...result });
};

// Returns the remaining seconds, or null when time had already run out and the attempt was submitted.
const startClock = async (connection: Connection, attempt: Awaited<ReturnType<typeof loadAttempt>>): Promise<number | null> => {
  clearTimer(connection);
  attempt.elapsedSeconds = frozenElapsedSeconds(attempt);
  attempt.lastResumedAt = null;
  const remaining = remainingSeconds(attempt, attempt.elapsedSeconds);
  const attemptId = String(attempt._id);

  if (remaining <= 0) {
    await attempt.save();
    await finishAttempt(connection, attemptId, true);
    return null;
  }

  const now = new Date();
  attempt.lastResumedAt = now;
  attempt.lastActiveAt = now;
  await attempt.save();

  connection.attemptId = attemptId;
  connection.resumedAt = now;
  connection.timer = setTimeout(() => {
    finishAttempt(connection, attemptId, true).catch((error) => logger.warn({ error }, 'Auto-submit failed'));
  }, remaining * 1000);
  return remaining;
};

const handleMessage = async (connection: Connection, message: ClientMessage) => {
  const { socket } = connection;

  if (message.type === 'ping') {
    if (connection.attemptId && connection.resumedAt) {
      TestAttempt.updateOne(
        { _id: connection.attemptId, lastResumedAt: connection.resumedAt },
        { $set: { lastActiveAt: new Date() } }
      ).catch(() => undefined);
    }
    send(socket, 'pong');
    return;
  }

  if (message.type === 'auth') {
    try {
      const user = await authenticateAccessToken(message.token);
      connection.userId = user.id;
      connection.role = user.role;
      if (isAdminRole(user.role)) {
        send(socket, 'auth.ok');
        joinPresence(socket, { id: user.id, name: user.name?.trim() || user.email?.split('@')[0] || 'Admin' });
        return;
      }
    } catch {
      send(socket, 'error', { code: 'UNAUTHORIZED', message: 'Invalid or expired access token.' });
      socket.close(4401, 'Unauthorized');
      return;
    }
    send(socket, 'auth.ok');
    return;
  }

  const userId = connection.userId;
  if (!userId) {
    send(socket, 'error', { code: 'UNAUTHORIZED', message: 'Authenticate first.' });
    return;
  }

  if (message.type === 'presence.update') {
    if (isAdminRole(connection.role)) updatePresence(socket, message.activeSet || null);
    return;
  }

  switch (message.type) {
    case 'session.start': {
      // A new session replaces any unfinished one.
      const entitlements = await loadEntitlements({ id: userId, role: connection.role });
      if (entitlements.tier === 'admin') {
        throw new SocketError('Admin accounts cannot take practice tests.');
      }
      const daily = Boolean(message.daily);
      if (message.exam === 'police-forest' && (daily || message.pyq)) {
        throw new SocketError('Police and Forest Test Series support subject practice and Constable mocks only.');
      }
      if (daily) {
        if (ownsPack(entitlements, 'subject')) throw new SocketError('Your Subject Wise Practice Test Series already includes unlimited practice.');
        if (message.pyq || message.mock !== undefined || message.categories?.length) {
          throw new SocketError('Free accounts can take one free daily test only.');
        }
      } else if (message.pyq) {
        if (message.mock !== undefined || message.categories?.length) throw new SocketError('Choose one kind of test at a time.');
        const freePaper = message.pyq.year === Math.max(...PYQ_YEARS) && message.pyq.paper === PYQ_PAPERS[0].id;
        if (!freePaper && !ownsPack(entitlements, 'pyq')) throw new SocketError('Buy the PYQ Practice Test Series to practise previous-year papers.');
      } else if (message.mock !== undefined) {
        if (message.categories?.length) throw new SocketError('Choose one kind of test at a time.');
        if (message.mock !== 1 && !ownsPack(entitlements, practicePack(message.exam, true))) throw new SocketError('Buy the Full Length Mock Test Series for this exam to take mock tests.');
      } else if (!ownsPack(entitlements, practicePack(message.exam, false))) {
        const { freeSubjectCategory } = await getSettings();
        if (!isFreeSubject(message.categories, freeSubjectCategory)) {
          throw new SocketError(freeSubjectCategory
            ? `Buy the Subject Wise Practice Test Series to practise by subject. ${freeSubjectCategory} is free to practise.`
            : 'Buy the Subject Wise Practice Test Series to practise by subject.');
        }
        // Query the stored category name, not the learner's spelling of it.
        message.categories = [freeSubjectCategory];
      }

      if (daily) {
        const today = await findDailyAttempt(userId);
        if (today) {
          if (today.status !== 'in_progress') {
            throw new SocketError("You have used today's free test. Come back tomorrow.");
          }
          const left = await startClock(connection, today);
          if (left !== null) await sendSessionState(socket, today, left);
          return;
        }
      }

      await pauseClock(connection);
      let created: Awaited<ReturnType<typeof startPracticeAttempt>>;
      try {
        created = await startPracticeAttempt({
          userId,
          exam: message.exam,
          categories: message.categories,
          difficulty: message.difficulty,
          ...(message.pyq ? { pyq: { year: message.pyq.year, paperId: message.pyq.paper } } : {}),
          ...(message.mock !== undefined ? { mock: message.mock } : {}),
          questionCount: daily ? (await getSettings()).dailyFreeQuestionCount : message.questionCount,
          ...(daily ? { kind: 'daily_free' as const, dayKey: dayKeyIST() } : {})
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) throw new SocketError("You have used today's free test. Come back tomorrow.");
        throw error;
      }
      const { attempt, questions } = created;
      if (!questions.length) {
        await attempt.deleteOne();
        throw new SocketError(message.pyq || message.mock !== undefined ? 'No questions have been added for this paper yet.' : 'No questions available for the selected filters.');
      }
      await TestAttempt.updateMany(
        { userId, status: 'in_progress', _id: { $ne: attempt._id } },
        { $set: { status: 'expired', lastResumedAt: null } }
      );
      const remaining = await startClock(connection, attempt);
      if (remaining !== null) await sendSessionState(socket, attempt, remaining);
      return;
    }

    case 'session.resume': {
      const attempt = message.attemptId
        ? await loadAttempt(message.attemptId, userId)
        : await TestAttempt.findOne({ userId, status: 'in_progress' }).sort({ startedAt: -1 }).exec();
      if (!attempt) {
        send(socket, 'session.none');
        return;
      }
      ensureInProgress(attempt.status);
      // Earlier failed starts left empty in-progress attempts; retire them instead of resuming.
      const available = await Question.countDocuments({ _id: { $in: attempt.selectedQuestionIds } });
      if (!available) {
        attempt.status = 'expired';
        await attempt.save();
        send(socket, 'session.none');
        return;
      }
      const remaining = await startClock(connection, attempt);
      if (remaining !== null) await sendSessionState(socket, attempt, remaining);
      return;
    }

    case 'session.pause': {
      await pauseClock(connection);
      send(socket, 'session.paused');
      return;
    }

    case 'answer.submit': {
      const question: any = await Question.findById(message.questionId, { options: 1 }).lean().exec();
      if (!question || message.selectedAnswer >= (question.options?.length ?? 0)) {
        throw new SocketError('Invalid answer.');
      }
      const result = await TestAttempt.updateOne(
        { _id: message.attemptId, userId, status: 'in_progress', selectedQuestionIds: message.questionId },
        { $set: { [`selectedAnswers.${message.questionId}`]: message.selectedAnswer } }
      );
      if (!result.matchedCount) throw new SocketError('Question is not part of an active attempt.');
      send(socket, 'answer.saved', { questionId: message.questionId, selectedAnswer: message.selectedAnswer });
      return;
    }

    case 'answer.clear': {
      const result = await TestAttempt.updateOne(
        { _id: message.attemptId, userId, status: 'in_progress', selectedQuestionIds: message.questionId },
        { $unset: { [`selectedAnswers.${message.questionId}`]: '' } }
      );
      if (!result.matchedCount) throw new SocketError('Question is not part of an active attempt.');
      send(socket, 'answer.cleared', { questionId: message.questionId });
      return;
    }

    case 'review.toggle': {
      const update = message.marked
        ? { $addToSet: { markedForReview: message.questionId } }
        : { $pull: { markedForReview: message.questionId } };
      const result = await TestAttempt.updateOne(
        { _id: message.attemptId, userId, status: 'in_progress', selectedQuestionIds: message.questionId },
        update
      );
      if (!result.matchedCount) throw new SocketError('Question is not part of an active attempt.');
      send(socket, 'review.updated', { questionId: message.questionId, marked: message.marked });
      return;
    }

    case 'session.finish': {
      const attempt = await loadAttempt(message.attemptId, userId);
      ensureInProgress(attempt.status);
      await finishAttempt(connection, message.attemptId, false);
      return;
    }
  }
};

export const attachPracticeSocket = (server: Server) => {
  const wss = new WebSocketServer({ server, path: '/ws/practice', maxPayload: 16 * 1024 });

  wss.on('connection', (socket, request) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      socket.close(4403, 'Origin not allowed');
      return;
    }

    const connection: Connection = { socket, userId: null, role: 'user', alive: true, attemptId: null, resumedAt: null, timer: null };
    const authTimer = setTimeout(() => {
      if (!connection.userId) socket.close(4401, 'Authentication timeout');
    }, AUTH_TIMEOUT_MS);

    socket.on('pong', () => {
      connection.alive = true;
    });

    socket.on('message', async (raw: RawData) => {
      let parsed: ClientMessage;
      try {
        parsed = messageSchema.parse(JSON.parse(raw.toString()));
      } catch {
        send(socket, 'error', { code: 'BAD_REQUEST', message: 'Invalid message.' });
        return;
      }

      try {
        await handleMessage(connection, parsed);
      } catch (error) {
        if (error instanceof SocketError || (error instanceof ApiError && error.isOperational)) {
          send(socket, 'error', { code: 'REJECTED', message: error.message });
          return;
        }
        logger.error({ error }, 'Practice socket handler failed');
        send(socket, 'error', { code: 'INTERNAL', message: 'Something went wrong.' });
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimer);
      leavePresence(socket);
      pauseClock(connection).catch((error) => logger.warn({ error }, 'Pause on close failed'));
    });
    socket.on('error', (error) => logger.warn({ error }, 'Practice socket error'));
    (socket as WebSocket & { connection?: Connection }).connection = connection;
  });

  const heartbeat = setInterval(() => {
    flushPresenceTime();
    for (const socket of wss.clients as Set<WebSocket & { connection?: Connection }>) {
      const connection = socket.connection;
      if (connection && !connection.alive) {
        socket.terminate();
        continue;
      }
      if (connection) connection.alive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(heartbeat));
  return wss;
};
