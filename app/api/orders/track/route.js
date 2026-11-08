import { createHash } from 'node:crypto';
import { db } from '../../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

export async function POST(request) {
  let token = '';
  try { token = String((await request.json()).token || ''); } catch { /* keep an invalid empty token */ }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return Response.json({ error: 'Lien de suivi invalide.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const rows = await db(`shop_orders?select=id,customer_name,city,items,subtotal,shipping_fee,total,status,created_at,updated_at&tracking_token_hash=eq.${tokenHash}&deleted_at=is.null&limit=1`);
    if (!rows?.length) return Response.json({ error: 'Commande introuvable. Vérifiez votre lien de suivi.' }, { status: 404 });
    const { order } = { order: rows[0] };
    return Response.json({ order: { ...order, items: (order.items || []).map(({ purchase_price, ...item }) => item) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order tracking failed:', error.message);
    return Response.json({ error: 'Le suivi est temporairement indisponible.' }, { status: 503 });
  }
}
