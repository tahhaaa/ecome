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
      const photos = String(form.get('photoUrls') || '').split('\n').map(value => value.trim()).filter(Boolean);
      for (const file of imageFiles) photos.push(await upload(file));
      if (!photos.length) throw new Error('Ajoutez au moins une photo ou un lien d’image.');
      const product = {
        id: editingId === 'new' ? `p${Date.now()}` : editingId,
        name: String(form.get('name')).trim(),
        description: String(form.get('description')).trim(),
        price: Number(form.get('price')),
        tag: String(form.get('tag')).trim() || 'À découvrir',
        photos,
        image: photos[0],
      };
      const products = editingId
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
              <button className={`admin-tab ${tab === 'style' ? 'active' : ''}`} onClick={() => setTab('style')} type="button">Style & textes</button>
              <button className="admin-logout" onClick={logout} type="button">Déconnexion</button>
            </div>

            {tab === 'products' ? (
              <div className="admin-content">
                <div className="admin-section-title"><div><h3>Votre collection</h3><p>Ajoutez et modifiez les produits affichés.</p></div><button className="button button-dark add-product" type="button" onClick={() => setEditingId('new')}>+ Ajouter</button></div>
                {store.products.map(product => (
                  <article className="admin-product" key={product.id}>
                    <img className="admin-product-thumb" src={product.image} alt="" />
                    <div className="admin-product-meta"><strong>{product.name}</strong><span>{Number(product.price || 0).toLocaleString('fr-FR')} DH</span></div>
                    <div className="admin-product-actions"><button className="tiny-button" type="button" onClick={() => setEditingId(product.id)} aria-label={`Modifier ${product.name}`}>✎</button><button className="tiny-button delete" type="button" onClick={() => removeProduct(product.id)} aria-label={`Supprimer ${product.name}`}>×</button></div>
                  </article>
                ))}
                {!store.products.length && <p className="empty-admin">Votre collection est vide. Ajoutez votre première pièce.</p>}

                {(editingId !== null) && (
                  <form className="product-editor" key={editingId} onSubmit={saveProduct}>
                    <label>Nom du produit<input name="name" required maxLength={55} defaultValue={editing?.name || ''} /></label>
                    <label>Prix (DH)<input name="price" type="number" min="0" required defaultValue={editing?.price ?? ''} /></label>
                    <label className="wide">Description<input name="description" maxLength={180} defaultValue={editing?.description || ''} /></label>
                    <label>Étiquette<input name="tag" maxLength={28} defaultValue={editing?.tag || 'À découvrir'} /></label>
                    <label>Ajouter des photos<input name="images" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple /></label>
                    <label className="wide">Photos actuelles ou URL (une par ligne)<textarea name="photoUrls" rows="3" defaultValue={currentPhotos.join('\n')} placeholder="https://…" /></label>
                    <div className="wide photo-hint">La première photo est la couverture. Les photos importées peuvent peser jusqu’à 3 Mo chacune.</div>
                    <div className="wide editor-actions"><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le produit ↗'}</button><button className="text-link" type="button" onClick={() => setEditingId(null)}>Annuler</button></div>
                  </form>
                )}
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
