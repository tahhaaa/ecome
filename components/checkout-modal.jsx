'use client';

import { useMemo, useState } from 'react';

function deliveryPrice(city, freeShipping = false) {
  if (freeShipping) return 0;
  const name = String(city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return ['rabat', 'temara', 'الرباط', 'تمارة'].includes(name) ? 25 : 35;
}

function money(value) { return `${Number(value || 0).toLocaleString('fr-FR')} DH`; }

export default function CheckoutModal({ items, products, promotions = {}, onUpdateItems, onClose }) {
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const byId = new Map(products.map(product => [String(product.id), product]));
  const cart = items.map(item => ({ ...item, product: byId.get(String(item.productId)) })).filter(item => item.product);
  const bundle = promotions.buyXGetY || {};
  const eligibleBuyIds = new Set((Array.isArray(bundle.buyProductIds) && bundle.buyProductIds.length ? bundle.buyProductIds : [bundle.buyProductId].filter(Boolean)).map(String));
  const eligibleBuyItems = bundle.enabled ? cart.filter(item => eligibleBuyIds.has(String(item.productId))) : [];
  const eligibleBuyQuantity = eligibleBuyItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
  const eligibleBuyNames = [...new Set(eligibleBuyItems.map(item => item.product.name))].join(', ');
  const giftProduct = byId.get(String(bundle.freeProductId));
  const freeQuantity = bundle.enabled && giftProduct && eligibleBuyQuantity >= Number(bundle.buyQuantity || 2)
    ? Math.floor(eligibleBuyQuantity / Math.max(1, Number(bundle.buyQuantity) || 2)) * Math.max(1, Number(bundle.freeQuantity) || 1)
    : 0;
  const freeShipping = promotions.freeShipping?.enabled === true;
  const shipping = useMemo(() => deliveryPrice(city, freeShipping), [city, freeShipping]);
  const subtotal = cart.reduce((total, item) => total + Number(item.product.price || 0) * Number(item.quantity || 0), 0);
  const itemCount = cart.reduce((total, item) => total + Number(item.quantity || 0), 0);

  function updateItem(productId, changes) {
    onUpdateItems(current => current.map(item => String(item.productId) === String(productId) ? { ...item, ...changes } : item));
  }

  function removeItem(productId) {
    onUpdateItems(current => current.filter(item => String(item.productId) !== String(productId)));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    if (!cart.length) { setError('Ajoute au moins un article au panier.'); setBusy(false); return; }
    if (cart.some(item => !item.product.oneSize && !item.size)) { setError('Choisis une pointure pour chaque paire avant de commander.'); setBusy(false); return; }
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), phone: form.get('phone'), city, items: cart.map(item => ({ productId: item.productId, quantity: Number(item.quantity), size: item.product.oneSize ? null : item.size })) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Commande impossible pour le moment.');
      setSuccess({ ...result.order, trackingToken: result.trackingToken });
      onUpdateItems([]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="checkout-overlay open" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="checkout-panel cart-checkout-panel" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <button className="icon-button checkout-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
        {success ? (
          <div className="checkout-success">
            <span className="checkout-success-mark">✓</span>
            <p className="eyebrow"><span className="eyebrow-line" /> COMMANDE REÇUE</p>
            <h2 id="checkoutTitle">Merci <em>beaucoup.</em></h2>
            <p>Votre commande est bien enregistrée{success.free_quantity > 0 && giftProduct ? <> avec <strong>{success.free_quantity} {giftProduct.name} offert{success.free_quantity > 1 ? 's' : 'e'}</strong></> : null}. Nous vous contacterons au numéro indiqué pour confirmer la livraison.</p>
            <div className="checkout-total"><span>Total à payer à la livraison</span><strong>{money(success.total)}</strong></div>
            <a className="button button-dark tracking-button" href={`/suivi#${success.trackingToken || ''}`}>Suivre ma commande <span>↗</span></a>
            <button className="checkout-continue" type="button" onClick={onClose}>Continuer la visite</button>
          </div>
        ) : (
          <>
            <p className="eyebrow"><span className="eyebrow-line" /> COMMANDE EN QUELQUES SECONDES</p>
            <h2 id="checkoutTitle">Votre <em>panier.</em></h2>
            <div className="cart-items-list">
              {cart.map(({ product, productId, quantity, size }) => {
                const sizes = product.oneSize ? [] : (Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['35-36', '37-38', '39-40', '41-42', '43-44', '45-46']);
                return <article className="cart-line" key={productId}>
                  <img src={product.image} alt="" />
                  <div className="cart-line-main"><strong>{product.name}</strong><span>{money(product.price)} / pièce</span>
                    <div className="cart-line-controls">
                      {sizes.length > 0 && <label>Pointure<select value={size || ''} onChange={event => updateItem(productId, { size: event.target.value })}><option value="">Choisir</option>{sizes.map(option => <option key={option} value={option}>{option.replace('-', '–')}</option>)}</select></label>}
                      <label>Quantité<select value={quantity} onChange={event => updateItem(productId, { quantity: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                    </div>
                  </div>
                  <strong className="cart-line-total">{money(Number(product.price || 0) * quantity)}</strong>
                  <button className="cart-remove" type="button" onClick={() => removeItem(productId)} aria-label={`Retirer ${product.name} du panier`}>×</button>
                </article>;
              })}
              {!cart.length && <p className="cart-empty">Ton panier est vide. Retourne à la collection pour choisir des articles.</p>}
            </div>
            {freeQuantity > 0 && giftProduct && <div className="cart-gift-note">✳ Offre Crooza : <strong>{freeQuantity} {giftProduct.name}</strong> offert{freeQuantity > 1 ? 's' : 'e'} avec {eligibleBuyQuantity} article{eligibleBuyQuantity > 1 ? 's' : ''} acheté{eligibleBuyQuantity > 1 ? 's' : ''}{eligibleBuyNames ? ` (${eligibleBuyNames})` : ''}.</div>}
            {bundle.enabled && eligibleBuyItems.length > 0 && !freeQuantity && <p className="cart-promo-hint">Ajoute encore {Math.max(0, Number(bundle.buyQuantity || 2) - eligibleBuyQuantity)} article(s) concerné(s) pour recevoir {giftProduct?.name || 'le cadeau'} offert.</p>}
            <form className="checkout-form" onSubmit={submit}>
              <label>Votre nom complet<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Ex. Sara El Amrani" /></label>
              <label>Votre téléphone<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required pattern="[+0-9 ()().-]{9,20}" placeholder="06 12 34 56 78" /></label>
              <label>Votre ville<input name="city" autoComplete="address-level2" required minLength={2} maxLength={80} value={city} onChange={event => setCity(event.target.value)} placeholder="Ex. Casablanca, Rabat, Témara…" /></label>
              <div className="checkout-summary"><span>Articles · {itemCount}</span><strong>{money(subtotal)}</strong>{freeQuantity > 0 && giftProduct && <><span>{giftProduct.name} offert{freeQuantity > 1 ? 's' : 'e'}</span><strong>{freeQuantity} · 0 DH</strong></>}<span>Livraison <small>{freeShipping ? '· offerte' : city.trim() ? `· ${city}` : '· toutes les villes'}</small></span><strong>{shipping === 0 ? 'Offerte' : money(shipping)}</strong><span className="checkout-summary-total">Total à payer à la livraison</span><strong className="checkout-summary-total">{money(subtotal + shipping)}</strong></div>
              {error && <p className="checkout-error" role="alert">{error}</p>}
              <button className="button button-dark checkout-submit" type="submit" disabled={busy || !cart.length}>{busy ? 'Envoi de la commande…' : 'Confirmer ma commande'} <span>↗</span></button>
              <p className="checkout-privacy">Aucune adresse demandée. Nous confirmons votre commande par téléphone.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
