import { hasAdminSession } from '../../lib/vercel/auth.js';
import { methodNotAllowed, readJson, sendJson } from '../../lib/vercel/http.js';
import { db } from '../../lib/vercel/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') return methodNotAllowed(res, ['PUT']);
  if (!hasAdminSession(req)) return sendJson(res, 401, { error: 'Connexion administrateur requise.' });
  try {
    const content = await readJson(req);
    if (!content || !Array.isArray(content.products)) return sendJson(res, 400, { error: 'Liste de produits invalide.' });
    const serialized = JSON.stringify(content);
    if (Buffer.byteLength(serialized) > 1_800_000) return sendJson(res, 413, { error: 'Boutique trop volumineuse.' });
    await db('shop_store?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: 1, content, updated_at: new Date().toISOString() }),
    });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 503, { error: error.message || 'Enregistrement impossible.' });
  }
}
