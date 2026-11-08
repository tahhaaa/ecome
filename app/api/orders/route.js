import { db } from '../../../lib/vercel/supabase.js';
import { hasAdminSession } from '../../../lib/auth.js';

export const runtime = 'nodejs';

function shippingFor(city) {
  const normalized = String(city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return /^(rabat|temara|temara city|الرباط|تمارة)$/.test(normalized) ? 25 : 35;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const customerName = String(body.name || '').trim().slice(0, 100);
    const phone = String(body.phone || '').replace(/[\s().-]/g, '').slice(0, 20);
    const city = String(body.city || '').trim().slice(0, 80);
    const productId = String(body.productId || '').slice(0, 100);
    const quantity = Math.max(1, Math.min(10, Number.parseInt(body.quantity, 10) || 1));
    if (customerName.length < 2 || !/^\+?\d{9,15}$/.test(phone) || city.length < 2 || !productId) {
      return Response.json({ error: 'Vérifiez le nom, le téléphone et la ville.' }, { status: 400 });
    }

    const rows = await db('shop_store?select=content&id=eq.1');
    const product = rows?.[0]?.content?.products?.find(item => String(item.id) === productId);
    if (!product) return Response.json({ error: 'Ce produit n’est plus disponible.' }, { status: 404 });
    const unitPrice = Number(product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return Response.json({ error: 'Prix du produit invalide.' }, { status: 400 });
    const subtotal = unitPrice * quantity;
    const shippingFee = shippingFor(city);
    const order = {
      customer_name: customerName,
      phone,
      city,
      items: [{ id: String(product.id), name: String(product.name), image: String(product.image || ''), unit_price: unitPrice, quantity }],
      subtotal,
      shipping_fee: shippingFee,
      total: subtotal + shippingFee,
      status: 'new',
    };
    const saved = await db('shop_orders?select=id,created_at,total', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(order),
    });
    const createdOrder = saved?.[0];
    if (!createdOrder) throw new Error('Supabase n’a pas retourné la commande enregistrée.');

    try {
      await sendOrderPush(createdOrder, customerName, product.name);
    } catch (error) {
      console.error('Order push failed:', error.message);
    }
    return Response.json({ ok: true, order: { id: createdOrder.id, total: createdOrder.total } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order save failed:', error.message);
    return Response.json({ error: 'La commande n’a pas pu être enregistrée. Réessayez dans un instant.' }, { status: 503 });
  }
}

export async function GET(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const rows = await db('shop_orders?select=*&order=created_at.desc&limit=200');
    return Response.json({ orders: rows || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order list failed:', error.message);
    return Response.json({ error: 'Impossible de charger les commandes. Vérifiez la migration Supabase.' }, { status: 503 });
  }
}

export async function PATCH(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const { id, status } = await request.json();
    if (!id || !['new', 'confirmed', 'shipped', 'completed', 'cancelled'].includes(status)) {
      return Response.json({ error: 'Statut de commande invalide.' }, { status: 400 });
    }
    const rows = await db(`shop_orders?id=eq.${encodeURIComponent(String(id))}&select=id,status`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    });
    if (!rows?.length) return Response.json({ error: 'Commande introuvable.' }, { status: 404 });
    return Response.json({ ok: true, order: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order update failed:', error.message);
    return Response.json({ error: 'Impossible de modifier cette commande.' }, { status: 503 });
  }
}

async function sendOrderPush(order, customerName, productName) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  const webpush = (await import('web-push')).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@crooza.vercel.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subscriptions = await db('admin_push_subscriptions?select=subscription');
  const payload = JSON.stringify({ title: 'Nouvelle commande Crooza', body: `${customerName} · ${productName} · ${Number(order.total).toLocaleString('fr-FR')} DH`, url: '/admin' });
  await Promise.all((subscriptions || []).map(async ({ subscription }) => {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        const endpoint = encodeURIComponent(subscription.endpoint);
        await db(`admin_push_subscriptions?endpoint=eq.${endpoint}`, { method: 'DELETE' });
      } else throw error;
    }
  }));
}
