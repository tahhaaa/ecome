import Storefront from '../components/storefront.jsx';
import { getStore } from '../lib/store.js';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const store = await getStore();
  return <Storefront initialStore={store} />;
}
