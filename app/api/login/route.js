import { createSessionCookie, passwordMatches } from '../../../lib/auth.js';
import { db } from '../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const { ADMIN_PASSWORD, SESSION_SECRET } = process.env;
  if (!ADMIN_PASSWORD || !SESSION_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'La connexion administrateur n’est pas configurée.' }, { status: 503 });
  }
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim().slice(0, 100);
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const attempts = await db(`login_attempts?select=id&ip=eq.${encodeURIComponent(ip)}&attempted_at=gt.${encodeURIComponent(since)}&limit=7`);
    if (attempts.length >= 6) return Response.json({ error: 'Trop d’essais. Réessayez dans quelques minutes.' }, { status: 429 });

    const body = await request.json();
    if (typeof body.password !== 'string' || !passwordMatches(body.password, ADMIN_PASSWORD)) {
      await db('login_attempts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip }) });
      return Response.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
    }

    await db(`login_attempts?attempted_at=lt.${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': createSessionCookie(), 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Admin login failed:', error.message);
    return Response.json({ error: 'Connexion impossible. Vérifiez la configuration Supabase.' }, { status: 503 });
  }
}
