'use client';

import { useMemo, useState } from 'react';

function deliveryPrice(city, freeShipping = false) {
  if (freeShipping) return 0;
  const name = String(city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return ['rabat', 'temara', 'الرباط', 'تمارة'].includes(name) ? 25 : 35;
}

export default function CheckoutModal({ product, promotions = {}, onClose }) {
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const configuredSizes = Array.isArray(product.sizes) ? product.sizes.filter(Boolean) : [];
  const sizes = configuredSizes.length ? configuredSizes : ['35-36', '37-38', '39-40', '41-42', '43-44', '45-46'];
  const bundle = promotions.buyXGetY || {};
  const freeShipping = promotions.freeShipping?.enabled === true;
  const freeQuantity = bundle.enabled ? Math.floor(quantity / Math.max(1, Number(bundle.buyQuantity) || 2)) * Math.max(1, Number(bundle.freeQuantity) || 1) : 0;
  const shipping = useMemo(() => deliveryPrice(city, freeShipping), [city, freeShipping]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), phone: form.get('phone'), city, productId: product.id, quantity, size }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Commande impossible pour le moment.');
      setSuccess({ ...result.order, trackingToken: result.trackingToken });
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
            <p>Votre demande pour <strong>{product.name}</strong>{success.size ? <> en pointure <strong>{success.size}</strong></> : null} est bien enregistrée. {success.free_quantity > 0 ? <><strong>{success.free_quantity} paire{success.free_quantity > 1 ? 's' : ''} offerte{success.free_quantity > 1 ? 's' : ''}</strong> incluse{success.free_quantity > 1 ? 's' : ''}. </> : null}Nous vous contacterons au numéro indiqué pour confirmer la livraison.</p>
            <div className="checkout-total"><span>Total avec livraison</span><strong>{Number(success.total).toLocaleString('fr-FR')} DH</strong></div>
            <a className="button button-dark tracking-button" href={`/suivi#${success.trackingToken || ''}`}>Suivre ma commande <span>↗</span></a>
            <button className="checkout-continue" type="button" onClick={onClose}>Continuer la visite</button>
          </div>
        ) : (
          <>
            <p className="eyebrow"><span className="eyebrow-line" /> COMMANDE EN QUELQUES SECONDES</p>
            <h2 id="checkoutTitle">Recevoir <em>votre pièce.</em></h2>
            <div className="checkout-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>{Number(product.price || 0).toLocaleString('fr-FR')} DH / pièce</span></div></div>
            <form className="checkout-form" onSubmit={submit}>
              <label>Votre nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Ex. Sara El Amrani" /></label>
              <label>Votre téléphone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required pattern="[+0-9 ()().-]{9,20}" placeholder="06 12 34 56 78" /></label>
              <label>Votre ville<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder="Ex. Casablanca, Rabat, Témara…" /></label>
              <label>Quantité souhaitée<select name="quantity" value={quantity} onChange={event => setQuantity(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value} {value === 1 ? 'paire' : 'paires'}</option>)}</select></label>
              {sizes.length > 0 && <label>Choisissez votre pointure<select name="size" required value={size} onChange={event => setSize(event.target.value)}><option value="">Sélectionner une pointure</option>{sizes.map(option => <option key={option} value={option}>{option.replace('-', '–')}</option>)}</select></label>}
              {freeQuantity > 0 && <p className="checkout-promo-note">✳ {bundle.label || `${bundle.buyQuantity} achetées, ${bundle.freeQuantity} offerte`} · {freeQuantity} paire{freeQuantity > 1 ? 's' : ''} offerte{freeQuantity > 1 ? 's' : ''}</p>}
              <div className="checkout-summary"><span>Articles · {quantity} payée{quantity > 1 ? 's' : ''}</span><strong>{(Number(product.price || 0) * quantity).toLocaleString('fr-FR')} DH</strong>{freeQuantity > 0 && <><span>Offertes</span><strong>{freeQuantity} paire{freeQuantity > 1 ? 's' : ''} · 0 DH</strong></>}<span>Livraison <small>{freeShipping ? '· offerte' : city.trim() ? `· ${city}` : '· toutes les villes'}</small></span><strong>{shipping === 0 ? 'Offerte' : `${shipping} DH`}</strong><span className="checkout-summary-total">Total à payer à la livraison</span><strong className="checkout-summary-total">{(Number(product.price || 0) * quantity + shipping).toLocaleString('fr-FR')} DH</strong></div>
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
