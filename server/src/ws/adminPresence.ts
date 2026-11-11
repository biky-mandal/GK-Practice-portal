import { WebSocket } from 'ws';
import { logger } from '../config/logger.js';
import { AdminActivity } from '../models/AdminActivity.js';

interface Member {
  socket: WebSocket;
  userId: string;
  name: string;
  activeSet: string | null;
  updatedAt: number;
  lastTick: number;
}

const members = new Map<WebSocket, Member>();

export const isAdminRole = (role: string) => role === 'admin' || role === 'superadmin';

// One entry per admin even when they have several tabs open; the most recently updated tab decides the set.
const snapshot = () => {
  const byUser = new Map<string, { userId: string; name: string; activeSet: string | null; updatedAt: number }>();
  for (const member of members.values()) {
    const existing = byUser.get(member.userId);
    if (!existing || member.updatedAt >= existing.updatedAt) {
      byUser.set(member.userId, { userId: member.userId, name: member.name, activeSet: member.activeSet, updatedAt: member.updatedAt });
    }
  }
  return [...byUser.values()].map(({ userId, name, activeSet }) => ({ userId, name, activeSet }));
};

const broadcast = () => {
  const payload = JSON.stringify({ type: 'presence.list', admins: snapshot() });
  for (const { socket } of members.values()) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
};

export const joinPresence = (socket: WebSocket, user: { id: string; name: string }) => {
  members.set(socket, { socket, userId: user.id, name: user.name, activeSet: null, updatedAt: Date.now(), lastTick: Date.now() });
  broadcast();
};

export const updatePresence = (socket: WebSocket, activeSet: string | null) => {
  const member = members.get(socket);
  if (!member) return;
  member.activeSet = activeSet;
  member.updatedAt = Date.now();
  broadcast();
};

// Pushes a saved chat message to every connected admin socket.
export const broadcastChat = (message: { id: string; userId: string; name: string; text: string; createdAt: string }) => {
  const payload = JSON.stringify({ type: 'chat.message', message });
  for (const { socket } of members.values()) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
};

export const leavePresence = (socket: WebSocket) => {
  flushPresenceTime();
  if (members.delete(socket)) broadcast();
};

// Adds the time since the last tick to each connected admin's daily total; several tabs of one admin count once.
const MAX_TICK_MS = 120_000;

export const flushPresenceTime = () => {
  const now = Date.now();
  const perUser = new Map<string, { name: string; ms: number }>();
  for (const member of members.values()) {
    const ms = Math.min(Math.max(0, now - member.lastTick), MAX_TICK_MS);
    member.lastTick = now;
    const entry = perUser.get(member.userId);
    if (!entry || ms > entry.ms) perUser.set(member.userId, { name: member.name, ms });
  }
  const day = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  for (const [userId, { name, ms }] of perUser) {
    if (ms < 1000) continue;
    AdminActivity.updateOne({ userId, day }, { $inc: { seconds: Math.round(ms / 1000) }, $set: { name } }, { upsert: true })
      .exec()
      .catch((error) => logger.warn({ error }, 'Admin activity save failed'));
  }
};