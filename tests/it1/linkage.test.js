import { describe, it, expect } from 'vitest';
import * as svc from '../../src/services/linkage.js';
import { baseState, row } from '../helpers.js';

const TODAY = '2026-11-15';

describe('IT1-1 支出登録と在庫/防災への振り分け', () => {
  it('IT1-01 通常の支出は確定済みで登録される', () => {
    const { state, expense } = svc.createExpense(baseState(), { date: TODAY, amount: 500, categoryId: 'cat-food' }, TODAY);
    expect(state.expenses).toHaveLength(1);
    expect(expense.status).toBe('confirmed');
    expect(state.stockItems).toHaveLength(0);
  });
  it('IT1-02 在庫に追加すると在庫行（ロット）ができる', () => {
    const { state } = svc.createExpense(baseState(), { date: TODAY, amount: 300, categoryId: 'cat-food', itemId: 'it-egg', quantity: 2, addToStock: true, location: 'fridge' }, TODAY);
    expect(state.stockItems).toHaveLength(1);
    expect(state.stockItems[0]).toMatchObject({ itemId: 'it-egg', quantity: 2, location: 'fridge', registeredDate: TODAY });
    expect(state.bosaiItems).toHaveLength(0);
  });
  it('IT1-03 防災登録（防災庫＋チェック）では防災備蓄品ができ、在庫行はできない', () => {
    const { state } = svc.createExpense(baseState(), { date: TODAY, amount: 1000, categoryId: 'cat-food', itemId: 'it-water2l', quantity: 3, addToStock: true, location: 'bosaiko', asBosai: true, kubun: 'water', expiryDate: '2028-01-01' }, TODAY);
    expect(state.bosaiItems).toHaveLength(1);
    expect(state.bosaiItems[0]).toMatchObject({ itemId: 'it-water2l', kubun: 'water', expiryDate: '2028-01-01' });
    expect(state.stockItems).toHaveLength(0);
  });
  it('IT1-04 防災庫の通常在庫（チェックなし）は期限なしの在庫行になる（仕様第6章の区別）', () => {
    const { state } = svc.createExpense(baseState(), { date: TODAY, amount: 800, categoryId: 'cat-food', itemId: 'it-rice', quantity: 1, addToStock: true, location: 'bosaiko' }, TODAY);
    expect(state.stockItems).toHaveLength(1);
    expect(state.stockItems[0].location).toBe('bosaiko');
    expect(state.stockItems[0].expiryDate).toBeUndefined();
    expect(state.bosaiItems).toHaveLength(0);
  });
  it('IT1-05 防災登録チェックONで保管場所が防災庫以外はエラー', () => {
    expect(() => svc.createExpense(baseState(), { date: TODAY, amount: 100, categoryId: 'cat-food', itemId: 'it-rice', quantity: 1, addToStock: true, location: 'fridge', asBosai: true, kubun: 'food', expiryDate: '2028-01-01' }, TODAY)).toThrow();
  });
  it('IT1-06 在庫に追加で品目なし・保管場所なしはエラー', () => {
    expect(() => svc.createExpense(baseState(), { date: TODAY, amount: 100, categoryId: 'cat-food', addToStock: true, location: 'fridge' }, TODAY)).toThrow();
    expect(() => svc.createExpense(baseState(), { date: TODAY, amount: 100, categoryId: 'cat-food', itemId: 'it-egg', addToStock: true }, TODAY)).toThrow();
  });
  it('IT1-07 防災登録で区分・期限が欠けたらエラー', () => {
    expect(() => svc.createExpense(baseState(), { date: TODAY, amount: 100, categoryId: 'cat-food', itemId: 'it-rice', quantity: 1, addToStock: true, location: 'bosaiko', asBosai: true, kubun: null, expiryDate: '2028-01-01' }, TODAY)).toThrow();
    expect(() => svc.createExpense(baseState(), { date: TODAY, amount: 100, categoryId: 'cat-food', itemId: 'it-rice', quantity: 1, addToStock: true, location: 'bosaiko', asBosai: true, kubun: 'food', expiryDate: null }, TODAY)).toThrow();
  });
  it('IT1-08 新しい在庫行は既存のしきい値を引き継ぐ', () => {
    const st = baseState({ stockItems: [row({ itemId: 'it-egg', quantity: 1, location: 'fridge', registeredDate: '2026-11-01', refillThreshold: 4, pinned: false })] });
    const { state } = svc.createExpense(st, { date: TODAY, amount: 200, categoryId: 'cat-food', itemId: 'it-egg', quantity: 2, addToStock: true, location: 'fridge' }, TODAY);
    const added = state.stockItems.find((r) => r.quantity === 2);
    expect(added.refillThreshold).toBe(4);
  });
});

describe('IT1-2 連携① 消し込み⇔下書き', () => {
  function withShopping() {
    return baseState({ shoppingItems: [row({ id: 'shop-1', itemId: 'it-milk', quantity: 2, source: 'manual', checked: false, checkedAt: null, draftExpenseId: null })] });
  }
  it('IT1-09 チェックすると金額未入力の下書きができる', () => {
    const { state, draft } = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    expect(draft).toMatchObject({ status: 'draft', amount: null, itemId: 'it-milk', quantity: 2, categoryId: 'cat-food', sourceShoppingItemId: 'shop-1', date: TODAY });
    const s = state.shoppingItems.find((x) => x.id === 'shop-1');
    expect(s.checked).toBe(true);
    expect(s.draftExpenseId).toBe(draft.id);
  });
  it('IT1-10 チェックを外すと下書きが消えて未消し込みに戻る', () => {
    let { state } = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    ({ state } = svc.checkShoppingItem(state, 'shop-1', TODAY));
    expect(state.expenses).toHaveLength(0);
    expect(state.shoppingItems[0].checked).toBe(false);
    expect(state.shoppingItems[0].draftExpenseId).toBeNull();
  });
  it('IT1-11 下書きの確定は金額必須で、確定後はチェックを外せない', () => {
    let { state, draft } = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    expect(() => svc.confirmDraft(state, draft.id, { amount: null }, TODAY)).toThrow();
    ({ state } = svc.confirmDraft(state, draft.id, { amount: 198 }, TODAY));
    const exp = state.expenses.find((e) => e.id === draft.id);
    expect(exp.status).toBe('confirmed');
    expect(exp.amount).toBe(198);
    expect(() => svc.checkShoppingItem(state, 'shop-1', TODAY)).toThrow();
  });
  it('IT1-12 下書き削除で買い物項目は未消し込みに戻る', () => {
    let { state, draft } = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    ({ state } = svc.deleteDraft(state, draft.id));
    expect(state.expenses).toHaveLength(0);
    expect(state.shoppingItems[0].checked).toBe(false);
  });
  it('IT1-13 下書き確定時に在庫追加を選べる（既定はオフ＝自動では入らない）', () => {
    let { state, draft } = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    ({ state } = svc.confirmDraft(state, draft.id, { amount: 198 }, TODAY));
    expect(state.stockItems).toHaveLength(0); // 選ばなければ在庫に入らない
    let r2 = svc.checkShoppingItem(withShopping(), 'shop-1', TODAY);
    const st2 = svc.confirmDraft(r2.state, r2.draft.id, { amount: 198, addToStock: true, location: 'fridge' }, TODAY).state;
    expect(st2.stockItems).toHaveLength(1);
  });
});

describe('IT1-3 連携② 在庫減→買い物リスト', () => {
  function withStock(qty = 5, threshold = 3) {
    return baseState({ stockItems: [row({ id: 'stock-1', itemId: 'it-egg', quantity: qty, location: 'fridge', registeredDate: '2026-11-10', refillThreshold: threshold, pinned: false })] });
  }
  it('IT1-14 しきい値を下回った瞬間だけ買い物項目ができる（不足分が数量）', () => {
    const { state } = svc.updateStockRow(withStock(5, 3), 'stock-1', { quantity: 2 });
    expect(state.shoppingItems).toHaveLength(1);
    expect(state.shoppingItems[0]).toMatchObject({ itemId: 'it-egg', source: 'stock_low', quantity: 1, checked: false });
  });
  it('IT1-15 しきい値ちょうどでは発火しない', () => {
    const { state } = svc.updateStockRow(withStock(5, 3), 'stock-1', { quantity: 3 });
    expect(state.shoppingItems).toHaveLength(0);
  });
  it('IT1-16 すでに下回っている状態での減少では発火しない', () => {
    const { state } = svc.updateStockRow(withStock(2, 3), 'stock-1', { quantity: 1 });
    expect(state.shoppingItems).toHaveLength(0);
  });
  it('IT1-17 未消し込みの同品目があれば重複追加しない', () => {
    const st = withStock(5, 3);
    st.shoppingItems.push(row({ id: 'shop-x', itemId: 'it-egg', quantity: 1, source: 'manual', checked: false, draftExpenseId: null }));
    const { state } = svc.updateStockRow(st, 'stock-1', { quantity: 0 });
    expect(state.shoppingItems).toHaveLength(1);
  });
  it('IT1-18 しきい値未設定なら発火しない', () => {
    const { state } = svc.updateStockRow(withStock(5, null), 'stock-1', { quantity: 0 });
    expect(state.shoppingItems).toHaveLength(0);
  });
  it('IT1-19 数量を増やしても発火しない', () => {
    const { state } = svc.updateStockRow(withStock(2, 3), 'stock-1', { quantity: 9 });
    expect(state.shoppingItems).toHaveLength(0);
  });
  it('IT1-20 品目変更では元の品目だけ判定し、新品目側には買い物項目ができない（数量増加を伴っても）', () => {
    // 卵の行がもう1行あり、そちらがしきい値3を持つ（保存後のTが残るケース）
    const st = baseState({ stockItems: [
      row({ id: 'stock-1', itemId: 'it-egg', quantity: 5, location: 'fridge', registeredDate: '2026-11-10', refillThreshold: null, pinned: false }),
      row({ id: 'stock-2', itemId: 'it-egg', quantity: 0, location: 'fridge', registeredDate: '2026-11-11', refillThreshold: 3, pinned: false }),
    ] });
    const { state } = svc.updateStockRow(st, 'stock-1', { itemId: 'it-milk', quantity: 9 });
    // 元の卵は在庫合計が5→0でしきい値3を下回るため1件できる。牛乳側にはできない
    expect(state.shoppingItems).toHaveLength(1);
    expect(state.shoppingItems[0].itemId).toBe('it-egg');
  });
  it('IT1-20b 品目変更でしきい値も行と一緒に移る場合は発火しない（保存後のTで判定）', () => {
    // 卵の行は1行だけで、その行がしきい値を持つ。品目を変えると卵のTは無くなる
    const { state } = svc.updateStockRow(withStock(5, 3), 'stock-1', { itemId: 'it-milk', quantity: 9 });
    expect(state.shoppingItems).toHaveLength(0);
  });
});

describe('IT1-4 連携③ 献立決定', () => {
  it('IT1-21 不足食材が買い物リストに入り、在庫ありは減る', () => {
    const st = baseState({ stockItems: [row({ id: 's1', itemId: 'it-egg', quantity: 3, location: 'fridge', registeredDate: '2026-11-10', pinned: false })] });
    const { state } = svc.decideMenu(st, { ingredientItemIds: ['it-egg', 'it-tofu'], uses: [{ itemId: 'it-egg', qty: 2 }] });
    expect(state.stockItems.find((r) => r.id === 's1').quantity).toBe(1);
    expect(state.shoppingItems).toHaveLength(1);
    expect(state.shoppingItems[0]).toMatchObject({ itemId: 'it-tofu', source: 'menu_short', quantity: 1 });
  });
  it('IT1-22 在庫減は登録日が古い行から（FIFO）', () => {
    const st = baseState({ stockItems: [
      row({ id: 'old', itemId: 'it-egg', quantity: 2, location: 'fridge', registeredDate: '2026-11-01', pinned: false }),
      row({ id: 'new', itemId: 'it-egg', quantity: 2, location: 'fridge', registeredDate: '2026-11-12', pinned: false }),
    ] });
    const { state } = svc.decideMenu(st, { ingredientItemIds: ['it-egg'], uses: [{ itemId: 'it-egg', qty: 3 }] });
    expect(state.stockItems.find((r) => r.id === 'old').quantity).toBe(0);
    expect(state.stockItems.find((r) => r.id === 'new').quantity).toBe(1);
  });
  it('IT1-23 献立の在庫減でも、しきい値を下回れば連携②が連鎖する', () => {
    const st = baseState({ stockItems: [row({ id: 's1', itemId: 'it-egg', quantity: 3, location: 'fridge', registeredDate: '2026-11-10', refillThreshold: 3, pinned: false })] });
    const { state } = svc.decideMenu(st, { ingredientItemIds: ['it-egg'], uses: [{ itemId: 'it-egg', qty: 1 }] });
    expect(state.shoppingItems).toHaveLength(1);
    expect(state.shoppingItems[0].source).toBe('stock_low');
  });
  it('IT1-24 不足分は未消し込みの同品目があれば重複追加しない', () => {
    const st = baseState({ shoppingItems: [row({ id: 'shop-1', itemId: 'it-tofu', quantity: 1, source: 'manual', checked: false, draftExpenseId: null })] });
    const { state } = svc.decideMenu(st, { ingredientItemIds: ['it-tofu'], uses: [] });
    expect(state.shoppingItems).toHaveLength(1);
  });
  it('IT1-25 使う量0の材料は減らない', () => {
    const st = baseState({ stockItems: [row({ id: 's1', itemId: 'it-egg', quantity: 3, location: 'fridge', registeredDate: '2026-11-10', pinned: false })] });
    const { state } = svc.decideMenu(st, { ingredientItemIds: ['it-egg'], uses: [{ itemId: 'it-egg', qty: 0 }] });
    expect(state.stockItems[0].quantity).toBe(3);
  });
});

describe('IT1-5 防災不足・手入力・削除ガード', () => {
  it('IT1-26 防災不足は source=bosai_short で追加される', () => {
    const { state, row: added } = svc.addBosaiShortage(baseState(), { itemId: 'it-water2l', quantity: 3 });
    expect(added.source).toBe('bosai_short');
    expect(state.shoppingItems).toHaveLength(1);
  });
  it('IT1-27 防災不足の数量不正はエラー', () => {
    expect(() => svc.addBosaiShortage(baseState(), { itemId: 'it-water2l', quantity: 0 })).toThrow();
    expect(() => svc.addBosaiShortage(baseState(), { itemId: '', quantity: 1 })).toThrow();
  });
  it('IT1-28 手入力追加は source=manual', () => {
    const { state } = svc.addShoppingManual(baseState(), { itemId: 'it-tissue', quantity: 2 });
    expect(state.shoppingItems[0]).toMatchObject({ source: 'manual', quantity: 2, checked: false });
  });
  it('IT1-29 消し込み済みの買い物項目は削除できない', () => {
    const st = baseState({ shoppingItems: [row({ id: 'shop-1', itemId: 'it-egg', quantity: 1, source: 'manual', checked: true, draftExpenseId: null })] });
    expect(() => svc.deleteShoppingItem(st, 'shop-1')).toThrow();
    const st2 = baseState({ shoppingItems: [row({ id: 'shop-2', itemId: 'it-egg', quantity: 1, source: 'manual', checked: false, draftExpenseId: null })] });
    expect(svc.deleteShoppingItem(st2, 'shop-2').state.shoppingItems).toHaveLength(0);
  });
  it('IT1-30 支出の編集・削除ができる（下書きは編集不可）', () => {
    const st = baseState({ expenses: [
      row({ id: 'e1', date: TODAY, amount: 100, categoryId: 'cat-food', itemId: null, quantity: 1, memo: '', status: 'confirmed', sourceShoppingItemId: null }),
      row({ id: 'e2', date: TODAY, amount: null, categoryId: 'cat-food', itemId: null, quantity: 1, memo: '', status: 'draft', sourceShoppingItemId: null }),
    ] });
    const edited = svc.updateExpense(st, 'e1', { amount: 250 }).state;
    expect(edited.expenses.find((e) => e.id === 'e1').amount).toBe(250);
    expect(() => svc.updateExpense(st, 'e2', { amount: 250 })).toThrow();
    expect(svc.deleteExpense(st, 'e1').state.expenses).toHaveLength(1);
  });
});
