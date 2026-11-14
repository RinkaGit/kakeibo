import React, { useMemo, useState } from 'react';
import { useApp, itemsByIdOf } from '../state/AppContext.jsx';
import { Sheet } from '../components/common.jsx';
import { rankRecipes } from '../domain/menu.js';
import { buildConsultText } from '../domain/consult.js';
import { stockTotals } from '../domain/stock.js';
import * as svc from '../services/linkage.js';

export function MenuPage() {
  const { state, run, today } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const ranked = useMemo(() => rankRecipes(state.recipes, state.stockItems, today), [state, today]);
  const [confirming, setConfirming] = useState(null); // evaluateRecipe result
  const [consult, setConsult] = useState(null); // {householdSize, avoidFoods, dishCount}

  return (
    <div className="page">
      <h2 className="pagetitle">献立</h2>
      <section className="card consultbox">
        <h3>定番で決まらないときは</h3>
        <p className="note">今ある食材をまとめた相談文を作ります。お使いのAIアプリに貼って相談できます（このアプリ自体はAIを使いません）。</p>
        <button className="primarybtn" onClick={() => setConsult({
          householdSize: state.settings.householdSize,
          avoidFoods: state.settings.avoidFoods || '',
          dishCount: 3,
        })}>AIに相談する文を作る</button>
      </section>
      <h3 className="sectiontitle">定番レシピの候補</h3>
      <p className="note">在庫にある材料が多い順、買ってから日数が経った食材を使う順に並んでいます</p>
      <ul className="list cardlist">
        {ranked.map((ev) => (
          <li key={ev.recipe.id} className="menurrow">
            <div className="grow">
              <div className="menurrow-name">{ev.recipe.name}</div>
              <div className="sub">在庫あり {ev.n}/{ev.m}
                {ev.shortages.length > 0
                  ? ` ・ 不足: ${ev.shortages.map((i) => itemsById[i]?.name || '').filter(Boolean).join('、')}`
                  : ' ・ 不足なし'}
              </div>
            </div>
            <button className="primarybtn small" onClick={() => setConfirming(ev)}>この献立に決める</button>
          </li>
        ))}
      </ul>
      {confirming && (
        <DecideDialog ev={confirming} onClose={() => setConfirming(null)} />
      )}
      {consult && (
        <ConsultSheet initial={consult} onClose={() => setConsult(null)} />
      )}
    </div>
  );
}

function DecideDialog({ ev, onClose }) {
  const { state, run } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const totals = useMemo(() => stockTotals(state.stockItems), [state]);
  const [uses, setUses] = useState(() => {
    const u = {};
    for (const id of ev.inStock) u[id] = 1;
    return u;
  });
  const submit = async () => {
    const useList = ev.inStock.map((id) => ({ itemId: id, qty: Number(uses[id]) || 0 }));
    try {
      await run((s) => svc.decideMenu(s, { ingredientItemIds: ev.recipe.ingredientItemIds, uses: useList }));
      onClose();
    } catch { /* バナー表示 */ }
  };
  return (
    <Sheet title={`${ev.recipe.name}に決めますか`} onClose={onClose}>
      <div className="form">
        {ev.inStock.map((id) => (
          <label key={id} className="field">
            <span>{itemsById[id]?.name || '品目'}（在庫 {totals[id]}）使う量</span>
            <input type="number" inputMode="numeric" min="0" max={totals[id]}
              value={uses[id]} onChange={(e) => setUses({ ...uses, [id]: e.target.value })} />
          </label>
        ))}
        {ev.shortages.length > 0 && (
          <p className="note">不足している {ev.shortages.map((i) => itemsById[i]?.name || '').filter(Boolean).join('、')} は買い物リストに追加されます</p>
        )}
        <div className="sheet-actions">
          <button className="primarybtn" onClick={submit}>決める</button>
        </div>
      </div>
    </Sheet>
  );
}

function ConsultSheet({ initial, onClose }) {
  const { state, today } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const [cond, setCond] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const text = buildConsultText({
    stockItems: state.stockItems, itemsById, today,
    householdSize: Number(cond.householdSize) || 2,
    avoidFoods: cond.avoidFoods,
    dishCount: Number(cond.dishCount) || 3,
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };
  return (
    <Sheet title="AIに相談する文" onClose={onClose}>
      <div className="form">
        <label className="field"><span>人数</span>
          <input type="number" inputMode="numeric" min="1" max="20" value={cond.householdSize}
            onChange={(e) => setCond({ ...cond, householdSize: e.target.value })} /></label>
        <label className="field"><span>避けたい食材</span>
          <input type="text" value={cond.avoidFoods} onChange={(e) => setCond({ ...cond, avoidFoods: e.target.value })} placeholder="例: 辛いもの" /></label>
        <label className="field"><span>作りたい品数</span>
          <input type="number" inputMode="numeric" min="1" max="10" value={cond.dishCount}
            onChange={(e) => setCond({ ...cond, dishCount: e.target.value })} /></label>
        <textarea className="consulttext" readOnly value={text} rows={12} />
        <div className="sheet-actions">
          <button className="primarybtn" onClick={copy}>相談文をコピー</button>
        </div>
        {copied && <p className="okmsg">コピーしました。お使いのAIアプリに貼ってください</p>}
        {copyFailed && <p className="note">自動コピーができませんでした。上の文を長押し（右クリック）で選んでコピーしてください</p>}
      </div>
    </Sheet>
  );
}
