import './globals.css';
import AnalyticsTracker from '../components/analytics-tracker.jsx';

export const metadata = {
  title: 'Crooza',
  description: 'Une sélection de pièces choisies avec soin. Découvrez la boutique et commandez directement sur WhatsApp.',
  applicationName: 'Crooza',
};

export const viewport = { themeColor: '#f7f5ef' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&display=swap" rel="stylesheet" />
      </head>
      <body><AnalyticsTracker />{children}</body>
    </html>
  );
}
