// 最小ルーター（ハッシュベース）。GitHub Pages のような静的配信でも
// 全ルートがそのまま動くように、パスは # の後ろで管理する。
// 例: /kakeibo/#/expenses?tab=stock
import { useEffect, useState } from 'react';

function current() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return { path: '/', search: '' };
  const q = raw.indexOf('?');
  return q >= 0
    ? { path: raw.slice(0, q), search: raw.slice(q) }
    : { path: raw, search: '' };
}

export function navigate(path) {
  if (window.location.hash !== '#' + path) {
    window.location.hash = path;
  }
}

export function useRoute() {
  const [loc, setLoc] = useState(current);
  useEffect(() => {
    const on = () => setLoc(current());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export function parseRoute(loc) {
  const params = new URLSearchParams(loc.search);
  const p = loc.path;
  if (p === '/' || p === '') return { name: 'home' };
  if (p === '/expenses') {
    const tab = params.get('tab');
    return { name: 'expenses', tab: ['list', 'stock', 'bosai'].includes(tab) ? tab : 'list' };
  }
  if (p === '/expenses/shopping') return { name: 'shopping' };
  if (p === '/expenses/menu') return { name: 'menu' };
  if (p === '/graph') return { name: 'graph' };
  const m = /^\/graph\/categories\/(.+)$/.exec(p);
  if (m) return { name: 'category', categoryId: decodeURIComponent(m[1]) };
  if (p === '/settings') return { name: 'settings' };
  return { name: 'home' };
}

export function tabOfRoute(route) {
  if (route.name === 'home') return 'home';
  if (['expenses', 'shopping', 'menu'].includes(route.name)) return 'expenses';
  if (['graph', 'category'].includes(route.name)) return 'graph';
  if (route.name === 'settings') return 'settings';
  return 'home';
}
