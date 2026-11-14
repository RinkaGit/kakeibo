import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { validateSettings } from '../domain/validation.js';

export function SettingsPage() {
  const { state, updateSettings, setError } = useApp();
  const s = state.settings;
  const [form, setForm] = useState({
    badgeDays: String(s.badgeDays),
    monthlyIncome: String(s.monthlyIncome),
    householdSize: String(s.householdSize),
    avoidFoods: s.avoidFoods || '',
    water: String(s.bosaiTargets.water || 0),
    food: String(s.bosaiTargets.food || 0),
    baby: String(s.bosaiTargets.baby || 0),
  });
  const [saved, setSaved] = useState(false);
  const set = (p) => { setForm((f) => ({ ...f, ...p })); setSaved(false); };
  const save = async () => {
    const next = {
      badgeDays: Number(form.badgeDays),
      monthlyIncome: Number(form.monthlyIncome),
      householdSize: Number(form.householdSize),
      avoidFoods: form.avoidFoods,
      bosaiTargets: { water: Number(form.water), food: Number(form.food), baby: Number(form.baby) },
    };
    const errs = validateSettings(next);
    if (errs.length) { setError(errs.join('\n')); return; }
    await updateSettings(next);
    setSaved(true);
  };
  return (
    <div className="page">
      <h2 className="pagetitle">設定</h2>
      <section className="card">
        <h3>家計</h3>
        <div className="form">
          <label className="field"><span>毎月の収入（円）</span>
            <input type="number" inputMode="numeric" min="0" value={form.monthlyIncome} onChange={(e) => set({ monthlyIncome: e.target.value })} /></label>
        </div>
      </section>
      <section className="card">
        <h3>防災備蓄</h3>
        <div className="form">
          <label className="field"><span>期限が近いと知らせる日数（バッジとカード）</span>
            <input type="number" inputMode="numeric" min="0" max="365" value={form.badgeDays} onChange={(e) => set({ badgeDays: e.target.value })} /></label>
          <label className="field"><span>目標量：水</span>
            <input type="number" inputMode="numeric" min="0" value={form.water} onChange={(e) => set({ water: e.target.value })} /></label>
          <label className="field"><span>目標量：食料</span>
            <input type="number" inputMode="numeric" min="0" value={form.food} onChange={(e) => set({ food: e.target.value })} /></label>
          <label className="field"><span>目標量：赤ちゃん用品</span>
            <input type="number" inputMode="numeric" min="0" value={form.baby} onChange={(e) => set({ baby: e.target.value })} /></label>
        </div>
      </section>
      <section className="card">
        <h3>献立の相談文</h3>
        <div className="form">
          <label className="field"><span>人数（既定）</span>
            <input type="number" inputMode="numeric" min="1" max="20" value={form.householdSize} onChange={(e) => set({ householdSize: e.target.value })} /></label>
          <label className="field"><span>避けたい食材（既定）</span>
            <input type="text" value={form.avoidFoods} onChange={(e) => set({ avoidFoods: e.target.value })} placeholder="例: 辛いもの" /></label>
        </div>
      </section>
      <button className="primarybtn block" onClick={save}>設定を保存</button>
      {saved && <p className="okmsg">保存しました</p>}
      <section className="card">
        <h3>このアプリについて</h3>
        <p className="note">データはこの端末のブラウザに保存されます（夫婦間での自動同期はありません）。ブラウザのデータを消すと消えてしまうので、大切な記録は別途控えてください。</p>
      </section>
    </div>
  );
}
