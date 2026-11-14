import { describe, it, expect } from 'vitest';
import { stockTotals, itemThreshold, sortStockRows, elapsedLabel } from '../../src/domain/stock.js';
import { baseState, itemsById, row } from '../helpers.js';

const TODAY = '2026-11-15';

describe('UT-S stock', () => {
  it('UT-S01 在庫合計は品目ごとに合算する', () => {
    const rows = [row({ itemId: 'it-egg', quantity: 2 }), row({ itemId: 'it-egg', quantity: 3 }), row({ itemId: 'it-milk', quantity: 1 })];
    expect(stockTotals(rows)).toEqual({ 'it-egg': 5, 'it-milk': 1 });
  });
  it('UT-S02 空なら空オブジェクト', () => {
    expect(stockTotals([])).toEqual({});
  });
  it('UT-S03 しきい値は行の最大値', () => {
    const rows = [row({ itemId: 'it-egg', quantity: 1, refillThreshold: 2 }), row({ itemId: 'it-egg', quantity: 1, refillThreshold: 5 }), row({ itemId: 'it-milk', quantity: 1, refillThreshold: 9 })];
    expect(itemThreshold(rows, 'it-egg')).toBe(5);
  });
  it('UT-S04 しきい値未設定は null', () => {
    const rows = [row({ itemId: 'it-egg', quantity: 1, refillThreshold: null })];
    expect(itemThreshold(rows, 'it-egg')).toBeNull();
    expect(itemThreshold([], 'it-egg')).toBeNull();
  });
  it('UT-S05 並びは ピン優先→経過日数降順→品目名昇順', () => {
    const st = baseState();
    const byId = itemsById(st);
    const rows = [
      row({ id: 'a', itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-14', pinned: false }),
      row({ id: 'b', itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-01', pinned: false }),
      row({ id: 'c', itemId: 'it-tofu', quantity: 1, registeredDate: '2026-11-10', pinned: true }),
      row({ id: 'd', itemId: 'it-natto', quantity: 1, registeredDate: '2026-11-01', pinned: false }),
    ];
    const sorted = sortStockRows(rows, byId, TODAY).map((r) => r.id);
    // c(ピン) → 経過14日の2件を名前昇順（納豆 な < 卵 た で d が先）→ a
    expect(sorted).toEqual(['c', 'd', 'b', 'a']);
  });
  it('UT-S06 経過表示は登録当日が1日目', () => {
    expect(elapsedLabel(row({ registeredDate: '2026-11-15' }), TODAY)).toBe('1日目');
    expect(elapsedLabel(row({ registeredDate: '2026-11-10' }), TODAY)).toBe('6日目');
  });
});
