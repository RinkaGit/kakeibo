import { describe, it, expect } from 'vitest';
import { SEED_CATEGORIES, SEED_ITEMS, SEED_RECIPES } from '../../src/seed/data.js';
import { SEGMENTS } from '../../src/constants/index.js';

describe('UT-G seed/constants', () => {
  it('UT-G01 定番レシピは30品', () => {
    expect(SEED_RECIPES).toHaveLength(30);
  });
  it('UT-G02 レシピの材料IDはすべて品目マスタに存在する', () => {
    const ids = new Set(SEED_ITEMS.map((i) => i.id));
    for (const r of SEED_RECIPES) {
      expect(r.ingredientItemIds.length).toBeGreaterThan(0);
      for (const id of r.ingredientItemIds) expect(ids.has(id)).toBe(true);
    }
  });
  it('UT-G03 品目の既定カテゴリはすべて存在する', () => {
    const cats = new Set(SEED_CATEGORIES.map((c) => c.id));
    for (const i of SEED_ITEMS) if (i.defaultCategoryId) expect(cats.has(i.defaultCategoryId)).toBe(true);
  });
  it('UT-G04 カテゴリは8件、食費と日用品は在庫リンクあり', () => {
    expect(SEED_CATEGORIES).toHaveLength(8);
    expect(SEED_CATEGORIES.find((c) => c.id === 'cat-food').linkToStock).toBe(true);
    expect(SEED_CATEGORIES.find((c) => c.id === 'cat-daily').linkToStock).toBe(true);
    expect(SEED_CATEGORIES.find((c) => c.id === 'cat-eatout').linkToStock).toBe(false);
  });
  it('UT-G05 セグメントは決定どおりの並びと名前', () => {
    expect(SEGMENTS.map((s) => s.label)).toEqual(['支出一覧', '在庫', '防災備蓄']);
    expect(SEGMENTS.map((s) => s.id)).toEqual(['list', 'stock', 'bosai']);
  });
  it('UT-G06 品目名に重複がない', () => {
    const names = SEED_ITEMS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
