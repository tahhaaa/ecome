import OrdersAdmin from '../../components/orders-admin.jsx';

export const metadata = { title: 'Administration · Crooza', robots: { index: false, follow: false } };

export default function AdminPage() {
  return <OrdersAdmin />;
}
