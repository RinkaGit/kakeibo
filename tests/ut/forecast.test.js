import { describe, it, expect } from 'vitest';
import { averageUnitPrices, monthExpenseTotal, draftCount, foodOutlook } from '../../src/domain/forecast.js';
import { baseState, itemsById, row } from '../helpers.js';

describe('UT-F forecast', () => {
  it('UT-F01 平均単価は Σ金額/Σ数量 で四捨五入', () => {
    const expenses = [
      row({ status: 'confirmed', itemId: 'it-egg', amount: 300, quantity: 2, date: '2026-11-01', categoryId: 'cat-food' }),
      row({ status: 'confirmed', itemId: 'it-egg', amount: 100, quantity: 1, date: '2026-11-02', categoryId: 'cat-food' }),
    ];
    expect(averageUnitPrices(expenses)['it-egg']).toBe(133); // 400/3 = 133.3
  });
  it('UT-F02 下書きと品目なし支出は平均単価の対象外', () => {
    const expenses = [
      row({ status: 'draft', itemId: 'it-egg', amount: 999, quantity: 1, date: '2026-11-01', categoryId: 'cat-food' }),
      row({ status: 'confirmed', itemId: null, amount: 500, quantity: 1, date: '2026-11-01', categoryId: 'cat-food' }),
    ];
    expect(averageUnitPrices(expenses)).toEqual({});
  });
  it('UT-F03 月次合計は確定済みだけ・カテゴリで絞れる', () => {
    const expenses = [
      row({ status: 'confirmed', amount: 1000, date: '2026-11-01', categoryId: 'cat-food' }),
      row({ status: 'confirmed', amount: 2000, date: '2026-10-31', categoryId: 'cat-food' }),
      row({ status: 'draft', amount: null, date: '2026-11-05', categoryId: 'cat-food' }),
      row({ status: 'confirmed', amount: 500, date: '2026-11-10', categoryId: 'cat-daily' }),
    ];
    expect(monthExpenseTotal(expenses, '2026-11')).toBe(1500);
    expect(monthExpenseTotal(expenses, '2026-11', 'cat-food')).toBe(1000);
  });
  it('UT-F04 下書き件数', () => {
    const expenses = [row({ status: 'draft' }), row({ status: 'confirmed' }), row({ status: 'draft' })];
    expect(draftCount(expenses)).toBe(2);
  });
  it('UT-F05 見通し: 未消し込みは見込みに入る', () => {
    const st = baseState();
    const expenses = [
      row({ id: 'e1', status: 'confirmed', itemId: 'it-egg', amount: 200, quantity: 2, date: '2026-11-01', categoryId: 'cat-food' }), // 単価100
    ];
    const shopping = [row({ id: 's1', itemId: 'it-egg', quantity: 3, checked: false, draftExpenseId: null })];
    const out = foodOutlook({ expenses, shoppingItems: shopping, itemsById: itemsById(st), foodCategoryId: 'cat-food', month: '2026-11' });
    expect(out.confirmed).toBe(200);
    expect(out.estimate).toBe(300);
    expect(out.total).toBe(500);
  });
  it('UT-F06 見通し: 消し込み済みでも下書き未確定なら見込みに入る、確定したら入らない', () => {
    const st = baseState();
    const draft = row({ id: 'e2', status: 'draft', itemId: 'it-egg', amount: null, quantity: 1, date: '2026-11-10', categoryId: 'cat-food' });
    const priceSrc = row({ id: 'e1', status: 'confirmed', itemId: 'it-egg', amount: 100, quantity: 1, date: '2026-11-01', categoryId: 'cat-food' });
    const shopping = [row({ id: 's1', itemId: 'it-egg', quantity: 2, checked: true, draftExpenseId: 'e2' })];
    let out = foodOutlook({ expenses: [priceSrc, draft], shoppingItems: shopping, itemsById: itemsById(st), foodCategoryId: 'cat-food', month: '2026-11' });
    expect(out.estimate).toBe(200);
    const confirmedDraft = { ...draft, status: 'confirmed', amount: 200 };
    out = foodOutlook({ expenses: [priceSrc, confirmedDraft], shoppingItems: shopping, itemsById: itemsById(st), foodCategoryId: 'cat-food', month: '2026-11' });
    expect(out.estimate).toBe(0);
    expect(out.confirmed).toBe(300);
  });
  it('UT-F07 見通し: 単価不明は0円で件数を数える', () => {
    const st = baseState();
    const shopping = [row({ id: 's1', itemId: 'it-milk', quantity: 1, checked: false, draftExpenseId: null })];
    const out = foodOutlook({ expenses: [], shoppingItems: shopping, itemsById: itemsById(st), foodCategoryId: 'cat-food', month: '2026-11' });
    expect(out.estimate).toBe(0);
    expect(out.unknownPriceCount).toBe(1);
  });
  it('UT-F08 見通し: 食費以外の既定カテゴリは対象外・未設定は別件数', () => {
    const st = baseState();
    st.items.push({ id: 'it-nocat', name: 'カテゴリなし品', defaultCategoryId: null });
    const shopping = [
      row({ id: 's1', itemId: 'it-tissue', quantity: 1, checked: false, draftExpenseId: null }), // 日用品
      row({ id: 's2', itemId: 'it-nocat', quantity: 1, checked: false, draftExpenseId: null }),
    ];
    const out = foodOutlook({ expenses: [], shoppingItems: shopping, itemsById: itemsById(st), foodCategoryId: 'cat-food', month: '2026-11' });
    expect(out.estimate).toBe(0);
    expect(out.unknownPriceCount).toBe(0);
    expect(out.noCategoryCount).toBe(1);
  });
});
