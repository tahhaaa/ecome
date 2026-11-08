import { hasAdminSession } from '../../../../lib/auth.js';
import { db } from '../../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return Response.json({ error: 'Clés VAPID manquantes dans Vercel. Ajoutez-les puis redéployez.' }, { status: 503 });
  }

  try {
    const subscriptions = await db('admin_push_subscriptions?select=endpoint,subscription');
    if (!subscriptions?.length) return Response.json({ error: 'Aucun appareil inscrit. Sur cet iPhone, ouvrez /admin depuis Crooza ajouté à l’écran d’accueil puis activez les notifications.' }, { status: 404 });

    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@crooza.vercel.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const results = await Promise.all(subscriptions.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ title: 'Crooza · Test de notification', body: 'Les notifications de commande sont bien activées sur cet appareil.', url: '/admin' }));
        return { ok: true };
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await db(`admin_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE' });
        }
        return { ok: false, status: error.statusCode || 0 };
      }
    }));
    const sent = results.filter(result => result.ok).length;
    const failed = results.length - sent;
    return Response.json({ ok: sent > 0, sent, failed, error: sent ? null : 'Le service push a refusé tous les appareils. Réactivez les notifications sur l’iPhone et vérifiez les clés VAPID.' });
  } catch (error) {
    console.error('Push test failed:', error.message);
    return Response.json({ error: 'Test push impossible. Vérifiez les clés VAPID et la migration Supabase 0002.' }, { status: 503 });
  }
}
