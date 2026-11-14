import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Sheet, ItemSelect, StockExtraFields } from './common.jsx';
import * as svc from '../services/linkage.js';

// 支出登録シート: mode = 'create' | 'edit' | 'draft'
export function ExpenseSheet({ mode, expense = null, onClose }) {
  const { state, run, today } = useApp();
  const [form, setForm] = useState({
    date: expense ? expense.date : today,
    amount: expense && typeof expense.amount === 'number' ? String(expense.amount) : '',
    categoryId: expense ? expense.categoryId : state.categories[0]?.id || '',
    itemId: expense ? expense.itemId : null,
    quantity: expense ? String(expense.quantity || 1) : '1',
    memo: expense ? expense.memo || '' : '',
    addToStock: false,
    location: '',
    asBosai: false,
    kubun: '',
    expiryDate: '',
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const input = {
      date: form.date,
      amount: form.amount === '' ? null : Number(form.amount),
      categoryId: form.categoryId,
      itemId: form.itemId,
      quantity: Number(form.quantity) || 1,
      memo: form.memo,
      addToStock: form.addToStock,
      location: form.location || null,
      asBosai: form.asBosai,
      kubun: form.kubun || null,
      expiryDate: form.expiryDate || null,
    };
    try {
      if (mode === 'create') await run((s) => svc.createExpense(s, input, today));
      else if (mode === 'edit') await run((s) => svc.updateExpense(s, expense.id, { date: input.date, amount: input.amount, categoryId: input.categoryId, itemId: input.itemId, quantity: input.quantity, memo: input.memo }));
      else if (mode === 'draft') await run((s) => svc.confirmDraft(s, expense.id, input, today));
      onClose();
    } catch { /* エラーはバナー表示 */ }
  };

  const removeDraft = async () => {
    try { await run((s) => svc.deleteDraft(s, expense.id)); onClose(); } catch { /* noop */ }
  };
  const removeExpense = async () => {
    try { await run((s) => svc.deleteExpense(s, expense.id)); onClose(); } catch { /* noop */ }
  };

  const title = mode === 'create' ? '支出を登録' : mode === 'edit' ? '支出を編集' : '下書きを確認';
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="form">
        <label className="field"><span>日付</span>
          <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label className="field"><span>金額（円）{mode === 'draft' ? ' ※確定に必要' : ''}</span>
          <input type="number" inputMode="numeric" min="1" max="9999999" value={form.amount}
            onChange={(e) => set({ amount: e.target.value })} placeholder="金額を入力" /></label>
        <label className="field"><span>カテゴリ</span>
          <select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="field"><span>品目（任意）</span>
          <ItemSelect value={form.itemId} onChange={(v) => set({ itemId: v })} allowEmpty /></label>
        {form.itemId && (
          <label className="field"><span>数量</span>
            <input type="number" inputMode="numeric" min="1" max="999" value={form.quantity}
              onChange={(e) => set({ quantity: e.target.value })} /></label>
        )}
        <label className="field"><span>メモ（任意）</span>
          <input type="text" maxLength={200} value={form.memo} onChange={(e) => set({ memo: e.target.value })} /></label>
        {mode !== 'edit' && (
          <>
            <label className="checkrow">
              <input type="checkbox" checked={form.addToStock} onChange={(e) => set({ addToStock: e.target.checked })} />
              <span>在庫に追加</span>
            </label>
            {form.addToStock && <StockExtraFields form={form} setForm={set} />}
          </>
        )}
        <div className="sheet-actions">
          {mode === 'draft' && <button className="dangerbtn" onClick={removeDraft}>下書きを削除</button>}
          {mode === 'edit' && <button className="dangerbtn" onClick={removeExpense}>この支出を削除</button>}
          <button className="primarybtn" onClick={submit}>{mode === 'draft' ? '確定する' : '保存する'}</button>
        </div>
      </div>
    </Sheet>
  );
}
