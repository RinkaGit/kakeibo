// 献立ドメイン（純関数）: 候補の評価と並び（仕様4.4: 在庫・経過日数・ピンの順）
import { elapsedDays } from '../lib/dates.js';
import { stockTotals } from './stock.js';

// レシピを評価する: 在庫あり材料数 n / 材料総数 m / 最大経過日数 / ピン付き材料数 / 不足品目
export function evaluateRecipe(recipe, stockItems, today) {
  const totals = stockTotals(stockItems);
  const ings = [...new Set(recipe.ingredientItemIds)];
  const inStock = ings.filter((i) => (totals[i] || 0) > 0);
  const shortages = ings.filter((i) => !((totals[i] || 0) > 0));
  let maxElapsed = -1;
  let pinnedCount = 0;
  for (const itemId of inStock) {
    const rows = stockItems.filter((s) => s.itemId === itemId && (s.quantity || 0) > 0);
    for (const r of rows) maxElapsed = Math.max(maxElapsed, elapsedDays(r.registeredDate, today));
    if (rows.some((r) => r.pinned)) pinnedCount += 1;
  }
  return {
    recipe,
    n: inStock.length,
    m: ings.length,
    inStock,
    shortages,
    maxElapsed,
    pinnedCount,
  };
}

// 候補の並び: 在庫あり材料数 降順 → 最大経過日数 降順 → ピン付き材料数 降順 → レシピ名 昇順 → id
export function rankRecipes(recipes, stockItems, today) {
  return recipes
    .map((r) => evaluateRecipe(r, stockItems, today))
    .sort((a, b) => {
      if (b.n !== a.n) return b.n - a.n;
      if (b.maxElapsed !== a.maxElapsed) return b.maxElapsed - a.maxElapsed;
      if (b.pinnedCount !== a.pinnedCount) return b.pinnedCount - a.pinnedCount;
      const n = a.recipe.name.localeCompare(b.recipe.name, 'ja');
      if (n !== 0) return n;
      return a.recipe.id < b.recipe.id ? -1 : 1;
    });
}
