import { hasAdminSession, jsonResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env }) {
  if (!await hasAdminSession(request, env)) return jsonResponse({ error: 'Connexion administrateur requise.' }, 401);
  let content;
  try { content = await request.json(); } catch { return jsonResponse({ error: 'Contenu invalide.' }, 400); }
  if (!content || !Array.isArray(content.products)) return jsonResponse({ error: 'Liste de produits invalide.' }, 400);
  const serialized = JSON.stringify(content);
  if (new TextEncoder().encode(serialized).byteLength > 1_800_000) return jsonResponse({ error: 'Boutique trop volumineuse.' }, 413);
  await env.DB.prepare("INSERT INTO shop_store (id, content, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at").bind(serialized).run();
  return jsonResponse({ ok: true });
}
