'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

async function record(event) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Analytics should never interrupt the shopping experience.
  }
}

export function trackProductView(productId) {
  if (typeof window === 'undefined') return;
  let visitorId = sessionStorage.getItem('crooza-visit-id');
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    sessionStorage.setItem('crooza-visit-id', visitorId);
  }
  record({ type: 'product_view', visitorId, path: window.location.pathname, productId: String(productId) });
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return undefined;
    let visitorId = sessionStorage.getItem('crooza-visit-id');
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem('crooza-visit-id', visitorId);
    }

    record({ type: 'page_view', visitorId, path: pathname });
    record({ type: 'heartbeat', visitorId, path: pathname });
    const heartbeat = window.setInterval(() => record({ type: 'heartbeat', visitorId, path: pathname }), 60000);
    return () => window.clearInterval(heartbeat);
  }, [pathname]);

  return null;
}
