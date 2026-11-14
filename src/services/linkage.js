// 連携サービス層: 状態（全コレクション）を受け取り、新しい状態を返すユースケース関数群。
// 連携①〜⑤のうち状態を変える ①②③ と、各画面の基本操作をここに集約する。
// 金額の自動確定は行わない（下書き→本人の確認で確定: D3原則）。
import { newRow, touch } from '../data/store.js';
import { stockTotals, itemThreshold } from '../domain/stock.js';
import { validateExpense, validateStock, validateBosai } from '../domain/validation.js';

const clone = (state) => JSON.parse(JSON.stringify(state));

function fail(errors) {
  const e = new Error(errors.join(' / '));
  e.validationErrors = errors;
  throw e;
}

// --- 連携②の判定: 数量が減った品目について、しきい値を下回ったら買い物リストへ ---
function applyStockLow(state, itemId, beforeTotal) {
  const totals = stockTotals(state.stockItems);
  const afterTotal = totals[itemId] || 0;
  const t = itemThreshold(state.stockItems, itemId);
  if (t === null) return;
  if (beforeTotal >= t && afterTotal < t) {
    const exists = state.shoppingItems.some((s) => s.itemId === itemId && !s.checked);
    if (!exists) {
      state.shoppingItems.push(
        newRow({ itemId, quantity: Math.max(1, t - afterTotal), source: 'stock_low', checked: false, checkedAt: null, draftExpenseId: null })
      );
    }
  }
}

function inheritThreshold(state, itemId, explicit) {
  if (typeof explicit === 'number') return explicit;
  return itemThreshold(state.stockItems, itemId);
}

// 在庫行の新規作成（ロットを分ける: 既存行に合算しない）
export function createStockRow(state, { itemId, quantity, location, refillThreshold }, today) {
  const errs = validateStock({ quantity, refillThreshold });
  if (errs.length) fail(errs);
  const next = clone(state);
  const t = inheritThreshold(next, itemId, refillThreshold);
  const row = newRow({ itemId, quantity, location, registeredDate: today, pinned: false, refillThreshold: t });
  next.stockItems.push(row);
  return { state: next, row };
}

// 防災備蓄品の新規作成
export function createBosaiRow(state, { itemId, quantity, location, kubun, expiryDate }) {
  const errs = validateBosai({ quantity, expiryDate, kubun });
  if (errs.length) fail(errs);
  const next = clone(state);
  const row = newRow({ itemId, quantity, location: location || 'bosaiko', kubun, expiryDate });
  next.bosaiItems.push(row);
  return { state: next, row };
}

// 支出の登録（確定）。在庫追加トグル/防災登録チェックの分岐を含む。
export function createExpense(state, input, today) {
  const {
    date, amount, categoryId, itemId = null, quantity = 1, memo = '',
    addToStock = false, location = null, asBosai = false, kubun = null, expiryDate = null, refillThreshold,
  } = input;
  const errs = validateExpense({ date, amount, categoryId, itemId, quantity, memo }, { requireAmount: true });
  if (addToStock && !itemId) errs.push('在庫に追加する場合は品目を選んでください');
  if (addToStock && !location) errs.push('保管場所を選んでください');
  // 防災備蓄として登録できるのは保管場所が防災庫のときだけ（画面側でも同じ条件でチェックを表示する）
  if (addToStock && asBosai && location !== 'bosaiko') errs.push('防災備蓄として登録できるのは、保管場所が防災庫のときだけです');
  if (addToStock && asBosai) errs.push(...validateBosai({ quantity, expiryDate, kubun }));
  if (errs.length) fail(errs);
  const next = clone(state);
  const expense = newRow({ date, amount, categoryId, itemId, quantity: itemId ? quantity : 1, memo, status: 'confirmed', sourceShoppingItemId: null });
  next.expenses.push(expense);
  let stockRow = null, bosaiRow = null;
  if (addToStock && asBosai) {
    bosaiRow = newRow({ itemId, quantity, location, kubun, expiryDate });
    next.bosaiItems.push(bosaiRow);
  } else if (addToStock) {
    const t = inheritThreshold(next, itemId, refillThreshold);
    stockRow = newRow({ itemId, quantity, location, registeredDate: today, pinned: false, refillThreshold: t });
    next.stockItems.push(stockRow);
  }
  return { state: next, expense, stockRow, bosaiRow };
}

// 支出の編集（確定済みのみ）
export function updateExpense(state, expenseId, patch) {
  const next = clone(state);
  const idx = next.expenses.findIndex((e) => e.id === expenseId);
  if (idx < 0) fail(['支出が見つかりません']);
  const cur = next.expenses[idx];
  if (cur.status !== 'confirmed') fail(['下書きは確認画面から編集してください']);
  const merged = { ...cur, ...patch };
  const errs = validateExpense(merged, { requireAmount: true });
  if (errs.length) fail(errs);
  next.expenses[idx] = touch(cur, patch);
  return { state: next };
}

export function deleteExpense(state, expenseId) {
  const next = clone(state);
  next.expenses = next.expenses.filter((e) => e.id !== expenseId);
  return { state: next };
}

// --- 連携①: 買い物リストの消し込み ⇔ 支出の下書き ---
export function checkShoppingItem(state, shoppingId, today) {
  const next = clone(state);
  const s = next.shoppingItems.find((x) => x.id === shoppingId);
  if (!s) fail(['買い物リスト項目が見つかりません']);
  if (s.checked) {
    // チェックを外す: 下書きが未確定なら削除、確定済みなら外せない
    if (s.draftExpenseId) {
      const draft = next.expenses.find((e) => e.id === s.draftExpenseId);
      if (draft && draft.status === 'confirmed') fail(['この買い物はすでに支出として確定しているため、チェックを外せません']);
      if (draft) next.expenses = next.expenses.filter((e) => e.id !== draft.id);
    }
    const idx = next.shoppingItems.findIndex((x) => x.id === shoppingId);
    next.shoppingItems[idx] = touch(s, { checked: false, checkedAt: null, draftExpenseId: null });
    return { state: next, draft: null };
  }
  const item = next.items.find((i) => i.id === s.itemId);
  const draft = newRow({
    date: today,
    amount: null,
    categoryId: (item && item.defaultCategoryId) || 'cat-food',
    itemId: s.itemId,
    quantity: s.quantity || 1,
    memo: '買い物リストから',
    status: 'draft',
    sourceShoppingItemId: s.id,
  });
  next.expenses.push(draft);
  const idx = next.shoppingItems.findIndex((x) => x.id === shoppingId);
  next.shoppingItems[idx] = touch(s, { checked: true, checkedAt: today, draftExpenseId: draft.id });
  return { state: next, draft };
}

// 下書きの確定（金額は本人が入力する）
export function confirmDraft(state, draftId, input, today) {
  const { amount, categoryId, itemId, quantity = 1, memo = '', date, addToStock = false, location = null, asBosai = false, kubun = null, expiryDate = null } = input;
  const next = clone(state);
  const idx = next.expenses.findIndex((e) => e.id === draftId);
  if (idx < 0) fail(['下書きが見つかりません']);
  const cur = next.expenses[idx];
  if (cur.status !== 'draft') fail(['この支出は下書きではありません']);
  const merged = { ...cur, amount, categoryId: categoryId || cur.categoryId, itemId: itemId ?? cur.itemId, quantity, memo, date: date || cur.date };
  const errs = validateExpense(merged, { requireAmount: true });
  if (addToStock && !merged.itemId) errs.push('在庫に追加する場合は品目を選んでください');
  if (addToStock && !location) errs.push('保管場所を選んでください');
  if (addToStock && asBosai && location !== 'bosaiko') errs.push('防災備蓄として登録できるのは、保管場所が防災庫のときだけです');
  if (addToStock && asBosai) errs.push(...validateBosai({ quantity: merged.quantity, expiryDate, kubun }));
  if (errs.length) fail(errs);
  next.expenses[idx] = touch(cur, { ...merged, status: 'confirmed' });
  if (addToStock && asBosai) {
    next.bosaiItems.push(newRow({ itemId: merged.itemId, quantity: merged.quantity, location, kubun, expiryDate }));
  } else if (addToStock) {
    const t = inheritThreshold(next, merged.itemId, undefined);
    next.stockItems.push(newRow({ itemId: merged.itemId, quantity: merged.quantity, location, registeredDate: today, pinned: false, refillThreshold: t }));
  }
  return { state: next };
}

// 下書きの削除（元の買い物項目は未消し込みに戻る）
export function deleteDraft(state, draftId) {
  const next = clone(state);
  const draft = next.expenses.find((e) => e.id === draftId);
  if (!draft) fail(['下書きが見つかりません']);
  next.expenses = next.expenses.filter((e) => e.id !== draftId);
  if (draft.sourceShoppingItemId) {
    const idx = next.shoppingItems.findIndex((s) => s.id === draft.sourceShoppingItemId);
    if (idx >= 0) next.shoppingItems[idx] = touch(next.shoppingItems[idx], { checked: false, checkedAt: null, draftExpenseId: null });
  }
  return { state: next };
}

// 在庫行の編集（数量減・品目変更で連携②を判定）
export function updateStockRow(state, rowId, patch) {
  const next = clone(state);
  const idx = next.stockItems.findIndex((r) => r.id === rowId);
  if (idx < 0) fail(['在庫が見つかりません']);
  const cur = next.stockItems[idx];
  const merged = { ...cur, ...patch };
  const errs = validateStock(merged);
  if (errs.length) fail(errs);
  const totalsBefore = stockTotals(next.stockItems);
  next.stockItems[idx] = touch(cur, patch);
  // 連携②は「在庫が減った」ときだけ判定する。
  // - 品目変更: 元の品目からは行が抜ける＝減ったとして、元の品目だけを判定する。
  //   新しい品目側は増える側なので判定しない（数量が同時に増えた場合も同じ）。
  // - 数量変更: 減った場合だけ判定する。増えた場合は発火しない。
  if (patch.itemId && patch.itemId !== cur.itemId) {
    applyStockLow(next, cur.itemId, totalsBefore[cur.itemId] || 0);
  } else if (typeof patch.quantity === 'number' && patch.quantity < cur.quantity) {
    applyStockLow(next, cur.itemId, totalsBefore[cur.itemId] || 0);
  }
  return { state: next };
}

export function deleteStockRow(state, rowId) {
  const next = clone(state);
  next.stockItems = next.stockItems.filter((r) => r.id !== rowId);
  return { state: next };
}

export function updateBosaiRow(state, rowId, patch) {
  const next = clone(state);
  const idx = next.bosaiItems.findIndex((r) => r.id === rowId);
  if (idx < 0) fail(['防災備蓄品が見つかりません']);
  const merged = { ...next.bosaiItems[idx], ...patch };
  const errs = validateBosai(merged);
  if (errs.length) fail(errs);
  next.bosaiItems[idx] = touch(next.bosaiItems[idx], patch);
  return { state: next };
}

export function deleteBosaiRow(state, rowId) {
  const next = clone(state);
  next.bosaiItems = next.bosaiItems.filter((r) => r.id !== rowId);
  return { state: next };
}

// FIFO で在庫を減らす（登録日が古い行から）。連携②も判定する。
function decreaseStockFIFO(state, itemId, qty) {
  if (!qty || qty <= 0) return;
  const totalsBefore = stockTotals(state.stockItems);
  let rest = qty;
  const rows = state.stockItems
    .filter((r) => r.itemId === itemId && (r.quantity || 0) > 0)
    .sort((a, b) => (a.registeredDate < b.registeredDate ? -1 : a.registeredDate > b.registeredDate ? 1 : a.createdAt < b.createdAt ? -1 : 1));
  for (const row of rows) {
    if (rest <= 0) break;
    const take = Math.min(row.quantity, rest);
    const idx = state.stockItems.findIndex((r) => r.id === row.id);
    state.stockItems[idx] = touch(state.stockItems[idx], { quantity: row.quantity - take });
    rest -= take;
  }
  applyStockLow(state, itemId, totalsBefore[itemId] || 0);
}

// --- 連携③: 献立決定 → 不足食材は買い物リストへ、使った分は在庫から減る ---
// uses: [{ itemId, qty }] 実際に使う量（材料ごとに調整済みのもの）
export function decideMenu(state, { ingredientItemIds, uses }) {
  const next = clone(state);
  const totals = stockTotals(next.stockItems);
  const useMap = new Map((uses || []).map((u) => [u.itemId, u.qty]));
  for (const itemId of [...new Set(ingredientItemIds)]) {
    if (!((totals[itemId] || 0) > 0)) {
      const exists = next.shoppingItems.some((s) => s.itemId === itemId && !s.checked);
      if (!exists) {
        next.shoppingItems.push(newRow({ itemId, quantity: 1, source: 'menu_short', checked: false, checkedAt: null, draftExpenseId: null }));
      }
    } else {
      decreaseStockFIFO(next, itemId, useMap.get(itemId) ?? 1);
    }
  }
  return { state: next };
}

// 防災の不足分を買い物リストへ
export function addBosaiShortage(state, { itemId, quantity }) {
  if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) fail(['品目と数量（1〜999）を入力してください']);
  const next = clone(state);
  const row = newRow({ itemId, quantity, source: 'bosai_short', checked: false, checkedAt: null, draftExpenseId: null });
  next.shoppingItems.push(row);
  return { state: next, row };
}

// 買い物リストへの手入力追加
export function addShoppingManual(state, { itemId, quantity }) {
  if (!itemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) fail(['品目と数量（1〜999）を入力してください']);
  const next = clone(state);
  const row = newRow({ itemId, quantity, source: 'manual', checked: false, checkedAt: null, draftExpenseId: null });
  next.shoppingItems.push(row);
  return { state: next, row };
}

export function deleteShoppingItem(state, shoppingId) {
  const next = clone(state);
  const s = next.shoppingItems.find((x) => x.id === shoppingId);
  if (s && s.checked) fail(['消し込み済みの項目は削除できません（先にチェックを外してください）']);
  next.shoppingItems = next.shoppingItems.filter((x) => x.id !== shoppingId);
  return { state: next };
}

// 品目マスタへの追加
export function addItem(state, { name, defaultCategoryId }) {
  const next = clone(state);
  const row = { id: `it-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`, name: (name || '').trim(), defaultCategoryId: defaultCategoryId || null };
  next.items.push(row);
  return { state: next, row };
}
