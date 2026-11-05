export async function onRequestGet({ params, env }) {
  const key = params.key;
  if (!/^[a-f0-9]{32}\.(png|jpg|webp|gif)$/.test(key)) return new Response('Introuvable', { status: 404 });
  const object = await env.IMAGES.get(key);
  if (!object) return new Response('Introuvable', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
