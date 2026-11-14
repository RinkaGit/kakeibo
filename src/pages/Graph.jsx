import React, { useMemo } from 'react';
import { useApp, itemsByIdOf } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { yen } from '../components/common.jsx';
import { currentMonthPrefix } from '../lib/dates.js';
import { monthExpenseTotal, averageUnitPrices, foodOutlook } from '../domain/forecast.js';

export function GraphPage() {
  const { state, today } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const month = currentMonthPrefix(today);
  const totals = state.categories
    .map((c) => ({ cat: c, total: monthExpenseTotal(state.expenses, month, c.id) }))
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...totals.map((t) => t.total));
  const grand = totals.reduce((s, t) => s + t.total, 0);
  const prices = averageUnitPrices(state.expenses);
  const priceRows = Object.entries(prices)
    .map(([itemId, price]) => ({ name: itemsById[itemId]?.name || '品目', price }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  const outlook = foodOutlook({ expenses: state.expenses, shoppingItems: state.shoppingItems, itemsById, foodCategoryId: 'cat-food', month });
  return (
    <div className="page">
      <h2 className="pagetitle">グラフ</h2>
      <section className="card">
        <h3>今月のカテゴリ別支出（合計 {yen(grand)}）</h3>
        {totals.map(({ cat, total }) => (
          <button key={cat.id} className="graphrow" onClick={() => navigate(`/graph/categories/${cat.id}`)}>
            <span className="graphrow-name">{cat.name}</span>
            <span className="graphbar"><span className="graphbarfill" style={{ width: `${Math.round((total / max) * 100)}%` }} /></span>
            <span className="amount">{yen(total)}</span>
          </button>
        ))}
        {grand === 0 && <p className="note">今月の支出はまだありません</p>}
      </section>
      <section className="card">
        <h3>食費の見通し</h3>
        <p className="outlook">確定 {yen(outlook.confirmed)} ＋ 見込み {yen(outlook.estimate)} ＝ <b>{yen(outlook.total)}</b></p>
      </section>
      <section className="card">
        <h3>品目ごとの平均単価（買った履歴から）</h3>
        {priceRows.length === 0 && <p className="note">品目付きの支出が登録されると、ここに平均単価が出ます</p>}
        <ul className="list">
          {priceRows.map((r) => (
            <li key={r.name} className="listrow static"><span>{r.name}</span><span className="amount">{yen(r.price)} / 個</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function CategoryPage({ categoryId }) {
  const { state, today } = useApp();
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const cat = state.categories.find((c) => c.id === categoryId);
  const month = currentMonthPrefix(today);
  if (!cat) return <div className="page"><p className="note">カテゴリが見つかりません</p></div>;
  const rows = [...state.expenses]
    .filter((e) => e.status === 'confirmed' && e.categoryId === categoryId && e.date.slice(0, 7) === month)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = rows.reduce((s, e) => s + (e.amount || 0), 0);
  return (
    <div className="page">
      <button className="linkbtn" onClick={() => navigate('/graph')}>← グラフに戻る</button>
      <h2 className="pagetitle">{cat.name}（今月 {yen(total)}）</h2>
      {cat.linkToStock && (
        <button className="subnavbtn block" onClick={() => navigate('/expenses?tab=stock')}>関連する在庫を見る</button>
      )}
      <ul className="list cardlist">
        {rows.map((e) => (
          <li key={e.id} className="listrow static">
            <span>{e.date}{e.itemId ? ` ${itemsById[e.itemId]?.name || ''} ×${e.quantity || 1}` : ''}{e.memo ? `（${e.memo}）` : ''}</span>
            <span className="amount">{yen(e.amount)}</span>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="note">今月の支出はありません</p>}
    </div>
  );
}
