import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Sheet, ItemSelect } from './common.jsx';
import { LOCATIONS, BOSAI_KUBUN } from '../constants/index.js';
import * as svc from '../services/linkage.js';

// 在庫の追加/編集シート
export function StockSheet({ row = null, onClose }) {
  const { state, run, today } = useApp();
  const [form, setForm] = useState({
    itemId: row ? row.itemId : null,
    quantity: row ? String(row.quantity) : '1',
    location: row ? row.location : 'fridge',
    refillThreshold: row && typeof row.refillThreshold === 'number' ? String(row.refillThreshold) : '',
    pinned: row ? !!row.pinned : false,
  });
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const submit = async () => {
    const data = {
      itemId: form.itemId,
      quantity: Number(form.quantity),
      location: form.location,
      refillThreshold: form.refillThreshold === '' ? null : Number(form.refillThreshold),
      pinned: form.pinned,
    };
    try {
      if (row) await run((s) => svc.updateStockRow(s, row.id, data));
      else await run((s) => svc.createStockRow(s, data, today));
      onClose();
    } catch { /* バナー表示 */ }
  };
  const remove = async () => {
    try { await run((s) => svc.deleteStockRow(s, row.id)); onClose(); } catch { /* noop */ }
  };
  return (
    <Sheet title={row ? '在庫を編集' : '在庫を追加'} onClose={onClose}>
      <div className="form">
        <label className="field"><span>品目</span>
          <ItemSelect value={form.itemId} onChange={(v) => set({ itemId: v })} /></label>
        <label className="field"><span>数量</span>
          <input type="number" inputMode="numeric" min="0" max="999" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} /></label>
        <label className="field"><span>保管場所</span>
          <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select></label>
        <label className="field"><span>補充の目安数量（任意）</span>
          <input type="number" inputMode="numeric" min="1" max="999" value={form.refillThreshold}
            onChange={(e) => set({ refillThreshold: e.target.value })} placeholder="これを下回ったら買い物リストへ" /></label>
        <label className="checkrow">
          <input type="checkbox" checked={form.pinned} onChange={(e) => set({ pinned: e.target.checked })} />
          <span>そろそろ使いたい（ピン）</span>
        </label>
        <div className="sheet-actions">
          {row && <button className="dangerbtn" onClick={remove}>削除</button>}
          <button className="primarybtn" onClick={submit}>保存する</button>
        </div>
      </div>
    </Sheet>
  );
}

// 防災備蓄品の追加/編集シート
export function BosaiSheet({ row = null, onClose }) {
  const { run } = useApp();
  const [form, setForm] = useState({
    itemId: row ? row.itemId : null,
    quantity: row ? String(row.quantity) : '1',
    location: row ? row.location : 'bosaiko',
    kubun: row ? row.kubun : '',
    expiryDate: row ? row.expiryDate : '',
  });
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const submit = async () => {
    const data = { itemId: form.itemId, quantity: Number(form.quantity), location: form.location, kubun: form.kubun, expiryDate: form.expiryDate };
    try {
      if (row) await run((s) => svc.updateBosaiRow(s, row.id, data));
      else await run((s) => svc.createBosaiRow(s, data));
      onClose();
    } catch { /* バナー表示 */ }
  };
  const remove = async () => {
    try { await run((s) => svc.deleteBosaiRow(s, row.id)); onClose(); } catch { /* noop */ }
  };
  return (
    <Sheet title={row ? '防災備蓄を編集' : '防災備蓄を追加'} onClose={onClose}>
      <div className="form">
        <label className="field"><span>品目</span>
          <ItemSelect value={form.itemId} onChange={(v) => set({ itemId: v })} /></label>
        <label className="field"><span>数量</span>
          <input type="number" inputMode="numeric" min="1" max="999" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} /></label>
        <label className="field"><span>区分</span>
          <select value={form.kubun} onChange={(e) => set({ kubun: e.target.value })}>
            <option value="">選んでください</option>
            {BOSAI_KUBUN.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select></label>
        <label className="field"><span>期限</span>
          <input type="date" value={form.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></label>
        <label className="field"><span>保管場所</span>
          <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select></label>
        <div className="sheet-actions">
          {row && <button className="dangerbtn" onClick={remove}>削除</button>}
          <button className="primarybtn" onClick={submit}>保存する</button>
        </div>
      </div>
    </Sheet>
  );
}
