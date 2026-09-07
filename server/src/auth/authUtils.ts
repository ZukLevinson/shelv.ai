import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = process.env.JWT_SECRET || 'shelv-ai-auth-secret-key-2026-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'inventory_owner' | 'scanner';
  is_manager: boolean;
  holderId?: string | null;
  personal_number?: string | null;
  name: string;
  iat?: number;
  exp?: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signSessionToken(payload: TokenPayload, expiresInSeconds = 7 * 24 * 60 * 60): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

export interface GoogleVerifiedProfile {
  sub: string;
  email: string;
  name: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerifiedProfile> {
  const cleanToken = idToken.trim();

  // 1. Try google-auth-library OAuth2Client if GOOGLE_CLIENT_ID is set
  if (GOOGLE_CLIENT_ID) {
    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: cleanToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (payload && payload.email) {
        return {
          sub: payload.sub,
          email: payload.email.toLowerCase(),
          name: payload.name || payload.email.split('@')[0],
        };
      }
    } catch (err) {
      console.warn('[Auth] google-auth-library verify failed, attempting tokeninfo fallback:', err);
    }
  }

  // 2. Direct tokeninfo verification via Google OAuth API endpoint
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google token validation failed: ${errText}`);
  }

  const data = await response.json() as any;
  if (!data.email || !data.sub) {
    throw new Error('Google token missing required email or sub identity claims');
  }

  return {
    sub: data.sub,
    email: String(data.email).toLowerCase(),
    name: data.name || data.email.split('@')[0],
  };
}
