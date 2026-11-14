import React, { useMemo, useState } from 'react';
import { useApp, itemsByIdOf, categoriesByIdOf } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { ExpenseSheet } from '../components/ExpenseSheet.jsx';
import { yen } from '../components/common.jsx';
import { currentMonthPrefix } from '../lib/dates.js';
import { contextCard } from '../domain/bosai.js';
import { monthExpenseTotal, draftCount, foodOutlook } from '../domain/forecast.js';

export function HomePage() {
  const { state, today } = useApp();
  const [sheet, setSheet] = useState(null); // 'create' | expense object (edit)
  const itemsById = useMemo(() => itemsByIdOf(state), [state]);
  const catsById = useMemo(() => categoriesByIdOf(state), [state]);
  const month = currentMonthPrefix(today);
  const spent = monthExpenseTotal(state.expenses, month);
  const income = state.settings.monthlyIncome || 0;
  const balance = income - spent;
  const drafts = draftCount(state.expenses);
  const card = contextCard(state.bosaiItems, itemsById, today, state.settings.badgeDays);
  const outlook = foodOutlook({ expenses: state.expenses, shoppingItems: state.shoppingItems, itemsById, foodCategoryId: 'cat-food', month });
  const recent = [...state.expenses]
    .filter((e) => e.status === 'confirmed')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5);
  const catTotals = state.categories
    .map((c) => ({ cat: c, total: monthExpenseTotal(state.expenses, month, c.id) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="page">
      <h2 className="pagetitle">家計簿</h2>
      <section className="card summary">
        <div className="summary-label">今月の収支</div>
        <div className="summary-balance">{yen(balance)}</div>
        <div className="summary-sub">収入 {yen(income)} − 支出 {yen(spent)}</div>
        {drafts > 0 && <div className="summary-draft">確認待ちの下書きが{drafts}件あります</div>}
      </section>

      {card && (
        <button className="contextcard" onClick={() => navigate('/expenses?tab=bosai')}>
          <span className="contextcard-title">防災備蓄の期限が近づいています</span>
          <span className="contextcard-body">
            {card.itemName}（期限 {card.expiryDate}、{card.daysLeft < 0 ? `${-card.daysLeft}日過ぎています` : `あと${card.daysLeft}日`}）ほか{card.count}件
          </span>
        </button>
      )}

      <section className="card">
        <h3>食費の見通し</h3>
        <p className="outlook">今月の食費 {yen(outlook.confirmed)} ＋ 買い物リストの見込み {yen(outlook.estimate)} ＝ <b>{yen(outlook.total)}</b></p>
        {outlook.unknownPriceCount > 0 && <p className="note">単価が分からない品目が{outlook.unknownPriceCount}件あります（見込みに含めていません）</p>}
        {outlook.noCategoryCount > 0 && <p className="note">カテゴリ未設定の品目が{outlook.noCategoryCount}件あります（見込みに含めていません）</p>}
      </section>

      <section className="card">
        <div className="row-between"><h3>最近の支出</h3>
          <button className="primarybtn small" onClick={() => setSheet('create')}>＋支出</button></div>
        {recent.length === 0 && <p className="note">まだ支出が登録されていません</p>}
        <ul className="list">
          {recent.map((e) => (
            <li key={e.id}>
              <button className="listrow" onClick={() => setSheet(e)}>
                <span>{e.date} {(catsById[e.categoryId] || {}).name || ''}{e.itemId ? ` ${itemsById[e.itemId]?.name || ''}` : ''}</span>
                <span className="amount">{yen(e.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {catTotals.length > 0 && (
        <section className="card">
          <h3>今月のカテゴリ内訳</h3>
          <ul className="list">
            {catTotals.map(({ cat, total }) => (
              <li key={cat.id}>
                <button className="listrow" onClick={() => navigate(`/graph/categories/${cat.id}`)}>
                  <span>{cat.name}</span><span className="amount">{yen(total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet === 'create' && <ExpenseSheet mode="create" onClose={() => setSheet(null)} />}
      {sheet && sheet !== 'create' && <ExpenseSheet mode="edit" expense={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
