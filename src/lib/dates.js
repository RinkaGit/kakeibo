// 日付ユーティリティ。すべて端末ローカル日付 (YYYY-MM-DD) で扱う。
export function pad(n) { return String(n).padStart(2, '0'); }

export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = new Date()) { return toKey(now); }

export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidDateKey(key) { return parseKey(key) !== null; }

// b - a の日数（a, b は YYYY-MM-DD）
export function diffDays(a, b) {
  const da = parseKey(a), db = parseKey(b);
  if (!da || !db) return NaN;
  return Math.round((db - da) / 86400000);
}

// 登録日からの経過日数（登録当日 = 0）
export function elapsedDays(registeredDate, today) {
  return diffDays(registeredDate, today);
}

// 期限までの残日数（期限当日 = 0、過ぎたら負）
export function daysLeft(expiryDate, today) {
  return diffDays(today, expiryDate);
}

export function monthPrefix(key) { return typeof key === 'string' ? key.slice(0, 7) : ''; }

export function currentMonthPrefix(today) { return today.slice(0, 7); }

export function isInMonth(dateKey, month) {
  return typeof dateKey === 'string' && dateKey.slice(0, 7) === month;
}

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

export function nowIso() { return new Date().toISOString(); }
