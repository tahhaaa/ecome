'use client';

import { useState } from 'react';

function money(value) { return `${Number(value || 0).toLocaleString('fr-FR')} DH`; }

export default function OrderFinance({ order, onSaveExpenses, onDelete }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const expenses = Array.isArray(order.delivery_expenses) ? order.delivery_expenses : [];
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const purchaseCost = (order.items || []).some(item => item.purchase_price === null || item.purchase_price === undefined)
    ? null
    : (order.items || []).reduce((sum, item) => sum + Number(item.purchase_price || 0) * Number(item.quantity || 1), 0);
  const margin = purchaseCost === null ? null : Number(order.total) - purchaseCost - expensesTotal;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await onSaveExpenses(order.id, [...expenses, { id: crypto.randomUUID(), label: label.trim(), amount: Number(amount), created_at: new Date().toISOString() }]);
      if (saved) { setLabel(''); setAmount(''); }
    } finally { setBusy(false); }
  }

  return (
    <div className="order-finance">
      <div className="order-finance-summary"><span>Frais livraison / autres<strong>{money(expensesTotal)}</strong></span><span className="order-total">Marge estimée<strong>{margin === null ? 'Prix d’achat à renseigner' : money(margin)}</strong></span></div>
      {expenses.length > 0 && <ul className="expense-list">{expenses.map(expense => <li key={expense.id}><span>{expense.label}</span><strong>{money(expense.amount)}</strong><button type="button" onClick={() => onSaveExpenses(order.id, expenses.filter(item => item.id !== expense.id))} aria-label={`Supprimer les frais ${expense.label}`}>×</button></li>)}</ul>}
      <form className="expense-form" onSubmit={submit}><label>Motif<input value={label} onChange={event => setLabel(event.target.value)} maxLength={80} required placeholder="Ex. Livraison, emballage…" /></label><label>Montant DH<input value={amount} onChange={event => setAmount(event.target.value)} type="number" min="0.01" max="1000000" step="0.01" required placeholder="0" /></label><button type="submit" disabled={busy}>{busy ? '…' : '+ Frais'}</button></form>
      <button className="delete-order-button" type="button" onClick={() => onDelete(order)}>Supprimer la commande</button>
    </div>
  );
}
