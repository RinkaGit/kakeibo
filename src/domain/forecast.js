// 連携⑤: 品目別平均単価と食費の見通し（純関数）
import { isInMonth } from '../lib/dates.js';

// 確定済み・品目と数量のある支出から平均単価（Σ金額/Σ数量、円未満四捨五入）
export function averageUnitPrices(expenses) {
  const acc = {};
  for (const e of expenses) {
    if (e.status !== 'confirmed' || !e.itemId || typeof e.amount !== 'number') continue;
    const q = e.quantity || 1;
    if (!acc[e.itemId]) acc[e.itemId] = { amount: 0, qty: 0 };
    acc[e.itemId].amount += e.amount;
    acc[e.itemId].qty += q;
  }
  const prices = {};
  for (const [itemId, v] of Object.entries(acc)) {
    if (v.qty > 0) prices[itemId] = Math.round(v.amount / v.qty);
  }
  return prices;
}

export function monthExpenseTotal(expenses, month, categoryId = null) {
  return expenses
    .filter(
      (e) =>
        e.status === 'confirmed' &&
        isInMonth(e.date, month) &&
        (categoryId === null || e.categoryId === categoryId)
    )
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

export function draftCount(expenses) {
  return expenses.filter((e) => e.status === 'draft').length;
}

// 食費の見通し: 今月の食費（確定）+ 見込み額。
// 見込み対象: 既定カテゴリが食費の買い物リスト項目のうち
//   P0 未消し込み / P1 消し込み済みで下書きが未確定 のもの（数量×平均単価）。
// 単価不明は0円で件数を別集計、既定カテゴリ未設定は対象外として件数を別集計。
export function foodOutlook({ expenses, shoppingItems, itemsById, foodCategoryId, month }) {
  const prices = averageUnitPrices(expenses);
  const confirmed = monthExpenseTotal(expenses, month, foodCategoryId);
  const draftIds = new Set(expenses.filter((e) => e.status === 'draft').map((e) => e.id));
  let estimate = 0;
  let unknownPriceCount = 0;
  let noCategoryCount = 0;
  for (const s of shoppingItems) {
    const included = !s.checked || (s.draftExpenseId && draftIds.has(s.draftExpenseId));
    if (!included) continue;
    const item = itemsById[s.itemId];
    if (!item || !item.defaultCategoryId) { noCategoryCount += 1; continue; }
    if (item.defaultCategoryId !== foodCategoryId) continue;
    const price = prices[s.itemId];
    if (typeof price !== 'number') { unknownPriceCount += 1; continue; }
    estimate += price * (s.quantity || 1);
  }
  return { confirmed, estimate, total: confirmed + estimate, unknownPriceCount, noCategoryCount };
}
