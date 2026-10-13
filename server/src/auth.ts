import type { NextFunction, Request, Response } from 'express';
import { loadUsers, userForKey } from './users.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('x-key');
  if (!key) {
    res.status(401).json({ error: 'missing key' });
    return;
  }
  const users = loadUsers();
  const user = userForKey(key);
  if (!user || !Object.prototype.hasOwnProperty.call(users, user)) {
    res.status(401).json({ error: 'invalid key' });
    return;
  }
  req.user = user;
  next();
}

export function requireSelf(req: Request, res: Response, next: NextFunction): void {
  if (req.user !== req.params.username) {
    res.status(403).json({ error: 'key does not belong to this user' });
    return;
  }
  next();
}
