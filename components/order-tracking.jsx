'use client';

import { useCallback, useEffect, useState } from 'react';

const steps = [
  { id: 'new', title: 'Commande reçue', description: 'Votre demande est bien arrivée chez Crooza.' },
  { id: 'confirmed', title: 'Confirmée', description: 'Notre équipe confirme votre commande.' },
  { id: 'shipped', title: 'En livraison', description: 'Votre commande est en route vers vous.' },
  { id: 'completed', title: 'Livrée', description: 'Votre commande a été remise.' },
];

function money(value) { return `${Number(value || 0).toLocaleString('fr-FR')} DH`; }

export default function OrderTracking() {
  const [token] = useState(() => typeof window === 'undefined' ? '' : window.location.hash.slice(1));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) { setError('Ce lien de suivi est incomplet. Ouvrez le lien reçu après votre commande.'); setLoading(false); return; }
    try {
      const response = await fetch('/api/orders/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Impossible de charger le suivi.');
      setOrder(result.order);
      setError('');
    } catch (fetchError) { setError(fetchError.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const currentStep = steps.findIndex(step => step.id === order?.status);
  const cancelled = order?.status === 'cancelled';

  return (
    <main className="tracking-page">
      <header className="tracking-header"><a href="/" className="tracking-brand">CROOZA<span>VOTRE BOUTIQUE</span></a><a href="/" className="tracking-shop-link">Retour à la boutique ↗</a></header>
      <section className="tracking-card">
        <p className="eyebrow"><span className="eyebrow-line" /> ESPACE DE SUIVI PERSONNEL</p>
        <h1>Votre commande,<br /><em>en toute tranquillité.</em></h1>
        {loading && !order && <p className="tracking-message">Nous recherchons votre commande…</p>}
        {error && <div className="tracking-error" role="alert"><strong>Suivi indisponible</strong><span>{error}</span><button type="button" onClick={refresh}>Réessayer</button></div>}
        {order && <>
          <div className="tracking-order-meta"><div><span>COMMANDE</span><strong>#{String(order.id).slice(0, 8).toUpperCase()}</strong></div><div><span>PASSÉE LE</span><strong>{new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(new Date(order.created_at))}</strong></div></div>
          {cancelled ? <div className="tracking-cancelled"><strong>Commande annulée</strong><p>Contactez-nous si vous avez besoin d’aide au sujet de cette commande.</p><a href="https://wa.me/212622222430" target="_blank" rel="noreferrer">Écrire à Crooza sur WhatsApp ↗</a></div> : <ol className="tracking-steps">{steps.map((step, index) => { const done = currentStep >= index; const active = currentStep === index; return <li className={`${done ? 'done' : ''} ${active ? 'current' : ''}`} key={step.id}><span className="tracking-step-icon">{done ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.description}</p></div>{active && <span className="tracking-current-label">EN COURS</span>}</li>; })}</ol>}
          <div className="tracking-items"><h2>Votre sélection</h2>{(order.items || []).map(item => <div className="tracking-item" key={item.id}><img src={item.image || '/images/crooza-mark.png'} alt="" /><span><strong>{item.name}</strong><small>{item.size ? `Taille ${item.size} · ` : ''}Quantité ${item.quantity}</small></span><b>{money(Number(item.unit_price) * Number(item.quantity))}</b></div>)}<div className="tracking-cost"><span>Livraison · {order.city}</span><strong>{money(order.shipping_fee)}</strong></div><div className="tracking-total"><span>Total à la livraison</span><strong>{money(order.total)}</strong></div></div>
          <p className="tracking-updated">État actualisé automatiquement toutes les 30 secondes.</p>
        </>}
        {!order && !loading && !error && <p className="tracking-message">Aucune commande trouvée.</p>}
      </section>
      <footer className="tracking-footer">Une question ? <a href="https://wa.me/212622222430" target="_blank" rel="noreferrer">Contactez-nous sur WhatsApp ↗</a></footer>
    </main>
  );
}
