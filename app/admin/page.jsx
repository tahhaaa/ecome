import OrdersAdmin from '../../components/orders-admin.jsx';

export const metadata = {
  title: 'Administration · Crooza',
  applicationName: 'Crooza Admin',
  manifest: '/admin.webmanifest',
  icons: {
    icon: [{ url: '/admin-icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/admin-icon.png', sizes: '512x512', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Crooza Admin', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <OrdersAdmin />;
}
