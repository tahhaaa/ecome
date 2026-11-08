'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AdminPanel from './admin-panel.jsx';
import OrderFinance from './order-finance.jsx';

const statusLabels = { new: 'Nouvelle', confirmed: 'Confirmée', shipped: 'Expédiée', completed: 'Livrée', cancelled: 'Annulée' };
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
function estimatedMargin(order) {
  if ((order.items || []).some(item => item.purchase_price === null || item.purchase_price === undefined)) return null;
  const purchases = (order.items || []).reduce((sum, item) => sum + Number(item.purchase_price || 0) * Number(item.quantity || 1), 0);
  const expenses = (order.delivery_expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return Number(order.total) - purchases - expenses;
}

export default function OrdersAdmin() {
  const [authenticated, setAuthenticated] = useState(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [pushState, setPushState] = useState('idle');
  const [shopStore, setShopStore] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [view, setView] = useState('orders');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [testingPush, setTestingPush] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [labelOrder, setLabelOrder] = useState(null);
  const [labelAddress, setLabelAddress] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
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

  const refreshAnalytics = useCallback(async () => {
    try {
      setAnalytics(await request('/api/analytics'));
      setAnalyticsError('');
    } catch (fetchError) {
      setAnalyticsError(fetchError.message);
    }
  }, []);

  useEffect(() => {
    request('/api/session').then(result => setAuthenticated(Boolean(result.authenticated))).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    request('/api/admin/store').then(setShopStore).catch(() => {});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/sw.js').then(registration => registration?.pushManager.getSubscription()).then(subscription => {
        if (subscription) setPushState('enabled');
      }).catch(() => {});
    }
    const initialRefresh = window.setTimeout(() => { refresh(); refreshAnalytics(); }, 0);
    const interval = window.setInterval(() => refresh(true), 15000);
    const analyticsInterval = window.setInterval(refreshAnalytics, 30000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(interval); window.clearInterval(analyticsInterval); };
  }, [authenticated, refresh, refreshAnalytics]);

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
      const applicationServerKey = decodeKey(key);
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const previousKey = subscription.options.applicationServerKey;
        const sameKey = previousKey && new Uint8Array(previousKey).every((byte, index) => byte === applicationServerKey[index]) && new Uint8Array(previousKey).length === applicationServerKey.length;
        if (!sameKey) { await subscription.unsubscribe(); subscription = null; }
      }
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await request('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) });
      setPushState('enabled');
      setNotice('Notifications push activées sur cet appareil.');
    } catch (pushError) {
      setPushState('idle');
      setError(pushError.message);
    }
  }

  async function testPush() {
    setTestingPush(true);
    setError('');
    try {
      const result = await request('/api/push/test', { method: 'POST', body: '{}' });
      if (!result.ok) throw new Error(result.error || 'Le test push n’a pas abouti.');
      setNotice(`Notification de test envoyée à ${result.sent} appareil${result.sent === 1 ? '' : 's'}.`);
      if (result.failed) setError(`${result.failed} appareil(s) n’ont pas accepté la notification. Réactivez-les depuis chaque appareil.`);
    } catch (pushError) { setError(pushError.message); }
    finally { setTestingPush(false); }
  }

  async function updateStatus(id, status) {
    const order = orders.find(item => item.id === id);
    if (status === 'confirmed' && order && order.status !== 'confirmed') return confirmOrder(order);
    try {
      await request('/api/orders', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      setOrders(current => current.map(order => order.id === id ? { ...order, status } : order));
    } catch (updateError) { setError(updateError.message); }
  }

  async function confirmOrder(order) {
    const messageWindow = window.open('about:blank', '_blank');
    setConfirmingOrderId(order.id);
    setError('');
    try {
      await request('/api/orders', { method: 'PATCH', body: JSON.stringify({ id: order.id, status: 'confirmed' }) });
      setOrders(current => current.map(item => item.id === order.id ? { ...item, status: 'confirmed' } : item));
      const items = (order.items || []).map(item => `${item.name}${item.size ? ` · القياس ${item.size}` : ''} × ${item.paid_quantity ?? item.quantity}${item.free_quantity ? ` + ${item.free_quantity} هدية` : ''}`).join('، ');
      const trackingUrl = order.tracking_token ? `${window.location.origin}/suivi#${encodeURIComponent(order.tracking_token)}` : '';
      const trackingLine = trackingUrl ? `\n🔎 تتبع الطلب ديالك: ${trackingUrl}` : '';
      const total = `${Number(order.total || 0).toLocaleString('fr-FR')} درهم`;
      const message = `سلام ${order.customer_name} 😊\nكنأكدوا ليك الطلب ديالك من Crooza 🛍️\n👟 ${items}\n💰 المجموع مع التوصيل: ${total}\n📍 المدينة: ${order.city}\nباش نوجدو ليك الإرسال، صيفط لينا العنوان كامل ولا أقرب نقطة تسليم 📦${trackingLine}\nشكراً على الثقة ديالك في Crooza 🤎`;
      const whatsappUrl = `https://wa.me/${String(order.phone).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      if (messageWindow) messageWindow.location.href = whatsappUrl;
      setNotice(messageWindow ? 'Message de confirmation ouvert dans WhatsApp : appuie sur Envoyer.' : 'Commande confirmée. Utilise le lien WhatsApp de la commande pour écrire au client.');
    } catch (confirmError) {
      messageWindow?.close();
      setError(confirmError.message);
    } finally {
      setConfirmingOrderId(null);
    }
  }

  async function printShippingLabel() {
    if (!labelOrder || !labelAddress.trim()) { setError('Saisis l’adresse ou le point relais avant de créer l’étiquette.'); return; }
    setSavingLabel(true);
    setError('');
    try {
      const result = await request('/api/orders', { method: 'PATCH', body: JSON.stringify({ id: labelOrder.id, delivery_address: labelAddress.trim() }) });
      const updatedOrder = { ...labelOrder, delivery_address: result.order.delivery_address };
      setLabelOrder(updatedOrder);
      setOrders(current => current.map(order => order.id === updatedOrder.id ? { ...order, delivery_address: updatedOrder.delivery_address } : order));
      window.setTimeout(() => window.print(), 100);
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingLabel(false); }
  }

  async function saveDeliveryExpenses(id, delivery_expenses) {
    try {
      const result = await request('/api/orders', { method: 'PATCH', body: JSON.stringify({ id, delivery_expenses }) });
      setOrders(current => current.map(order => order.id === id ? { ...order, delivery_expenses: result.order.delivery_expenses } : order));
      return true;
    } catch (updateError) { setError(updateError.message); return false; }
  }

  async function deleteOrder(order) {
    const reference = String(order.id).slice(0, 8).toUpperCase();
    if (!window.confirm(`Supprimer la commande #${reference} ? Elle sera retirée des totaux et les articles seront remis en stock.`)) return;
    try {
      await request('/api/orders', { method: 'DELETE', body: JSON.stringify({ id: order.id }) });
      setOrders(current => current.filter(item => item.id !== order.id));
      setNotice(`Commande #${reference} supprimée et retirée des totaux.`);
    } catch (deleteError) { setError(deleteError.message); }
  }

  async function saveShopStore(next) {
    await request('/api/admin/store', { method: 'PUT', body: JSON.stringify(next) });
    setShopStore(next);
  }

  const visibleOrders = filter === 'all' ? orders : orders.filter(order => order.status === filter);
  const newCount = orders.filter(order => order.status === 'new').length;
  const completedOrders = orders.filter(order => order.status === 'completed');
  const canEstimateMargin = completedOrders.every(order => estimatedMargin(order) !== null);
  const totalMargin = completedOrders.reduce((sum, order) => sum + (estimatedMargin(order) || 0), 0);
  const maxDailyVisitors = Math.max(1, ...(analytics?.daily || []).map(day => Number(day.visitors || 0)));

  if (authenticated === null) return <main className="admin-page"><div className="admin-loading">Crooza · Chargement de votre espace…</div></main>;

  if (!authenticated) return (
    <main className="admin-page admin-login-page">
      <Link className="admin-brand" href="/">CROOZA<span>ADMIN</span></Link>
      <form className="admin-login-card" onSubmit={login}>
        <p className="eyebrow"><span className="eyebrow-line" /> ESPACE PRIVÉ</p>
        <h1>Connexion <em>admin.</em></h1>
        <p>Connectez-vous pour consulter et gérer les commandes de la boutique.</p>
        <label>Mot de passe administrateur<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        {loginError && <p className="admin-error" role="alert">{loginError}</p>}
        <button className="button button-dark" type="submit">Se connecter <span>↗</span></button>
        <Link className="admin-back" href="/">← Retour à la boutique</Link>
      </form>
    </main>
  );

  return (
    <main className="admin-page">
      <header className="orders-header">
        <Link className="admin-brand" href="/">CROOZA<span>ADMIN</span></Link>
        <div className="orders-header-actions"><button type="button" className="push-enable" onClick={() => setEditorOpen(true)}>Modifier la boutique</button><button type="button" className={`push-enable ${pushState === 'enabled' ? 'is-enabled' : ''}`} onClick={enablePush}>{pushState === 'busy' ? 'Activation…' : pushState === 'enabled' ? '✓ Notifications activées' : '♧ Activer les notifications'}</button><button type="button" className="push-enable" onClick={testPush} disabled={testingPush}>{testingPush ? 'Test envoi…' : 'Tester le push'}</button><Link href="/" className="admin-store-link">Voir la boutique ↗</Link><button type="button" className="admin-logout-button" onClick={logout}>Déconnexion</button></div>
      </header>
      <section className="orders-main">
        <div className="admin-view-tabs" role="tablist" aria-label="Administration"><button type="button" role="tab" aria-selected={view === 'orders'} className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}>Commandes {newCount > 0 && <span>{newCount}</span>}</button><button type="button" role="tab" aria-selected={view === 'analytics'} className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>Statistiques</button></div>
        {notice && <div className="orders-toast" role="status">✳ {notice}</div>}
        {error && <div className="admin-error orders-error" role="alert">{error}</div>}
        {view === 'orders' ? <>
          <div className="orders-title-row"><div><p className="eyebrow"><span className="eyebrow-line" /> VOTRE BOUTIQUE · MAROC</p><h1>Commandes <em>reçues.</em></h1><p>Les nouvelles commandes se synchronisent automatiquement.</p></div><button className="refresh-button" type="button" onClick={() => refresh()} disabled={loading}>↻ Actualiser</button></div>
          <div className="orders-stats"><div><span>À traiter</span><strong>{newCount}</strong></div><div><span>Commandes actives</span><strong>{orders.length}</strong></div><div><span>Chiffre d’affaires livré</span><strong>{money(completedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0))}</strong></div><div><span>Marge des commandes livrées</span><strong>{canEstimateMargin ? money(totalMargin) : completedOrders.length ? 'À compléter' : money(0)}</strong></div></div>
          <div className="orders-toolbar"><div className="orders-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Toutes ({orders.length})</button><button className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}>Nouvelles ({newCount})</button><button className={filter === 'confirmed' ? 'active' : ''} onClick={() => setFilter('confirmed')}>Confirmées</button><button className={filter === 'shipped' ? 'active' : ''} onClick={() => setFilter('shipped')}>Expédiées</button></div><span className="sync-indicator"><i /> Actualisation automatique · 15 s</span></div>
          {visibleOrders.length ? <div className="orders-list">{visibleOrders.map(order => (
          <article className="order-card" key={order.id}>
            <div className="order-card-top"><div><span className="order-number">COMMANDE · {String(order.id).slice(0, 8).toUpperCase()}</span><time>{date(order.created_at)}</time></div><span className={`order-status status-${order.status}`}>{statusLabels[order.status] || order.status}</span></div>
            <div className="order-card-content"><div className="order-customer"><strong>{order.customer_name}</strong><a href={`tel:${order.phone}`}>{order.phone} ↗</a><span>{order.city}</span><a className="order-whatsapp" href={`https://wa.me/${String(order.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, nous confirmons votre commande Crooza. Merci de nous envoyer votre adresse complète ou le point relais souhaité.`)}`} target="_blank" rel="noreferrer">Contacter sur WhatsApp ↗</a>{order.status === 'new' && <button className="order-confirm-button" type="button" onClick={() => confirmOrder(order)} disabled={confirmingOrderId === order.id}>{confirmingOrderId === order.id ? 'Confirmation…' : 'Confirmer + message WhatsApp ↗'}</button>}{order.status === 'confirmed' && <button className="order-label-button" type="button" onClick={() => { setLabelOrder(order); setLabelAddress(order.delivery_address || ''); }}>Préparer l’étiquette d’envoi ↗</button>}</div><div className="order-items">{(order.items || []).map(item => <div className="order-item" key={item.id}><img src={item.image || '/images/crooza-mark.png'} alt="" /><span>{item.name} <small>× {item.quantity}{item.size ? ` · pointure ${item.size}` : ''}{item.free_quantity ? ` · ${item.free_quantity} offerte${item.free_quantity > 1 ? 's' : ''}` : ''}</small></span><strong>{money(item.unit_price * (item.paid_quantity ?? item.quantity))}</strong></div>)}</div><div className="order-costs"><span>Sous-total<strong>{money(order.subtotal)}</strong></span><span>{Number(order.shipping_fee) === 0 ? 'Livraison offerte' : 'Livraison payée'}<strong>{Number(order.shipping_fee) === 0 ? 'Offerte' : money(order.shipping_fee)}</strong></span><label>Statut<select value={order.status} onChange={event => updateStatus(order.id, event.target.value)} aria-label={`Statut de la commande ${String(order.id).slice(0, 8)}`}>{statusOptions.map(status => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label></div><OrderFinance order={order} onSaveExpenses={saveDeliveryExpenses} onDelete={deleteOrder} /></div>
          </article>
          ))}</div> : <div className="orders-empty"><span>✳</span><h2>{loading ? 'Chargement…' : filter === 'all' ? 'Aucune commande pour le moment.' : 'Aucune commande dans ce filtre.'}</h2><p>Les commandes passées sur votre boutique apparaîtront ici.</p></div>}
        </> : <div className="analytics-view">
          <div className="orders-title-row"><div><p className="eyebrow"><span className="eyebrow-line" /> VOTRE BOUTIQUE · MAROC</p><h1>Votre trafic <em>en un coup d’œil.</em></h1><p>Statistiques des 30 derniers jours · données anonymes de première partie.</p></div><button className="refresh-button" type="button" onClick={refreshAnalytics}>↻ Actualiser</button></div>
          {analyticsError && <div className="admin-error orders-error" role="alert">{analyticsError}</div>}
          <div className="analytics-stats"><article><span className="analytics-live-dot" />Visiteurs en direct<strong>{analytics?.active_visitors ?? '—'}</strong><small>Actifs durant les 90 dernières secondes</small></article><article>Sessions<strong>{analytics?.visitors?.toLocaleString('fr-FR') ?? '—'}</strong><small>Sur les 30 derniers jours</small></article><article>Pages consultées<strong>{analytics?.page_views?.toLocaleString('fr-FR') ?? '—'}</strong><small>Sur les 30 derniers jours</small></article><article>Produits consultés<strong>{analytics?.product_views?.toLocaleString('fr-FR') ?? '—'}</strong><small>Ouvertures des fiches produit</small></article></div>
          <section className="analytics-panel"><div className="analytics-panel-heading"><div><h2>Visiteurs par jour</h2><p>Évolution sur les 30 derniers jours</p></div><span>● Sessions</span></div><div className="analytics-chart" role="img" aria-label="Graphique des visiteurs quotidiens sur les 30 derniers jours">{(analytics?.daily || []).map((day, index) => <div className="analytics-day" key={day.date} title={`${new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-MA', { day: 'numeric', month: 'long' })} : ${day.visitors} session(s), ${day.page_views} page(s)`}><div className="analytics-bar-space"><i style={{ height: `${Math.max(3, (Number(day.visitors) / maxDailyVisitors) * 132)}px` }} /></div>{index % 5 === 0 || index === analytics.daily.length - 1 ? <small>{new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' })}</small> : <small aria-hidden="true">&nbsp;</small>}</div>)}</div></section>
          <section className="analytics-panel top-products-panel"><div className="analytics-panel-heading"><div><h2>Produits les plus consultés</h2><p>Fiches ouvertes sur la boutique</p></div></div>{analytics?.popular_products?.length ? <div className="popular-products">{analytics.popular_products.map((item, index) => { const product = shopStore?.products?.find(entry => String(entry.id) === String(item.product_id)); return <div className="popular-product" key={item.product_id}><span>{String(index + 1).padStart(2, '0')}</span>{product?.image && <img src={product.image} alt="" />}<strong>{product?.name || `Produit ${String(item.product_id).slice(0, 8)}`}</strong><span>{Number(item.views).toLocaleString('fr-FR')} vues</span></div>; })}</div> : <p className="analytics-no-data">Les produits consultés s’afficheront ici quand les clients ouvriront leurs fiches.</p>}</section>
        </div>}
      </section>
      {shopStore && <AdminPanel open={editorOpen} onClose={() => setEditorOpen(false)} authenticated onAuthenticated={setAuthenticated} store={shopStore} saveStore={saveShopStore} notify={setNotice} />}
      {labelOrder && <div className="shipping-label-overlay" role="dialog" aria-modal="true" aria-labelledby="shippingLabelTitle"><section className="shipping-label-dialog"><div className="shipping-label-actions"><button type="button" onClick={() => setLabelOrder(null)}>Fermer</button><button type="button" onClick={printShippingLabel} disabled={savingLabel}>{savingLabel ? 'Enregistrement…' : 'Enregistrer et imprimer'}</button></div><label className="shipping-address-field">Adresse complète ou point relais<input value={labelAddress} onChange={event => setLabelAddress(event.target.value)} maxLength={500} placeholder="À demander au client après confirmation" /></label><p className="shipping-label-hint">Saisis l’adresse ou le relais confirmé avec le client. Cette étiquette est à imprimer puis à recopier dans le portail de ton transporteur.</p><article className="shipping-label-print"><header><strong>CROOZA</strong><span>ÉTIQUETTE D’EXPÉDITION</span></header><div className="shipping-label-reference">COMMANDE #{String(labelOrder.id).slice(0, 8).toUpperCase()}</div><section><small>DESTINATAIRE</small><h2 id="shippingLabelTitle">{labelOrder.customer_name}</h2><p>{labelOrder.phone}</p><p>{labelAddress || 'Adresse / point relais à compléter'}</p><p>{labelOrder.city}</p></section><section><small>COLIS</small>{(labelOrder.items || []).map(item => <p className="shipping-label-item" key={item.id}>{item.name} · {item.size ? `pointure ${item.size} · ` : ''}Qté {item.quantity}</p>)}</section><footer><span>À ENCAISSER À LA LIVRAISON<strong>{money(labelOrder.total)}</strong></span><span>FRAIS DE LIVRAISON<strong>{money(labelOrder.shipping_fee)}</strong></span></footer><p className="shipping-label-note">Bon de préparation Crooza · à enregistrer sur le portail de la société de livraison</p></article></section></div>}
    </main>
  );
}
