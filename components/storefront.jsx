'use client';

import { useEffect, useMemo, useState } from 'react';
import CheckoutModal from './checkout-modal.jsx';
import { trackProductView } from './analytics-tracker.jsx';

const phone = '212622222430';
const fallback = { brand: 'Crooza', accent: '#c36e4f', background: '#f7f5ef', textColor: '#292b26', font: 'Playfair Display' };

function whatsapp(message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString('fr-FR')} DH`;
}

export default function Storefront({ initialStore }) {
  const store = initialStore;
  const [selected, setSelected] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('Tout');
  const [promoOpen, setPromoOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') { setSelected(null); setCartOpen(false); setPromoOpen(false); }
      const count = selected?.photos?.length || (selected?.image ? 1 : 0);
      if (count && event.key === 'ArrowRight') setPhotoIndex(index => (index + 1) % count);
      if (count && event.key === 'ArrowLeft') setPhotoIndex(index => (index - 1 + count) % count);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (!store.promotions?.promoPopup?.enabled || cartOpen || selected || promoOpen) return undefined;
    const key = 'crooza-promo-popup-dismissed';
    if (window.sessionStorage.getItem(key) === '1') return undefined;
    const timer = window.setTimeout(() => setPromoOpen(true), 8000);
    return () => window.clearTimeout(timer);
  }, [store.promotions?.promoPopup?.enabled, cartOpen, selected, promoOpen]);

  function dismissPromo() {
    window.sessionStorage.setItem('crooza-promo-popup-dismissed', '1');
    setPromoOpen(false);
  }

  function showProduct(product) {
    trackProductView(product.id);
    setSelected(product);
    setPhotoIndex(0);
  }

  function addToCart(product) {
    trackProductView(product.id);
    setCartItems(current => {
      const existing = current.find(item => String(item.productId) === String(product.id));
      return existing
        ? current.map(item => String(item.productId) === String(product.id) ? { ...item, quantity: Math.min(10, item.quantity + 1) } : item)
        : [...current, { productId: String(product.id), quantity: 1, size: '' }];
    });
    setSelected(null);
    setPromoOpen(false);
    setCartOpen(true);
  }

  const cartCount = cartItems.reduce((count, item) => count + Number(item.quantity || 0), 0);
  const tags = ['Tout', ...new Set(store.products.map(product => product.tag).filter(Boolean))];
  const filteredProducts = useMemo(() => store.products.filter(product => {
    const matchesTag = tagFilter === 'Tout' || product.tag === tagFilter;
    const query = search.trim().toLocaleLowerCase('fr');
    const matchesSearch = !query || `${product.name} ${product.description} ${product.tag || ''}`.toLocaleLowerCase('fr').includes(query);
    return matchesTag && matchesSearch;
  }), [store.products, tagFilter, search]);

  const bundle = store.promotions?.buyXGetY;
  const giftProduct = store.products.find(product => String(product.id) === String(bundle?.freeProductId));
  const activePromotions = [
    store.promotions?.freeShipping?.enabled ? 'Livraison offerte partout au Maroc' : '',
    bundle?.enabled ? `${bundle.label || `${bundle.buyQuantity} achetées`}${giftProduct ? ` + ${giftProduct.name} offert${Number(bundle.freeQuantity) > 1 ? 's' : 'e'}` : ''}` : '',
  ].filter(Boolean);
  const promoPopup = store.promotions?.promoPopup || {};
  const promoMessage = promoPopup.message?.trim() || activePromotions.join(' · ') || 'Découvre notre sélection Crooza du moment.';
  const gallery = selected?.photos?.length ? selected.photos : selected?.image ? [selected.image] : [];
  const fontName = String(store.font || fallback.font).replace(/["';]/g, '');
  const waIntro = whatsapp('Bonjour, j’aimerais en savoir plus sur la boutique Crooza.');

  return (
    <div className="shop-shell buyer-v2" style={{ '--accent': store.accent || fallback.accent, '--paper': store.background || fallback.background, '--ink': store.textColor || fallback.textColor, '--serif': `'${fontName}', Georgia, serif` }}>
      {store.announcement && <div className="buyer-announcement">{store.announcement}</div>}
      <header className="buyer-header">
        <a className="buyer-brand" href="#top" aria-label={store.brand}>
          <img src={store.logo || '/images/crooza-mark.png'} alt="" />
          <span>{store.brand || fallback.brand}<small>Chaussures & accessoires</small></span>
        </a>
        <nav className="buyer-nav" aria-label="Navigation principale"><a href="#collection">Boutique</a><a href="#faq">FAQ</a></nav>
        <button className="buyer-cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Ouvrir le panier, ${cartCount} article${cartCount === 1 ? '' : 's'}`}>
          <span>Panier</span><b>{cartCount}</b>
        </button>
      </header>

      <main id="top" className="buyer-main">
        <section className="buyer-catalog" id="collection">
          <div className="buyer-catalog-heading">
            <div><span className="buyer-kicker">CROOZA · MAROC</span><h1>{String(store.collectionTitle || 'La collection').replaceAll('|', ' ')}</h1><p>{store.collectionNote || store.description}</p></div>
            <span className="buyer-count">{filteredProducts.length} article{filteredProducts.length === 1 ? '' : 's'}</span>
          </div>
          {activePromotions.length > 0 && <div className="buyer-promo-bar">{activePromotions.map((promotion, index) => <span key={`${promotion}-${index}`}><i>✳</i>{promotion}</span>)}</div>}
          <div className="buyer-tools">
            <label className="buyer-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un produit" aria-label="Rechercher un produit" /></label>
            <div className="buyer-filters" aria-label="Filtrer par collection">{tags.map(tag => <button type="button" key={tag} className={tagFilter === tag ? 'active' : ''} onClick={() => setTagFilter(tag)}>{tag}</button>)}</div>
          </div>
          <div className="buyer-product-grid">
            {filteredProducts.length ? filteredProducts.map(product => (
              <article className="buyer-product-card" key={product.id}>
                <button className="buyer-product-image" type="button" onClick={() => showProduct(product)} aria-label={`Voir ${product.name}`}>
                  <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
                  {product.tag && <span>{product.tag}</span>}
                  {product.inStock === false && <strong>Épuisé</strong>}
                </button>
                <div className="buyer-product-info"><div><button type="button" onClick={() => showProduct(product)}>{product.name}</button><p>{product.description}</p></div><b>{money(product.price)}</b></div>
                <div className="buyer-product-actions"><button type="button" onClick={() => showProduct(product)}>Détails</button><button className="add-to-cart" type="button" onClick={() => addToCart(product)} disabled={product.inStock === false}>{product.inStock === false ? 'Indisponible' : 'Ajouter au panier'} <span>↗</span></button></div>
              </article>
            )) : <div className="buyer-empty"><strong>Aucun article trouvé</strong><span>Essaie un autre mot ou enlève le filtre sélectionné.</span></div>}
          </div>
        </section>

        <section className="buyer-faq" id="faq">
          <div className="buyer-faq-heading"><span className="buyer-kicker">TOUT SIMPLEMENT</span><h2>Questions<br /><em>fréquentes.</em></h2><p>Les infos utiles avant de commander.</p></div>
          <div className="buyer-faq-list">{[
            ['Comment choisir ma pointure ?', 'Ouvre le produit et ajoute-le au panier : les pointures encore disponibles apparaissent au moment de la commande.'],
            ['Comment se passe la livraison ?', 'Nous livrons partout au Maroc. Les frais sont affichés dans le récapitulatif avant de confirmer la commande.'],
            ['Quand est-ce que je paie ?', 'Le paiement se fait à la livraison. Nous te contactons pour confirmer les informations de ta commande.'],
            ['Comment suivre ma commande ?', 'Après confirmation, tu peux retrouver son état avec le lien de suivi qui te sera envoyé.'],
          ].map(([question, answer], index) => <article className={`buyer-faq-item ${faqOpen === index ? 'open' : ''}`} key={question}><button type="button" onClick={() => setFaqOpen(faqOpen === index ? -1 : index)} aria-expanded={faqOpen === index}><span><i>0{index + 1}</i>{question}</span><b>{faqOpen === index ? '−' : '+'}</b></button><div className="buyer-faq-answer"><p>{answer}</p></div></article>)}</div>
        </section>
      </main>

      <footer className="buyer-footer"><a className="buyer-brand" href="#top"><img src={store.logo || '/images/crooza-mark.png'} alt="" /><span>{store.brand || fallback.brand}<small>Fait avec attention, au Maroc.</small></span></a><span>© {new Date().getFullYear()} · Tous droits réservés</span><a href={waIntro} target="_blank" rel="noreferrer">Contact WhatsApp ↗</a></footer>
      <a className="floating-wa" href={waIntro} target="_blank" rel="noreferrer" aria-label="Nous écrire sur WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.2 1.6 6L0 24l6.4-1.7a11.9 11.9 0 0 0 5.7 1.5h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.2-3.5-8.5ZM12.1 21.8a9.9 9.9 0 0 1-5.1-1.4l-.4-.2-3.8 1 1-3.7-.3-.4a9.9 9.9 0 0 1-1.5-5.3c0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.1 2.9a10 10 0 0 1 2.9 7.1c0 5.5-4.5 10-10 10Zm5.5-7.5c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.8 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" /></svg></a>

      {selected && <div className="detail-overlay open" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="detail-panel" role="dialog" aria-modal="true" aria-label={`Détail : ${selected.name}`}><button className="icon-button detail-close" type="button" onClick={() => setSelected(null)} aria-label="Fermer">×</button><div className="detail-gallery"><div className="detail-main-image"><img src={gallery[photoIndex]} alt={`${selected.name} — photo ${photoIndex + 1}`} /><button className="gallery-arrow gallery-prev" type="button" aria-label="Photo précédente" hidden={gallery.length < 2} onClick={() => setPhotoIndex(index => (index - 1 + gallery.length) % gallery.length)}>←</button><button className="gallery-arrow gallery-next" type="button" aria-label="Photo suivante" hidden={gallery.length < 2} onClick={() => setPhotoIndex(index => (index + 1) % gallery.length)}>→</button><span className="gallery-count">{photoIndex + 1} / {gallery.length}</span></div><div className="detail-thumbnails">{gallery.length > 1 && gallery.map((photo, index) => <button className={`detail-thumb ${index === photoIndex ? 'active' : ''}`} type="button" key={photo} onClick={() => setPhotoIndex(index)} aria-label={`Afficher la photo ${index + 1}`}><img src={photo} alt="" /></button>)}</div></div><div className="detail-copy"><p className="eyebrow"><span className="eyebrow-line" /> {selected.inStock === false ? 'Épuisé' : selected.tag || 'À découvrir'}</p><h2>{selected.name}</h2><p className="detail-price">{money(selected.price)}</p><p className="detail-description">{selected.description}</p><button className="button button-dark detail-order" type="button" onClick={() => addToCart(selected)} disabled={selected.inStock === false}>{selected.inStock === false ? 'Indisponible' : 'Ajouter au panier'} <span>↗</span></button><p className="detail-help">Paiement à la livraison · livraison partout au Maroc.</p></div></section></div>}

      {promoOpen && <div className="buyer-promo-backdrop" onMouseDown={event => event.target === event.currentTarget && dismissPromo()}><section className="buyer-promo-popup" role="dialog" aria-modal="true" aria-labelledby="buyerPromoTitle"><button type="button" className="buyer-promo-close" onClick={dismissPromo} aria-label="Fermer">×</button><span className="buyer-kicker">UNE PETITE ATTENTION</span><span className="buyer-promo-mark">✳</span><h2 id="buyerPromoTitle">{promoPopup.title || 'Une offre Crooza'}</h2><p>{promoMessage}</p><a href="#collection" onClick={dismissPromo}>{promoPopup.buttonLabel || 'Découvrir les articles'} <span>↗</span></a><button type="button" className="buyer-promo-later" onClick={dismissPromo}>Pas maintenant</button></section></div>}

      {cartOpen && <CheckoutModal items={cartItems} products={store.products} promotions={store.promotions} onUpdateItems={setCartItems} onClose={() => setCartOpen(false)} />}
    </div>
  );
}
