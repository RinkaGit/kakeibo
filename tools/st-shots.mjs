// ST用: 全画面 × 2幅 のフルページスクリーンショットと横はみ出し測定
// usage: node tools/st-shots.mjs <port> <baseUrl> <outDir>
import fs from 'node:fs';
const [port, base, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const ROUTES = [
  ['home', '/'],
  ['expenses-list', '/expenses?tab=list'],
  ['expenses-stock', '/expenses?tab=stock'],
  ['expenses-bosai', '/expenses?tab=bosai'],
  ['shopping', '/expenses/shopping'],
  ['menu', '/expenses/menu'],
  ['graph', '/graph'],
  ['category-food', '/graph/categories/cat-food'],
  ['settings', '/settings'],
];
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Page.enable'); await send('Runtime.enable');
const results = [];
for (const width of [390, 1280]) {
  const height = width === 390 ? 844 : 900;
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 });
  for (const [name, path] of ROUTES) {
    await send('Page.navigate', { url: base + path });
    await new Promise((r) => setTimeout(r, 1100));
    const metrics = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, sh: document.documentElement.scrollHeight })`,
      returnByValue: true,
    });
    const m = JSON.parse(metrics.result.result.value);
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: m.iw, height: Math.min(m.sh, 6000), scale: 1 },
    });
    const file = `${outDir}/${name}_${width}.png`;
    fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    results.push({ route: name, width, scrollWidth: m.sw, innerWidth: m.iw, overflow: m.sw > m.iw + 1, file });
    console.log(name, width, 'scrollWidth', m.sw, 'innerWidth', m.iw, m.sw > m.iw + 1 ? 'OVERFLOW!' : 'ok');
  }
}
fs.writeFileSync(`${outDir}/../st-metrics.json`, JSON.stringify(results, null, 2));
ws.close(); process.exit(0);
