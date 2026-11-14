import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { TABS, LOCATIONS, BOSAI_KUBUN } from '../constants/index.js';
import { badgeCount, badgeLabel } from '../domain/bosai.js';
import { validateItemName } from '../domain/validation.js';
import * as svc from '../services/linkage.js';

export function BottomTabs({ activeTab }) {
  const { state, today } = useApp();
  const count = badgeCount(state.bosaiItems, today, state.settings.badgeDays);
  return (
    <nav className="tabbar" aria-label="メインタブ">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tabbtn ${activeTab === t.id ? 'active' : ''}`}
          onClick={() => navigate(t.path)}
        >
          <span className="tablabel">{t.label}</span>
          {t.id === 'expenses' && count > 0 && <span className="badge">{badgeLabel(count)}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ItemSelect({ value, onChange, allowEmpty = false, emptyLabel = '（品目なし）' }) {
  const { state, run } = useApp();
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const addItem = async () => {
    const errs = validateItemName(newName, state.items);
    if (errs.length) { setLocalErr(errs.join('\n')); return; }
    try {
      const r = await run((s) => svc.addItem(s, { name: newName, defaultCategoryId: null }));
      onChange(r.row.id);
      setNewName(''); setAdding(false); setLocalErr('');
    } catch { /* エラーは上部に表示 */ }
  };
  return (
    <div className="itemselect">
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {!allowEmpty && <option value="">選んでください</option>}
        {state.items.map((i) => (
          <option key={i.id} value={i.id}>{i.name}</option>
        ))}
      </select>
      {adding ? (
        <span className="additem">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しい品目名" maxLength={40} />
          <button type="button" onClick={addItem}>追加</button>
          <button type="button" onClick={() => setAdding(false)}>やめる</button>
          {localErr && <span className="fielderror">{localErr}</span>}
        </span>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setAdding(true)}>＋品目を追加</button>
      )}
    </div>
  );
}

// 在庫追加まわりの共通入力（保管場所、防災登録チェック、区分、期限）
// 保管場所が防災庫のときだけ防災登録チェックを出す（仕様 4.1）
export function StockExtraFields({ form, setForm }) {
  return (
    <>
      <label className="field">
        <span>保管場所</span>
        <select value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })}>
          <option value="">選んでください</option>
          {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      {form.location === 'bosaiko' && (
        <label className="checkrow">
          <input
            type="checkbox"
            checked={!!form.asBosai}
            onChange={(e) => setForm({ ...form, asBosai: e.target.checked })}
          />
          <span>防災備蓄として登録する</span>
        </label>
      )}
      {form.location === 'bosaiko' && form.asBosai && (
        <>
          <label className="field">
            <span>区分</span>
            <select value={form.kubun || ''} onChange={(e) => setForm({ ...form, kubun: e.target.value })}>
              <option value="">選んでください</option>
              {BOSAI_KUBUN.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>期限</span>
            <input type="date" value={form.expiryDate || ''} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </label>
        </>
      )}
    </>
  );
}

export function ErrorBanner() {
  const { error, setError } = useApp();
  if (!error) return null;
  return (
    <div className="errorbanner" role="alert">
      <pre>{error}</pre>
      <button className="iconbtn" onClick={() => setError('')} aria-label="閉じる">×</button>
    </div>
  );
}

export const yen = (n) => (typeof n === 'number' ? `${n.toLocaleString('ja-JP')}円` : '―');
