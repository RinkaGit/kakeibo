// データ層: localStorage アダプタ + コレクションリポジトリ。
// ブラウザAPIに触れるのはこのファイルだけ。将来 Firebase 等へ差し替える場合は
// このモジュールの関数シグネチャ（すべて Promise を返す）を保って実装を置き換える。
import { SEED_CATEGORIES, SEED_ITEMS, SEED_RECIPES } from '../seed/data.js';
import { DEFAULT_SETTINGS } from '../constants/index.js';
import { uid, nowIso } from '../lib/dates.js';

const PREFIX = 'kakeibo:v1:';
export const COLLECTIONS = ['expenses', 'stockItems', 'bosaiItems', 'recipes', 'shoppingItems', 'items', 'categories'];

function storage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  // テスト環境用フォールバック（メモリ）
  if (!storage._mem) {
    const m = new Map();
    storage._mem = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  return storage._mem;
}

export function readCollection(name) {
  try {
    const raw = storage().getItem(PREFIX + name);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeCollection(name, rows) {
  storage().setItem(PREFIX + name, JSON.stringify(rows));
}

export function readSettings() {
  try {
    const raw = storage().getItem(PREFIX + 'settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(s) {
  storage().setItem(PREFIX + 'settings', JSON.stringify(s));
}

export function isSeeded() {
  return storage().getItem(PREFIX + 'meta') !== null;
}

export function seedIfNeeded() {
  if (isSeeded()) return;
  writeCollection('categories', SEED_CATEGORIES);
  writeCollection('items', SEED_ITEMS);
  writeCollection('recipes', SEED_RECIPES);
  for (const c of ['expenses', 'stockItems', 'bosaiItems', 'shoppingItems']) writeCollection(c, []);
  writeSettings({ ...DEFAULT_SETTINGS });
  storage().setItem(PREFIX + 'meta', JSON.stringify({ schema: 1, seededAt: nowIso() }));
}

// アプリ全体の状態（全コレクション＋設定）を読み込む
export async function loadAll() {
  seedIfNeeded();
  const state = { settings: readSettings() };
  for (const c of COLLECTIONS) state[c] = readCollection(c);
  return state;
}

// 状態全体を永続化する（変更のあったコレクションのみでも全体でも結果は同じ）
export async function saveAll(state) {
  for (const c of COLLECTIONS) writeCollection(c, state[c] || []);
  writeSettings(state.settings || { ...DEFAULT_SETTINGS });
}

export function newRow(fields) {
  const t = nowIso();
  return { id: uid(), createdAt: t, updatedAt: t, ...fields };
}

export function touch(row, patch) {
  return { ...row, ...patch, updatedAt: nowIso() };
}
