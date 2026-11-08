'use client';

import { useState } from 'react';
import defaults from '../store.default.json';

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

function imageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function upload(file) {
  if (!file) return '';
  if (file.size > 3_000_000) throw new Error('Image trop volumineuse (3 Mo maximum).');
  return (await request('/api/admin/upload', { method: 'POST', body: JSON.stringify({ data: await imageData(file) }) })).url;
}

const shoeSizePairs = ['35-36', '37-38', '39-40', '41-42', '43-44', '45-46'];

function SizeStockPicker({ product }) {
  const existingSizes = Array.isArray(product?.sizes) ? product.sizes.map(String) : [];
  const options = [...shoeSizePairs, ...existingSizes.filter(size => !shoeSizePairs.includes(size))];
  const [selectedSizes, setSelectedSizes] = useState(existingSizes);
  const [quantities, setQuantities] = useState(() => ({ ...(product?.inventoryBySize || {}) }));
  const totalStock = selectedSizes.reduce((sum, size) => sum + Math.max(0, Number(quantities[size] || 0)), 0);

  function toggleSize(size, checked) {
    setSelectedSizes(current => checked ? [...current, size] : current.filter(item => item !== size));
    if (checked) setQuantities(current => ({ ...current, [size]: Number(current[size] || 0) }));
  }

  function changeQuantity(size, delta) {
    setQuantities(current => ({ ...current, [size]: Math.min(100_000, Math.max(0, Number(current[size] || 0) + delta)) }));
  }

  const inventory = Object.fromEntries(selectedSizes.map(size => [size, Math.max(0, Math.floor(Number(quantities[size] || 0)))]));
  return (
    <div className="wide size-stock-picker">
      <span className="size-stock-label">Pointures et paires disponibles</span>
      <p className="photo-hint">Coche une pointure ou appuie directement sur + pour l’ajouter, puis règle le stock avec − et +.</p>
      <input type="hidden" name="sizes" value={JSON.stringify(selectedSizes)} />
      <input type="hidden" name="inventoryBySize" value={JSON.stringify(inventory)} />
      <div className="size-stock-grid">
        {options.map(size => {
          const selected = selectedSizes.includes(size);
          return <div className={`size-stock-option ${selected ? 'selected' : ''}`} key={size}>
            <label><input type="checkbox" checked={selected} onChange={event => toggleSize(size, event.target.checked)} /><span>{size.replace('-', '–')}</span></label>
            <div className="size-quantity" aria-label={`Quantité pour ${size.replace('-', ' à ')}`}>
              <button type="button" onClick={() => changeQuantity(size, -1)} disabled={!selected || !quantities[size]} aria-label={`Retirer une paire en ${size}`}>−</button>
              <output>{selected ? Number(quantities[size] || 0) : '—'}</output>
              <button type="button" onClick={() => { if (!selected) toggleSize(size, true); changeQuantity(size, 1); }} disabled={Number(quantities[size] || 0) >= 100_000} aria-label={`Ajouter une paire en ${size}`}>+</button>
            </div>
          </div>;
        })}
      </div>
      <div className="size-stock-total">Total en stock <strong>{totalStock} paire{totalStock > 1 ? 's' : ''}</strong></div>
      {product?.stock > 0 && !Object.keys(product?.inventoryBySize || {}).length && <p className="photo-hint">Stock global actuel : {product.stock} paire(s). Répartis-le entre les pointures ci-dessus avant d’enregistrer.</p>}
    </div>
  );
}

function ProductStockPicker({ product }) {
  const [oneSize, setOneSize] = useState(product?.oneSize === true);
  const [stock, setStock] = useState(Number(product?.stock || 0));
  return (
    <div className="wide product-inventory-picker">
      <label className="one-size-toggle"><input name="oneSize" type="checkbox" checked={oneSize} onChange={event => setOneSize(event.target.checked)} /> Article sans pointure (ex. pin Crocs)</label>
      {oneSize ? <label>Stock disponible<input name="oneSizeStock" type="number" min="0" max="100000" step="1" required value={stock} onChange={event => setStock(Number(event.target.value))} /></label> : <SizeStockPicker product={product} />}
    </div>
  );
}

export default function AdminPanel({ open, onClose, authenticated, onAuthenticated, store, saveStore, notify }) {
  const [tab, setTab] = useState('products');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);

  if (!open) return null;

  async function login(event) {
    event.preventDefault();
    setLoginError('');
    try {
      await request('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      onAuthenticated(true);
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function logout() {
    await request('/api/logout', { method: 'POST', body: '{}' });
    onAuthenticated(false);
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const imageFiles = Array.from(formElement.elements.images.files);
    try {
      const oneSize = form.get('oneSize') === 'on';
      const sizes = oneSize ? [] : [...new Set(JSON.parse(String(form.get('sizes') || '[]')))].slice(0, 20);
      const inventoryBySize = oneSize ? {} : JSON.parse(String(form.get('inventoryBySize') || '{}'));
      if (!oneSize && !sizes.length) throw new Error('Coche au moins une pointure disponible.');
      if (!inventoryBySize || typeof inventoryBySize !== 'object' || Array.isArray(inventoryBySize)) throw new Error('Le stock par pointure est invalide.');
      for (const size of sizes) {
        const quantity = Number(inventoryBySize[size]);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100_000) throw new Error(`Vérifie le nombre de paires en ${size}.`);
      }
      const stock = oneSize ? Number(form.get('oneSizeStock')) : sizes.reduce((total, size) => total + Number(inventoryBySize[size]), 0);
      const purchasePrice = Number(form.get('purchasePrice'));
      if (!Number.isInteger(stock) || stock < 0) throw new Error('Le stock doit être un nombre entier positif.');
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) throw new Error('Le prix d’achat doit être un montant positif.');
      const photos = String(form.get('photoUrls') || '').split('\n').map(value => value.trim()).filter(Boolean);
      for (const file of imageFiles) photos.push(await upload(file));
      if (!photos.length) photos.push('/images/crooza-mark.png');
      const product = {
        id: editingId === 'new' ? `p${Date.now()}` : editingId,
        name: String(form.get('name')).trim(),
        description: String(form.get('description')).trim(),
        price: Number(form.get('price')),
        purchasePrice,
        stock,
        oneSize,
        inventoryBySize,
        sizes,
        tag: String(form.get('tag')).trim() || 'À découvrir',
        photos,
        image: photos[0],
      };
      const products = editingId !== 'new'
        ? store.products.map(item => item.id === editingId ? product : item)
        : [...store.products, product];
      await saveStore({ ...store, products });
      setEditingId(null);
      notify('Produit enregistré ✓');
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id) {
    if (!window.confirm('Supprimer ce produit de la boutique ?')) return;
    try {
      await saveStore({ ...store, products: store.products.filter(item => item.id !== id) });
      notify('Produit supprimé.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveStyle(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const next = {
        ...store,
        brand: String(form.get('brand')).trim() || defaults.brand,
        headline: String(form.get('headline')).trim().replace(/\s+/g, '|') || defaults.headline,
        description: String(form.get('description')).trim(),
        collectionTitle: String(form.get('collectionTitle')).trim().replace(/\s+/g, '|'),
        collectionNote: String(form.get('collectionNote')).trim().replace(/\n+/g, '|'),
        aboutTitle: String(form.get('aboutTitle')).trim().replace(/\s+/g, '|'),
        aboutTextOne: String(form.get('aboutTextOne')).trim(),
        aboutTextTwo: String(form.get('aboutTextTwo')).trim(),
        contactTitle: String(form.get('contactTitle')).trim().replace(/\s+/g, '|'),
        contactText: String(form.get('contactText')).trim(),
        announcement: String(form.get('announcement')).trim(),
        accent: String(form.get('accent')),
        background: String(form.get('background')),
        font: String(form.get('font')),
      };
      for (const [key, name] of [['logo', 'logoFile'], ['heroImage', 'heroFile'], ['aboutImage', 'aboutFile']]) {
        const file = form.get(name);
        if (file?.size) next[key] = await upload(file);
      }
      await saveStore(next);
      notify('Style et textes enregistrés ✓');
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePromotions(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const enabled = form.get('bundleEnabled') === 'on';
      const buyProductId = String(form.get('buyProductId') || '');
      const freeProductId = String(form.get('freeProductId') || '');
      if (enabled) {
        if (!buyProductId || !freeProductId || buyProductId === freeProductId) throw new Error('Choisis deux produits différents pour l’offre.');
        const giftProduct = store.products.find(product => String(product.id) === freeProductId);
        if (!giftProduct?.oneSize) throw new Error('Le produit offert doit être configuré sans pointure, par exemple un pin Crocs.');
      }
      const promotions = {
        freeShipping: { enabled: form.get('freeShipping') === 'on' },
        promoPopup: {
          enabled: form.get('popupEnabled') === 'on',
          title: String(form.get('popupTitle') || '').trim().slice(0, 60),
          message: String(form.get('popupMessage') || '').trim().slice(0, 180),
          buttonLabel: String(form.get('popupButtonLabel') || '').trim().slice(0, 32) || 'Découvrir les articles',
        },
        buyXGetY: {
          enabled,
          buyQuantity: Math.min(10, Math.max(1, Number.parseInt(form.get('buyQuantity'), 10) || 2)),
          freeQuantity: Math.min(5, Math.max(1, Number.parseInt(form.get('freeQuantity'), 10) || 1)),
          buyProductId,
          freeProductId,
          label: String(form.get('bundleLabel') || '').trim().slice(0, 60),
        },
      };
      await saveStore({ ...store, promotions });
      notify('Promotions enregistrées ✓');
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetStore() {
    if (!window.confirm('Réinitialiser les produits et réglages pour tous les visiteurs ?')) return;
    try {
      await saveStore(structuredClone(defaults));
      setEditingId(null);
      notify('La boutique a été réinitialisée.');
    } catch (error) {
      notify(error.message);
    }
  }

  const editing = editingId === 'new' ? null : store.products.find(product => product.id === editingId);
  const currentPhotos = editing?.photos?.length ? editing.photos : editing?.image ? [editing.image] : [];

  return (
    <div className="admin-overlay open" aria-hidden="false" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
        <div className="admin-head">
          <div><span className="admin-kicker">✳ VOTRE BOUTIQUE</span><h2 id="adminTitle">Espace <em>créateur.</em></h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        {!authenticated ? (
          <form className="admin-login" onSubmit={login}>
            <p>Connexion privée</p>
            <label>Mot de passe administrateur<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
            <button className="button button-dark" type="submit">Se connecter <span>↗</span></button>
            <span className="login-error">{loginError}</span>
          </form>
        ) : (
          <div>
            <div className="admin-tabs">
              <button className={`admin-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')} type="button">Produits</button>
              <button className={`admin-tab ${tab === 'promotions' ? 'active' : ''}`} onClick={() => setTab('promotions')} type="button">Promotions</button>
              <button className={`admin-tab ${tab === 'style' ? 'active' : ''}`} onClick={() => setTab('style')} type="button">Style & textes</button>
              <button className="admin-logout" onClick={logout} type="button">Déconnexion</button>
            </div>

            {tab === 'products' ? (
              <div className="admin-content">
                <div className="admin-section-title"><div><h3>Votre collection</h3><p>Ajoutez et modifiez les produits affichés.</p></div><button className="button button-dark add-product" type="button" onClick={() => setEditingId('new')}>+ Ajouter</button></div>
                {store.products.map(product => (
                  <article className="admin-product" key={product.id}>
                    <img className="admin-product-thumb" src={product.image} alt="" />
                    <div className="admin-product-meta"><strong>{product.name}</strong><span>Vente {Number(product.price || 0).toLocaleString('fr-FR')} DH · Achat {Number(product.purchasePrice || 0).toLocaleString('fr-FR')} DH</span><span>{product.sizes?.length ? `Stock : ${product.sizes.map(size => `${size} (${product.inventoryBySize?.[size] ?? product.stock ?? 0})`).join(' · ')}` : `Stock : ${product.stock ?? 'non suivi'}`}</span></div>
                    <div className="admin-product-actions"><button className="tiny-button" type="button" onClick={() => setEditingId(product.id)} aria-label={`Modifier ${product.name}`}>✎</button><button className="tiny-button delete" type="button" onClick={() => removeProduct(product.id)} aria-label={`Supprimer ${product.name}`}>×</button></div>
                  </article>
                ))}
                {!store.products.length && <p className="empty-admin">Votre collection est vide. Ajoutez votre première pièce.</p>}

                {(editingId !== null) && (
                  <form className="product-editor" key={editingId} onSubmit={saveProduct}>
                    <label>Nom du produit<input name="name" required maxLength={55} defaultValue={editing?.name || ''} /></label>
                    <label>Prix de vente (DH)<input name="price" type="number" min="0" step="0.01" required defaultValue={editing?.price ?? ''} /></label>
                    <label>Prix d’achat (DH)<input name="purchasePrice" type="number" min="0" step="0.01" required defaultValue={editing?.purchasePrice ?? ''} /></label>
                    <ProductStockPicker key={`sizes-${editingId}`} product={editing} />
                    <label className="wide">Description<input name="description" maxLength={180} defaultValue={editing?.description || ''} /></label>
                    <label>Étiquette<input name="tag" maxLength={28} defaultValue={editing?.tag || 'À découvrir'} /></label>
                    <label>Ajouter des photos<input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple /></label>
                    <label className="wide">Photos actuelles ou URL (une par ligne)<textarea name="photoUrls" rows="3" defaultValue={currentPhotos.join('\n')} placeholder="https://…" /></label>
                    <div className="wide photo-hint">La photo est facultative : sans photo, le logo Crooza sera utilisé. Les photos importées peuvent peser jusqu’à 3 Mo chacune.</div>
                    <div className="wide editor-actions"><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le produit ↗'}</button><button className="text-link" type="button" onClick={() => setEditingId(null)}>Annuler</button></div>
                  </form>
                )}
              </div>
            ) : tab === 'promotions' ? (
              <div className="admin-content">
                <div className="admin-section-title"><div><h3>Offres de la boutique</h3><p>Active les promotions quand tu veux. Elles s’appliquent automatiquement au panier et au montant à payer.</p></div></div>
                <form className="style-form promotion-form" key={JSON.stringify(store.promotions || {})} onSubmit={savePromotions}>
                  <section className="promotion-card">
                    <label className="promotion-toggle"><input name="freeShipping" type="checkbox" defaultChecked={store.promotions?.freeShipping?.enabled === true} /><span><strong>Livraison gratuite</strong><small>Supprime les frais de livraison pour toutes les villes tant que l’offre est active.</small></span></label>
                    <span className="promotion-badge">Offre boutique</span>
                  </section>
                  <section className="promotion-card promotion-bundle">
                    <label className="promotion-toggle"><input name="bundleEnabled" type="checkbox" defaultChecked={store.promotions?.buyXGetY?.enabled === true} /><span><strong>Achetés + offerts</strong><small>Choisis le produit déclencheur et un cadeau différent. Le cadeau doit être un article sans pointure, comme un pin Crocs.</small></span></label>
                    <div className="promotion-fields"><label>Produit à acheter<select name="buyProductId" defaultValue={store.promotions?.buyXGetY?.buyProductId || ''}><option value="">Choisir un produit</option>{store.products.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><span className="promotion-plus">→</span><label>Produit offert<select name="freeProductId" defaultValue={store.promotions?.buyXGetY?.freeProductId || ''}><option value="">Choisir le cadeau</option>{store.products.map(product => <option value={product.id} key={product.id}>{product.name}{product.oneSize ? '' : ' · nécessite une pointure'}</option>)}</select></label></div>
                    <div className="promotion-fields promotion-count-fields"><label>Quantité à acheter<input name="buyQuantity" type="number" min="1" max="10" required defaultValue={store.promotions?.buyXGetY?.buyQuantity ?? 2} /></label><span className="promotion-plus">+</span><label>Nombre de cadeaux<input name="freeQuantity" type="number" min="1" max="5" required defaultValue={store.promotions?.buyXGetY?.freeQuantity ?? 1} /></label></div>
                    <label>Texte de l’offre (facultatif)<input name="bundleLabel" maxLength={60} placeholder="Ex. 2 achetées, 1 offerte" defaultValue={store.promotions?.buyXGetY?.label || ''} /></label>
                  </section>
                  <section className="promotion-card promotion-popup-card">
                    <label className="promotion-toggle"><input name="popupEnabled" type="checkbox" defaultChecked={store.promotions?.promoPopup?.enabled === true} /><span><strong>Fenêtre promotionnelle discrète</strong><small>Facultative : apparaît après quelques secondes, une seule fois par session. Le visiteur peut la fermer.</small></span></label>
                    <div className="promotion-popup-fields">
                      <label>Titre<input name="popupTitle" maxLength={60} defaultValue={store.promotions?.promoPopup?.title || 'Une offre Crooza'} placeholder="Une offre Crooza" /></label>
                      <label>Message<textarea name="popupMessage" rows="3" maxLength={180} defaultValue={store.promotions?.promoPopup?.message || ''} placeholder="Laisse vide pour afficher automatiquement les promotions actives." /></label>
                      <label>Texte du bouton<input name="popupButtonLabel" maxLength={32} defaultValue={store.promotions?.promoPopup?.buttonLabel || 'Découvrir les articles'} /></label>
                    </div>
                  </section>
                  <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les promotions ↗'}</button>
                  <p className="save-note">Le client voit le prix et le cadeau avant de confirmer. Le stock est vérifié et déduit automatiquement.</p>
                </form>
              </div>
            ) : (
              <div className="admin-content">
                <form className="style-form" onSubmit={saveStyle}>
                  <label>Nom de la boutique<input name="brand" maxLength={40} defaultValue={store.brand} /></label>
                  <label>Phrase d’accueil<input name="headline" maxLength={80} defaultValue={(store.headline || '').replace('|', ' ')} /></label>
                  <label>Petit texte d’accueil<textarea name="description" rows="3" maxLength={180} defaultValue={store.description} /></label>
                  <label>Titre de la collection<input name="collectionTitle" maxLength={60} defaultValue={(store.collectionTitle || '').replace('|', ' ')} /></label>
                  <label>Texte de la collection<textarea name="collectionNote" rows="2" maxLength={150} defaultValue={(store.collectionNote || '').replaceAll('|', '\n')} /></label>
                  <label>Titre « À propos »<input name="aboutTitle" maxLength={60} defaultValue={(store.aboutTitle || '').replace('|', ' ')} /></label>
                  <label>Texte « À propos » · paragraphe 1<textarea name="aboutTextOne" rows="3" maxLength={240} defaultValue={store.aboutTextOne} /></label>
                  <label>Texte « À propos » · paragraphe 2<textarea name="aboutTextTwo" rows="3" maxLength={240} defaultValue={store.aboutTextTwo} /></label>
                  <label>Titre du contact<input name="contactTitle" maxLength={50} defaultValue={(store.contactTitle || '').replace('|', ' ')} /></label>
                  <label>Texte de contact<textarea name="contactText" rows="2" maxLength={180} defaultValue={store.contactText} /></label>
                  <label>Annonce en haut du site<input name="announcement" maxLength={90} defaultValue={store.announcement} /></label>
                  <label>Logo<input name="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
                  <label>Image d’accueil<input name="heroFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
                  <label>Image de présentation<input name="aboutFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label>
                  <label>Couleur d’accent<input name="accent" type="color" defaultValue={store.accent} /></label>
                  <label>Couleur de fond<input name="background" type="color" defaultValue={store.background} /></label>
                  <label>Police des titres<select name="font" defaultValue={store.font}><option>Playfair Display</option><option>Georgia</option><option>DM Sans</option></select></label>
                  <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer les changements ↗'}</button>
                  <p className="save-note">Les changements enregistrés sont visibles par tous les visiteurs.</p>
                </form>
              </div>
            )}
            <div className="admin-foot"><span>✳ Modifiez votre boutique à votre rythme.</span><button type="button" onClick={resetStore}>Réinitialiser la boutique</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
