import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const COOKIE = 'miro_session';

export function passwordMatches(candidate, expected) {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionCookie() {
  const secret = process.env.SESSION_SECRET;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const nonce = randomUUID();
  const payload = `${expiry}.${nonce}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`;
}

export function hasAdminSession(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
  if (!cookie) return false;
  const [expiryText, nonce, signature, extra] = cookie.slice(COOKIE.length + 1).split('.');
  const expiry = Number(expiryText);
  if (!expiry || expiry < Math.floor(Date.now() / 1000) || !nonce || !signature || extra) return false;
  const expected = createHmac('sha256', secret).update(`${expiry}.${nonce}`).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
