import { createHash, randomBytes } from 'node:crypto';
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
    const size = String(body.size || '').trim().slice(0, 30);
    const quantity = Number.parseInt(body.quantity, 10);
    if (customerName.length < 2 || !/^\+?\d{9,15}$/.test(phone) || city.length < 2 || !productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return Response.json({ error: 'Vérifiez le nom, le téléphone, la ville et la quantité.' }, { status: 400 });
    }

    const shippingFee = shippingFor(city);
    const trackingToken = randomBytes(32).toString('base64url');
    const createdOrder = await db('rpc/place_shop_order', {
      method: 'POST',
      body: JSON.stringify({
        p_customer_name: customerName,
        p_phone: phone,
        p_city: city,
        p_product_id: productId,
        p_quantity: quantity,
        p_size: size,
        p_shipping_fee: shippingFee,
        p_tracking_token_hash: createHash('sha256').update(trackingToken).digest('hex'),
      }),
    });
    if (!createdOrder?.id) throw new Error('Supabase n’a pas retourné la commande enregistrée.');

    try {
      await sendOrderPush(createdOrder, customerName, `${createdOrder.product_name}${size ? ` · taille ${size}` : ''}`);
    } catch (error) {
      console.error('Order push failed:', error.message);
    }
    return Response.json({ ok: true, order: { id: createdOrder.id, total: createdOrder.total, size: size || null }, trackingToken }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order save failed:', error.message);
    const message = error.message || '';
    if (message.includes('SIZE_OUT_OF_STOCK')) return Response.json({ error: 'Cette taille vient d’être épuisée. Choisissez une autre taille.' }, { status: 409 });
    if (message.includes('OUT_OF_STOCK')) return Response.json({ error: 'Ce produit est épuisé.' }, { status: 409 });
    if (message.includes('SIZE_NOT_AVAILABLE') || message.includes('PRODUCT_ONE_SIZE')) return Response.json({ error: 'Cette taille n’est pas disponible pour ce produit.' }, { status: 409 });
    if (message.includes('PRODUCT_NOT_FOUND')) return Response.json({ error: 'Ce produit n’est plus disponible.' }, { status: 404 });
    if (message.includes('place_shop_order') || message.includes('shop_orders') || message.includes('P0001')) {
      return Response.json({ error: 'La commande n’a pas pu être enregistrée. Vérifiez que la migration Supabase 0005 est exécutée.' }, { status: 409 });
    }
    return Response.json({ error: 'La commande n’a pas pu être enregistrée. Réessayez dans un instant.' }, { status: 503 });
  }
}

export async function GET(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const rows = await db('shop_orders?select=*&deleted_at=is.null&order=created_at.desc&limit=200');
    return Response.json({ orders: rows || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order list failed:', error.message);
    return Response.json({ error: 'Impossible de charger les commandes. Vérifiez la migration Supabase.' }, { status: 503 });
  }
}

export async function PATCH(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const body = await request.json();
    const { id, status } = body;
    if (!id || (status === undefined && body.delivery_expenses === undefined && body.delivery_address === undefined)) return Response.json({ error: 'Modification invalide.' }, { status: 400 });
    const updates = {};
    if (status !== undefined) {
      if (!['new', 'confirmed', 'shipped', 'completed', 'cancelled'].includes(status)) return Response.json({ error: 'Statut de commande invalide.' }, { status: 400 });
      updates.status = status;
    }
    if (body.delivery_expenses !== undefined) {
      if (!Array.isArray(body.delivery_expenses) || body.delivery_expenses.length > 30) return Response.json({ error: 'Liste de frais invalide.' }, { status: 400 });
      const cleanExpenses = [];
      for (const entry of body.delivery_expenses) {
        const label = String(entry.label || '').trim().slice(0, 80);
        const amount = Number(entry.amount);
        if (!label || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return Response.json({ error: 'Chaque frais doit avoir un motif et un montant positif.' }, { status: 400 });
        cleanExpenses.push({ id: String(entry.id || randomBytes(8).toString('hex')), label, amount: Math.round(amount * 100) / 100, created_at: entry.created_at || new Date().toISOString() });
      }
      updates.delivery_expenses = cleanExpenses;
    }
    if (body.delivery_address !== undefined) {
      if (typeof body.delivery_address !== 'string' || body.delivery_address.trim().length > 500) return Response.json({ error: 'Adresse de livraison invalide (500 caractères maximum).' }, { status: 400 });
      updates.delivery_address = body.delivery_address.trim();
    }
    const rows = await db(`shop_orders?id=eq.${encodeURIComponent(String(id))}&deleted_at=is.null&select=id,status,delivery_expenses,delivery_address`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    });
    if (!rows?.length) return Response.json({ error: 'Commande introuvable.' }, { status: 404 });
    return Response.json({ ok: true, order: rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order update failed:', error.message);
    return Response.json({ error: 'Impossible de modifier cette commande.' }, { status: 503 });
  }
}

export async function DELETE(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) return Response.json({ error: 'Commande invalide.' }, { status: 400 });
    const result = await db('rpc/soft_delete_shop_order', { method: 'POST', body: JSON.stringify({ p_order_id: id }) });
    return Response.json({ ok: true, order: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Order delete failed:', error.message);
    const errorMessage = error.message || '';
    return Response.json({ error: errorMessage.includes('ORDER_NOT_FOUND') ? 'Cette commande est introuvable ou déjà supprimée.' : 'Suppression impossible. Vérifiez la migration Supabase 0005.' }, { status: 503 });
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
