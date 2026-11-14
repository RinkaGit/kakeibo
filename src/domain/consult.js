// 案B 相談文テンプレート生成（アプリ側は決定的な文字列組み立てのみ。AIは使わない: D4/D6）
import { elapsedDays} from '../lib/dates.js';
import { stockTotals} from './stock.js';

// 優先して使いたい品: ピン付き品目＋経過日数の大きい品目（最大5件、重複除去）
export function priorityItems(stockItems, itemsById, today, limit = 5) {
const totals = stockTotals(stockItems);
const byItem = new Map();
for (const s of stockItems) {
if ((totals[s.itemId] || 0) <= 0) continue;
const cur = byItem.get(s.itemId) || { itemId: s.itemId, pinned: false, maxElapsed: -1};
cur.pinned = cur.pinned ||!!s.pinned;
cur.maxElapsed = Math.max(cur.maxElapsed, elapsedDays(s.registeredDate, today));
byItem.set(s.itemId, cur);
}
const rows = [...byItem.values()].sort((a, b) => {
if (a.pinned!== b.pinned) return a.pinned? -1: 1;
if (b.maxElapsed!== a.maxElapsed) return b.maxElapsed - a.maxElapsed;
const na = (itemsById[a.itemId] || {}).name || '';
const nb = (itemsById[b.itemId] || {}).name || '';
return na.localeCompare(nb, 'ja');
});
return rows.slice(0, limit).map((r) => ({
itemId: r.itemId,
name: (itemsById[r.itemId] || {}).name || '品目',
quantity: totals[r.itemId],
elapsed: r.maxElapsed,
}));
}

export function buildConsultText({ stockItems, itemsById, today, householdSize, avoidFoods, dishCount}) {
const totals = stockTotals(stockItems);
const inStock = Object.keys(totals)
.filter((id) => totals[id] > 0)
.map((id) => ({ name: (itemsById[id] || {}).name || '品目', qty: totals[id]}))
.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
const stockLines = inStock.length
? inStock.map((s) => `・${s.name} ×${s.qty}`).join('\n')
: '（在庫はありません）';
const prio = priorityItems(stockItems, itemsById, today);
const prioText = prio.length
? prio.map((p) => `${p.name}（買って${p.elapsed + 1}日目）`).join('、')
: '特になし';
const lines = [
'今夜の献立を相談させてください。',
'',
`${householdSize}人分`,
`${dishCount}品`,
`${avoidFoods && avoidFoods.trim()? avoidFoods.trim(): '特になし'}`,
'',
'',
stockLines,
'',
`${prioText}`,
'',
'この食材で作れる献立を、足りないものがあれば買い足す前提で提案してください。',
];
return lines.join('\n');
}
