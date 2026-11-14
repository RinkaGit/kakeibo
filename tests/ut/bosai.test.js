import { describe, it, expect } from 'vitest';
import { nearExpiryItems, badgeCount, badgeLabel, contextCard, sufficiency } from '../../src/domain/bosai.js';
import { baseState, itemsById, row } from '../helpers.js';

const TODAY = '2026-11-15';

describe('UT-B bosai', () => {
  it('UT-B01 残日数がしきい値ちょうどの品は対象', () => {
    const items = [row({ itemId: 'it-water2l', quantity: 1, kubun: 'water', expiryDate: '2026-11-22' })]; // 残7日
    expect(badgeCount(items, TODAY, 7)).toBe(1);
  });
  it('UT-B02 しきい値+1日は対象外', () => {
    const items = [row({ itemId: 'it-water2l', quantity: 1, kubun: 'water', expiryDate: '2026-11-23' })]; // 残8日
    expect(badgeCount(items, TODAY, 7)).toBe(0);
  });
  it('UT-B03 期限切れは対象に含む', () => {
    const items = [row({ itemId: 'it-water2l', quantity: 1, kubun: 'water', expiryDate: '2026-11-01' })];
    expect(badgeCount(items, TODAY, 7)).toBe(1);
  });
  it('UT-B04 数量0は対象外', () => {
    const items = [row({ itemId: 'it-water2l', quantity: 0, kubun: 'water', expiryDate: '2026-11-16' })];
    expect(nearExpiryItems(items, TODAY, 7)).toHaveLength(0);
  });
  it('UT-B05 バッジ表示: 0は空、100以上は99+', () => {
    expect(badgeLabel(0)).toBe('');
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(99)).toBe('99');
    expect(badgeLabel(100)).toBe('99+');
  });
  it('UT-B06 文脈カードは残日数最小の品と件数', () => {
    const st = baseState();
    const items = [
      row({ itemId: 'it-water2l', quantity: 1, kubun: 'water', expiryDate: '2026-11-20' }),
      row({ itemId: 'it-rice', quantity: 1, kubun: 'food', expiryDate: '2026-11-10' }),
    ];
    const card = contextCard(items, itemsById(st), TODAY, 7);
    expect(card.itemName).toBe('米');
    expect(card.daysLeft).toBe(-5);
    expect(card.count).toBe(2);
  });
  it('UT-B07 対象がなければカードは null', () => {
    const st = baseState();
    expect(contextCard([], itemsById(st), TODAY, 7)).toBeNull();
    const items = [row({ itemId: 'it-rice', quantity: 1, kubun: 'food', expiryDate: '2027-01-01' })];
    expect(contextCard(items, itemsById(st), TODAY, 7)).toBeNull();
  });
  it('UT-B08 充足: 現在量は期限切れを除く', () => {
    const items = [
      row({ itemId: 'it-water2l', quantity: 3, kubun: 'water', expiryDate: '2027-01-01' }),
      row({ itemId: 'it-water2l', quantity: 10, kubun: 'water', expiryDate: '2026-11-01' }), // 期限切れ
      row({ itemId: 'it-rice', quantity: 2, kubun: 'food', expiryDate: '2027-01-01' }),
    ];
    const suf = sufficiency(items, { water: 6, food: 2, baby: 0 }, TODAY);
    expect(suf.water).toEqual({ current: 3, target: 6, rate: 0.5, shortage: 3 });
    expect(suf.food).toEqual({ current: 2, target: 2, rate: 1, shortage: 0 });
  });
  it('UT-B09 充足率は1を超えない、目標0は rate null', () => {
    const items = [row({ itemId: 'it-water2l', quantity: 20, kubun: 'water', expiryDate: '2027-01-01' })];
    const suf = sufficiency(items, { water: 6, food: 0, baby: 0 }, TODAY);
    expect(suf.water.rate).toBe(1);
    expect(suf.food.rate).toBeNull();
    expect(suf.food.shortage).toBe(0);
  });
});
