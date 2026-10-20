import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal signed session token: base64url(payload).base64url(hmac).
// This backs the demo sign-in only. Replace it with the company's identity
// provider before launch; the rest of the app reads users through
// getCurrentUser() and does not depend on this format.

export const SESSION_COOKIE = "btr_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface SessionPayload {
  uid: string;
  exp: number;
}

const DEV_FALLBACK_SECRET = "demo-only-secret-change-me-before-any-real-deployment";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("SESSION_SECRET (32+ characters) is required in production.");
  }
  return DEV_FALLBACK_SECRET;
}

function sign(data: string) {
  return createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export function createToken(uid: string, now = Date.now()): string {
  const payload: SessionPayload = { uid, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyToken(token: string | undefined | null, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}
