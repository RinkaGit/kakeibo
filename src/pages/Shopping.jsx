import React, { useMemo, useState } from 'react';
import { useApp, itemsByIdOf } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { ItemSelect } from '../components/common.jsx';
import { SHOPPING_SOURCES } from '../constants/index.js';
import * as svc from '../services/linkage.js';

export function ShoppingPage() {
  const { state, run, today } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const [newItem, setNewItem] = useState(null);
  const [newQty, setNewQty] = useState('1');
  const unchecked = state.shoppingItems.filter((s) => !s.checked);
  const checked = state.shoppingItems.filter((s) => s.checked);

  const toggle = async (s) => { try { await run((st) => svc.checkShoppingItem(st, s.id, today)); } catch { /* バナー表示（確定済みは外せない等） */ } };
  const remove = async (s) => { try { await run((st) => svc.deleteShoppingItem(st, s.id)); } catch { /* noop */ } };
  const addManual = async () => {
    try {
      await run((st) => svc.addShoppingManual(st, { itemId: newItem, quantity: Number(newQty) }));
      setNewItem(null); setNewQty('1');
    } catch { /* バナー表示 */ }
  };

  const row = (s) => (
    <li key={s.id} className="shoprow">
      <label className="checkrow grow">
        <input type="checkbox" checked={s.checked} onChange={() => toggle(s)} />
        <span className={s.checked ? 'done' : ''}>
          {itemsById[s.itemId]?.name || '品目'} ×{s.quantity}
          <span className="sub"> {SHOPPING_SOURCES[s.source] || ''}</span>
        </span>
      </label>
      {s.checked && s.draftExpenseId && (
        <button className="linkbtn" onClick={() => navigate('/expenses?tab=list')}>下書きを確認</button>
      )}
      {!s.checked && <button className="iconbtn" onClick={() => remove(s)} aria-label="削除">×</button>}
    </li>
  );

  return (
    <div className="page">
      <h2 className="pagetitle">買い物リスト</h2>
      <p className="note">買ったらチェックを付けると、家計簿に支出の下書きが作られます。金額は下書きで確認して確定してください。</p>
      <section className="card">
        <h3>買うもの（{unchecked.length}件）</h3>
        <ul className="list">{unchecked.map(row)}</ul>
        {unchecked.length === 0 && <p className="note">買うものはありません</p>}
      </section>
      {checked.length > 0 && (
        <section className="card">
          <h3>買い終わったもの</h3>
          <ul className="list">{checked.map(row)}</ul>
        </section>
      )}
      <section className="card">
        <h3>手入力で追加</h3>
        <div className="form">
          <label className="field"><span>品目</span>
            <ItemSelect value={newItem} onChange={setNewItem} /></label>
          <label className="field"><span>数量</span>
            <input type="number" inputMode="numeric" min="1" max="999" value={newQty} onChange={(e) => setNewQty(e.target.value)} /></label>
          <button className="primarybtn" onClick={addManual}>追加する</button>
        </div>
      </section>
    </div>
  );
}
