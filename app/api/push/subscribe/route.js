import { hasAdminSession } from '../../../../lib/auth.js';
import { db } from '../../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const { subscription } = await request.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return Response.json({ error: 'Abonnement de notification invalide.' }, { status: 400 });
    }
    await db('admin_push_subscriptions?on_conflict=endpoint', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint: subscription.endpoint, subscription, updated_at: new Date().toISOString() }),
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Push subscription failed:', error.message);
    return Response.json({ error: 'Impossible d’activer les notifications.' }, { status: 503 });
  }
}
