// ST E2E: 献立決定の一連の流れ（画面操作）を確認する
const results = {};
const bodyText = () => document.body.innerText;
const clickText = async (txt, sel = 'button') => {
  const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(txt));
  if (!el) return false;
  el.click(); await sleep(500); return true;
};
// 献立画面で「豆腐とわかめの味噌汁」を決める（卵は無関係。在庫: 豆腐なし→買い物へ、わかめなし→買い物へ）
// 在庫にある卵を使う献立として「納豆ご飯と卵焼き」ではなく、卵を確実に使うため親子丼の行を探す
history.pushState({}, '', '/expenses/menu'); dispatchEvent(new PopStateEvent('popstate')); await sleep(700);
const rows = [...document.querySelectorAll('.menurrow')];
const oyako = rows.find((r) => r.textContent.includes('親子丼'));
results['E2E-01_menu_row'] = !!oyako;
if (oyako) {
  oyako.querySelector('button').click(); await sleep(600);
  const sheet = document.querySelector('.sheet');
  results['E2E-02_decide_dialog'] = !!sheet && sheet.innerText.includes('使う量');
  if (sheet) {
    await clickText('決める', '.sheet button');
    await sleep(700);
  }
}
// 在庫画面で卵が 4→3 に減っていること、買い物リストに不足分（鶏もも肉など）が入っていること
history.pushState({}, '', '/expenses?tab=stock'); dispatchEvent(new PopStateEvent('popstate')); await sleep(700);
results['E2E-03_stock_decreased'] = bodyText().includes('卵 ×3');
history.pushState({}, '', '/expenses/shopping'); dispatchEvent(new PopStateEvent('popstate')); await sleep(700);
results['E2E-04_shortage_added'] = bodyText().includes('鶏もも肉');
return results;
