import React, { useMemo, useState } from 'react';
import { useApp, itemsByIdOf, categoriesByIdOf } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { SEGMENTS, LOCATIONS, locationLabel, kubunLabel } from '../constants/index.js';
import { ExpenseSheet } from '../components/ExpenseSheet.jsx';
import { StockSheet, BosaiSheet } from '../components/StockSheets.jsx';
import { yen } from '../components/common.jsx';
import { sortStockRows, elapsedLabel } from '../domain/stock.js';
import { sufficiency } from '../domain/bosai.js';
import { daysLeft, currentMonthPrefix } from '../lib/dates.js';
import { monthExpenseTotal } from '../domain/forecast.js';
import * as svc from '../services/linkage.js';

export function ExpensesPage({ tab }) {
  const { state } = useApp();
  const unchecked = state.shoppingItems.filter((s) => !s.checked).length;
  return (
    <div className="page">
      <h2 className="pagetitle">支出</h2>
      <div className="subnav">
        <button className="subnavbtn" onClick={() => navigate('/expenses/shopping')}>買い物リスト（{unchecked}件）</button>
        <button className="subnavbtn" onClick={() => navigate('/expenses/menu')}>献立</button>
      </div>
      <div className="segment" role="tablist" aria-label="支出ハブ">
        {SEGMENTS.map((s) => (
          <button key={s.id} role="tab" aria-selected={tab === s.id}
            className={`segmentbtn ${tab === s.id ? 'active' : ''}`}
            onClick={() => navigate(`/expenses?tab=${s.id}`)}>{s.label}</button>
        ))}
      </div>
      {tab === 'list' && <ExpenseList />}
      {tab === 'stock' && <StockList />}
      {tab === 'bosai' && <BosaiList />}
    </div>
  );
}

function ExpenseList() {
  const { state, today } = useApp();
  const [sheet, setSheet] = useState(null); // 'create' | {mode, expense}
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const catsById = useMemo(() => categoriesByIdOf(state), [state]);
  const month = currentMonthPrefix(today);
  const drafts = state.expenses.filter((e) => e.status === 'draft');
  const confirmed = [...state.expenses]
    .filter((e) => e.status === 'confirmed')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
  return (
    <div>
      <div className="row-between">
        <p className="note">今月の支出合計 {yen(monthExpenseTotal(state.expenses, month))}</p>
        <button className="primarybtn small" onClick={() => setSheet({ mode: 'create' })}>＋支出</button>
      </div>
      {drafts.length > 0 && (
        <section className="card draftbox">
          <h3>確認待ちの下書き</h3>
          <ul className="list">
            {drafts.map((e) => (
              <li key={e.id}>
                <button className="listrow" onClick={() => setSheet({ mode: 'draft', expense: e })}>
                  <span>{itemsById[e.itemId]?.name || (catsById[e.categoryId] || {}).name || '下書き'} ×{e.quantity || 1}</span>
                  <span className="amount draftamount">金額未入力</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="list cardlist">
        {confirmed.map((e) => (
          <li key={e.id}>
            <button className="listrow" onClick={() => setSheet({ mode: 'edit', expense: e })}>
              <span>{e.date} {(catsById[e.categoryId] || {}).name || ''}{e.itemId ? ` ${itemsById[e.itemId]?.name || ''} ×${e.quantity || 1}` : ''}</span>
              <span className="amount">{yen(e.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
      {confirmed.length === 0 && <p className="note">支出はまだありません</p>}
      {sheet && <ExpenseSheet mode={sheet.mode} expense={sheet.expense || null} onClose={() => setSheet(null)} />}
    </div>
  );
}

function StockList() {
  const { state, run, today } = useApp();
  const [loc, setLoc] = useState('all');
  const [sheet, setSheet] = useState(null); // 'new' | row
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const rows = sortStockRows(state.stockItems.filter((r) => loc === 'all' || r.location === loc), itemsById, today);
  const togglePin = async (row) => { try { await run((s) => svc.updateStockRow(s, row.id, { pinned: !row.pinned })); } catch { /* noop */ } };
  return (
    <div>
      <div className="chips">
        <button className={`chipbtn ${loc === 'all' ? 'active' : ''}`} onClick={() => setLoc('all')}>すべて</button>
        {LOCATIONS.map((l) => (
          <button key={l.id} className={`chipbtn ${loc === l.id ? 'active' : ''}`} onClick={() => setLoc(l.id)}>{l.label}</button>
        ))}
      </div>
      <div className="row-between">
        <p className="note">期限は扱いません。買ってからの日数で表示しています</p>
        <button className="primarybtn small" onClick={() => setSheet('new')}>＋在庫</button>
      </div>
      <ul className="list cardlist">
        {rows.map((r) => (
          <li key={r.id} className="stockrow">
            <button className="listrow grow" onClick={() => setSheet(r)}>
              <span>{r.pinned ? '📌 ' : ''}{itemsById[r.itemId]?.name || '品目'} ×{r.quantity}
                <span className="sub"> {locationLabel(r.location)}・{elapsedLabel(r, today)}</span></span>
            </button>
            <button className={`pinbtn ${r.pinned ? 'on' : ''}`} onClick={() => togglePin(r)} aria-label="そろそろ使いたい">
              {r.pinned ? '使いたい' : 'ピン'}
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="note">在庫はまだありません</p>}
      <button className="linkbtn block" onClick={() => navigate('/expenses/menu')}>献立候補を見る</button>
      {sheet === 'new' && <StockSheet onClose={() => setSheet(null)} />}
      {sheet && sheet !== 'new' && <StockSheet row={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function BosaiList() {
  const { state, run, today } = useApp();
  const [sheet, setSheet] = useState(null); // 'new' | row
  const [shortageFor, setShortageFor] = useState(null); // kubun
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const suf = sufficiency(state.bosaiItems, state.settings.bosaiTargets, today);
  const rows = [...state.bosaiItems].sort((a, b) => daysLeft(a.expiryDate, today) - daysLeft(b.expiryDate, today));
  return (
    <div>
      <section className="card">
        <h3>備蓄の充足</h3>
        {['water', 'food', 'baby'].map((k) => {
          const s = suf[k];
          const label = { water: '水', food: '食料', baby: '赤ちゃん用品' }[k];
          return (
            <div key={k} className="sufrow">
              <div className="row-between"><span>{label}</span><span>{s.current} / {s.target > 0 ? s.target : '目標未設定'}</span></div>
              {s.rate !== null ? (
                <div className="bar"><div className="barfill" style={{ width: `${Math.round(s.rate * 100)}%` }} /></div>
              ) : <p className="note">目標量は設定画面で登録できます</p>}
              {s.shortage > 0 && (
                <button className="linkbtn" onClick={() => setShortageFor(k)}>不足分（{s.shortage}）を買い物リストに追加</button>
              )}
            </div>
          );
        })}
      </section>
      <div className="row-between">
        <p className="note">期限が近い順に並んでいます</p>
        <button className="primarybtn small" onClick={() => setSheet('new')}>＋備蓄</button>
      </div>
      <ul className="list cardlist">
        {rows.map((r) => {
          const left = daysLeft(r.expiryDate, today);
          return (
            <li key={r.id}>
              <button className="listrow" onClick={() => setSheet(r)}>
                <span>{itemsById[r.itemId]?.name || '品目'} ×{r.quantity}
                  <span className="sub"> {kubunLabel(r.kubun)}・{locationLabel(r.location)}</span></span>
                <span className={left < 0 ? 'expiry danger' : left <= state.settings.badgeDays ? 'expiry warn' : 'expiry'}>
                  {r.expiryDate}（{left < 0 ? `${-left}日過ぎ` : `あと${left}日`}）
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="note">防災備蓄はまだありません</p>}
      {sheet === 'new' && <BosaiSheet onClose={() => setSheet(null)} />}
      {sheet && sheet !== 'new' && <BosaiSheet row={sheet} onClose={() => setSheet(null)} />}
      {shortageFor && (
        <BosaiShortageDialog kubun={shortageFor} shortage={suf[shortageFor].shortage} onClose={() => setShortageFor(null)} />
      )}
    </div>
  );
}

function BosaiShortageDialog({ kubun, shortage, onClose }) {
  const { state, run } = useApp();
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(String(shortage));
  const candidates = state.items;
  const submit = async () => {
    try {
      await run((s) => svc.addBosaiShortage(s, { itemId, quantity: Number(qty) }));
      onClose();
    } catch { /* バナー表示 */ }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="不足分を買い物リストに追加" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h3>不足分を買い物リストに追加</h3>
          <button className="iconbtn" onClick={onClose} aria-label="閉じる">×</button></div>
        <div className="form">
          <label className="field"><span>品目</span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">選んでください</option>
              {candidates.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select></label>
          <label className="field"><span>数量</span>
            <input type="number" inputMode="numeric" min="1" max="999" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <div className="sheet-actions"><button className="primarybtn" onClick={submit}>追加する</button></div>
        </div>
      </div>
    </div>
  );
}
