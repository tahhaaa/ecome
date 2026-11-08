'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AdminPanel from './admin-panel.jsx';

const statusLabels = { new: 'Nouvelle', confirmed: 'Confirmée', shipped: 'Expédiée', completed: 'Terminée', cancelled: 'Annulée' };
const statusOptions = ['new', 'confirmed', 'shipped', 'completed', 'cancelled'];

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
  return result;
}

function decodeKey(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function money(amount) { return `${Number(amount || 0).toLocaleString('fr-FR')} DH`; }
function date(value) { return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

export default function OrdersAdmin() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [pushState, setPushState] = useState('idle');
  const [shopStore, setShopStore] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const knownOrders = useRef(null);

  const refresh = useCallback(async (notifyNew = false) => {
    try {
      const result = await request('/api/orders');
      const nextOrders = result.orders || [];
      if (notifyNew && knownOrders.current) {
        const previous = knownOrders.current;
        const added = nextOrders.filter(order => !previous.has(order.id));
        if (added.length) setNotice(`${added.length} nouvelle${added.length > 1 ? 's' : ''} commande${added.length > 1 ? 's' : ''} reçue${added.length > 1 ? 's' : ''} !`);
      }
      knownOrders.current = new Set(nextOrders.map(order => order.id));
      setOrders(nextOrders);
      setError('');
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    request('/api/session').then(result => setAuthenticated(Boolean(result.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    setLoading(true);
    request('/api/store').then(setShopStore).catch(() => {});
    refresh();
    const interval = window.setInterval(() => refresh(true), 15000);
    return () => window.clearInterval(interval);
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function login(event) {
    event.preventDefault();
    setLoginError('');
    try {
      await request('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      setAuthenticated(true);
    } catch (loginFailure) { setLoginError(loginFailure.message); }
  }

  async function logout() {
    try { await request('/api/logout', { method: 'POST', body: '{}' }); } finally { setAuthenticated(false); }
  }

  async function enablePush() {
    setPushState('busy');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Ce navigateur ne prend pas en charge les notifications push.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Autorisez les notifications dans les réglages de votre navigateur.');
      const { key } = await request('/api/push/key');
      if (!key) throw new Error('Les clés push VAPID ne sont pas encore configurées dans Vercel.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
      await request('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) });
      setPushState('enabled');
      setNotice('Notifications push activées sur cet appareil.');
    } catch (pushError) {
      setPushState('idle');
      setError(pushError.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      await request('/api/orders', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      setOrders(current => current.map(order => order.id === id ? { ...order, status } : order));
    } catch (updateError) { setError(updateError.message); }
  }

  async function saveShopStore(next) {
    await request('/api/admin/store', { method: 'PUT', body: JSON.stringify(next) });
    setShopStore(next);
  }

  const visibleOrders = filter === 'all' ? orders : orders.filter(order => order.status === filter);
  const newCount = orders.filter(order => order.status === 'new').length;

  if (authenticated === null) return <main className="admin-page"><div className="admin-loading">Crooza · Chargement de votre espace…</div></main>;

  if (!authenticated) return (
    <main className="admin-page admin-login-page">
      <a className="admin-brand" href="/">CROOZA<span>ADMIN</span></a>
      <form className="admin-login-card" onSubmit={login}>
        <p className="eyebrow"><span className="eyebrow-line" /> ESPACE PRIVÉ</p>
        <h1>Connexion <em>admin.</em></h1>
        <p>Connectez-vous pour consulter et gérer les commandes de la boutique.</p>
        <label>Mot de passe administrateur<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        {loginError && <p className="admin-error" role="alert">{loginError}</p>}
        <button className="button button-dark" type="submit">Se connecter <span>↗</span></button>
        <a className="admin-back" href="/">← Retour à la boutique</a>
      </form>
    </main>
  );

  return (
    <main className="admin-page">
      <header className="orders-header">
        <a className="admin-brand" href="/">CROOZA<span>ADMIN</span></a>
        <div className="orders-header-actions"><button type="button" className="push-enable" onClick={() => setEditorOpen(true)}>Modifier la boutique</button><button type="button" className={`push-enable ${pushState === 'enabled' ? 'is-enabled' : ''}`} onClick={enablePush}>{pushState === 'enabled' ? '✓ Notifications activées' : '♧ Activer les notifications'}</button><a href="/" className="admin-store-link">Voir la boutique ↗</a><button type="button" className="admin-logout-button" onClick={logout}>Déconnexion</button></div>
      </header>
      <section className="orders-main">
        <div className="orders-title-row"><div><p className="eyebrow"><span className="eyebrow-line" /> VOTRE BOUTIQUE · MAROC</p><h1>Commandes <em>reçues.</em></h1><p>Les nouvelles commandes se synchronisent automatiquement.</p></div><button className="refresh-button" type="button" onClick={() => refresh()} disabled={loading}>↻ Actualiser</button></div>
        <div className="orders-stats"><div><span>À traiter</span><strong>{newCount}</strong></div><div><span>Toutes les commandes</span><strong>{orders.length}</strong></div><div><span>Chiffre confirmé</span><strong>{money(orders.filter(order => !['cancelled'].includes(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0))}</strong></div></div>
        <div className="orders-toolbar"><div className="orders-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Toutes ({orders.length})</button><button className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}>Nouvelles ({newCount})</button><button className={filter === 'confirmed' ? 'active' : ''} onClick={() => setFilter('confirmed')}>Confirmées</button><button className={filter === 'shipped' ? 'active' : ''} onClick={() => setFilter('shipped')}>Expédiées</button></div><span className="sync-indicator"><i /> Actualisation automatique · 15 s</span></div>
        {notice && <div className="orders-toast" role="status">✳ {notice}</div>}
        {error && <div className="admin-error orders-error" role="alert">{error}</div>}
        {visibleOrders.length ? <div className="orders-list">{visibleOrders.map(order => (
          <article className="order-card" key={order.id}>
            <div className="order-card-top"><div><span className="order-number">COMMANDE · {String(order.id).slice(0, 8).toUpperCase()}</span><time>{date(order.created_at)}</time></div><span className={`order-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span></div>
            <div className="order-card-content"><div className="order-customer"><strong>{order.customer_name}</strong><a href={`tel:${order.phone}`}>{order.phone} ↗</a><span>{order.city}</span><a className="order-whatsapp" href={`https://wa.me/${String(order.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, nous confirmons votre commande Crooza.`)}`} target="_blank" rel="noreferrer">Contacter sur WhatsApp ↗</a></div><div className="order-items">{(order.items || []).map(item => <div className="order-item" key={item.id}><img src={item.image || '/images/crooza-mark.png'} alt="" /><span>{item.name} <small>× {item.quantity}</small></span><strong>{money(item.unit_price * item.quantity)}</strong></div>)}</div><div className="order-costs"><span>Sous-total<strong>{money(order.subtotal)}</strong></span><span>Livraison<strong>{money(order.shipping_fee)}</strong></span><span className="order-total">Total<strong>{money(order.total)}</strong></span><label>Statut<select value={order.status} onChange={event => updateStatus(order.id, event.target.value)} aria-label={`Statut de la commande ${String(order.id).slice(0, 8)}`}>{statusOptions.map(status => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label></div></div>
          </article>
        ))}</div> : <div className="orders-empty"><span>✳</span><h2>{loading ? 'Chargement…' : filter === 'all' ? 'Aucune commande pour le moment.' : 'Aucune commande dans ce filtre.'}</h2><p>Les commandes passées sur votre boutique apparaîtront ici.</p></div>}
      </section>
      {shopStore && <AdminPanel open={editorOpen} onClose={() => setEditorOpen(false)} authenticated onAuthenticated={setAuthenticated} store={shopStore} saveStore={saveShopStore} notify={setNotice} />}
    </main>
  );
}
