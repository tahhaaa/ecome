import defaults from '../store.default.json';
import { db } from './vercel/supabase.js';

export function publicStore(content) {
  const products = Array.isArray(content?.products) ? content.products.map(product => {
    const { purchasePrice, stock, inventoryBySize, ...publicProduct } = product;
    const inventory = inventoryBySize && typeof inventoryBySize === 'object' && !Array.isArray(inventoryBySize) ? inventoryBySize : null;
    const sizeInventoryExists = inventory && Object.keys(inventory).length > 0;
    const sizes = Array.isArray(product.sizes) ? product.sizes.filter(size => !sizeInventoryExists || Number(inventory[size] || 0) > 0) : [];
    const inStock = sizeInventoryExists ? sizes.length > 0 : stock === undefined || Number(stock) > 0;
    return { ...publicProduct, sizes, inStock };
  }) : [];
  return { ...content, products };
}

export async function getRawStore() {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) return defaults;
  try {
    const rows = await db('shop_store?select=content&id=eq.1');
    return rows?.[0]?.content ? { ...defaults, ...rows[0].content } : defaults;
  } catch (error) {
    console.error('Supabase store read failed:', error.message);
    return defaults;
  }
}

export async function getStore() {
  return publicStore(await getRawStore());
}
