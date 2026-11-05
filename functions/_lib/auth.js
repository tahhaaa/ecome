const encoder = new TextEncoder();
const cookieName = 'miro_session';

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionCookie(env) {
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const nonce = crypto.randomUUID();
  const payload = `${expiry}.${nonce}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.SESSION_SECRET), encoder.encode(payload));
  return `${cookieName}=${payload}.${base64url(new Uint8Array(signature))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200; Secure`;
}

export async function hasAdminSession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  if (!cookie) return false;
  const [expiryText, nonce, signature, extra] = cookie.slice(cookieName.length + 1).split('.');
  const expiry = Number(expiryText);
  if (!expiry || expiry < Math.floor(Date.now() / 1000) || !nonce || !signature || extra) return false;
  try {
    return await crypto.subtle.verify('HMAC', await signingKey(env.SESSION_SECRET), fromBase64url(signature), encoder.encode(`${expiry}.${nonce}`));
  } catch {
    return false;
  }
}

export function passwordMatches(candidate, expected) {
  const a = encoder.encode(candidate);
  const b = encoder.encode(expected);
  const length = Math.max(a.length, b.length, 1);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index++) difference |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
  return difference === 0;
}

export function clearSessionCookie() {
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure`;
}

export function jsonResponse(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
