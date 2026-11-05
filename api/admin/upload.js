import { randomUUID } from 'node:crypto';
import { hasAdminSession } from '../../lib/vercel/auth.js';
import { methodNotAllowed, readJson, sendJson } from '../../lib/vercel/http.js';
import { uploadImage } from '../../lib/vercel/supabase.js';

const types = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!hasAdminSession(req)) return sendJson(res, 401, { error: 'Connexion administrateur requise.' });
  try {
    const body = await readJson(req);
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(body.data || '');
    if (!match) return sendJson(res, 400, { error: 'Format image non accepté.' });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.byteLength > 3_000_000) return sendJson(res, 413, { error: 'Image trop volumineuse (3 Mo maximum).' });
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const url = await uploadImage(`${randomUUID()}.${extension}`, bytes, types[match[1]]);
    return sendJson(res, 201, { url });
  } catch (error) {
    return sendJson(res, 503, { error: error.message || 'Téléversement impossible.' });
  }
}
