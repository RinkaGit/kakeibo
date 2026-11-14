// 入力バリデーション（純関数）。エラー文言の配列を返す（空 = OK）
import { isValidDateKey } from '../lib/dates.js';

const isInt = (v) => Number.isInteger(v);

export function validateExpense({ date, amount, categoryId, itemId, quantity, memo }, { requireAmount }) {
  const errs = [];
  if (!date || !isValidDateKey(date)) errs.push('日付が正しくありません');
  if (requireAmount) {
    if (typeof amount !== 'number' || !isInt(amount) || amount < 1 || amount > 9999999)
      errs.push('金額は1〜9,999,999円の整数で入力してください');
  } else if (amount !== null && amount !== undefined) {
    if (typeof amount !== 'number' || !isInt(amount) || amount < 1 || amount > 9999999)
      errs.push('金額は1〜9,999,999円の整数で入力してください');
  }
  if (!categoryId) errs.push('カテゴリを選んでください');
  if (itemId) {
    if (!isInt(quantity) || quantity < 1 || quantity > 999) errs.push('数量は1〜999の整数で入力してください');
  }
  if (memo && memo.length > 200) errs.push('メモは200文字までです');
  return errs;
}

export function validateStock({ quantity, refillThreshold }) {
  const errs = [];
  if (!isInt(quantity) || quantity < 0 || quantity > 999) errs.push('数量は0〜999の整数で入力してください');
  if (refillThreshold !== null && refillThreshold !== undefined) {
    if (!isInt(refillThreshold) || refillThreshold < 1 || refillThreshold > 999)
      errs.push('補充の目安数量は1〜999の整数で入力してください');
  }
  return errs;
}

export function validateBosai({ quantity, expiryDate, kubun }) {
  const errs = [];
  if (!isInt(quantity) || quantity < 1 || quantity > 999) errs.push('数量は1〜999の整数で入力してください');
  if (!expiryDate || !isValidDateKey(expiryDate)) errs.push('期限を正しく入力してください');
  if (!kubun) errs.push('区分を選んでください');
  return errs;
}

export function validateItemName(name, existingItems, selfId = null) {
  const errs = [];
  const trimmed = (name || '').trim();
  if (trimmed.length < 1 || trimmed.length > 40) errs.push('品目名は1〜40文字で入力してください');
  if (existingItems.some((i) => i.id !== selfId && i.name === trimmed)) errs.push('同じ名前の品目がすでにあります');
  return errs;
}

export function validateSettings({ badgeDays, householdSize, monthlyIncome, bosaiTargets }) {
  const errs = [];
  if (!isInt(badgeDays) || badgeDays < 0 || badgeDays > 365) errs.push('バッジの日数は0〜365の整数で入力してください');
  if (!isInt(householdSize) || householdSize < 1 || householdSize > 20) errs.push('人数は1〜20の整数で入力してください');
  if (!isInt(monthlyIncome) || monthlyIncome < 0 || monthlyIncome > 99999999) errs.push('毎月の収入は0〜99,999,999の整数で入力してください');
  for (const k of ['water', 'food', 'baby']) {
    const v = bosaiTargets ? bosaiTargets[k] : 0;
    if (!isInt(v) || v < 0 || v > 9999) errs.push('防災の目標量は0〜9,999の整数で入力してください');
  }
  return errs;
}
