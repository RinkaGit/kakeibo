import { describe, it, expect } from 'vitest';
import { evaluateRecipe, rankRecipes } from '../../src/domain/menu.js';
import { row } from '../helpers.js';

const TODAY = '2026-11-15';

describe('UT-M menu', () => {
  it('UT-M01 評価: 在庫あり数・不足・最大経過・ピン数', () => {
    const recipe = { id: 'r1', name: 'テスト', ingredientItemIds: ['it-egg', 'it-milk', 'it-tofu'], servings: 2 };
    const stock = [
      row({ itemId: 'it-egg', quantity: 2, registeredDate: '2026-11-05', pinned: true }),
      row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-13', pinned: false }),
    ];
    const ev = evaluateRecipe(recipe, stock, TODAY);
    expect(ev.n).toBe(2);
    expect(ev.m).toBe(3);
    expect(ev.shortages).toEqual(['it-tofu']);
    expect(ev.maxElapsed).toBe(10);
    expect(ev.pinnedCount).toBe(1);
  });
  it('UT-M02 在庫ゼロの材料だけなら maxElapsed は -1', () => {
    const recipe = { id: 'r1', name: 'テスト', ingredientItemIds: ['it-tofu'], servings: 2 };
    const ev = evaluateRecipe(recipe, [], TODAY);
    expect(ev.n).toBe(0);
    expect(ev.maxElapsed).toBe(-1);
  });
  it('UT-M03 数量0の行は在庫ありに数えない', () => {
    const recipe = { id: 'r1', name: 'テスト', ingredientItemIds: ['it-egg'], servings: 2 };
    const stock = [row({ itemId: 'it-egg', quantity: 0, registeredDate: '2026-11-01', pinned: true })];
    const ev = evaluateRecipe(recipe, stock, TODAY);
    expect(ev.n).toBe(0);
    expect(ev.pinnedCount).toBe(0);
  });
  it('UT-M04 並び: 在庫数が最優先', () => {
    const recipes = [
      { id: 'r1', name: 'A', ingredientItemIds: ['it-egg'], servings: 2 },
      { id: 'r2', name: 'B', ingredientItemIds: ['it-egg', 'it-milk'], servings: 2 },
    ];
    const stock = [row({ itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-14' }), row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-14' })];
    expect(rankRecipes(recipes, stock, TODAY).map((e) => e.recipe.id)).toEqual(['r2', 'r1']);
  });
  it('UT-M05 並び: 在庫数が同じなら経過日数が大きい方が先（ピンより経過が優先）', () => {
    const recipes = [
      { id: 'r1', name: 'A', ingredientItemIds: ['it-egg'], servings: 2 },
      { id: 'r2', name: 'B', ingredientItemIds: ['it-milk'], servings: 2 },
    ];
    const stock = [
      row({ itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-14', pinned: true }), // 経過1日・ピン
      row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-01', pinned: false }), // 経過14日
    ];
    expect(rankRecipes(recipes, stock, TODAY).map((e) => e.recipe.id)).toEqual(['r2', 'r1']);
  });
  it('UT-M06 並び: 経過も同じならピン数が多い方が先', () => {
    const recipes = [
      { id: 'r1', name: 'A', ingredientItemIds: ['it-egg'], servings: 2 },
      { id: 'r2', name: 'B', ingredientItemIds: ['it-milk'], servings: 2 },
    ];
    const stock = [
      row({ itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-10', pinned: false }),
      row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-10', pinned: true }),
    ];
    expect(rankRecipes(recipes, stock, TODAY).map((e) => e.recipe.id)).toEqual(['r2', 'r1']);
  });
  it('UT-M07 並び: すべて同じなら名前昇順', () => {
    const recipes = [
      { id: 'r1', name: 'バナナ料理', ingredientItemIds: ['it-egg'], servings: 2 },
      { id: 'r2', name: 'あんかけ', ingredientItemIds: ['it-milk'], servings: 2 },
    ];
    const stock = [
      row({ itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-10' }),
      row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-10' }),
    ];
    expect(rankRecipes(recipes, stock, TODAY).map((e) => e.recipe.id)).toEqual(['r2', 'r1']);
  });
  it('UT-M08 材料の重複は1回だけ数える', () => {
    const recipe = { id: 'r1', name: 'テスト', ingredientItemIds: ['it-egg', 'it-egg'], servings: 2 };
    const ev = evaluateRecipe(recipe, [row({ itemId: 'it-egg', quantity: 1, registeredDate: TODAY })], TODAY);
    expect(ev.m).toBe(1);
    expect(ev.n).toBe(1);
  });
});
