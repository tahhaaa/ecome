import { clearSessionCookie } from '../../../lib/auth.js';

export const runtime = 'nodejs';

export async function POST() {
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } });
}
