import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import path from 'path';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function getFirebaseProjectId(): string {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as { projectId?: string };
  if (!parsed.projectId) {
    throw new Error('Missing projectId in firebase-applet-config.json');
  }
  return parsed.projectId;
}

const BOOTSTRAPPED_ADMIN_EMAIL = 'prajwalm1122@gmail.com';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export async function verifyFirebaseIdToken(token: string): Promise<AuthenticatedUser> {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : undefined;
  const emailVerified = payload.email_verified === true;

  if (!uid) {
    throw new Error('Invalid Firebase ID token: missing subject.');
  }

  if (!emailVerified) {
    const err = new Error(
      'Verified email required before running server-side diagnostic actions.'
    ) as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  return {
    uid,
    email,
    emailVerified,
    isAdmin: email === BOOTSTRAPPED_ADMIN_EMAIL && emailVerified,
  };
}

/**
 * Cryptographically verifies Firebase ID tokens using Google's public JWKS keys.
 * Requires zero IAM roles and works reliably on Starter Tier projects.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Empty token.' });
    return;
  }

  try {
    req.authUser = await verifyFirebaseIdToken(token);
    next();
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 401;
    if (statusCode === 403) {
      res.status(403).json({
        error:
          error instanceof Error
            ? error.message
            : 'Verified email required before running server-side diagnostic actions.',
      });
      return;
    }
    console.error('Firebase token verification error:', error);
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!req.authUser.isAdmin) {
    res.status(403).json({ error: 'Forbidden: administrator privileges required.' });
    return;
  }
  next();
}
