import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type Users = Record<string, string>;

export const USERS_FILE = path.join(process.cwd(), 'users.json');
export const REGISTER_FILE = path.join(process.cwd(), 'register.json');

export function loadUsers(): Users {
  try {
    const raw = readFileSync(USERS_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const users: Users = {};
    for (const [username, key] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key === 'string') users[username] = key;
    }
    return users;
  } catch {
    return {};
  }
}

export function userExists(username: string): boolean {
  return Object.prototype.hasOwnProperty.call(loadUsers(), username);
}

export function userForKey(key: string | undefined): string | null {
  if (!key) return null;
  const users = loadUsers();
  for (const [username, userKey] of Object.entries(users)) {
    if (userKey === key) return username;
  }
  return null;
}

export function loadRegisterKey(): string | null {
  try {
    const raw = readFileSync(REGISTER_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const key = (parsed as Record<string, unknown>).key;
    return typeof key === 'string' && key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

export function validUsername(username: string): boolean {
  return username !== 'register' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(username);
}

export function addUser(username: string, key: string): void {
  const users = loadUsers();
  users[username] = key;
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + '\n');
}
