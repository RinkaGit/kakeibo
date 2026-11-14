// 文言・選択肢の定数集約（U1: セグメントの並びと名前はここ1か所で管理する）
export const SEGMENTS = [
  { id: 'list', label: '支出一覧' },
  { id: 'stock', label: '在庫' },
  { id: 'bosai', label: '防災備蓄' },
];

export const LOCATIONS = [
  { id: 'fridge', label: '冷蔵庫' },
  { id: 'freezer', label: '冷凍庫' },
  { id: 'pantry', label: 'パントリー' },
  { id: 'bosaiko', label: '防災庫' },
];
export const locationLabel = (id) => (LOCATIONS.find((l) => l.id === id) || {}).label || id;

export const BOSAI_KUBUN = [
  { id: 'water', label: '水' },
  { id: 'food', label: '食料' },
  { id: 'baby', label: '赤ちゃん用品' },
];
export const kubunLabel = (id) => (BOSAI_KUBUN.find((k) => k.id === id) || {}).label || id;

export const SHOPPING_SOURCES = {
  stock_low: '在庫が少なくなった',
  menu_short: '献立の不足分',
  bosai_short: '防災備蓄の不足分',
  manual: '手入力',
};

export const TABS = [
  { id: 'home', label: '家計簿', path: '/' },
  { id: 'expenses', label: '支出', path: '/expenses' },
  { id: 'graph', label: 'グラフ', path: '/graph' },
  { id: 'settings', label: '設定', path: '/settings' },
];

export const DEFAULT_SETTINGS = {
  badgeDays: 7,
  bosaiTargets: { water: 0, food: 0, baby: 0 },
  monthlyIncome: 0,
  householdSize: 2,
  avoidFoods: '',
};
