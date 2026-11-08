import { getStore } from '../../../lib/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getStore(), { headers: { 'Cache-Control': 'no-store' } });
}
