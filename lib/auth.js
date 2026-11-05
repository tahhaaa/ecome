import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const cookieName = 'miro_session';

export function passwordMatches(candidate, expected) {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionCookie() {
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = `${expiry}.${randomUUID()}`;
  const signature = createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`;
}

export function hasAdminSession(request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookie = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
  if (!cookie) return false;
  const [expiryText, nonce, signature, extra] = cookie.slice(cookieName.length + 1).split('.');
  const expiry = Number(expiryText);
  if (!expiry || expiry < Math.floor(Date.now() / 1000) || !nonce || !signature || extra) return false;
  try {
    const expected = createHmac('sha256', secret).update(`${expiry}.${nonce}`).digest();
    const actual = Buffer.from(signature, 'base64url');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
