import { hasAdminSession } from '../../../lib/auth.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return Response.json({ authenticated: hasAdminSession(request) }, { headers: { 'Cache-Control': 'no-store' } });
}
