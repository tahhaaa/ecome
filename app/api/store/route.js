import defaults from '../../../store.default.json';
import { db } from '../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db('shop_store?select=content&id=eq.1');
    return Response.json({ ...defaults, ...(rows?.[0]?.content || {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(defaults, { headers: { 'Cache-Control': 'no-store' } });
  }
}
