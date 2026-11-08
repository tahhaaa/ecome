export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  return Response.json({ key }, { headers: { 'Cache-Control': 'no-store' } });
}
