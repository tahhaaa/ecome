import { createSessionCookie, jsonResponse, passwordMatches } from '../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.DB) return jsonResponse({ error: 'Connexion admin non configurée.' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const recent = await env.DB.prepare("SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ? AND attempted_at > ?").bind(ip, Date.now() - 10 * 60 * 1000).first();
  if ((recent?.attempts || 0) >= 6) return jsonResponse({ error: 'Trop d’essais. Réessayez dans quelques minutes.' }, 429);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Requête incorrecte.' }, 400); }
  if (typeof body.password !== 'string' || !passwordMatches(body.password, env.ADMIN_PASSWORD)) {
    await env.DB.prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)').bind(ip, Date.now()).run();
    return jsonResponse({ error: 'Mot de passe incorrect.' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(Date.now() - 24 * 60 * 60 * 1000).run();
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': await createSessionCookie(env) });
}
