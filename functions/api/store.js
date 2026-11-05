import { jsonResponse } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const row = await env.DB.prepare('SELECT content FROM shop_store WHERE id = 1').first();
  if (row?.content) return jsonResponse(JSON.parse(row.content));
  const assetUrl = new URL('/store.default.json', request.url);
  const asset = await env.ASSETS.fetch(new Request(assetUrl));
  if (!asset.ok) return jsonResponse({ error: 'Configuration initiale introuvable.' }, 500);
  return new Response(asset.body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
