/**
 * Require authenticated user email to be listed in ADMIN_EMAILS.
 * Chain after requireAuth.
 */

import { Request, Response, NextFunction } from 'express';

function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS?.trim() ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const set = adminEmailSet();
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const email = req.user?.email;
  if (!email || !isAdminEmail(email)) {
    const wantsHtml = String(req.headers.accept ?? '').includes('text/html');
    if (wantsHtml) {
      res.status(403).type('html').send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
        <h1>Admin access required</h1>
        <p>Your account (${email ?? 'unknown'}) is not listed in <code>ADMIN_EMAILS</code>.</p>
      </body></html>`);
      return;
    }
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
