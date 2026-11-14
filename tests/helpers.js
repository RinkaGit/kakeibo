// テスト用の状態ファクトリ
import { SEED_CATEGORIES, SEED_ITEMS, SEED_RECIPES } from '../src/seed/data.js';
import { DEFAULT_SETTINGS } from '../src/constants/index.js';

export function baseState(overrides = {}) {
  return {
    expenses: [],
    stockItems: [],
    bosaiItems: [],
    recipes: JSON.parse(JSON.stringify(SEED_RECIPES)),
    shoppingItems: [],
    items: JSON.parse(JSON.stringify(SEED_ITEMS)),
    categories: JSON.parse(JSON.stringify(SEED_CATEGORIES)),
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    ...overrides,
  };
}

export function itemsById(state) {
  const m = {};
  for (const i of state.items) m[i.id] = i;
  return m;
}

let seq = 0;
export function row(fields) {
  seq += 1;
  return { id: `row-${seq}`, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', ...fields };
}
