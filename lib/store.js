import defaults from '../store.default.json';
import { db } from './vercel/supabase.js';

export async function getStore() {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return defaults;
  try {
    const rows = await db('shop_store?select=content&id=eq.1');
    return rows?.[0]?.content ? { ...defaults, ...rows[0].content } : defaults;
  } catch (error) {
    console.error('Supabase store read failed:', error.message);
    return defaults;
  }
}
