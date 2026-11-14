// テスト用シナリオデータを localStorage に投入する（drive.mjs の script として実行）
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date();
const add = (days) => { const d = new Date(today); d.setDate(d.getDate() + days); return key(d); };
const T = key(today);
const row = (id, fields) => ({ id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...fields });
const P = 'kakeibo:v1:';
const set = (name, v) => localStorage.setItem(P + name, JSON.stringify(v));

set('expenses', [
  row('e-test-1', { date: T, amount: 1200, categoryId: 'cat-food', itemId: 'it-egg', quantity: 2, memo: 'テスト購入', status: 'confirmed', sourceShoppingItemId: null }),
  row('e-test-2', { date: T, amount: 3500, categoryId: 'cat-eatout', itemId: null, quantity: 1, memo: '', status: 'confirmed', sourceShoppingItemId: null }),
]);
set('stockItems', [
  row('st-test-1', { itemId: 'it-egg', quantity: 4, location: 'fridge', registeredDate: add(-9), pinned: true, refillThreshold: 2 }),
  row('st-test-2', { itemId: 'it-milk', quantity: 1, location: 'fridge', registeredDate: add(-1), pinned: false, refillThreshold: null }),
  row('st-test-3', { itemId: 'it-rice', quantity: 1, location: 'bosaiko', registeredDate: add(-30), pinned: false, refillThreshold: null }),
]);
set('bosaiItems', [
  row('bo-test-1', { itemId: 'it-water2l', quantity: 3, location: 'bosaiko', kubun: 'water', expiryDate: add(3) }),
  row('bo-test-2', { itemId: 'it-rice', quantity: 2, location: 'bosaiko', kubun: 'food', expiryDate: add(300) }),
]);
set('shoppingItems', [
  row('sh-test-1', { itemId: 'it-tofu', quantity: 1, source: 'manual', checked: false, checkedAt: null, draftExpenseId: null }),
]);
const settings = { badgeDays: 7, bosaiTargets: { water: 6, food: 2, baby: 0 }, monthlyIncome: 300000, householdSize: 2, avoidFoods: '' };
localStorage.setItem(P + 'settings', JSON.stringify(settings));
return 'seeded ' + T;
