function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || 'product-images';
  if (!url || !key) throw new Error('Supabase n’est pas configuré.');
  return { url, key, bucket };
}

export async function db(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Erreur Supabase (${response.status})${text ? ` : ${text.slice(0, 300)}` : ''}`);
  return text ? JSON.parse(text) : null;
}

export async function uploadImage(key, bytes, contentType) {
  const { url, key: secretKey, bucket } = config();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${key}`, {
    method: 'POST',
    headers: { apikey: secretKey, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Téléversement Supabase refusé (${response.status}).`);
  return `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${key}`;
}
