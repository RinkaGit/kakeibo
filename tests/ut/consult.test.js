import { describe, it, expect} from 'vitest';
import { buildConsultText, priorityItems} from '../../src/domain/consult.js';
import { baseState, itemsById, row} from '../helpers.js';

const TODAY = '2026-11-15';

describe('UT-C consult', () => {
it('UT-C01 相談文に在庫・人数・品数・避けたい食材が入る', () => {
const st = baseState();
const stock = [
row({ itemId: 'it-egg', quantity: 6, registeredDate: '2026-11-10'}),
row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-14'}),
];
const text = buildConsultText({ stockItems: stock, itemsById: itemsById(st), today: TODAY, householdSize: 3, avoidFoods: '辛いもの', dishCount: 2});
expect(text).toContain('3人分');
expect(text).toContain('2品');
expect(text).toContain('辛いもの');
expect(text).toContain('・卵 ×6');
expect(text).toContain('・牛乳 ×1');
});
it('UT-C02 優先品は「買って◯日目」で書かれる（期限の言い方をしない）', () => {
const st = baseState();
const stock = [row({ itemId: 'it-egg', quantity: 2, registeredDate: '2026-11-09'})]; // 経過6日 → 7日目
const text = buildConsultText({ stockItems: stock, itemsById: itemsById(st), today: TODAY, householdSize: 2, avoidFoods: '', dishCount: 3});
expect(text).toContain('卵（買って7日目）');
expect(text).not.toContain('賞味期限');
expect(text).not.toContain('期限');
});
it('UT-C03 優先品はピン優先→経過日数降順で最大5件', () => {
const st = baseState();
const stock = [
row({ itemId: 'it-milk', quantity: 1, registeredDate: '2026-11-14', pinned: false}), // 経過1
row({ itemId: 'it-egg', quantity: 1, registeredDate: '2026-11-01', pinned: false}), // 経過14
row({ itemId: 'it-tofu', quantity: 1, registeredDate: '2026-11-13', pinned: true}), // 経過2・ピン
row({ itemId: 'it-natto', quantity: 1, registeredDate: '2026-11-05', pinned: false}), // 経過10
row({ itemId: 'it-rice', quantity: 1, registeredDate: '2026-11-03', pinned: false}), // 経過12
row({ itemId: 'it-bread', quantity: 1, registeredDate: '2026-11-02', pinned: false}), // 経過13
row({ itemId: 'it-ham', quantity: 1, registeredDate: '2026-11-04', pinned: false}), // 経過11
];
const prio = priorityItems(stock, itemsById(st), TODAY);
expect(prio).toHaveLength(5);
expect(prio[0].itemId).toBe('it-tofu'); // ピンが最優先
expect(prio[1].itemId).toBe('it-egg'); // 次は経過最大
});
it('UT-C04 数量0の品目は優先品・在庫一覧に入らない', () => {
const st = baseState();
const stock = [row({ itemId: 'it-egg', quantity: 0, registeredDate: '2026-11-01', pinned: true})];
const text = buildConsultText({ stockItems: stock, itemsById: itemsById(st), today: TODAY, householdSize: 2, avoidFoods: '', dishCount: 3});
expect(text).toContain('（在庫はありません）');
expect(priorityItems(stock, itemsById(st), TODAY)).toHaveLength(0);
});
it('UT-C05 防災備蓄品は相談文の在庫に入らない', () => {
const st = baseState();
const text = buildConsultText({ stockItems: [], itemsById: itemsById(st), today: TODAY, householdSize: 2, avoidFoods: '', dishCount: 3});
expect(text).toContain('（在庫はありません）');
});
it('UT-C06 避けたい食材が空なら「特になし」', () => {
const st = baseState();
const text = buildConsultText({ stockItems: [], itemsById: itemsById(st), today: TODAY, householdSize: 2, avoidFoods: ' ', dishCount: 3});
expect(text).toContain('特になし');
});
});
