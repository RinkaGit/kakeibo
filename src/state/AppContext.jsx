import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadAll, saveAll } from '../data/store.js';
import { todayKey } from '../lib/dates.js';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [today, setToday] = useState(todayKey());

  useEffect(() => {
    loadAll().then(setState).catch((e) => setError(String(e)));
    const onFocus = () => setToday(todayKey());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // サービス関数（state -> {state, ...}）を実行し、保存してから画面へ反映する
  const run = useCallback(async (fn) => {
    setError('');
    try {
      const result = fn(state);
      const next = result.state || result;
      await saveAll(next);
      setState(next);
      return result;
    } catch (e) {
      const msg = e.validationErrors ? e.validationErrors.join('\n') : String(e.message || e);
      setError(msg);
      throw e;
    }
  }, [state]);

  const updateSettings = useCallback(async (patch) => {
    const next = { ...state, settings: { ...state.settings, ...patch } };
    await saveAll(next);
    setState(next);
  }, [state]);

  if (!state) return <div className="loading">読み込み中…</div>;
  return <Ctx.Provider value={{ state, run, updateSettings, error, setError, today }}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}

export function itemsByIdOf(state) {
  const m = {};
  for (const i of state.items) m[i.id] = i;
  return m;
}
export function categoriesByIdOf(state) {
  const m = {};
  for (const c of state.categories) m[c.id] = c;
  return m;
}
