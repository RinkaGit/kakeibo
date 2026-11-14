# 夫婦家計簿アプリ 内部設計書（ID）

## 0. 文書情報

| 項目 | 内容 |
|---|---|
| 文書名 | 夫婦家計簿アプリ 内部設計書（ID） |
| 版 | 1.0 |
| 日付 | 2026-11-15 |
| 作成 | Claude Code（作業者 worker） |
| 入力文書 | 仕様書 v1.0 `docs/spec-v1.0.html`（決定 D1〜D6、設計案 S1〜S3、第6章データ項目。U1 は 2026-11-15 に決定済み。改訂版 `docs/spec-v1.1.html`）、作業指示書 `WORK_ORDER.md`、設計ブリーフ `evidence/PLAN-design-brief.md` |
| 関連文書 | 外部設計書 `docs/ED.md`（並行作成） |

### 0.1 ED との関係

- ED は「利用者から見た振る舞い」（画面、入力、バリデーション、データ項目、連携、アラート、非機能）を定める。ID は「それをどう作るか」（モジュール、API、状態、計算手順、テスト）を定める。
- ED と ID はどちらも設計ブリーフ（`evidence/PLAN-design-brief.md`）を正とする。画面ID（SC-01〜SC-08）、ルート、エンティティ名と物理名、連携①〜⑤、計算規則はブリーフと同一にしてある。
- 優先順位: 仕様書の決定事項（D1〜D6、U1）＞ 設計ブリーフ ＞ ED ＞ ID。ID の記述が ED と食い違った場合は ED を正として ID を直す。
- ID で新たに置いた判断は第10.2節に一覧する。

### 0.2 用語

| 用語 | 意味 |
|---|---|
| 今日 | 端末のローカル日付（`YYYY-MM-DD`）。clock モジュールから取得する（5.6節） |
| 在庫合計 | ある品目の StockItem の数量合計。BosaiItem は含めない |
| 下書き | `status = 'draft'` の Expense。金額は null 可 |
| 確定済み | `status = 'confirmed'` の Expense |
| 未消し込み | `checked = false` の ShoppingItem |
| 経過日数 d | 今日 − 登録日（日数）。登録当日は 0 |
| 残日数 r | 期限 − 今日（日数）。期限当日は 0、期限切れは負 |

---

## 1. 技術構成

| 区分 | 採用 | 備考 |
|---|---|---|
| 言語 | JavaScript（ES2022、ESM） | TypeScript は使わない（WORK_ORDER）。型は JSDoc コメントで補う |
| UI | React 18（react, react-dom） | 関数コンポーネントと Hooks のみ |
| ビルド | Vite（@vitejs/plugin-react） | `npm run dev` / `npm run build` / `npm run preview` |
| ルーティング | React Router v6（react-router-dom）の `BrowserRouter` | ルートは S2 を採用・拡張したブリーフ B 節のとおり（2.3節） |
| スタイル | CSS Modules（`*.module.css`）＋ グローバル CSS 1 枚（`src/styles/global.css`） | Vite 標準機能のため追加依存なし。外部 UI ライブラリ・CSS フレームワークは使わない |
| 単体・結合テスト | Vitest ＋ @testing-library/react ＋ jsdom | UT と IT1 |
| E2E | Playwright（@playwright/test、Chromium） | IT2 と ST |
| ID 生成 | `crypto.randomUUID()`。使えない環境（非セキュアコンテキスト）では `crypto.getRandomValues` で UUID v4 を組み立てる | `src/data/id.js` |
| データ保存 | localStorage（`src/data/storageAdapter.js` のみが触れる） | 3章 |

依存パッケージ（これ以外は追加しない）:

| 種別 | パッケージ |
|---|---|
| dependencies | react, react-dom, react-router-dom |
| devDependencies | vite, @vitejs/plugin-react, vitest, jsdom, @testing-library/react, @playwright/test |

補足:
- `BrowserRouter` を使うため、配信時は全パスを `index.html` に返す設定（SPA フォールバック）が必要。Vite の dev / preview は既定で対応する。
- npm scripts: `dev`, `build`, `preview`, `test`（Vitest 全件）, `test:unit`（tests/unit）, `test:it1`（tests/it1）, `e2e`（Playwright 全件）, `e2e:it2`, `e2e:st`。テスト系 script は `TZ=Asia/Tokyo` を付けて実行する（9.6節）。

---

## 2. モジュール構成

### 2.1 ディレクトリツリーと責務

```text
kakeibo-app/
├─ index.html
├─ package.json
├─ vite.config.js            Vite と Vitest の設定（test.environment='jsdom'、setupFiles）
├─ playwright.config.js      Playwright 設定（projects: 390x844 / 1280x800、timezoneId、baseURL）
├─ src/
│  ├─ main.jsx               エントリ。localStorage アダプタ→データ層→services を組み立て AppStoreProvider に渡す
│  ├─ App.jsx                BrowserRouter 配下のルート定義、AppLayout、起動時の `/` 表示（D1）
│  ├─ styles/
│  │  └─ global.css          CSS 変数（色・余白）、リセット、本文最大幅 560px の中央寄せ
│  ├─ constants/
│  │  ├─ segments.js         セグメント定義［支出一覧｜在庫｜防災備蓄］（U1 決定。文言はここだけ）
│  │  ├─ tabs.js             下部タブ4つ（家計簿・支出・グラフ・設定）とパス
│  │  ├─ locations.js        保管場所 fridge/freezer/pantry/bosaiko と表示名、絞り込みチップ定義
│  │  ├─ kubun.js            防災区分 water/food/baby と表示名
│  │  ├─ shoppingSources.js  買い物リスト発生源 stock_low/menu_short/bosai_short と表示名
│  │  ├─ categories.js       初期カテゴリ8件（固定ID、linkToStock、sortOrder）
│  │  ├─ limits.js           バリデーション上限値（金額・数量・文字数・設定値の範囲）
│  │  └─ messages.js         エラー・トースト・空表示などの固定文言
│  ├─ seed/
│  │  ├─ items.js            初期品目マスタ（固定ID）
│  │  ├─ recipes.js          定番レシピ30品（固定ID、材料タグ＝品目ID）
│  │  └─ defaultSettings.js  Settings の既定値
│  ├─ data/
│  │  ├─ storageAdapter.js   アダプタ・インターフェースの定義と localStorage 実装（ブラウザ storage API に触れる唯一のファイル）
│  │  ├─ memoryAdapter.js    同じインターフェースのメモリ実装（テスト用。storage API に触れない）
│  │  ├─ collections.js      コレクション名（物理名）一覧と種類（配列／単一オブジェクト）
│  │  ├─ repository.js       コレクション単位の非同期 CRUD（list/get/create/update/remove/replaceAll）、settings 用の単一レコード repository
│  │  ├─ migrations.js       スキーマ版 CURRENT_SCHEMA_VERSION とマイグレーション関数表
│  │  ├─ initData.js         初回起動時のシード投入とマイグレーション実行
│  │  ├─ errors.js           エラー型（StorageQuotaError 等。3.6節）
│  │  ├─ id.js               ID 生成
│  │  └─ index.js            createDataLayer(adapter) → { repos, init } を返す組み立て口（差し替え点）
│  ├─ domain/                すべて純関数。React・storage・Date.now に依存しない（今日は引数で受ける）
│  │  ├─ dates.js            日付文字列の検証、日番号変換、日数差、月キー
│  │  ├─ stock.js            経過日数、在庫並び順、品目別在庫合計、②しきい値判定、③FIFO 減算
│  │  ├─ bosai.js            残日数、充足率・不足数
│  │  ├─ alerts.js           バッジ件数、バッジ表示文字列、ホームカード選択
│  │  ├─ menu.js             献立候補スコアと並び順（④）
│  │  ├─ forecast.js         今月収支、カテゴリ内訳、平均単価、食費の見通し（⑤）
│  │  ├─ consult.js          相談文テンプレート生成（buildConsultText）
│  │  ├─ validation.js       入力検証（支出・在庫・防災・品目・設定・相談条件）
│  │  └─ format.js           金額・日付・日数ラベルの表示整形
│  ├─ services/
│  │  ├─ index.js            createServices({ repos, init, clock, clipboard }) でユースケース関数群を返す
│  │  ├─ transaction.js      複数コレクション更新のスナップショットとロールバック（4.3節）
│  │  ├─ clock.js            今日・現在時刻の取得（テストで差し替え可能）
│  │  ├─ clipboard.js        クリップボード書込み（navigator.clipboard の薄いラッパ、差し替え可能）
│  │  ├─ appService.js       loadAll（初期化＋全コレクション読込）
│  │  ├─ expenseService.js   createExpense, updateExpense, deleteExpense, confirmDraft, deleteDraft
│  │  ├─ stockService.js     addStockItem, updateStockItem, adjustStockQuantity, toggleStockPin, removeStockItem
│  │  ├─ bosaiService.js     addBosaiItem, updateBosaiItem, removeBosaiItem, addBosaiShortageToShopping
│  │  ├─ shoppingService.js  checkShoppingItem, uncheckShoppingItem, addShoppingItem（内部共用）
│  │  ├─ menuService.js      decideMenu
│  │  ├─ consultService.js   copyConsultText
│  │  ├─ itemService.js      createItem, resolveItemRef（内部共用）
│  │  └─ settingsService.js  updateSettings
│  ├─ state/
│  │  ├─ AppStore.jsx        AppStoreProvider（Context＋useReducer）、起動時ロード、アクション実行キュー
│  │  ├─ reducer.js          reducer と初期 state
│  │  ├─ actionTypes.js      reducer アクション種別
│  │  ├─ selectors.js        派生値の selector（memoizeOne でメモ化）
│  │  └─ hooks.js            useAppData, useAppActions, useToday, useSelector, useToast
│  ├─ components/            共通コンポーネント（6.1節）。各 .jsx と同名の .module.css
│  └─ pages/                 画面と画面専用コンポーネント（6.2節）
│     ├─ HomePage.jsx                SC-01
│     ├─ ExpenseHubPage.jsx          SC-02（セグメント切替の親）
│     ├─ expenseHub/ExpenseListPanel.jsx, StockPanel.jsx, BosaiPanel.jsx
│     ├─ sheets/ExpenseSheet.jsx     SC-03
│     ├─ sheets/StockItemSheet.jsx, BosaiItemSheet.jsx
│     ├─ dialogs/MenuDecideDialog.jsx, BosaiShortageDialog.jsx
│     ├─ ShoppingListPage.jsx        SC-04
│     ├─ MenuPage.jsx                SC-05（menu/ConsultSection.jsx を含む）
│     ├─ GraphPage.jsx               SC-06
│     ├─ CategoryDetailPage.jsx      SC-07
│     └─ SettingsPage.jsx            SC-08
├─ tests/
│  ├─ setup.js               jsdom 用の後始末（localStorage.clear、clock リセット）
│  ├─ helpers/               テスト用ファクトリ（buildExpense 等）、固定日付、memoryAdapter 組み立て
│  ├─ unit/                  UT（domain, validation, data 層）*.test.js
│  └─ it1/                   IT1（services 経由の連携①〜⑤と下書き→確定）*.test.js
└─ e2e/
   ├─ fixtures/              テストデータ（localStorage へ事前投入する JSON 生成関数）、崩れ検出関数
   ├─ it2/                  IT2 *.spec.js
   └─ st/                   ST *.spec.js
```

### 2.2 依存方向のルール

```text
pages / components ──▶ state ──▶ services ──▶ data
                                    │
                                    └──────▶ domain ◀── state（selectors） ◀── pages（表示用の整形は domain/format）
constants / seed は全層から参照可（seed は data/initData と tests からのみ）
```

| ルール | 内容 |
|---|---|
| R1 | 依存は pages → state → services → data / domain の一方向。逆向きの import を禁止する |
| R2 | pages と components は data と services を直接 import しない。書込みは必ず `useAppActions()` 経由 |
| R3 | pages は表示用に domain の純関数（format、selectors 経由の計算）を使ってよい |
| R4 | domain は純関数のみ。React、storage、`Date.now()`、`new Date()`（引数なし）、navigator を使わない。今日は引数 `today` で受ける |
| R5 | ブラウザ storage API（`localStorage` / `sessionStorage` / `indexedDB`）に触れるのは `src/data/storageAdapter.js` のみ。他ファイルからの参照は禁止（テストコードを除く） |
| R6 | services は repository インターフェースだけに依存する（アダプタの種類を知らない） |
| R7 | 文言（セグメント名、保管場所名、区分名、発生源名、固定メッセージ）は constants に集約し、コンポーネントに直書きしない |
| R8 | components（共通）は state を import しない（props のみで動く）。state に触れるのは pages |

R4・R5 の検査: UT に「禁止 import の静的検査」項目を置く（`src/domain/**` と `src/**`（storageAdapter.js 以外）のソース文字列に `localStorage` 等が無いこと、domain に `react` の import が無いことを確認する。9.2節）。

### 2.3 ルート定義（ブリーフ B 節と同一）

| 画面ID | 画面 | ルート | 下部タブの選択状態 | ページコンポーネント |
|---|---|---|---|---|
| SC-01 | 家計簿ホーム | `/` | 家計簿 | HomePage |
| SC-02 | 支出ハブ（セグメント 支出一覧/在庫/防災備蓄） | `/expenses?tab=list` または `stock` または `bosai`（tab 省略・不正値は list） | 支出 | ExpenseHubPage |
| SC-03 | 支出登録シート（新規/編集/下書き確認で共用） | ルートを持たない（オーバーレイ） | 呼出元のまま | ExpenseSheet |
| SC-04 | 買い物リスト | `/expenses/shopping` | 支出 | ShoppingListPage |
| SC-05 | 献立（案A候補一覧＋案B相談ボタン） | `/expenses/menu` | 支出 | MenuPage |
| SC-06 | グラフ（カテゴリ別内訳・食費の見通し） | `/graph` | グラフ | GraphPage |
| SC-07 | カテゴリ詳細 | `/graph/categories/:categoryId` | グラフ | CategoryDetailPage |
| SC-08 | 設定 | `/settings` | 設定 | SettingsPage |
| 補助 | 在庫品目の追加/編集シート、防災備蓄品の追加/編集シート、献立決定の確認ダイアログ、防災不足の追加ダイアログ | オーバーレイ | — | StockItemSheet, BosaiItemSheet, MenuDecideDialog, BosaiShortageDialog |

- 上記以外のパスは `/` へ `replace` で遷移する。
- 下部タブの選択状態はパスの先頭で決める: `/` → 家計簿、`/expenses` で始まる → 支出、`/graph` で始まる → グラフ、`/settings` → 設定（`constants/tabs.js` の `matchPrefix`）。
- 起動時の表示（D1、ブリーフ B「起動時は常に `/`」）: App の初回マウント時に1回だけ、現在パスが `/` でなければ `navigate('/', { replace: true })` する。判定済みフラグはモジュール変数で持つ（ページ再読込で再評価され、アプリ内遷移では働かない）。

---

## 3. データ層

### 3.1 コレクションと物理名

キーは `kakeibo:v1:<collection>`。値は JSON 文字列。

| エンティティ名 | 和名 | コレクション名（物理名） | localStorage キー | 形 |
|---|---|---|---|---|
| Expense | 支出 | `expenses` | `kakeibo:v1:expenses` | 配列 |
| StockItem | 在庫品目 | `stockItems` | `kakeibo:v1:stockItems` | 配列 |
| BosaiItem | 防災備蓄品 | `bosaiItems` | `kakeibo:v1:bosaiItems` | 配列 |
| Recipe | レシピ | `recipes` | `kakeibo:v1:recipes` | 配列 |
| ShoppingItem | 買い物リスト項目 | `shoppingItems` | `kakeibo:v1:shoppingItems` | 配列 |
| Item | 品目マスタ | `items` | `kakeibo:v1:items` | 配列 |
| Category | カテゴリ | `categories` | `kakeibo:v1:categories` | 配列 |
| Settings | 設定 | `settings` | `kakeibo:v1:settings` | 単一オブジェクト |
| （管理情報） | メタ | `meta` | `kakeibo:v1:meta` | 単一オブジェクト |

フィールド（物理名）はブリーフ C 節のとおり。全エンティティ共通で `id`（文字列UUID）、`createdAt`、`updatedAt`（ISO 8601 文字列、`new Date().toISOString()`）を持つ。日付項目（`date`, `registeredDate`, `expiryDate`）は `YYYY-MM-DD`（端末ローカル日付）。

| エンティティ | フィールド（共通項目を除く） |
|---|---|
| Expense | date, amount（整数円、下書きは null 可）, categoryId, itemId（任意、なしは null）, quantity（整数≥1、品目ありの時のみ、なしは null）, memo（≤200字、なしは空文字）, status（'draft' または 'confirmed'）, sourceShoppingItemId（任意、なしは null） |
| StockItem | itemId, quantity（整数≥0）, location（'fridge' / 'freezer' / 'pantry' / 'bosaiko'）, registeredDate, pinned（bool）, refillThreshold（整数≥1 または null） |
| BosaiItem | itemId, quantity（整数≥1）, location（既定 'bosaiko'）, kubun（'water' / 'food' / 'baby'）, expiryDate（必須） |
| Recipe | name, ingredientItemIds（品目ID配列、1件以上、重複なし）, servings |
| ShoppingItem | itemId, quantity（整数≥1）, source（'stock_low' / 'menu_short' / 'bosai_short'）, checked（bool）, checkedAt（ISO または null）, draftExpenseId（または null） |
| Item | name（1〜40字、前後空白除去、重複不可）, defaultCategoryId（または null） |
| Category | name, linkToStock（bool）, sortOrder |
| Settings | badgeDays（既定7）, bosaiTargets（{ water, food, baby }、既定 各0）, monthlyIncome（既定0）, householdSize（既定2）, avoidFoods（既定 空文字） |
| meta | schemaVersion（整数）, seededAt（ISO） |

- Settings は単一レコードで `id = 'settings'` 固定。
- 通常在庫（StockItem）に期限項目は無い（D5）。期限を持つのは BosaiItem だけ。防災備蓄品かどうかはエンティティ種別（どのコレクションか）で判定し、location の値では判定しない（第6章）。

### 3.2 storageAdapter インターフェース

アダプタは「コレクション名 → 値」を保存する最小インターフェース。すべて Promise を返す。

| 関数名 | 引数 | 戻り値 | 例外（reject） | 備考 |
|---|---|---|---|---|
| `getCollection(name)` | name: string（3.1節の物理名） | `Promise<any or null>` | StorageUnavailableError, StorageParseError | 未保存なら null。値は呼び出し側で変更してよい新しいオブジェクト（毎回 JSON.parse） |
| `setCollection(name, value)` | name: string, value: 配列またはオブジェクト | `Promise<void>` | StorageQuotaError, StorageUnavailableError | 値全体を置き換える |
| `removeCollection(name)` | name: string | `Promise<void>` | StorageUnavailableError | テストと将来のマイグレーション用 |
| `listCollectionNames()` | なし | `Promise<string[]>` | StorageUnavailableError | プレフィックス `kakeibo:v1:` のキーのみ対象 |
| `clearAll()` | なし | `Promise<void>` | StorageUnavailableError | プレフィックス一致のキーだけ消す。アプリ画面からは呼ばない（テスト用） |

localStorage 実装:

```js
// src/data/storageAdapter.js
export const KEY_PREFIX = 'kakeibo:v1:';
export function createLocalStorageAdapter({ storage } = {}) {
  // storage 省略時のみ globalThis.localStorage を参照する（このファイル内でだけ許可）
  // 取得時に例外（SecurityError 等）が出たら StorageUnavailableError
  // getItem → null ならそのまま null、JSON.parse 失敗は StorageParseError(name)
  // setItem の例外は isQuotaError(e) なら StorageQuotaError、それ以外は StorageUnavailableError
}
function isQuotaError(e) {
  return e instanceof DOMException && (
    e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 || e.code === 1014);
}
```

- 同期 API を `Promise.resolve` / `Promise.reject` で包む。キャッシュは持たない（毎回読み直す。データ量が小さいため）。
- `memoryAdapter.js` は同じインターフェースを Map で実装し、JSON 往復（`JSON.parse(JSON.stringify(v))`）で値の共有を防ぐ。オプション `failOn: { set: (name) => Error }` で書込み失敗を注入できる（ロールバック試験用）。

### 3.3 repository

`createRepository(adapter, name)` は配列コレクション用、`createSingletonRepository(adapter, name, defaults)` は settings 用。すべて Promise を返す（将来 Firebase に差し替えても呼び出し側を変えないため。ブリーフ I）。

| 関数名 | 引数 | 戻り値 | 例外（reject） | 備考 |
|---|---|---|---|---|
| `list()` | なし | `Promise<Record[]>` | StorageUnavailableError, StorageParseError | 未保存なら `[]`。並びは保存順（作成順） |
| `get(id)` | id: string | `Promise<Record or null>` | 同上 | 見つからなければ null |
| `create(data)` | data: id/createdAt/updatedAt を除くフィールド | `Promise<Record>` | StorageQuotaError ほか | id 生成、createdAt=updatedAt=現在時刻を付けて末尾に追加 |
| `update(id, patch)` | id, patch: 変更フィールド | `Promise<Record>` | NotFoundError, StorageQuotaError ほか | 浅いマージ。id・createdAt は patch に含まれても無視。updatedAt を更新 |
| `remove(id)` | id | `Promise<void>` | NotFoundError, StorageQuotaError ほか | 削除後の配列を保存 |
| `replaceAll(records)` | records: Record[] | `Promise<void>` | StorageQuotaError ほか | シード投入とロールバック専用。services のユースケースからは使わない |
| `bulkUpdate(patches)` | patches: `{ id, patch }[]` | `Promise<Record[]>` | NotFoundError, StorageQuotaError ほか | 1回の読込・1回の書込みで複数行を更新（③FIFO 用）。1件でも id 不明なら何も書かずに NotFoundError |

単一レコード repository（settings）:

| 関数名 | 引数 | 戻り値 | 例外（reject） | 備考 |
|---|---|---|---|---|
| `get()` | なし | `Promise<Settings>` | StorageUnavailableError, StorageParseError | 未保存なら defaults を返す（保存はしない） |
| `update(patch)` | patch | `Promise<Settings>` | StorageQuotaError ほか | 既存（なければ defaults）に浅いマージ。`bosaiTargets` は1段深くマージ |
| `replace(value)` | value | `Promise<void>` | StorageQuotaError ほか | シードとロールバック専用 |

- 現在時刻は `createDataLayer(adapter, { now })` で注入する（既定は `() => new Date().toISOString()`、services の clock と同じものを渡す）。
- repository は値の検証をしない（検証は domain/validation と services の責務）。

### 3.4 スキーマ版とマイグレーション方針

- `meta.schemaVersion` に整数のスキーマ版を持つ。v1.0 リリース時は `CURRENT_SCHEMA_VERSION = 1`。
- 起動時（`init()`）:
  1. `meta` を読む。null なら初回起動としてシード投入（3.5節）。
  2. `meta.schemaVersion < CURRENT` なら `migrations[v]`（v → v+1 の関数）を順に実行し、各段の完了ごとに `meta.schemaVersion` を書く。
  3. `meta.schemaVersion > CURRENT`（新しい版のアプリで保存されたデータ）なら SchemaVersionError で停止し、データには書き込まない。
- マイグレーション関数は `(adapter) => Promise<void>` の形で、必要なコレクションを読み替えて書き戻す。互換を壊さない追加項目（任意項目の追加）はマイグレーションを作らず、読込側で既定値を補う。
- キー名の `v1` は名前空間で、スキーマ版とは独立。キー体系自体を変える必要が出た場合のみ `v2` を新設し、`v1` から複製するマイグレーションを書く。
- v1.0 時点のマイグレーション表は空。

### 3.5 初期データ投入（シード）

`initData.js` の `initialize(adapter, { now })`:

```text
meta = getCollection('meta')
if meta == null:
    setCollection('categories', constants/categories の8件)
    setCollection('items',      seed/items)
    setCollection('recipes',    seed/recipes（30品）)
    setCollection('settings',   seed/defaultSettings)
    setCollection('expenses', []), ('stockItems', []), ('bosaiItems', []), ('shoppingItems', [])
    setCollection('meta', { schemaVersion: CURRENT, seededAt: now })   ← 最後に書く
else:
    migrate(meta)
```

- meta を最後に書くため、途中で失敗した場合は次回起動時に再度シード投入する（中途半端な状態を初回扱いにして上書きする）。
- シードのレコードは固定ID（例 `cat-food`, `seed-item-001`, `seed-recipe-01`）と固定 createdAt（`2026-11-15T00:00:00.000Z`）を持ち、テストで参照できるようにする。
- 初期カテゴリ（`constants/categories.js`、ブリーフ C）:

| id | name | linkToStock | sortOrder |
|---|---|---|---|
| cat-food | 食費 | true | 1 |
| cat-daily | 日用品 | true | 2 |
| cat-eatout | 外食 | false | 3 |
| cat-housing | 住まい・光熱 | false | 4 |
| cat-transport | 交通 | false | 5 |
| cat-kids | 子ども | false | 6 |
| cat-medical | 医療 | false | 7 |
| cat-other | その他 | false | 8 |

- 初期レシピ30品（一般的な家庭の定番で仮置き。家の定番は未入手のため。ブリーフ I の判断）。servings はすべて 2。材料タグは主要材料のみ（調味料・米は含めない）。

| No | name | 材料タグ（品目名） |
|---|---|---|
| 01 | 肉じゃが | 豚肉、じゃがいも、玉ねぎ、にんじん |
| 02 | カレーライス | 豚肉、じゃがいも、玉ねぎ、にんじん、カレールウ |
| 03 | 親子丼 | 鶏もも肉、卵、玉ねぎ |
| 04 | 豚の生姜焼き | 豚肉、玉ねぎ、しょうが |
| 05 | 鶏の唐揚げ | 鶏もも肉、しょうが、にんにく |
| 06 | ハンバーグ | 合いびき肉、玉ねぎ、卵、パン粉 |
| 07 | 野菜炒め | 豚肉、キャベツ、にんじん、もやし |
| 08 | 麻婆豆腐 | 豆腐、豚ひき肉、長ねぎ |
| 09 | 餃子 | 豚ひき肉、キャベツ、にら、餃子の皮 |
| 10 | オムライス | 卵、鶏もも肉、玉ねぎ |
| 11 | 鮭の塩焼き | 鮭 |
| 12 | さばの味噌煮 | さば、しょうが、長ねぎ |
| 13 | ぶり大根 | ぶり、大根 |
| 14 | 筑前煮 | 鶏もも肉、にんじん、ごぼう、れんこん、しいたけ |
| 15 | 豚汁 | 豚肉、大根、にんじん、ごぼう、豆腐 |
| 16 | 豆腐とわかめの味噌汁 | 豆腐、わかめ、長ねぎ |
| 17 | 卵焼き | 卵 |
| 18 | ほうれん草のおひたし | ほうれん草 |
| 19 | きんぴらごぼう | ごぼう、にんじん |
| 20 | ポテトサラダ | じゃがいも、きゅうり、卵、ハム |
| 21 | クリームシチュー | 鶏もも肉、じゃがいも、玉ねぎ、にんじん、牛乳、シチュールウ |
| 22 | チャーハン | 卵、長ねぎ、ハム |
| 23 | 焼きそば | 焼きそば麺、豚肉、キャベツ、もやし |
| 24 | きつねうどん | うどん、油揚げ、長ねぎ |
| 25 | 寄せ鍋 | 白菜、鶏もも肉、豆腐、長ねぎ、しいたけ |
| 26 | ロールキャベツ | キャベツ、合いびき肉、玉ねぎ |
| 27 | 鶏の照り焼き | 鶏もも肉 |
| 28 | 回鍋肉 | 豚肉、キャベツ、ピーマン |
| 29 | チンジャオロース | 牛肉、ピーマン、たけのこ |
| 30 | ナポリタン | スパゲッティ、玉ねぎ、ピーマン、ソーセージ |

- 初期品目マスタ（`seed/items.js`）は上表の材料40品目（defaultCategoryId = `cat-food`）。品目名の重複は無い。防災用・日用品の品目は初期投入しない（利用者が登録シートの「新規」で作る）。

### 3.6 エラー型（`src/data/errors.js`）

すべて `AppError extends Error` を継承し、`code` を持つ。UI は `code` で文言（`constants/messages.js`）を選ぶ。

| クラス | code | 発生箇所 | UI での扱い |
|---|---|---|---|
| StorageQuotaError | `STORAGE_QUOTA` | setCollection | トースト「保存できませんでした。ブラウザの保存容量が不足しています。」。操作はロールバック済み |
| StorageUnavailableError | `STORAGE_UNAVAILABLE` | アダプタ全般（プライベートモード等で localStorage 不可） | 起動時ならエラー画面、操作時ならトースト |
| StorageParseError | `STORAGE_PARSE` | getCollection（JSON 破損） | 起動時エラー画面「データを読み込めませんでした」。自動での初期化・上書きはしない |
| SchemaVersionError | `SCHEMA_VERSION` | init | 起動時エラー画面「新しい版のアプリで保存されたデータです」 |
| NotFoundError | `NOT_FOUND` | repository get 以外、services | トースト「対象が見つかりません。画面を開き直してください。」と該当コレクションの再読込 |
| ValidationError | `VALIDATION` | services（domain/validation の結果） | `fieldErrors: { [field]: message }` をフォームに表示 |
| BusinessRuleError | `RULE_*`（下表） | services | トーストまたはフォーム上部に理由表示 |
| RollbackFailedError | `ROLLBACK_FAILED` | transaction | エラー画面「保存中に問題が起きました。再読み込みしてください。」（cause に元エラー） |

BusinessRuleError の code:

| code | 状況 | 表示文言（messages.js） |
|---|---|---|
| `RULE_DRAFT_CONFIRMED` | 確定済み支出に紐づく買い物項目のチェックを外そうとした | 「この項目から作った支出は確定済みのため、チェックを外せません。」 |
| `RULE_ALREADY_CHECKED` | 消し込み済み項目を再度消し込もうとした | 「この項目は消し込み済みです。」 |
| `RULE_NOT_DRAFT` | 下書きでない支出に confirmDraft / deleteDraft | 「この支出は下書きではありません。」 |
| `RULE_IS_DRAFT` | 下書きに updateExpense / deleteExpense | 「下書きは確認画面から確定または削除してください。」 |

### 3.7 データ層の組み立てと Firebase 等への差し替え手順

```js
// src/data/index.js
export function createDataLayer(adapter, { now }) {
  const repos = {
    expenses: createRepository(adapter, 'expenses', { now }),
    stockItems: ..., bosaiItems: ..., recipes: ..., shoppingItems: ..., items: ..., categories: ...,
    settings: createSingletonRepository(adapter, 'settings', defaultSettings, { now }),
  };
  return { repos, init: () => initialize(adapter, { now }), snapshot, restore };
}
// src/main.jsx
const data = createDataLayer(createLocalStorageAdapter(), { now: clock.nowIso });
const services = createServices({ ...data, clock, clipboard });
```

`snapshot(names)` / `restore(snap)` は transaction 用（4.3節）で、`getCollection` / `setCollection` を使う。

差し替えは2段階のどちらかで行う。services 以上（state, pages）は変更しない。

| 方式 | 差し替えるファイル | 満たすべき条件 | 向く保存先 |
|---|---|---|---|
| A. アダプタ差し替え | `src/data/storageAdapter.js` に別実装（例 `createIndexedDbAdapter`）を追加し、`src/main.jsx` の1行で切り替える | 3.2節の5関数を同じ意味・同じ例外型で実装する。値は JSON 互換 | IndexedDB など「キー → 値」型のローカル保存 |
| B. repository 差し替え | `src/data/repository.js` 相当を新実装（例 `firestoreRepository.js`）し、`src/data/index.js` の `createDataLayer` を差し替える | 3.3節の関数（list/get/create/update/remove/bulkUpdate、settings の get/update）を同じ戻り値・同じ例外型で実装。`snapshot/restore` は、ロールバックの代わりにバッチ書込み（Firestore の `writeBatch` / `runTransaction`）で原子性を確保する実装に置き換える（4.3節の `runTransaction` の中身を差し替える） | Firestore など文書単位の保存先 |

方式 B の注意（今回は実装しない。外部サービスへの接続は WORK_ORDER で禁止）:
- 認証（夫婦2人のアカウント）と共有範囲の設計が別途必要。本アプリは認証を持たない。
- 他端末の変更を受け取るには、store に「外部変更の購読 → 該当コレクションの再読込」を追加する必要がある（現行は起動時ロードと自分の書込み後の再読込のみ）。
- シードの固定ID・固定 createdAt はそのまま移行できる。

---

## 4. services（ユースケース）

### 4.1 共通仕様

- `createServices({ repos, init, snapshot, restore, clock, clipboard })` が以下の関数を持つオブジェクトを返す。
- 各ユースケースは `Promise<ServiceResult>` を返す。

```js
/** @typedef {{ result: any, touched: string[], notices: Notice[] }} ServiceResult */
/** @typedef {{ kind: 'stock_low_added'|'menu_short_added'|'bosai_short_added'|'already_listed', itemName: string }} Notice */
```

- `touched` は更新したコレクション名。store はこれらを `list()` で読み直して state に反映する（5.3節）。
- `notices` は連携で自動発生したこと（②で買い物リストに入った等）を利用者に伝えるためのトースト材料。
- 入力検証は services の先頭で `domain/validation` を呼び、不正なら ValidationError を投げて何も書かない。
- 「今日」は `clock.today()`、時刻は `clock.nowIso()` で取得する（services は引数で today を受けない。テストでは clock を差し替える）。
- 金額を自動で確定する処理は持たない。`status: 'confirmed'` を書くのは createExpense（利用者が金額を入力して登録）と confirmDraft（利用者が金額を入力して確定）だけ（D3）。

品目参照 `ItemRef`: 品目入力欄は「既存を選ぶ」か「新規名を入れる」。

```js
/** @typedef {{ itemId: string } | { newItemName: string }} ItemRef */
```

`resolveItemRef(ref, { defaultCategoryId })`（itemService 内部）: `itemId` ならその存在確認、`newItemName` なら前後空白除去後に重複を確認し、重複していれば ValidationError（`item: '同じ名前の品目があります。一覧から選んでください。'`）、なければ Item を作成して id を返す。作成した場合は `items` を touched に加える。

### 4.2 関数一覧

| 関数 | 入力 | 出力（result） | 実行する連携 | 更新コレクションと書込み順 |
|---|---|---|---|---|
| `loadAll()` | なし | 全コレクションの値 `{ expenses, stockItems, bosaiItems, recipes, shoppingItems, items, categories, settings }` | — | init（初回はシード） |
| `createExpense(input)` | `{ date, amount, categoryId, itemRef?, quantity?, memo, addToStock, location?, registerAsBosai?, kubun?, expiryDate? }` | Expense（confirmed） | なし（補助導線: 在庫に追加） | items（新規品目時）→ expenses → stockItems または bosaiItems |
| `updateExpense(id, input)` | `{ date, amount, categoryId, itemRef?, quantity?, memo }` | Expense | なし | items（新規品目時）→ expenses |
| `deleteExpense(id)` | id | なし | なし | expenses |
| `confirmDraft(id, input)` | createExpense と同じ形（amount 必須、addToStock の既定は false） | Expense（confirmed） | ①の確定段 | items → expenses → stockItems または bosaiItems |
| `deleteDraft(id)` | id | なし | ①の取消段 | expenses → shoppingItems |
| `checkShoppingItem(id)` | id | `{ shoppingItem, draft }` | ① | expenses（下書き作成）→ shoppingItems |
| `uncheckShoppingItem(id)` | id | ShoppingItem | ①の取消段 | expenses（下書き削除）→ shoppingItems |
| `addShoppingItem(params)`（内部共用） | `{ itemId, quantity, source }` | `{ added: ShoppingItem or null }` | ②③と防災不足から呼ぶ | shoppingItems |
| `addStockItem(input)` | `{ itemRef, quantity, location, refillThreshold? }` | StockItem | なし | items → stockItems |
| `updateStockItem(id, input)` | `{ itemRef, quantity, location, refillThreshold? }` | StockItem | ②（数量が減った場合） | items → stockItems → shoppingItems |
| `adjustStockQuantity(id, delta)` | id, delta（+1 または −1） | StockItem | ②（delta<0 の場合） | stockItems → shoppingItems |
| `toggleStockPin(id)` | id | StockItem | ④の入力（並び替えのみ） | stockItems |
| `removeStockItem(id)` | id | なし | なし | stockItems |
| `addBosaiItem(input)` | `{ itemRef, quantity, location, kubun, expiryDate }` | BosaiItem | なし | items → bosaiItems |
| `updateBosaiItem(id, input)` | 同上 | BosaiItem | なし | items → bosaiItems |
| `removeBosaiItem(id)` | id | なし | なし | bosaiItems |
| `addBosaiShortageToShopping(input)` | `{ kubun, itemRef, quantity }` | `{ added: ShoppingItem or null }` | 防災不足→買い物リスト（source=bosai_short） | items → shoppingItems |
| `decideMenu(input)` | `{ recipeId } または { manualName, ingredientItemIds }` と `uses: { [itemId]: number }` | `{ shortages: itemId[], consumed: {itemId, quantity}[], refillAdded: itemId[] }` | ③（＋②の連鎖） | stockItems → shoppingItems |
| `buildConsultText(...)` | domain/consult の純関数（8章）。services からは再公開のみ | string | ⑤ではなく案B | なし |
| `copyConsultText(text)` | text | `{ copied: boolean }` | 案B | なし（clipboard のみ） |
| `createItem(input)` | `{ name, defaultCategoryId? }` | Item | なし | items |
| `updateSettings(patch)` | Settings の一部 | Settings | なし | settings |

連携④（優先付け→献立候補の先頭）と⑤（購入価格の蓄積と食費の見通し）は保存処理を持たず、selector（domain/menu、domain/forecast）で毎回計算する。⑤の「蓄積」は確定済み Expense（itemId・quantity・amount）そのもので、別コレクションを作らない。

#### 4.2.1 各関数の処理

createExpense:
```text
validateExpense(input, mode='new') ; NG → ValidationError
transaction(['items','expenses','stockItems','bosaiItems']):
  itemId = input.itemRef ? resolveItemRef(input.itemRef, { defaultCategoryId: input.categoryId }) : null
  expense = expenses.create({ date, amount, categoryId, itemId, quantity: itemId ? quantity : null,
                              memo, status:'confirmed', sourceShoppingItemId:null })
  if addToStock:
     if location=='bosaiko' and registerAsBosai:
         bosaiItems.create({ itemId, quantity, location, kubun, expiryDate })
     else:
         stockItems.create({ itemId, quantity, location, registeredDate: today, pinned:false, refillThreshold:null })
```
- 「在庫に追加」は再購入でも既存行に合算せず、新しい行（ロット）を作る（ブリーフ C）。
- registerAsBosai は location が 'bosaiko' 以外のとき無視する（UI でも非表示）。

updateExpense: 確定済みの編集。status が draft なら RULE_IS_DRAFT。在庫は触らない（編集モードの登録シートには「在庫に追加」トグルを出さない。10.2節 J-08）。

deleteExpense: 確定済みの削除。draft なら RULE_IS_DRAFT。在庫・買い物リストは触らない。①由来の確定済み支出を削除した場合、元の ShoppingItem は消し込み済みのまま残り、`draftExpenseId` は存在しない支出を指す（uncheck 時は「支出なし」として扱う）。

confirmDraft:
```text
expense = expenses.get(id) ; null → NotFoundError ; status!='draft' → RULE_NOT_DRAFT
validateExpense(input, mode='confirm')      // 金額必須
transaction(['items','expenses','stockItems','bosaiItems']):
  itemId = resolve...
  expenses.update(id, { date, amount, categoryId, itemId, quantity, memo, status:'confirmed' })
  addToStock なら createExpense と同じ在庫追加
```
- 元の ShoppingItem は消し込み済みのまま、`draftExpenseId` も保持する（以後は確定済みのため uncheck 不可）。

deleteDraft:
```text
expense = get(id) ; status!='draft' → RULE_NOT_DRAFT
transaction(['expenses','shoppingItems']):
  expenses.remove(id)
  if expense.sourceShoppingItemId で項目が存在:
     shoppingItems.update(srcId, { checked:false, checkedAt:null, draftExpenseId:null })
```

checkShoppingItem（連携①）:
```text
s = shoppingItems.get(id) ; s.checked → RULE_ALREADY_CHECKED
item = items.get(s.itemId)
categoryId = item?.defaultCategoryId が存在するカテゴリなら それ、なければ 'cat-food'
transaction(['expenses','shoppingItems']):
  draft = expenses.create({ date: today, amount: null, categoryId, itemId: s.itemId, quantity: s.quantity,
                            memo: '買い物リストから', status:'draft', sourceShoppingItemId: s.id })
  shoppingItems.update(id, { checked:true, checkedAt: nowIso, draftExpenseId: draft.id })
```

uncheckShoppingItem:
```text
s = get(id) ; !s.checked → 何もしない（result=s, touched=[]）
e = s.draftExpenseId ? expenses.get(s.draftExpenseId) : null
if e && e.status=='confirmed' → RULE_DRAFT_CONFIRMED
transaction(['expenses','shoppingItems']):
  if e (draft): expenses.remove(e.id)
  shoppingItems.update(id, { checked:false, checkedAt:null, draftExpenseId:null })
```

addShoppingItem（内部共用、重複抑止つき）:
```text
if shoppingItems に { itemId 同じ かつ checked=false } が存在 → { added:null }（notice 'already_listed'）
else create({ itemId, quantity, source, checked:false, checkedAt:null, draftExpenseId:null })
```
- 重複抑止は3つの発生源すべてに適用する（②③はブリーフどおり、防災不足は10.2節 J-05）。
- 利用者が手で任意の項目を足す画面操作は持たない（仕様の発生源は3つのみ）。

adjustStockQuantity / updateStockItem（連携②）:
```text
row = stockItems.get(id)
newQty = row.quantity + delta（updateStockItem は入力値）; 0〜999 外 → ValidationError
before = stockTotal(allStockRows, row.itemId)
transaction(['stockItems','shoppingItems', 'items'(update時)]):
  stockItems.update(id, { quantity:newQty, ... })
  rowsAfter = stockItems.list()
  after = stockTotal(rowsAfter, itemId)
  decision = evaluateRefill({ before, after, threshold: itemThreshold(rowsAfter, itemId) })   // 7.4節
  if decision.add: addShoppingItem({ itemId, quantity: decision.quantity, source:'stock_low' })
```
- updateStockItem で品目を付け替えた場合は、元の品目（before のみ変化）と新しい品目の両方を評価する。元品目は合計が減るので②の対象になり得る。
- 数量 0 になっても行は削除しない（ブリーフ D②）。
- しきい値（refillThreshold）の変更だけでは②を評価しない（「数量を減らした結果」のみが条件のため）。
- removeStockItem は②を評価しない（記録の削除であり数量を減らす操作ではない。10.2節 J-06）。

addBosaiShortageToShopping:
```text
validate: kubun 必須、itemRef 必須、quantity 1〜999
transaction(['items','shoppingItems']):
  itemId = resolveItemRef(itemRef, { defaultCategoryId: null })
  addShoppingItem({ itemId, quantity, source:'bosai_short' })
```

decideMenu（連携③、②の連鎖を含む）:
```text
ingredients = recipe.ingredientItemIds  または  input.ingredientItemIds（手入力。重複除去）
validateMenuDecision(input, stockTotals)      // uses[itemId] は 0〜在庫合計の整数
rows = stockItems.list() ; shoppings = shoppingItems.list()
plan:
  for itemId in ingredients:
     total = stockTotal(rows, itemId)
     if total == 0: shortages.push(itemId)
     else if uses[itemId] > 0: patches += fifoConsume(rows, itemId, uses[itemId])   // 7.5節
transaction(['stockItems','shoppingItems']):
  stockItems.bulkUpdate(patches)                 // 1回で書く
  for itemId in shortages: addShoppingItem({ itemId, quantity:1, source:'menu_short' })
  for 消費した itemId: evaluateRefill(before=total, after=total−used, threshold) → 該当なら addShoppingItem(stock_low)
```
- 手入力の献立名はどこにも保存しない（ブリーフ D③）。名前はトースト表示に使うだけ。
- shortages に入った品目は在庫を減らさない。uses が 0 の在庫あり材料は何もしない。

copyConsultText:
```text
try: await clipboard.writeText(text); return { copied:true }
catch: return { copied:false }        // 例外は投げない。UI がフォールバック表示する（8.6節）
```
- clipboard は `{ writeText(text): Promise<void> }`。既定実装は `navigator.clipboard?.writeText`。`navigator.clipboard` が無い場合は reject する。
- 相談文を外部へ送信する処理・AI 応答を取り込む処理は持たない（D4）。

updateSettings: `validateSettings(patch)` 後に settings.update。

### 4.3 複数コレクション更新の順序と失敗時の扱い

localStorage はキー単位の書込みで、複数キーをまたぐ原子性が無い。そこで services は `runTransaction` で「スナップショット→実行→失敗時に復元」を行う。

```js
// src/services/transaction.js
export async function runTransaction({ snapshot, restore }, names, work) {
  const snap = await snapshot(names);          // 対象コレクションの現在値（JSON）を退避
  try {
    return await work();
  } catch (err) {
    try { await restore(snap); }                // 退避した値で全コレクションを書き戻す（逆順）
    catch (rollbackErr) { throw new RollbackFailedError({ cause: err, rollbackErr }); }
    throw err;                                  // 元のエラーを呼び出し側へ
  }
}
```

- 書込み順の原則: 「主となるレコードを先に、それを参照する更新を後に」。例: ①では下書き Expense を作ってから ShoppingItem に `draftExpenseId` を書く。途中で失敗しても、復元できなかった場合に残るのは「どこからも参照されない下書き」で、参照切れ（存在しない下書きを指す項目）にはならない。
- 復元は退避した値の書き戻しなので、元より容量が増えない。復元にも失敗した場合（ストレージ不可など）は RollbackFailedError とし、UI はエラー画面で再読込を促す。再読込後は保存されている状態をそのまま表示する。
- 同時実行の防止: store のアクション実行はキュー（Promise チェーン）で直列化する（5.3節）。ダブルタップで同じ処理が重なり、read-modify-write が交錯することを防ぐ。加えて、実行中のボタンは disabled にする。
- 複数タブ・複数端末の同時編集は扱わない（後勝ち）。`storage` イベントの購読もしない（ED の非機能「localStorage の限界」に該当）。

---

## 5. 状態管理

### 5.1 AppStore の構成

- `AppStoreProvider`（`src/state/AppStore.jsx`）が React Context を2つ提供する。
  - `AppStateContext`: state（useReducer）
  - `AppActionsContext`: アクション関数群（useMemo で固定。state 変化で再生成しない）
- props: `services`（必須。main.jsx で組み立てたもの。テストではメモリアダプタ版を渡す）、`clock`（既定 `services/clock`）。

state の形:

```js
{
  status: 'loading' | 'ready' | 'error',
  error: null | { code, message },          // 起動時エラー、RollbackFailedError
  data: { expenses: [], stockItems: [], bosaiItems: [], recipes: [], shoppingItems: [],
          items: [], categories: [], settings: {...} },
  today: 'YYYY-MM-DD',
  pending: 0,                               // 実行中アクション数（ボタン disabled 用）
  toast: null | { id, kind: 'info'|'error', text },
}
```

### 5.2 起動時ロード

1. Provider マウント時に `LOAD_START` → `services.loadAll()`。
2. 成功で `LOAD_SUCCESS(data)`、失敗で `LOAD_FAILURE(error)`。
3. `status === 'loading'` の間は App がローディング表示、`'error'` ならエラー画面（エラー文言と「再読み込み」ボタン＝`location.reload()`）を出し、ルートを描画しない。

### 5.3 アクション

reducer アクション（`actionTypes.js`）:

| type | payload | 効果 |
|---|---|---|
| `LOAD_START` | なし | status='loading' |
| `LOAD_SUCCESS` | data | status='ready'、data を設定 |
| `LOAD_FAILURE` | error | status='error' |
| `COLLECTIONS_REFRESHED` | `{ [collectionName]: value }` | data の該当キーだけ差し替え（他は同一参照のまま） |
| `PENDING_INC` / `PENDING_DEC` | なし | pending の増減 |
| `TOAST_SHOW` | `{ kind, text }` | toast 設定（id は連番） |
| `TOAST_HIDE` | id | 同じ id の toast を消す |
| `TODAY_CHANGED` | today | today 更新 |
| `FATAL_ERROR` | error | status='error'（RollbackFailedError 時） |

アクション関数（`useAppActions()` が返す。4.2節の services と1対1）:
`createExpense, updateExpense, deleteExpense, confirmDraft, deleteDraft, checkShoppingItem, uncheckShoppingItem, addStockItem, updateStockItem, adjustStockQuantity, toggleStockPin, removeStockItem, addBosaiItem, updateBosaiItem, removeBosaiItem, addBosaiShortageToShopping, decideMenu, copyConsultText, createItem, updateSettings, showToast`

各アクション関数の共通処理:

```text
run(serviceFn, ...args):
  queue = queue.then(async () => {
    dispatch(PENDING_INC)
    try:
      { result, touched, notices } = await serviceFn(...args)
      values = 各 touched について repos.list()（settings は get()）     // services.reload(touched) として提供
      dispatch(COLLECTIONS_REFRESHED(values))
      notices があれば TOAST_SHOW（messages.js の文言で組み立て）
      return { ok:true, result }
    catch err:
      ValidationError → return { ok:false, fieldErrors }        // フォームが表示。トーストは出さない
      RollbackFailedError → dispatch(FATAL_ERROR)
      NotFoundError → 全コレクション再読込＋TOAST
      その他 → TOAST_SHOW(error, messages[err.code]) ; return { ok:false, error }
    finally: dispatch(PENDING_DEC)
  })
```

- 書込みは必ず services 経由で、保存成功後に state を更新する（楽観的更新はしない）。
- アクション関数は例外を投げず `{ ok, result, fieldErrors, error }` を返す。シートは `ok` で閉じるかどうかを決める。

### 5.4 派生値（selectors）

- selector は `(data, today, ...params) => 値` の純関数で、計算は domain の関数に委ねる。
- メモ化: `memoizeOne`（直前の引数と参照比較で同じなら前回値を返す、自前実装 10 行程度）で包む。`COLLECTIONS_REFRESHED` は変わったコレクションだけ参照を差し替えるため、無関係な selector は再計算されない。
- コンポーネントでは `useSelector(selectX, ...params)`（内部で `useMemo`）で使う。

| selector | 入力 | 出力 | 使う domain |
|---|---|---|---|
| `selectItemMap` | items | `Map<id, Item>` | — |
| `selectCategoryMap` / `selectCategoriesSorted` | categories | Map / sortOrder 昇順配列 | — |
| `selectStockTotals` | stockItems | `Map<itemId, number>` | stock.stockTotalsByItem |
| `selectStockList(location)` | stockItems, items, today, location | 並び済み表示行（経過日数・「◯日目」付き） | stock.sortStockRows, stock.elapsedDays |
| `selectBosaiList` | bosaiItems, items, today | 期限昇順の表示行（残日数付き） | bosai.remainingDays |
| `selectSufficiency` | bosaiItems, settings, today | 区分ごと `{ current, target, ratio, shortage, hasTarget }` | bosai.sufficiency |
| `selectBadgeCount` / `selectBadgeLabel` | bosaiItems, settings, today | 件数 / 表示文字列 | alerts |
| `selectHomeCard` | bosaiItems, items, settings, today | null または `{ count, item, remaining }` | alerts.selectHomeCard |
| `selectDrafts` | expenses | 下書き（createdAt 昇順） | — |
| `selectConfirmedExpenses` | expenses | 確定済み（date 降順→createdAt 降順） | — |
| `selectRecentExpenses(n=5)` | expenses | 確定済みの先頭 n 件 | — |
| `selectMonthSummary` | expenses, settings, today | `{ income, spent, balance, draftCount }` | forecast.monthSummary |
| `selectCategoryBreakdown` | expenses, categories, today | カテゴリ別合計と比率 | forecast.categoryBreakdown |
| `selectCategoryExpenses(categoryId)` | expenses, today | 今月の当該カテゴリ確定済み | — |
| `selectAverageUnitPrices` | expenses | `Map<itemId, number>` | forecast.averageUnitPrices |
| `selectFoodForecast` | expenses, shoppingItems, items, today | `{ confirmed, pending, total, unknownCount }` | forecast.foodForecast |
| `selectShoppingLists` | shoppingItems, items | `{ unchecked, checked }` | — |
| `selectUncheckedCount` | shoppingItems | number | — |
| `selectMenuCandidates` | recipes, stockItems, items, today | 並び済み候補 | menu.rankRecipes |
| `selectConsultInput` | stockItems, items, settings, today | buildConsultText の stock/priority 部分 | consult.collectConsultStock |

### 5.5 URL を状態の源とするもの・ローカル状態

| 状態 | 置き場所 | 規則 |
|---|---|---|
| 支出ハブのセグメント | URL クエリ `tab` | `useSearchParams`。`list` / `stock` / `bosai` 以外・省略は list として表示し、URL は書き換えない。セグメント操作は `setSearchParams({ tab }, { replace: true })`（セグメント切替で履歴を積まない） |
| カテゴリ詳細の対象 | URL パス `:categoryId` | `useParams`。存在しない ID は EmptyState「カテゴリが見つかりません」とグラフへ戻るリンク |
| 在庫の保管場所チップ | StockPanel の `useState`（既定「すべて」） | URL に載せない。セグメント切替で初期化される |
| 支出登録シート（SC-03）の開閉 | 開いたページの `useState`（`{ mode: 'new' または 'edit' または 'draft', expenseId? }` または null） | ルートを持たない。ページ遷移でアンマウントされ閉じる |
| 補助シート・ダイアログの開閉 | 開いたページ／パネルの `useState` | 同上 |
| フォーム入力値 | 各シートの `useState`（開くたびに初期化） | 送信時に actions を呼び、`ok` なら閉じる |
| 献立画面の相談条件（人数・避けたい食材・品数） | MenuPage の `useState`（既定は設定値と3） | 設定へは保存しない（10.2節 J-10） |
| 相談文のフォールバック表示 | ConsultSection の `useState` | コピー失敗時のみ表示 |
| トースト | store の `toast` | 3秒で自動 `TOAST_HIDE` |

### 5.6 「今日」の注入（clock）

```js
// src/services/clock.js
let impl = { now: () => new Date() };
export const clock = {
  nowIso: () => impl.now().toISOString(),
  today: () => toLocalDateString(impl.now()),   // getFullYear/getMonth/getDate で YYYY-MM-DD
};
export function setClockForTest(nowFn) { impl = { now: nowFn }; }
export function resetClock() { impl = { now: () => new Date() }; }
```

- domain は today を引数で受ける。selectors は store の `state.today` を渡す。
- store は起動時に `today = clock.today()` を入れ、`visibilitychange`（表示に戻った時）・`focus`・60 秒ごとのタイマーで `clock.today()` と比べ、変わっていれば `TODAY_CHANGED` を出す（日付をまたいで開きっぱなしでも経過日数・残日数・今月がずれない）。
- E2E は Playwright の `page.clock` で時刻を固定する（9.6節）。

---

## 6. コンポーネント

CSS は各コンポーネントと同名の `*.module.css`。共通の色・余白は `global.css` の CSS 変数を使う。

### 6.1 共通コンポーネント（`src/components/`）

| コンポーネント | 配置画面 | props | 責務 | 状態の持ち方 |
|---|---|---|---|---|
| AppLayout | 全画面（App の外枠） | children | 本文領域（最大幅 560px・中央寄せ、下部タブ分の下余白、safe-area 対応）と BottomTabBar、Toast の配置 | なし |
| BottomTabBar | 全画面 | `badgeLabel`（支出タブ用、null で非表示） | 4タブ（constants/tabs）の表示、現在パスから選択状態を決める、支出タブにバッジ | なし（useLocation） |
| PageHeader | 全画面 | `title`, `backTo?`, `actions?` | 画面タイトル、戻るリンク（SC-04/05/07）、右側の操作 | なし |
| SegmentControl | SC-02 | `options`（`{ value, label }[]`）, `value`, `onChange` | セグメントの表示と選択。`role="tablist"` / `aria-selected` | なし（親が URL から渡す） |
| Sheet | SC-03、在庫/防災シート | `open`, `title`, `onClose`, `children`, `footer` | 下からのシート。背景オーバーレイ、Esc とオーバーレイタップで閉じる、本文のみスクロール、フォーカスを内側に保つ | なし |
| Dialog | 献立決定、防災不足、削除確認 | `open`, `title`, `onClose`, `children`, `actions` | 中央ダイアログ。`role="dialog"`、`aria-modal` | なし |
| ConfirmDialog | 削除操作全般 | `open`, `message`, `confirmLabel`, `onConfirm`, `onCancel` | 削除前の確認 | なし |
| Badge | BottomTabBar、操作行 | `label` | 数字バッジ（label が null なら描画しない） | なし |
| Chip / ChipGroup | 在庫の保管場所、発生源タグ | `options`, `value`, `onChange`（ChipGroup）、`label`, `tone`（Chip） | 絞り込みチップ（単一選択）と表示用タグ | なし |
| FillBar | 防災備蓄（充足）、グラフ（内訳） | `ratio`（0〜1）, `label`, `valueText` | 横棒。幅は `ratio*100%`、`role="meter"` | なし |
| Toast | AppLayout | `toast`, `onHide` | 画面下部（タブの上）にメッセージ、`aria-live="polite"` | なし（store） |
| EmptyState | 各一覧 | `message`, `action?` | データが無い時の表示 | なし |
| FormField | 各フォーム | `label`, `htmlFor`, `error?`, `hint?`, `children` | ラベル・入力・エラー文の並び（`aria-describedby`） | なし |
| AmountInput | SC-03 | `value`, `onChange`, `id` | 金額入力（`inputMode="numeric"`、半角数字以外を除去） | なし |
| QuantityStepper | 在庫、献立決定 | `value`, `min`, `max`, `onChange`, `label` | −／＋ボタンと数値表示 | なし |
| ItemPicker | SC-03、在庫/防災シート、防災不足ダイアログ、手入力献立 | `items`, `value`（ItemRef）, `onChange`, `candidates?`, `multiple?` | 品目マスタからの検索選択と「新規」名入力の切替 | 入力中の検索語のみ useState |
| MoneyText | 各画面 | `amount` | `format.yen` で「¥1,234」表示、null は「未入力」 | なし |
| ErrorScreen / LoadingScreen | App | `error` / なし | 起動時エラー・読込中表示 | なし |

### 6.2 画面別コンポーネント（`src/pages/`）

| コンポーネント | 配置画面 | props | 責務 | 状態の持ち方 |
|---|---|---|---|---|
| HomePage | SC-01 | なし | 今月の収支（収入・支出合計・収支、下書き件数の別表示）、防災の文脈カード（最大1枚、件数>0のみ）、カテゴリ別内訳（行タップで SC-07）、食費の見通し、直近の支出、「＋支出」 | SC-03 の開閉を useState |
| BosaiAlertCard | SC-01 | `card`（selectHomeCard の結果） | 期限が最も近い品と件数の表示、タップで `/expenses?tab=bosai` | なし |
| ExpenseHubPage | SC-02 | なし | PageHeader、操作行（買い物リスト〔未消し込み件数バッジ〕・献立へのリンク）、SegmentControl、tab に応じたパネル、「＋支出」 | tab は URL、SC-03 の開閉を useState |
| ExpenseListPanel | SC-02 支出一覧 | `onOpenSheet(mode, id)` | 先頭に「確認待ちの下書き」欄（下書きがある時のみ）、確定済み一覧（日付降順）、行タップで編集・下書き確認 | なし |
| StockPanel | SC-02 在庫 | なし | 保管場所チップ、在庫行（品目・数量・保管場所・「◯日目」・ピン・−／＋）、行タップで編集シート、「＋在庫」 | チップ値、StockItemSheet の開閉を useState |
| BosaiPanel | SC-02 防災備蓄 | なし | 区分ごとの充足バー（目標未設定は「目標未設定」）、不足数と「買い物リストに追加」、防災備蓄品一覧（期限・残日数ラベル）、「＋防災備蓄」 | BosaiItemSheet・BosaiShortageDialog の開閉を useState |
| ExpenseSheet | SC-03 | `mode`（new / edit / draft）, `expenseId?`, `onClose` | 日付・金額・カテゴリ・品目・数量・メモ、「在庫に追加」トグル（new と draft のみ。draft は既定オフ）、保管場所、防災登録チェック（保管場所=防災庫の時のみ）、区分・期限（チェック時のみ）。ボタン: new=登録、edit=保存/削除、draft=確定/下書き削除 | フォーム値・fieldErrors を useState |
| StockItemSheet | SC-02 在庫（補助） | `stockItemId?`, `onClose` | 品目・数量・保管場所・補充の目安数量の追加/編集、削除（確認つき）。期限欄は持たない（D5） | フォーム値を useState |
| BosaiItemSheet | SC-02 防災備蓄（補助） | `bosaiItemId?`, `onClose` | 品目・数量・保管場所（既定 防災庫）・区分・期限の追加/編集、削除 | フォーム値を useState |
| BosaiShortageDialog | SC-02 防災備蓄（補助） | `kubun`, `shortage`, `onClose` | 品目（その区分の既存品目、または品目マスタ／新規）と数量（既定=不足数）を選んで追加 | フォーム値を useState |
| ShoppingListPage | SC-04 | なし | 未消し込み（作成順）と消し込み済み（checkedAt 降順）の2区分、発生源タグ、チェックで①、チェック外しで取消（確定済みは理由をトースト） | なし |
| MenuPage | SC-05 | なし | 案A 候補一覧（「在庫あり n/m」「不足: …」）、「この献立に決める」、手入力の献立、一覧の下に ConsultSection | 相談条件・ダイアログ開閉を useState |
| RecipeCandidateCard | SC-05 | `candidate`, `onDecide` | 1候補の表示 | なし |
| ManualMenuForm | SC-05 | `onDecide` | 献立名と材料（品目マスタから複数選択）の入力 | フォーム値を useState |
| MenuDecideDialog | SC-05（補助） | `ingredients`, `stockTotals`, `title`, `onConfirm`, `onClose` | 材料ごとの在庫合計と「使う量」（既定1、0〜在庫合計）、在庫0の材料は「買い物リストへ」と表示、確定で decideMenu | 使う量を useState |
| ConsultSection | SC-05 | `conditions`, `onChangeConditions` | 人数・避けたい食材・品数の入力、「AIに相談する文をコピー」ボタン、失敗時の選択可能テキスト欄 | フォールバック表示を useState |
| GraphPage | SC-06 | なし | 今月のカテゴリ別内訳（FillBar、行タップで SC-07）、食費の見通し（確定・見込み・単価不明件数） | なし |
| CategoryDetailPage | SC-07 | なし（URL の categoryId） | 今月の当該カテゴリ合計と確定済み一覧、linkToStock のカテゴリだけ「関連する在庫を見る」（→ `/expenses?tab=stock`） | なし |
| SettingsPage | SC-08 | なし | badgeDays、bosaiTargets（水・食料・赤ちゃん用品）、monthlyIncome、householdSize、avoidFoods の編集と保存 | フォーム値を useState |

### 6.3 constants に集約する文言

| ファイル | 内容 |
|---|---|
| segments.js | `[{ value:'list', label:'支出一覧' }, { value:'stock', label:'在庫' }, { value:'bosai', label:'防災備蓄' }]` の順（U1 決定）。`DEFAULT_SEGMENT = 'list'` |
| tabs.js | 家計簿 `/`、支出 `/expenses`、グラフ `/graph`、設定 `/settings` |
| locations.js | fridge 冷蔵、freezer 冷凍、pantry 常温、bosaiko 防災庫。絞り込みチップは「すべて」＋4つ |
| kubun.js | water 水、food 食料、baby 赤ちゃん用品 |
| shoppingSources.js | stock_low 在庫減、menu_short 献立の不足、bosai_short 防災の不足 |
| messages.js | エラー（3.6節）、トースト（4.1節 notices）、空表示、ラベル（下書き memo「買い物リストから」等） |

---

## 7. 計算ロジック

### 7.1 日付の扱い（`domain/dates.js`）

- 日付はすべて `YYYY-MM-DD` のローカル日付文字列で保存・計算する。
- 日数差は、文字列を年月日に分解し `Date.UTC(y, m - 1, d) / 86400000` で「日番号」に変換して引き算する。UTC には夏時間が無いので、端末のタイムゾーンや DST の切替日をまたいでも差は必ず整数日になる。
- 禁止: `new Date('YYYY-MM-DD')`（UTC 0 時として解釈され、日本時間以外の端末で日付がずれる）、ローカル時刻の Date 同士のミリ秒差を 86400000 で割る計算（DST 切替日に 23/25 時間となり端数が出る）。
- 「今日」だけは `clock` が端末ローカルの年月日（`getFullYear/getMonth/getDate`）から作る。

```text
isValidDateString(s):
  /^\d{4}-\d{2}-\d{2}$/ に一致しない → false
  [y,m,d] = 数値化 ; dt = new Date(Date.UTC(y, m-1, d))
  return dt.getUTCFullYear()==y && dt.getUTCMonth()==m-1 && dt.getUTCDate()==d     // 2026-02-30 等を弾く
dayNumber(s)      = Date.UTC(y, m-1, d) / 86400000
diffDays(from,to) = dayNumber(to) - dayNumber(from)
monthKey(s)       = s.slice(0, 7)                       // 'YYYY-MM'
isInMonth(s, today) = monthKey(s) == monthKey(today)
```

### 7.2 経過日数と「◯日目」表示（`domain/stock.js`）

```text
elapsedDays(registeredDate, today) = max(0, diffDays(registeredDate, today))   // 未来日（端末時計の巻き戻り）は 0
dayLabel(d) = `${d + 1}日目`                                                    // 登録当日が1日目
```

### 7.3 在庫並び順と品目別在庫合計

```text
sortStockRows(rows, itemMap, today):
  rows を次のキーで安定ソート
    1. pinned（true が先）
    2. elapsedDays 降順
    3. 品目名 昇順（localeCompare(b, 'ja')）
    4. id 昇順
filterByLocation(rows, loc) = loc=='all' ? rows : rows.filter(r => r.location == loc)
stockTotal(rows, itemId)    = Σ r.quantity（r.itemId == itemId）           // StockItem のみ
stockTotalsByItem(rows)     = Map<itemId, Σ quantity>
itemThreshold(rows, itemId) = その品目の行の refillThreshold（null 除く）の最大値。無ければ null
```
- 数量0の行も一覧に含める（「0」と表示）。

### 7.4 連携②のしきい値判定

```text
evaluateRefill({ before, after, threshold, hasUncheckedSameItem }):
  if threshold == null           → { add:false, reason:'no_threshold' }
  if !(after < threshold && before >= threshold) → { add:false, reason:'not_crossed' }
  if hasUncheckedSameItem        → { add:false, reason:'already_listed' }
  return { add:true, quantity: max(1, threshold - after) }
```
- 「下回った」は「減らす前は しきい値以上 → 減らした後は しきい値未満」の遷移のみ。既にしきい値未満の状態からさらに減らしても追加しない（重複抑止の一段目）。
- 二段目の重複抑止は「同品目の未消し込み項目がある」場合（addShoppingItem 内でも再確認する）。
- threshold は変更後の行集合から求める。

### 7.5 連携③の FIFO 減算

```text
fifoConsume(rows, itemId, use):
  targets = rows.filter(r => r.itemId==itemId && r.quantity>0)
                .sort(registeredDate 昇順 → createdAt 昇順 → id 昇順)
  remaining = use ; patches = []
  for r in targets while remaining > 0:
     take = min(r.quantity, remaining)
     patches.push({ id: r.id, patch: { quantity: r.quantity - take } })
     remaining -= take
  // use は 0〜在庫合計に検証済みなので remaining は 0 で終わる
  return patches
```

### 7.6 防災の残日数（`domain/bosai.js`）

```text
remainingDays(expiryDate, today) = diffDays(today, expiryDate)     // 期限当日 0、期限切れは負
remainingLabel(r) = r < 0 ? `期限切れ（${-r}日経過）` : r == 0 ? '今日が期限' : `あと${r}日`
```

### 7.7 バッジ件数とホームカード選択（`domain/alerts.js`）

```text
alertTargets(bosaiItems, badgeDays, today) =
  bosaiItems.filter(b => b.quantity >= 1 && remainingDays(b.expiryDate, today) <= badgeDays)   // 期限切れを含む
badgeCount = alertTargets.length
badgeLabel(n) = n == 0 ? null : n >= 100 ? '99+' : String(n)
selectHomeCard(...):
  t = alertTargets(...)
  if t.length == 0 → null
  top = t を (remainingDays 昇順 → 品目名 昇順 → id 昇順) で並べた先頭    // 期限切れ（負）が自然に優先
  return { count: t.length, item: top, remaining: remainingDays(top.expiryDate, today) }
```
- 通常在庫・下書き・買い物リストは対象外（第7章）。

### 7.8 充足率・不足数

```text
sufficiency(bosaiItems, targets, today) → kubun ごとに:
  current = Σ b.quantity（b.kubun==k かつ remainingDays(b.expiryDate, today) >= 0）
  target  = targets[k] ?? 0
  if target == 0 → { hasTarget:false, current }                  // バーを出さず「目標未設定」
  ratio    = min(current / target, 1)
  shortage = max(0, target - current)
  percentText = floor(ratio * 100) + '%'
```

### 7.9 献立候補スコアと並び順（連携④、`domain/menu.js`）

```text
rankRecipes(recipes, stockRows, itemMap, today):
  totals = stockTotalsByItem(stockRows)
  for recipe:
    ings        = uniq(recipe.ingredientItemIds) ; m = ings.length
    inStock     = ings.filter(i => totals[i] > 0) ; n = inStock.length
    pinnedCount = inStock.filter(i => その品目の行に quantity>0 かつ pinned の行がある).length
    maxElapsed  = inStock の各品目について quantity>0 の行の elapsedDays の最大、の最大（inStock が空なら -1）
    shortages   = ings.filter(i => !(totals[i] > 0))
  sort:
    1. n 降順
    2. maxElapsed 降順
    3. pinnedCount 降順
    4. recipe.name 昇順（localeCompare 'ja'）
    5. id 昇順
  表示: 「在庫あり n/m」「不足: 品目名…」（shortages が空なら「不足なし」）
```
- 全レシピを表示する（n=0 も末尾に並ぶ）。並び順は仕様書と ED 5.4 節に合わせ「在庫数 → 経過日数 → ピン数」とする（2026-11-15 Codex レビュー指摘で修正。当初 ID は ブリーフ F の判断でピンを経過日数より上位に置いていたが、優先順位は仕様書＞ブリーフのため ED に統一）。

### 7.10 平均単価と食費の見通し（連携⑤、`domain/forecast.js`）

```text
averageUnitPrices(expenses):
  対象 = status=='confirmed' かつ itemId != null かつ quantity >= 1 かつ amount != null
  品目ごとに sumAmount, sumQty を集計（期間の限定なし）
  price[itemId] = Math.round(sumAmount / sumQty)               // 正の値のみなので四捨五入と一致
foodForecast(expenses, shoppingItems, itemMap, today):
  confirmed = Σ amount（confirmed かつ categoryId=='cat-food' かつ isInMonth(date, today)）
  pendingTargets = shoppingItems.filter(s => !s.checked && effectiveCategory(s.itemId)=='cat-food')
  effectiveCategory(itemId) = itemMap[itemId]?.defaultCategoryId ?? 'cat-food'         // ①の下書きと同じ決め方
  pending = Σ s.quantity * price[s.itemId]（price がある項目のみ）
  unknownCount = 単価が無い項目の件数                                                  // 0円として扱い件数を別表示
  return { confirmed, pending, total: confirmed + pending, unknownCount }
```

### 7.11 今月の収支・カテゴリ内訳

```text
monthSummary(expenses, settings, today):
  spent      = Σ amount（confirmed かつ isInMonth(date, today)）
  draftCount = 件数（draft かつ isInMonth(date, today)）           // 合計には含めず別表示
  balance    = settings.monthlyIncome - spent
categoryBreakdown(expenses, categories, today):
  今月の確定済みを categoryId ごとに合計。合計>0 のカテゴリのみ、sortOrder 昇順
  ratio = 合計 / spent（spent==0 なら空配列）
```

### 7.12 境界値の例（today = 2026-11-15、badgeDays = 7）

| 計算 | 入力 | 期待結果 | 備考 |
|---|---|---|---|
| 経過日数 | registeredDate 2026-11-15 | d=0、「1日目」 | 登録当日 |
| 経過日数 | 2026-11-14 | d=1、「2日目」 | |
| 経過日数 | 2026-10-31（today 2026-11-01） | d=1 | 月またぎ |
| 経過日数 | 2028-02-28（today 2028-03-01） | d=2 | うるう年 |
| 経過日数 | 2026-03-07（today 2026-03-09、TZ=America/New_York） | d=2 | DST 開始日（3/8）をまたぐ |
| 経過日数 | 2026-11-16（未来日） | d=0 | 時計の巻き戻り |
| 残日数 | expiryDate 2026-11-22 | r=7、バッジ対象 | 境界内 |
| 残日数 | 2026-11-23 | r=8、対象外 | 境界外 |
| 残日数 | 2026-11-15 | r=0、「今日が期限」、対象 | |
| 残日数 | 2026-11-14 | r=−1、「期限切れ（1日経過）」、対象 | 期限切れ |
| バッジ | badgeDays 0、期限 2026-11-15 と 2026-11-16 | 1件 | 当日のみ |
| バッジ表示 | 0 / 1 / 99 / 100 件 | 非表示 / 「1」 / 「99」 / 「99+」 | |
| ホームカード | 期限切れ1件（r=−3）と r=2 の2件 | count=2、表示は r=−3 の品 | 期限切れ優先 |
| ② | threshold 3、before 3 → after 2 | 追加、quantity 1 | |
| ② | threshold 3、before 1 → after 0 | 追加しない | 既に下回り済み |
| ② | threshold 3、before 4 → after 0（③で4使用） | 追加、quantity 3 | |
| ② | threshold 3、before 5 → after 3 | 追加しない | 3 は未満でない |
| ② | threshold null | 追加しない | 未設定 |
| ② | 条件成立だが同品目の未消し込みあり | 追加しない | 重複抑止 |
| ③ FIFO | 行A（11/01、2）・行B（11/10、3）、use 3 | A→0、B→2 | 古い行から |
| ③ | 材料の在庫合計 0 | menu_short を quantity 1 で追加、在庫は不変 | |
| 充足 | target 10、有効数量 4 | 40%、不足 6 | |
| 充足 | target 10、有効数量 12 | 100%、不足 0 | 上限1 |
| 充足 | target 0 | 「目標未設定」、ボタンなし | |
| 充足 | 期限切れ 5 個を含む（有効 4） | current 4 | 期限切れは数えない |
| 平均単価 | 198円×1、400円×2 | round(598/3)=199 | |
| 平均単価 | 100円×1、101円×1 | round(100.5)=101 | 0.5 は切上げ |
| 食費見通し | 食費確定 3,000、未消し込み 卵2（単価199）・不明品目1 | pending 398、total 3,398、unknownCount 1 | |
| 今月収支 | 収入 300,000、確定 120,000、下書き 2件 | balance 180,000、下書き2件を別表示 | 下書きは含めない |

---

## 8. 相談文テンプレート生成（案B）

### 8.1 関数シグネチャ（`domain/consult.js`）

```js
/**
 * @param {{
 *   stockLines: { name: string, quantity: number }[],          // 品目合算済み、数量>0のみ
 *   priorityLines: { name: string, day: number, pinned: boolean }[], // 最大5件
 *   householdSize: number, avoidFoods: string, dishCount: number,
 * }} input
 * @returns {string}
 */
export function buildConsultText(input) { ... }

/** 在庫から stockLines / priorityLines を作る（selectConsultInput が使う） */
export function collectConsultStock(stockRows, itemMap, today) { ... }
```

### 8.2 入力

| 入力 | 出所 | 既定値 | 検証（validation.validateConsultConditions） |
|---|---|---|---|
| 在庫 stockLines | StockItem を品目ごとに合算。数量>0 の品目のみ。品目名昇順。防災備蓄品（BosaiItem）は含めない | — | — |
| 優先 priorityLines | 在庫行（数量>0）を在庫並び順（ピン付き→経過日数降順→品目名）で並べ、品目で重複除去し先頭5件 | — | — |
| 人数 householdSize | 献立画面の入力 | 設定 householdSize | 整数 1〜20 |
| 避けたい食材 avoidFoods | 献立画面の入力 | 設定 avoidFoods | 200字以内 |
| 作りたい品数 dishCount | 献立画面の入力 | 3 | 整数 1〜10 |

### 8.3 テンプレート全文

`{…}` が埋め込み箇所。改行は `\n`、末尾に改行を付けない。

```text
献立の相談です。家にある食材をできるだけ使った献立を考えてください。

【条件】
・人数: {householdSize}人分
・作りたい品数: {dishCount}品
・避けたい食材: {avoidFoodsText}

【家にある食材（品目と数量）】
{stockBlock}

【優先して使いたい食材】
{priorityBlock}

【お願い】
・「優先して使いたい食材」をなるべく使ってください。
・家にない食材が必要な場合は、買い足すものとして分けて書いてください。
・それぞれの料理について、料理名・使う食材・簡単な作り方を書いてください。
```

### 8.4 埋め込み規則

| 埋め込み | 規則 |
|---|---|
| `{householdSize}` / `{dishCount}` | 整数をそのまま |
| `{avoidFoodsText}` | avoidFoods の前後空白を除去し、改行を「、」に置換。空なら `特になし` |
| `{stockBlock}` | 1品目1行で `・{品目名} {数量}`（例 `・卵 6`）。単位は持たないので数値のみ |
| `{priorityBlock}` | 1品目1行で `・{品目名}（{day}日目）`、ピン付きは `・{品目名}（{day}日目、そろそろ使いたい）`。day は 7.2 節の d+1 |

空の場合:

| 状況 | 出力 |
|---|---|
| 在庫が空（数量>0 の在庫行なし） | `{stockBlock}` = `・（登録されている在庫はありません）`、`{priorityBlock}` = `・（特になし）` |
| 避けたい食材なし | `・避けたい食材: 特になし` |

### 8.5 出力例

入力: 卵 6（2日目、ピン）、玉ねぎ 3（10日目）、鶏もも肉 1（1日目）、人数2、避けたい食材「セロリ」、品数3。

```text
献立の相談です。家にある食材をできるだけ使った献立を考えてください。

【条件】
・人数: 2人分
・作りたい品数: 3品
・避けたい食材: セロリ

【家にある食材（品目と数量）】
・玉ねぎ 3
・鶏もも肉 1
・卵 6

【優先して使いたい食材】
・卵（2日目、そろそろ使いたい）
・玉ねぎ（10日目）
・鶏もも肉（1日目）

【お願い】
・「優先して使いたい食材」をなるべく使ってください。
・家にない食材が必要な場合は、買い足すものとして分けて書いてください。
・それぞれの料理について、料理名・使う食材・簡単な作り方を書いてください。
```

（在庫欄の並びは品目名の `localeCompare('ja')` 昇順。実装時の実際の並びは UT で確定値を固定する。）

### 8.6 コピーと失敗時のフォールバック

1. 「AIに相談する文をコピー」押下で、条件を検証（NG ならフォームにエラー）→ `buildConsultText` → `actions.copyConsultText(text)`。
2. `copied: true` → トースト「相談文をコピーしました。お使いのAIサービスに貼り付けて相談してください。」
3. `copied: false`（`navigator.clipboard` が無い、非セキュアコンテキスト、権限拒否）→ ConsultSection に読み取り専用 `<textarea>` で全文を表示し、表示直後に `select()` する。文言「コピーできませんでした。下の文を長押しして選択し、コピーしてください。」。`document.execCommand('copy')` は使わない（非推奨 API のため）。
4. アプリは相談文を外部に送信せず、AI の回答を取り込む機能も持たない（D4）。決めた献立は利用者が手入力の献立（ManualMenuForm）で入力する。

---

## 9. テスト方針

### 9.1 テストレベル一覧

| レベル | 対象 | ツール | 配置 | 項目ID | 証跡 |
|---|---|---|---|---|---|
| UT | domain（dates, stock, bosai, alerts, menu, forecast, consult, format）、validation、data 層（storageAdapter, memoryAdapter, repository, initData, migrations, errors）、services/transaction、依存ルールの静的検査 | Vitest（jsdom） | `tests/unit/<module>.test.js` | `UT-001` から連番 | `evidence/UT-items.md`、`evidence/UT-log.txt` |
| IT1 | services 経由の連携①〜⑤、下書き→確定フロー、ロールバック、store のアクション（Provider を描画して actions を呼ぶ） | Vitest＋@testing-library/react（jsdom） | `tests/it1/<scenario>.test.js` | `IT1-001` から | `evidence/IT1-items.md`、`evidence/IT1-log.txt` |
| IT2 | 画面遷移6段（仕様第3章）、セグメント切替と URL、トグル・チェックの条件表示、シート開閉、バッジ表示 | Playwright | `e2e/it2/<topic>.spec.js` | `IT2-001` から | `evidence/IT2-items.md`、`evidence/IT2-log.txt`、`evidence/it2-shots/` |
| ST | 全画面×390/1280 のスクリーンショットと崩れ自動検査、主要 E2E シナリオ | Playwright | `e2e/st/<topic>.spec.js` | `ST-001` から | `evidence/ST-items.md`、`evidence/ST-log.txt`、`evidence/st-shots/` |
| UAT | D1〜D6（＋S1〜S3、U1）への適合判定、ビルド確認、既知の制限 | チェックリスト（根拠は上位テストIDと画面） | — | `UAT-D1` 〜 `UAT-D6`、`UAT-S1` 〜 `UAT-S3`、`UAT-U1`、`UAT-B01`（ビルド） | `evidence/UAT-items.md` |

### 9.2 命名と項目表

- テスト名の先頭に項目IDを付ける: `it('UT-012 経過日数: 登録当日は1日目', ...)`、`test('IT2-003 セグメント切替でURLのtabが変わる', ...)`。ログから項目表へ結果を転記するときの突き合わせキーにする。
- 1 項目 = 1 テストケース。1テスト内で複数観点を検査しない。
- 項目表の列（UT/IT1 共通）: `項目ID | 対象 | 観点 | 入力 | 期待結果 | 結果 | 証跡`。IT2/ST は `証跡` にスクリーンショットのパスを書く。
- 結果は実行ログからの転記のみ（PASS / FAIL）。実行していない項目を PASS にしない。
- UT の観点の網羅: 7.12 節の境界値表は全行を UT 項目にする。validation は各項目の「最小・最大・範囲外・型違い・空」を項目にする。data 層は正常系に加えて QuotaExceeded、JSON 破損、localStorage 取得不可、未知のスキーマ版を項目にする。
- 依存ルールの静的検査（UT）: `src/**/*.js(x)` を読み、`storageAdapter.js` 以外に `localStorage` / `sessionStorage` / `indexedDB` の文字列が無いこと、`src/domain/**` に `from 'react'` と引数なしの `new Date()`・`Date.now(` が無いこと。

### 9.3 IT1 の必須シナリオ

| 区分 | シナリオ |
|---|---|
| ① | 消し込み→下書き作成（項目の内容、amount null、memo、categoryId の決め方）／チェック外し→下書き削除／確定済みはチェック外し不可／下書き確定（金額必須、確定後はホーム合計に入る）／下書き削除→項目が未消し込みに戻る／確定時「在庫に追加」オンで在庫行ができる |
| ② | 下回り遷移で追加／既に下回っていると追加しない／未消し込み重複で追加しない／しきい値未設定は追加しない／複数行の最大しきい値を使う／品目付け替え時に元品目を評価 |
| ③ | 在庫0材料→menu_short／FIFO 減算／③による減少で②が連鎖／使う量0の材料は不変／手入力献立がレシピとして保存されない |
| ④ | ピン付け替えで候補の先頭が変わる／経過日数で並びが変わる |
| ⑤ | 確定済みのみから平均単価／下書きは単価・見通しに入らない／未消し込み項目の見込み額と単価不明件数 |
| 横断 | 金額の自動確定が起きない（全連携の後で confirmed の件数が利用者操作分だけ）／書込み途中の QuotaExceeded でロールバックされ全コレクションが元に戻る／在庫追加＋防災チェックで BosaiItem のみ作られ StockItem は作られない／防災庫の StockItem はバッジ対象にならない（エンティティ種別で判定） |

### 9.4 IT2 の必須シナリオ

- 遷移6段（仕様第3章）: ①起動で `/` のホーム ②文脈カードタップで `/expenses?tab=bosai` が開きセグメント「防災備蓄」が選択 ③下部タブ「支出」で既定「支出一覧」、バッジは防災期限件数のみ ④セグメント切替（3つ、並びと文言が［支出一覧｜在庫｜防災備蓄］） ⑤登録シートの「在庫に追加」オンで保管場所表示、防災庫選択時だけ防災登録チェック表示、チェックで区分・期限表示 ⑥カテゴリ詳細（食費）から「関連する在庫を見る」で在庫セグメント。
- 加えて: tab 不正値で支出一覧、買い物リスト・献立への遷移と戻る、深いパスで起動すると `/` が表示される（D1）、linkToStock でないカテゴリにはリンクが無い、バッジ 0 件で非表示。
- 各段で 390x844 のスクリーンショットを `evidence/it2-shots/IT2-<番号>-<段>.png` に保存する。

### 9.5 ST

- 撮影対象（各 390x844 と 1280x800 で `fullPage: true`）: SC-01、SC-02（list / stock / bosai）、SC-03（新規、在庫に追加＋防災チェックをすべて開いた状態、下書き確認、編集）、SC-04、SC-05（相談のフォールバック表示を含む）、SC-06、SC-07（linkToStock あり・なし）、SC-08、補助（在庫シート、防災シート、献立決定ダイアログ、防災不足ダイアログ）。データは「標準データ」と「空データ」の2種（SC-01・SC-02・SC-04・SC-05・SC-06 は両方、その他は標準データ）。
- ファイル名: `evidence/st-shots/<画面ID>-<状態>-<幅>.png`（例 `SC-02-stock-390.png`、`SC-03-bosai-check-1280.png`）。
- 主要 E2E シナリオ（1本の spec）: 支出登録（在庫に追加）→在庫で数量を減らし②発生→買い物リストで消し込み→下書き確認で金額入力・確定→献立で決定（③）→相談文コピー（クリップボード権限を付与して内容を読み戻し検証）。
- 撮影した画像は作業者が目視確認し、ST-items.md に画面ごとの確認結果を記録する。

### 9.6 時刻・タイムゾーンの固定

| 対象 | 方法 |
|---|---|
| domain の UT | `today` を引数で渡す（固定値 `'2026-11-15'`）。DST 項目のみ `TZ=America/New_York` を付けた別 script（`test:unit:dst`）でも同じテストファイルを実行し、結果が変わらないことを確認する |
| services・store（IT1） | `setClockForTest(() => new Date('2026-11-15T09:00:00+09:00'))`、`afterEach(resetClock)`。日付またぎは `2026-11-15T23:59:59+09:00` → `2026-11-16T00:00:01+09:00` で TODAY_CHANGED を検証（vi.useFakeTimers でインターバルを進める） |
| 実行環境 | npm script に `TZ=Asia/Tokyo` を付ける |
| Playwright | `playwright.config.js` の `use: { timezoneId: 'Asia/Tokyo', locale: 'ja-JP' }`、各テストの先頭で `await page.clock.setFixedTime(new Date('2026-11-15T09:00:00+09:00'))`（ページ読込前） |

### 9.7 localStorage のテスト時の扱い

- UT/IT1: `tests/setup.js` の `beforeEach` で `localStorage.clear()`。repository と services のテストは原則 `memoryAdapter` を使い、localStorage 実装の試験だけ jsdom の localStorage を使う。
- QuotaExceeded の再現: `setItem` が `new DOMException('quota', 'QuotaExceededError')` を投げる偽 storage を `createLocalStorageAdapter({ storage })` に渡す。ロールバック試験は memoryAdapter の `failOn` で N 回目の書込みを失敗させる。
- E2E: Playwright は各テストで新しいブラウザコンテキスト（空の localStorage）。データ入りの状態は `page.addInitScript` で `kakeibo:v1:*` キーを事前に書き込む（`e2e/fixtures/seedData.js` の `buildStandardData()` / `buildEmptyData()` が meta を含む全キーの値を返す）。この直接書込みはテストコードに限り許可する（R5 はアプリコードの規則）。

### 9.8 Playwright の viewport と崩れ検出

- `playwright.config.js` の projects: `mobile-390`（viewport 390x844、deviceScaleFactor 2、hasTouch true）と `desktop-1280`（1280x800）。IT2 は mobile-390 を主とし、ST は両方。
- 補助として、全画面について 320x640 で横スクロール検査だけを行う（ブリーフ H「320〜1280px で横スクロールなし」の確認。スクリーンショットは必須にしない）。
- 自動チェック（`e2e/fixtures/layoutChecks.js` の `assertNoLayoutBreak(page)`、各撮影の直前に実行）:

| 検査 | 方法 | 合格条件 |
|---|---|---|
| 横スクロール | `document.documentElement.scrollWidth <= document.documentElement.clientWidth`（body も同様） | 成立 |
| 画面外へのはみ出し | 表示中の全要素の `getBoundingClientRect()` で `left >= -1` かつ `right <= innerWidth + 1` | 違反0件 |
| 文字の切れ | `overflow` が hidden/clip の要素で `scrollWidth > clientWidth + 1`。意図した省略（クラス `ellipsis` を付けた要素）は除外 | 違反0件 |
| 要素の重なり | 対象は「葉に近い表示要素」（`button, a, input, select, textarea, label, h1-h3, [data-testid], li` のうち表示中のもの）。祖先・子孫関係にない2要素の矩形の交差面積が 1px² を超えたら違反。オーバーレイ（Sheet/Dialog）表示中は、オーバーレイの外側の要素を検査対象から外す（`[data-overlay-root]` 内のみ検査）。固定配置の BottomTabBar は「ページ最下部までスクロールした時、本文の最後の要素の下端 ≤ タブバーの上端」で別途検査 | 違反0件 |
| タップ領域 | `button, a, input[type=checkbox]` の矩形が 44x44px 以上（チェックボックスはラベル込み） | 違反は警告として ST-items.md に記録 |

- 違反があればセレクタと矩形をテスト出力に書き、テストを失敗させる。自動検査は目視確認の代わりではなく補助とする（目視も行う）。

### 9.9 UAT

- `evidence/UAT-items.md` に D1〜D6、S1〜S3、U1 を1行ずつ、判定（適合/不適合）と根拠（UT/IT1/IT2/ST の項目IDとスクリーンショット）を書く。
- `npm run build` の成功（終了コードと出力）を `UAT-B01` として記録する。
- 既知の制限（localStorage の端末独立・容量・消去、複数タブ非対応、初期レシピが仮置き等）を列挙し、リリース可否の自己判定を書く。

---

## 10. ED との対応と ID の追加判断

### 10.1 ED との対応表

ED の章番号は ED 側の目次に従う。ここでは WORK_ORDER が ED に求めた内容単位で対応を示す。

| ED の内容 | ID の対応節 |
|---|---|
| 画面一覧と遷移（SC-01〜SC-08、ルート、下部タブ） | 2.3 ルート定義、5.5 URL を状態の源とするもの、6.2 画面別コンポーネント |
| 画面ごとの表示要素・入力項目 | 6.1 共通コンポーネント、6.2 画面別コンポーネント、6.3 constants |
| バリデーション | 4.1 共通仕様（validation の呼び出し位置）、3.6 エラー型（ValidationError）、9.2 UT の観点 |
| データ項目定義（5エンティティ＋品目マスタ＋カテゴリ＋設定） | 3.1 コレクションと物理名、3.5 シード |
| 連携ルール①〜⑤ | 4.2 関数一覧と 4.2.1 各関数の処理、7.4 ②判定、7.5 ③FIFO、7.9 ④並び、7.10 ⑤見通し |
| 下書き→確認→確定 | 4.2.1（checkShoppingItem, confirmDraft, deleteDraft, uncheckShoppingItem） |
| アラート/バッジ規則 | 7.6 残日数、7.7 バッジとホームカード |
| 防災備蓄の充足と不足 | 7.8、4.2.1（addBosaiShortageToShopping） |
| 献立（案A）と相談文（案B） | 7.9、8章 |
| 非機能（対象ブラウザ、レスポンシブ幅） | 1章、6.1（AppLayout）、9.8 |
| 非機能（localStorage 前提と限界） | 3章、4.3（同時編集・原子性）、3.7（差し替え） |
| 設計上の前提・判断 | 10.2（ID 固有の判断）。ブリーフの判断は ED 側に再掲 |

### 10.2 ID で置いた追加の判断

ブリーフに明記が無く、ID で決めたもの。ED と食い違う場合は ED を正として ID を直す。

| No | 判断 | 理由 |
|---|---|---|
| J-01 | コレクションの物理名を `expenses, stockItems, bosaiItems, recipes, shoppingItems, items, categories, settings, meta` とする | ブリーフはキー形式 `kakeibo:v1:<collection>` のみ規定。エンティティ名の複数形（camelCase）で統一 |
| J-02 | スタイルは CSS Modules＋グローバル CSS 1枚 | Vite 標準で追加依存なし。クラス名の衝突を防げる |
| J-03 | シードは固定ID・固定 createdAt。初期カテゴリの ID を `cat-food` 等に固定。品目マスタの初期投入はレシピ材料の40品目のみ | テストで参照するため。食費カテゴリは①と⑤で ID 参照が必要 |
| J-04 | 初回起動のシードは meta を最後に書き、途中失敗時は次回に再投入 | localStorage に複数キーの原子性が無いため |
| J-05 | 防災不足からの追加（bosai_short）にも「同品目の未消し込みがあれば追加しない」を適用し、トーストで知らせる | ②③と同じ規則にそろえ、買い物リストの重複を防ぐ |
| J-06 | 在庫行の削除（removeStockItem）と、しきい値だけの変更では②を評価しない。在庫行の数量編集（updateStockItem）と ±1 操作では評価する | ブリーフの条件は「数量を減らした結果」のため |
| J-07 | 新規品目を支出登録から作る時は defaultCategoryId に支出のカテゴリを入れる。他の画面から作る時は null | ①の下書きカテゴリ決定（既定カテゴリ or 食費）に使えるようにするため |
| J-08 | 確定済み支出の編集モードでは「在庫に追加」トグルを出さない（在庫に触れない）。新規と下書き確認でのみ出す | 編集のたびに在庫が二重に増えることを防ぐ |
| J-09 | ①由来の支出を確定後に削除しても、元の買い物項目は消し込み済みのまま。参照先が無い draftExpenseId は「支出なし」としてチェック外しを許可 | 確定済み支出の削除は家計簿の操作であり、買い物リストを巻き戻さない |
| J-10 | 献立画面の相談条件（人数・避けたい食材・品数）は画面内だけの一時値とし、設定に書き戻さない。品数の範囲は 1〜10 | 設定値は既定値の供給元。範囲はブリーフに無いため |
| J-11 | 相談文の「優先して使いたい食材」は、在庫並び順（ピン付き→経過日数降順）で並べ品目重複を除いた先頭5件（ピン付きも5件枠に含む） | ブリーフ「ピン付き＋経過日数上位5件、重複除去」の解釈 |
| J-12 | 相談文テンプレートの固定文言（8.3節）と、在庫の数量は単位なしの数値で表記 | 仕様は構成要素のみ規定。品目に単位項目が無い |
| J-13 | 食費の見通しの「見込み額」に入れる未消し込み項目は、品目の既定カテゴリが食費、または既定カテゴリ未設定のもの | ①の下書きと同じカテゴリ決定規則にそろえるため |
| J-14 | 平均単価の算出期間は限定しない（全期間の確定済み支出） | ブリーフに期間の規定が無いため |
| J-15 | 支出一覧（SC-02 list）は確定済みを全期間・日付降順で表示。ホームの「直近の支出」は確定済みの先頭5件 | ブリーフに件数・期間の規定が無いため |
| J-16 | 買い物リストの消し込み済み項目は自動で消さず、未消し込みの下に checkedAt 降順で表示。項目の手動追加・削除の操作は持たない | 発生源は仕様で3つに限定。削除は仕様に無い |
| J-17 | 在庫の保管場所チップの選択値は URL に載せずローカル状態。セグメント切替は `replace` で履歴を積まない。tab 不正値時に URL は書き換えない | URL を源とするのはブリーフで tab とカテゴリIDのみ |
| J-18 | 起動時の `/` 表示は、ページ読込ごとに1回、現在パスが `/` 以外なら `replace` で `/` へ移す | ブリーフ「起動時は常に `/`」の実装方法 |
| J-19 | 残日数の表示文言を「期限切れ（n日経過）」「今日が期限」「あとn日」とする | 文言の規定が無いため（ED が文言を定めた場合は ED に合わせる） |
| J-20 | JSON 破損・未知のスキーマ版では自動初期化せずエラー画面で止める | 利用者データを黙って消さないため |
| J-21 | ロールバックはスナップショット書き戻し方式。複数タブ・`storage` イベントには対応しない | localStorage 前提の制約。Firebase 化の際は 3.7 の方式 B で置き換える |
| J-22 | domain に `format.js`（金額・日付・日数ラベル整形）を追加し、平均単価は `Math.round` | ブリーフ I の domain 一覧に表示整形の置き場が無いため |
| J-23 | 献立の手入力は献立名（1〜40字）と材料1件以上を必須とする | 材料が無いと③で何も起きないため |
| J-24 | ST で 390/1280 に加え 320px の横スクロール検査を行う。タップ領域 44px 未満は警告扱い | ブリーフ H の 320px 要件を確認するため |
