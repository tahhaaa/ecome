import { hasAdminSession, jsonResponse } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!await hasAdminSession(request, env)) return jsonResponse({ error: 'Connexion administrateur requise.' }, 401);
  if (!env.IMAGES) return jsonResponse({ error: 'Stockage photo non configuré.' }, 503);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'Image invalide.' }, 400); }
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(body.data || '');
  if (!match) return jsonResponse({ error: 'Format image non accepté.' }, 400);
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  if (bytes.byteLength > 4_000_000) return jsonResponse({ error: 'Image trop volumineuse (4 Mo maximum).' }, 413);
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const key = `${crypto.randomUUID().replaceAll('-', '')}.${extension}`;
  await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: `image/${match[1]}` } });
  return jsonResponse({ url: `/uploads/${key}` }, 201);
}
