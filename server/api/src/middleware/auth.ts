import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AccessTokenPayload {
  id: string;
  email: string;
  subscriptionTier: string;
}

function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const t = header.slice('Bearer '.length).trim();
    if (t) return t;
  }
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.access_token;
  if (cookieToken?.trim()) return cookieToken.trim();
  const q = req.query?.access_token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractAccessToken(req);
  if (!token) {
    // HTML navigations get a friendly page; API callers get JSON
    const wantsHtml = String(req.headers.accept ?? '').includes('text/html');
    if (wantsHtml) {
      res.status(401).type('html').send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px">
        <h1>Admin login required</h1>
        <p>POST to <code>/api/auth/login</code> then open this page with <code>?access_token=YOUR_JWT</code> (a cookie will be set).</p>
      </body></html>`);
      return;
    }
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'JWT_ACCESS_SECRET is not configured' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AccessTokenPayload;
    if (!decoded?.id || !decoded?.email) {
      res.status(401).json({ error: 'Invalid access token payload' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      subscriptionTier: decoded.subscriptionTier,
    };

    // Persist token for subsequent HTML navigations / form posts
    if (typeof req.query.access_token === 'string') {
      res.cookie('access_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
