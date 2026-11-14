import { describe, it, expect } from 'vitest';
import { validateExpense, validateStock, validateBosai, validateItemName, validateSettings } from '../../src/domain/validation.js';
import { baseState } from '../helpers.js';

describe('UT-V validation', () => {
  it('UT-V01 支出: 正常系', () => {
    expect(validateExpense({ date: '2026-11-15', amount: 500, categoryId: 'cat-food', itemId: null, quantity: 1, memo: '' }, { requireAmount: true })).toEqual([]);
  });
  it('UT-V02 支出: 金額の境界（0・上限超・小数・負）', () => {
    const base = { date: '2026-11-15', categoryId: 'cat-food', itemId: null, quantity: 1, memo: '' };
    expect(validateExpense({ ...base, amount: 0 }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ ...base, amount: 9999999 }, { requireAmount: true })).toEqual([]);
    expect(validateExpense({ ...base, amount: 10000000 }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ ...base, amount: 100.5 }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ ...base, amount: -5 }, { requireAmount: true }).length).toBeGreaterThan(0);
  });
  it('UT-V03 支出: 下書きは金額 null を許す（requireAmount=false）', () => {
    expect(validateExpense({ date: '2026-11-15', amount: null, categoryId: 'cat-food', itemId: 'it-egg', quantity: 1, memo: '' }, { requireAmount: false })).toEqual([]);
  });
  it('UT-V04 支出: 日付不正・カテゴリなし・メモ201字', () => {
    expect(validateExpense({ date: '2026-02-30', amount: 100, categoryId: 'cat-food' }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ date: '2026-11-15', amount: 100, categoryId: '' }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ date: '2026-11-15', amount: 100, categoryId: 'cat-food', memo: 'あ'.repeat(201) }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ date: '2026-11-15', amount: 100, categoryId: 'cat-food', memo: 'あ'.repeat(200) }, { requireAmount: true })).toEqual([]);
  });
  it('UT-V05 支出: 品目ありのとき数量1〜999', () => {
    const base = { date: '2026-11-15', amount: 100, categoryId: 'cat-food', itemId: 'it-egg' };
    expect(validateExpense({ ...base, quantity: 0 }, { requireAmount: true }).length).toBeGreaterThan(0);
    expect(validateExpense({ ...base, quantity: 999 }, { requireAmount: true })).toEqual([]);
    expect(validateExpense({ ...base, quantity: 1000 }, { requireAmount: true }).length).toBeGreaterThan(0);
  });
  it('UT-V06 在庫: 数量0〜999、しきい値の境界', () => {
    expect(validateStock({ quantity: 0 })).toEqual([]);
    expect(validateStock({ quantity: 999 })).toEqual([]);
    expect(validateStock({ quantity: -1 }).length).toBeGreaterThan(0);
    expect(validateStock({ quantity: 1000 }).length).toBeGreaterThan(0);
    expect(validateStock({ quantity: 1, refillThreshold: null })).toEqual([]);
    expect(validateStock({ quantity: 1, refillThreshold: 0 }).length).toBeGreaterThan(0);
    expect(validateStock({ quantity: 1, refillThreshold: 1 })).toEqual([]);
  });
  it('UT-V07 防災: 期限必須・数量1〜999・区分必須', () => {
    expect(validateBosai({ quantity: 1, expiryDate: '2027-01-01', kubun: 'water' })).toEqual([]);
    expect(validateBosai({ quantity: 1, expiryDate: '', kubun: 'water' }).length).toBeGreaterThan(0);
    expect(validateBosai({ quantity: 0, expiryDate: '2027-01-01', kubun: 'water' }).length).toBeGreaterThan(0);
    expect(validateBosai({ quantity: 1, expiryDate: '2027-01-01', kubun: '' }).length).toBeGreaterThan(0);
    expect(validateBosai({ quantity: 1, expiryDate: '2027-02-30', kubun: 'water' }).length).toBeGreaterThan(0);
  });
  it('UT-V08 品目名: 重複・空白・41字', () => {
    const st = baseState();
    expect(validateItemName('卵', st.items).length).toBeGreaterThan(0); // 既存と重複
    expect(validateItemName(' 卵 ', st.items).length).toBeGreaterThan(0); // 空白除去後に重複
    expect(validateItemName('新しい品目', st.items)).toEqual([]);
    expect(validateItemName('   ', st.items).length).toBeGreaterThan(0);
    expect(validateItemName('あ'.repeat(41), st.items).length).toBeGreaterThan(0);
    expect(validateItemName('卵', st.items, 'it-egg')).toEqual([]); // 自分自身は除く
  });
  it('UT-V09 設定: 境界値', () => {
    const ok = { badgeDays: 7, householdSize: 2, monthlyIncome: 0, bosaiTargets: { water: 0, food: 0, baby: 0 } };
    expect(validateSettings(ok)).toEqual([]);
    expect(validateSettings({ ...ok, badgeDays: 366 }).length).toBeGreaterThan(0);
    expect(validateSettings({ ...ok, badgeDays: -1 }).length).toBeGreaterThan(0);
    expect(validateSettings({ ...ok, householdSize: 0 }).length).toBeGreaterThan(0);
    expect(validateSettings({ ...ok, householdSize: 21 }).length).toBeGreaterThan(0);
    expect(validateSettings({ ...ok, monthlyIncome: 100000000 }).length).toBeGreaterThan(0);
    expect(validateSettings({ ...ok, bosaiTargets: { water: 10000, food: 0, baby: 0 } }).length).toBeGreaterThan(0);
  });
});
