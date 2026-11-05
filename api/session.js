import { hasAdminSession } from '../lib/vercel/auth.js';
import { methodNotAllowed, sendJson } from '../lib/vercel/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return sendJson(res, 200, { authenticated: hasAdminSession(req) });
}
