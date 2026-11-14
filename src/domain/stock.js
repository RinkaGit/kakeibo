// 在庫ドメイン（純関数）: 合計、経過日数、しきい値、並び順
import { elapsedDays } from '../lib/dates.js';

// 品目ごとの在庫合計（防災備蓄品は含めない）
export function stockTotals(stockItems) {
  const totals = {};
  for (const s of stockItems) totals[s.itemId] = (totals[s.itemId] || 0) + (s.quantity || 0);
  return totals;
}

// 品目の補充しきい値（その品目の在庫行が持つ refillThreshold の最大値。未設定なら null）
export function itemThreshold(stockItems, itemId) {
  let t = null;
  for (const s of stockItems) {
    if (s.itemId === itemId && typeof s.refillThreshold === 'number') {
      t = t === null ? s.refillThreshold : Math.max(t, s.refillThreshold);
    }
  }
  return t;
}

// 在庫一覧の並び: ピン付き優先 → 経過日数 降順 → 品目名 昇順 → id
export function sortStockRows(rows, itemsById, today) {
  const name = (r) => (itemsById[r.itemId] || {}).name || '';
  return [...rows].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const d = elapsedDays(b.registeredDate, today) - elapsedDays(a.registeredDate, today);
    if (d !== 0) return d;
    const n = name(a).localeCompare(name(b), 'ja');
    if (n !== 0) return n;
    return a.id < b.id ? -1 : 1;
  });
}

export function rowElapsed(row, today) {
  return elapsedDays(row.registeredDate, today);
}

// 「{d+1}日目」表示（登録当日が1日目）
export function elapsedLabel(row, today) {
  return `${rowElapsed(row, today) + 1}日目`;
}
