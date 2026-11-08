'use client';

import { useMemo, useState } from 'react';

function deliveryPrice(city) {
  const name = String(city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return ['rabat', 'temara', 'الرباط', 'تمارة'].includes(name) ? 25 : 35;
}

export default function CheckoutModal({ product, onClose }) {
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const shipping = useMemo(() => deliveryPrice(city), [city]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), phone: form.get('phone'), city, productId: product.id, quantity: 1 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Commande impossible pour le moment.');
      setSuccess(result.order);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-overlay open" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <button className="icon-button checkout-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        {success ? (
          <div className="checkout-success">
            <span className="checkout-success-mark">✓</span>
            <p className="eyebrow"><span className="eyebrow-line" /> COMMANDE REÇUE</p>
            <h2 id="checkoutTitle">Merci <em>beaucoup.</em></h2>
            <p>Votre demande pour <strong>{product.name}</strong> est bien enregistrée. Nous vous contacterons au numéro indiqué pour confirmer la livraison.</p>
            <div className="checkout-total"><span>Total avec livraison</span><strong>{Number(success.total).toLocaleString('fr-FR')} DH</strong></div>
            <button className="button button-dark" type="button" onClick={onClose}>Continuer la visite <span>↗</span></button>
          </div>
        ) : (
          <>
            <p className="eyebrow"><span className="eyebrow-line" /> COMMANDE EN QUELQUES SECONDES</p>
            <h2 id="checkoutTitle">Recevoir <em>votre pièce.</em></h2>
            <div className="checkout-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{Number(product.price || 0).toLocaleString('fr-FR')} DH</span></div></div>
            <form className="checkout-form" onSubmit={submit}>
              <label>Votre nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Ex. Sara El Amrani" /></label>
              <label>Votre téléphone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required pattern="[+0-9 ()().-]{9,20}" placeholder="06 12 34 56 78" /></label>
              <label>Votre ville<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder="Ex. Casablanca, Rabat, Témara…" /></label>
              <div className="checkout-summary"><span>Livraison <small>{city.trim() ? `· ${city}` : '· toutes les villes'}</small></span><strong>{shipping} DH</strong><span className="checkout-summary-total">Total à payer à la livraison</span><strong className="checkout-summary-total">{(Number(product.price || 0) + shipping).toLocaleString('fr-FR')} DH</strong></div>
              {error && <p className="checkout-error" role="alert">{error}</p>}
              <button className="button button-dark checkout-submit" type="submit" disabled={busy}>{busy ? 'Envoi de la commande…' : 'Confirmer ma commande'} <span>↗</span></button>
              <p className="checkout-privacy">Aucune adresse demandée. Nous confirmons votre commande par téléphone.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
