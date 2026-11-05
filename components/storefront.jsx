'use client';

import { useEffect, useState } from 'react';
import AdminPanel from './admin-panel.jsx';

const phone = '212622222430';
const fallback = {
  brand: 'maison miro', accent: '#c36e4f', background: '#f7f5ef', textColor: '#292b26', font: 'Playfair Display',
};

function whatsapp(message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function lines(value, className) {
  return String(value || '').split('|').map((line, index) => <span className={className} key={`${line}-${index}`}>{line}{index < String(value || '').split('|').length - 1 && <br />}</span>);
}

async function saveToServer(next) {
  const response = await fetch('/api/admin/store', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Enregistrement impossible.');
}

export default function Storefront({ initialStore }) {
  const [store, setStore] = useState(initialStore);
  const [adminOpen, setAdminOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [selected, setSelected] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/session').then(response => response.json()).then(data => setAuthenticated(Boolean(data.authenticated))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') { setSelected(null); setAdminOpen(false); }
      const count = selected?.photos?.length || (selected?.image ? 1 : 0);
      if (count && event.key === 'ArrowRight') setPhotoIndex(index => (index + 1) % count);
      if (count && event.key === 'ArrowLeft') setPhotoIndex(index => (index - 1 + count) % count);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  async function saveStore(next) {
    await saveToServer(next);
    setStore(next);
  }

  function showProduct(product) {
    setSelected(product);
    setPhotoIndex(0);
  }

  const gallery = selected?.photos?.length ? selected.photos : selected?.image ? [selected.image] : [];
  const headline = String(store.headline || '').split('|');
  const collectionTitle = String(store.collectionTitle || '').split('|');
  const waIntro = whatsapp('Bonjour, j’aimerais en savoir plus sur votre boutique.');
  const fontName = String(store.font || fallback.font).replace(/["';]/g, '');

  return (
    <div className="shop-shell" style={{ '--accent': store.accent || fallback.accent, '--paper': store.background || fallback.background, '--ink': store.textColor || fallback.textColor, '--serif': `'${fontName}', Georgia, serif` }}>
      <div className="announcement">{store.announcement}</div>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Accueil"><span className="wordmark-mark">{store.logo ? <img className="brand-logo" src={store.logo} alt="" /> : 'm.'}</span><span>{store.brand}</span></a>
        <nav className="main-nav" aria-label="Navigation principale"><a href="#collection">La collection</a><a href="#about">Notre histoire</a><a href="#contact">Contact</a></nav>
        <button className="admin-trigger" type="button" onClick={() => setAdminOpen(true)}><span className="admin-icon">✳</span> Espace boutique</button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> L’art de choisir</p>
            <h1>{headline[0]}<br /><em>{headline.slice(1).join(' ')}</em></h1>
            <p className="hero-description">{store.description}</p>
            <a className="button button-dark" href="#collection">Explorer la collection <span>↘</span></a>
            <div className="hero-note"><span className="note-star">✳</span><span>Petites séries, grandes histoires.<br /><b>Choisies avec amour.</b></span></div>
          </div>
          <div className="hero-visual"><div className="hero-frame"><img src={store.heroImage} alt="Intérieur chaleureux aux objets choisis" /><span className="image-caption">La beauté des choses simples</span></div><div className="hero-sticker"><span>NEW<br />SEASON</span><b>✳</b></div><span className="hero-side-note">Objets choisis · Maroc</span></div>
          <div className="hero-index">01 <span>—</span> 03</div>
        </section>

        <section className="ticker" aria-label="Notre sélection"><div className="ticker-track"><span>Beau au quotidien</span><b>✳</b><span>Fait pour durer</span><b>✳</b><span>Choisi avec soin</span><b>✳</b><span>Beau au quotidien</span><b>✳</b><span>Fait pour durer</span><b>✳</b><span>Choisi avec soin</span><b>✳</b></div></section>

        <section className="collection section-wrap" id="collection">
          <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> À découvrir</p><h2>{collectionTitle[0]} <em>{collectionTitle.slice(1).join(' ')}</em></h2></div><p className="section-aside">{lines(store.collectionNote)}</p></div>
          <div className="product-grid">
            {store.products.length ? store.products.map((product, index) => (
              <article className="product-card" style={{ animationDelay: `${index * 90}ms` }} key={product.id}>
                <button className="product-image" type="button" onClick={() => showProduct(product)} aria-label={`Voir le détail de ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /><span className="product-tag">{product.tag || 'À découvrir'}</span><span className="product-heart">✳</span></button>
                <div className="product-info"><div><button className="product-title-button" type="button" onClick={() => showProduct(product)}>{product.name}</button><p>{product.description}</p></div><span className="product-price">{Number(product.price || 0).toLocaleString('fr-FR')} DH</span></div>
                <button className="product-details-link" type="button" onClick={() => showProduct(product)}>Voir le produit <span>↗</span></button>
                <a className="product-order" href={whatsapp(`Bonjour, je souhaite commander le produit « ${product.name} » au prix de ${product.price} DH. Est-il disponible ?`)} target="_blank" rel="noreferrer">Commander sur WhatsApp <span>↗</span></a>
              </article>
            )) : <p className="empty-products">La prochaine belle trouvaille arrive bientôt.</p>}
          </div>
          <div className="collection-bottom"><span>UNE BELLE CHOSE À LA FOIS</span><span>✳</span></div>
        </section>

        <section className="about" id="about"><div className="about-art"><img src={store.aboutImage} alt="Salon lumineux aux matières naturelles" /><span className="about-seal">EST. WITH<br />INTENTION <b>✳</b></span></div><div className="about-copy"><p className="eyebrow"><span className="eyebrow-line" /> Un peu de nous</p><h2>{lines(store.aboutTitle)}</h2><p>{store.aboutTextOne}</p><p>{store.aboutTextTwo}</p><a href="#contact" className="text-link">Faisons connaissance <span>↗</span></a></div></section>

        <section className="contact section-wrap" id="contact"><div><p className="eyebrow"><span className="eyebrow-line" /> Une question ?</p><h2>{lines(store.contactTitle)}</h2></div><div className="contact-right"><p>{store.contactText}</p><a className="button button-dark" href={waIntro} target="_blank" rel="noreferrer">Discuter sur WhatsApp <span>↗</span></a><span className="contact-number">+212 6 22 22 24 30</span></div></section>
      </main>

      <footer className="footer"><a className="wordmark footer-brand" href="#top"><span className="wordmark-mark">{store.logo ? <img className="brand-logo" src={store.logo} alt="" /> : 'm.'}</span><span>{store.brand}</span></a><span>Fait avec attention, au Maroc.</span><span>© {new Date().getFullYear()} · Tous droits réservés</span></footer>
      <a className="floating-wa" href={waIntro} target="_blank" rel="noreferrer" aria-label="Nous écrire sur WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.2 1.6 6L0 24l6.4-1.7a11.9 11.9 0 0 0 5.7 1.5h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.2-3.5-8.5ZM12.1 21.8a9.9 9.9 0 0 1-5.1-1.4l-.4-.2-3.8 1 1-3.7-.3-.4a9.9 9.9 0 0 1-1.5-5.3c0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.1 2.9a10 10 0 0 1 2.9 7.1c0 5.5-4.5 10-10 10Zm5.5-7.5c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.8 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" /></svg></a>

      {selected && <div className="detail-overlay open" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="detail-panel" role="dialog" aria-modal="true" aria-label={`Détail : ${selected.name}`}><button className="icon-button detail-close" type="button" onClick={() => setSelected(null)} aria-label="Fermer">×</button><div className="detail-gallery"><div className="detail-main-image"><img src={gallery[photoIndex]} alt={`${selected.name} — photo ${photoIndex + 1}`} /><button className="gallery-arrow gallery-prev" type="button" aria-label="Photo précédente" hidden={gallery.length < 2} onClick={() => setPhotoIndex(index => (index - 1 + gallery.length) % gallery.length)}>←</button><button className="gallery-arrow gallery-next" type="button" aria-label="Photo suivante" hidden={gallery.length < 2} onClick={() => setPhotoIndex(index => (index + 1) % gallery.length)}>→</button><span className="gallery-count">{photoIndex + 1} / {gallery.length}</span></div><div className="detail-thumbnails">{gallery.length > 1 && gallery.map((photo, index) => <button className={`detail-thumb ${index === photoIndex ? 'active' : ''}`} type="button" key={photo} onClick={() => setPhotoIndex(index)} aria-label={`Afficher la photo ${index + 1}`}><img src={photo} alt="" /></button>)}</div></div><div className="detail-copy"><p className="eyebrow"><span className="eyebrow-line" /> {selected.tag || 'À découvrir'}</p><h2>{selected.name}</h2><p className="detail-price">{Number(selected.price || 0).toLocaleString('fr-FR')} DH</p><p className="detail-description">{selected.description}</p><a className="button button-dark detail-order" href={whatsapp(`Bonjour, je souhaite commander le produit « ${selected.name} » au prix de ${selected.price} DH. Est-il disponible ?`)} target="_blank" rel="noreferrer">Commander sur WhatsApp <span>↗</span></a><p className="detail-help">Une question sur cette pièce ? Écrivez-nous sur WhatsApp.</p></div></section></div>}

      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} authenticated={authenticated} onAuthenticated={setAuthenticated} store={store} saveStore={saveStore} notify={setToast} />
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </div>
  );
}
