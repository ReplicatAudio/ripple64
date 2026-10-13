import { closeSync, createReadStream, existsSync, openSync, readSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authenticate, requireSelf } from './auth.js';
import { sniffAudioType } from './sniff.js';
import { MAX_BYTES, MAX_FILES, MAX_MESSAGE_CHARS, MESSAGE_ID, STORAGE_DIR, deleteSample, listSamples, readMessage, samplePath, saveSample, totalBytes, validId } from './storage.js';
import { USERS_FILE, addUser, loadRegisterKey, loadUsers, userExists, userForKey, validUsername } from './users.js';

const PORT = Number(process.env.PORT) || 3000;

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

const app = express();
app.use(express.raw({ type: () => true, limit: MAX_BYTES }));

app.get('/api', authenticate, (_req: Request, res: Response) => {
  res.json(
    Object.keys(loadUsers()).map((username) => ({
      username,
      msg: readMessage(username),
    })),
  );
});

app.get('/api/me', (req: Request, res: Response) => {
  const key = req.header('x-key');
  if (!key) {
    res.status(401).json({ error: 'missing key' });
    return;
  }
  const registerKey = loadRegisterKey();
  if (registerKey && key === registerKey) {
    res.json({ username: 'register' });
    return;
  }
  const user = userForKey(key);
  if (!user) {
    res.status(401).json({ error: 'invalid key' });
    return;
  }
  res.json({ username: user });
});

app.post('/api/register', (req: Request, res: Response) => {
  const key = req.header('x-key') ?? '';
  const registerKey = loadRegisterKey();
  if (!registerKey || key !== registerKey) {
    res.status(401).json({ error: 'invalid register key' });
    return;
  }
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  let username: unknown;
  try {
    username = (JSON.parse(raw) as { username?: unknown }).username;
  } catch {
    username = undefined;
  }
  if (typeof username !== 'string' || !validUsername(username)) {
    res.status(400).json({ error: 'invalid username' });
    return;
  }
  if (userExists(username)) {
    res.status(409).json({ error: 'username taken' });
    return;
  }
  const newKey = randomBytes(8).toString('hex');
  addUser(username, newKey);
  res.status(201).json({ username, key: newKey });
});

app.get('/api/:username', authenticate, (req: Request, res: Response) => {
  const username = param(req.params.username);
  if (!userExists(username)) {
    res.status(404).json({ error: 'unknown user' });
    return;
  }
  const samples = listSamples(username);
  const total = samples.reduce((sum, sample) => sum + sample.size, 0);
  res.json({
    total: Math.round(total / 1024),
    files: samples.map((sample) => ({
      id: sample.id,
      size: Math.round(sample.size / 1024),
    })),
  });
});

app.get('/api/:username/:id', authenticate, (req: Request, res: Response) => {
  const username = param(req.params.username);
  const id = param(req.params.id);
  if (!userExists(username)) {
    res.status(404).json({ error: 'unknown user' });
    return;
  }
  if (!validId(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const full = samplePath(username, id);
  if (!existsSync(full)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const stat = statSync(full);
  const head = Buffer.alloc(16);
  let read = 0;
  try {
    const fd = openSync(full, 'r');
    try {
      read = readSync(fd, head, 0, head.length, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    read = 0;
  }
  res.setHeader('Content-Type', sniffAudioType(head.subarray(0, read)));
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(id)}"`);
  createReadStream(full).pipe(res);
});

app.post('/api/:username/:id', authenticate, requireSelf, (req: Request, res: Response) => {
  const username = param(req.params.username);
  const id = param(req.params.id);
  if (!validId(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  const data = req.body as unknown;
  if (!Buffer.isBuffer(data)) {
    res.status(400).json({ error: 'expected binary body' });
    return;
  }
  const full = samplePath(username, id);
  const isMessage = id === MESSAGE_ID;
  if (isMessage && data.toString('utf8').length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: `message too long (${MAX_MESSAGE_CHARS} chars)` });
    return;
  }
  const existing = !isMessage && existsSync(full) ? statSync(full).size : 0;
  if (!existsSync(full) && !isMessage) {
    if (listSamples(username).length >= MAX_FILES) {
      res.status(409).json({ error: `sample limit reached (${MAX_FILES})` });
      return;
    }
  }
  const newTotal = totalBytes(username) - existing + data.length;
  if (newTotal > MAX_BYTES) {
    res.status(413).json({ error: 'quota exceeded (64mb)' });
    return;
  }
  saveSample(username, id, data);
  res.status(201).json({ id, size: data.length });
});

app.delete('/api/:username/:id', authenticate, requireSelf, (req: Request, res: Response) => {
  const username = param(req.params.username);
  const id = param(req.params.id);
  if (!validId(id)) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  if (!deleteSample(username, id)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : 'internal error';
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`ripple64 listening on http://localhost:${PORT}`);
  console.log(`users: ${USERS_FILE}`);
  console.log(`storage: ${STORAGE_DIR}`);
});
