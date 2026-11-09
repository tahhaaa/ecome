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

function getVisitorId() {
  try {
    let visitorId = window.sessionStorage.getItem('crooza-visit-id');
    if (!visitorId) {
      visitorId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem('crooza-visit-id', visitorId);
    }
    return visitorId;
  } catch {
    // Analytics storage can be blocked; never let that stop shopping actions.
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function trackProductView(productId) {
  if (typeof window === 'undefined') return;
  record({ type: 'product_view', visitorId: getVisitorId(), path: window.location.pathname, productId: String(productId) });
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return undefined;
    const visitorId = getVisitorId();

    record({ type: 'page_view', visitorId, path: pathname });
    record({ type: 'heartbeat', visitorId, path: pathname });
    const heartbeat = window.setInterval(() => record({ type: 'heartbeat', visitorId, path: pathname }), 60000);
    return () => window.clearInterval(heartbeat);
  }, [pathname]);

  return null;
}
