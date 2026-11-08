import { db } from '../../../lib/vercel/supabase.js';
import { hasAdminSession } from '../../../lib/auth.js';

export const runtime = 'nodejs';

const allowedTypes = new Set(['page_view', 'product_view', 'heartbeat']);

export async function POST(request) {
  try {
    const body = await request.json();
    const type = String(body.type || '');
    const visitorId = String(body.visitorId || '');
    const path = String(body.path || '/').slice(0, 180);
    const productId = body.productId ? String(body.productId).slice(0, 100) : null;
    if (!allowedTypes.has(type) || !/^[0-9a-f-]{36}$/i.test(visitorId) || !path.startsWith('/') || path.startsWith('/admin')) {
      return Response.json({ ok: false }, { status: 400 });
    }
    if (type === 'heartbeat') {
      await db('shop_active_visitors?on_conflict=visitor_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ visitor_id: visitorId, path, last_seen: new Date().toISOString() }),
      });
    } else {
      await db('shop_analytics_events', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ event_type: type, visitor_id: visitorId, path, product_id: productId }),
      });
    }
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Analytics event failed:', error.message);
    return Response.json({ ok: false }, { status: 503 });
  }
}

export async function GET(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const summary = await db('rpc/get_shop_analytics', { method: 'POST', body: JSON.stringify({ p_since: since }) });
    return Response.json(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Analytics summary failed:', error.message);
    return Response.json({ error: 'Statistiques indisponibles. Vérifiez la migration Supabase 0003.' }, { status: 503 });
  }
}
