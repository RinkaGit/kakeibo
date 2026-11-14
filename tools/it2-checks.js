// IT2 画面結合チェック（drive.mjs の script として実行し、結果オブジェクトを返す）
const results = {};
const bodyText = () => document.body.innerText;
const overflow = () => document.documentElement.scrollWidth <= window.innerWidth + 1;
const clickText = async (txt, sel = 'button') => {
  const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(txt));
  if (!el) return false;
  el.click();
  await sleep(500);
  return true;
};
const setNative = (el, value, proto) => {
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

// T2-01 起動直後 = 家計簿ホーム、収支と文脈カード
results['T2-01_home'] = location.pathname === '/' && bodyText().includes('今月の収支') && bodyText().includes('295,300円');
results['T2-02_context_card'] = bodyText().includes('防災備蓄の期限が近づいています') && bodyText().includes('水（2L）');
// バッジ: 支出タブに「1」
const expensesTab = [...document.querySelectorAll('.tabbtn')].find((b) => b.textContent.includes('支出'));
results['T2-03_badge'] = !!expensesTab && !!expensesTab.querySelector('.badge') && expensesTab.querySelector('.badge').textContent === '1';
results['T2-01_overflow'] = overflow();
// T2-04 文脈カードのタップで防災備蓄へ
await clickText('防災備蓄の期限が近づいています', '.contextcard');
results['T2-04_card_to_bosai'] = location.pathname + location.search === '/expenses?tab=bosai' && bodyText().includes('備蓄の充足');
// T2-05 支出ハブ既定は支出一覧
history.pushState({}, '', '/expenses'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
const activeSeg = document.querySelector('.segmentbtn.active');
results['T2-05_default_list'] = !!activeSeg && activeSeg.textContent === '支出一覧' && bodyText().includes('外食');
// T2-06 セグメントで在庫へ
await clickText('在庫', '.segmentbtn');
results['T2-06_to_stock'] = location.search.includes('tab=stock') && bodyText().includes('卵') && bodyText().includes('10日目') && bodyText().includes('防災庫');
// T2-07 セグメントで防災備蓄へ（充足バーと期限）
await clickText('防災備蓄', '.segmentbtn');
results['T2-07_to_bosai'] = location.search.includes('tab=bosai') && bodyText().includes('水（2L）') && bodyText().includes('あと3日');
// T2-08 支出登録シート: 在庫トグルと防災チェックの条件表示
history.pushState({}, '', '/expenses?tab=list'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
await clickText('＋支出');
let sheet = document.querySelector('.sheet');
results['T2-08_sheet_open'] = !!sheet && sheet.innerText.includes('支出を登録');
const stockToggle = [...sheet.querySelectorAll('input[type=checkbox]')][0];
stockToggle.click(); await sleep(300);
sheet = document.querySelector('.sheet');
const locSelect = [...sheet.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === '防災庫'));
results['T2-08_location_shown'] = !!locSelect;
setNative(locSelect, 'bosaiko', HTMLSelectElement); await sleep(300);
sheet = document.querySelector('.sheet');
results['T2-08_bosai_check_shown'] = sheet.innerText.includes('防災備蓄として登録する');
setNative(locSelect, 'fridge', HTMLSelectElement); await sleep(300);
sheet = document.querySelector('.sheet');
results['T2-08_bosai_check_hidden'] = !sheet.innerText.includes('防災備蓄として登録する');
document.querySelector('.sheet .iconbtn').click(); await sleep(300);
// T2-09 買い物リストのチェックで下書きができる
history.pushState({}, '', '/expenses/shopping'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
results['T2-09_shopping_page'] = bodyText().includes('豆腐');
const cb = document.querySelector('.shoprow input[type=checkbox]');
cb.click(); await sleep(700);
history.pushState({}, '', '/expenses?tab=list'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
results['T2-09_draft_created'] = bodyText().includes('確認待ちの下書き') && bodyText().includes('金額未入力');
// T2-10 献立画面と相談文
history.pushState({}, '', '/expenses/menu'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
results['T2-10_menu_list'] = bodyText().includes('在庫あり') && bodyText().includes('親子丼');
await clickText('AIに相談する文を作る');
await sleep(400);
const ta = document.querySelector('.consulttext');
results['T2-10_consult_text'] = !!ta && ta.value.includes('今夜の献立を相談させてください') && ta.value.includes('卵');
document.querySelector('.sheet .iconbtn').click(); await sleep(300);
// T2-11 カテゴリ詳細から在庫リンク
history.pushState({}, '', '/graph'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
await clickText('食費', '.graphrow');
await sleep(400);
results['T2-11_category_page'] = location.pathname === '/graph/categories/cat-food' && bodyText().includes('関連する在庫を見る');
await clickText('関連する在庫を見る');
results['T2-11_to_stock'] = location.pathname + location.search === '/expenses?tab=stock';
// T2-12 不正な tab は list にフォールバック
history.pushState({}, '', '/expenses?tab=xxx'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
const seg2 = document.querySelector('.segmentbtn.active');
results['T2-12_invalid_tab'] = !!seg2 && seg2.textContent === '支出一覧';
// T2-13 設定の保存がホーム収支に反映される
history.pushState({}, '', '/settings'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
const incomeInput = [...document.querySelectorAll('.field input')][0];
setNative(incomeInput, '310000', HTMLInputElement); await sleep(200);
await clickText('設定を保存');
await sleep(700);
history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); await sleep(600);
results['T2-13_settings_reflected'] = bodyText().includes('305,300円');
results['T2-13_overflow'] = overflow();
return results;
