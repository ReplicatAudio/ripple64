import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STORAGE_DIR = path.join(process.cwd(), 'storage');
export const MAX_BYTES = 64 * 1024 * 1024;
export const MAX_FILES = 999;
export const MESSAGE_ID = 'msg.md';
export const MAX_MESSAGE_CHARS = 128;

export interface Sample {
  id: string;
  size: number;
}

export function userDir(username: string): string {
  return path.join(STORAGE_DIR, username);
}

export function samplePath(username: string, id: string): string {
  return path.join(userDir(username), id);
}

export function validId(id: string): boolean {
  if (id.length === 0 || id.length > 255) return false;
  if (id === '.' || id === '..') return false;
  if (id.startsWith('.')) return false;
  return !id.includes('/') && !id.includes('\\') && !id.includes('\0');
}

export function listSamples(username: string): Sample[] {
  const dir = userDir(username);
  if (!existsSync(dir)) return [];
  const samples: Sample[] = [];
  for (const id of readdirSync(dir)) {
    if (id === MESSAGE_ID) continue;
    const full = path.join(dir, id);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    samples.push({ id, size: stat.size });
  }
  samples.sort((a, b) => a.id.localeCompare(b.id));
  return samples;
}

export function totalBytes(username: string): number {
  let total = 0;
  for (const sample of listSamples(username)) total += sample.size;
  return total;
}

export function saveSample(username: string, id: string, data: Buffer): void {
  const dir = userDir(username);
  mkdirSync(dir, { recursive: true });
  writeFileSync(samplePath(username, id), data);
}

export function readMessage(username: string): string {
  const full = samplePath(username, MESSAGE_ID);
  if (!existsSync(full)) return '';
  try {
    return readFileSync(full, 'utf8');
  } catch {
    return '';
  }
}

export function deleteSample(username: string, id: string): boolean {
  const full = samplePath(username, id);
  if (!existsSync(full)) return false;
  unlinkSync(full);
  return true;
}
