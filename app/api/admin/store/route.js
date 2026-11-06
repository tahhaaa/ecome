import { hasAdminSession } from '../../../../lib/auth.js';
import { db } from '../../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

export async function PUT(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const content = await request.json();
    if (!content || !Array.isArray(content.products)) return Response.json({ error: 'Liste de produits invalide.' }, { status: 400 });
    if (Buffer.byteLength(JSON.stringify(content)) > 1_800_000) return Response.json({ error: 'Boutique trop volumineuse.' }, { status: 413 });
    await db('shop_store?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, content, updated_at: new Date().toISOString() }),
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Store save failed:', error.message);
    return Response.json({ error: `Enregistrement refusé par Supabase : ${error.message || 'erreur inconnue'}` }, { status: 503 });
  }
}
