// 防災備蓄ドメイン（純関数）: 残日数、バッジ件数、文脈カード、充足率
import { daysLeft } from '../lib/dates.js';

// 期限が近い（期限切れ含む）防災備蓄品: 数量≥1 かつ 残日数 ≤ badgeDays
export function nearExpiryItems(bosaiItems, today, badgeDays) {
  return bosaiItems.filter(
    (b) => (b.quantity || 0) >= 1 && daysLeft(b.expiryDate, today) <= badgeDays
  );
}

// 支出タブのバッジ件数
export function badgeCount(bosaiItems, today, badgeDays) {
  return nearExpiryItems(bosaiItems, today, badgeDays).length;
}

export function badgeLabel(count) {
  if (!count || count <= 0) return '';
  return count >= 100 ? '99+' : String(count);
}

// ホームの文脈カード（最大1枚）: 残日数が最小の品（期限切れ優先）と件数
export function contextCard(bosaiItems, itemsById, today, badgeDays) {
  const near = nearExpiryItems(bosaiItems, today, badgeDays);
  if (near.length === 0) return null;
  const sorted = [...near].sort((a, b) => daysLeft(a.expiryDate, today) - daysLeft(b.expiryDate, today));
  const top = sorted[0];
  return {
    itemId: top.itemId,
    itemName: (itemsById[top.itemId] || {}).name || '品目',
    expiryDate: top.expiryDate,
    daysLeft: daysLeft(top.expiryDate, today),
    count: near.length,
  };
}

// 区分ごとの充足状況: 現在量は期限切れでない（残日数≥0）品の数量合計
export function sufficiency(bosaiItems, targets, today) {
  const result = {};
  for (const kubun of ['water', 'food', 'baby']) {
    const current = bosaiItems
      .filter((b) => b.kubun === kubun && daysLeft(b.expiryDate, today) >= 0)
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
    const target = targets && typeof targets[kubun] === 'number' ? targets[kubun] : 0;
    result[kubun] = {
      current,
      target,
      rate: target > 0 ? Math.min(current / target, 1) : null, // 目標未設定は null
      shortage: Math.max(0, target - current),
    };
  }
  return result;
}
