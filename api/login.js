import { createSessionCookie, passwordMatches } from '../lib/vercel/auth.js';
import { methodNotAllowed, readJson, sendJson } from '../lib/vercel/http.js';
import { db } from '../lib/vercel/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return sendJson(res, 503, { error: 'Connexion admin non configurée.' });
  try {
    const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim().slice(0, 100);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const attempts = await db(`login_attempts?select=id&ip=eq.${encodeURIComponent(ip)}&attempted_at=gt.${encodeURIComponent(since)}&limit=7`);
    if (attempts.length >= 6) return sendJson(res, 429, { error: 'Trop d’essais. Réessayez dans quelques minutes.' });
    const body = await readJson(req);
    if (typeof body.password !== 'string' || !passwordMatches(body.password, process.env.ADMIN_PASSWORD)) {
      await db('login_attempts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip, attempted_at: new Date().toISOString() }) });
      return sendJson(res, 401, { error: 'Mot de passe incorrect.' });
    }
    await db(`login_attempts?attempted_at=lt.${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    res.setHeader('Set-Cookie', createSessionCookie());
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 503, { error: error.message || 'Supabase est indisponible.' });
  }
}
