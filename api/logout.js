import { clearSessionCookie } from '../lib/vercel/auth.js';
import { methodNotAllowed, sendJson } from '../lib/vercel/http.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  res.setHeader('Set-Cookie', clearSessionCookie());
  return sendJson(res, 200, { ok: true });
}
