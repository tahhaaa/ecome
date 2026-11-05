import defaultStore from '../store.default.json' with { type: 'json' };
import { db } from '../lib/vercel/supabase.js';
import { methodNotAllowed, sendJson } from '../lib/vercel/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const rows = await db('shop_store?select=content&id=eq.1');
    if (rows?.[0]?.content) return sendJson(res, 200, rows[0].content);
    return sendJson(res, 200, defaultStore);
  } catch (error) {
    return sendJson(res, 503, { error: error.message || 'Supabase est indisponible.' });
  }
}
