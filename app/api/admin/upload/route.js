import { randomUUID } from 'node:crypto';
import { hasAdminSession } from '../../../../lib/auth.js';
import { uploadImage } from '../../../../lib/vercel/supabase.js';

export const runtime = 'nodejs';

const types = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export async function POST(request) {
  if (!hasAdminSession(request)) return Response.json({ error: 'Connexion administrateur requise.' }, { status: 401 });
  try {
    const body = await request.json();
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(body.data || '');
    if (!match) return Response.json({ error: 'Format image non accepté.' }, { status: 400 });
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 3_000_000) return Response.json({ error: 'Image trop volumineuse (3 Mo maximum).' }, { status: 413 });
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
    const url = await uploadImage(`${randomUUID()}.${extension}`, bytes, types[match[1]]);
    return Response.json({ url }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Image upload failed:', error.message);
    return Response.json({ error: 'Téléversement impossible. Vérifiez le stockage Supabase.' }, { status: 503 });
  }
}
