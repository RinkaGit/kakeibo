// CDP ドライバ: 指定URLを開き、任意のJS（async関数本体）を実行し、スクリーンショットを撮る。
// usage: node tools/drive.mjs <port> <width> <height> <url> <outPng> [scriptFile]
import fs from 'node:fs';
const [port, w, h, url, out, scriptFile] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
let page = list.find((t) => t.type === 'page');
if (!page) {
  await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).catch(() => {});
  const l2 = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  page = l2.find((t) => t.type === 'page');
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise((r) => (ws.onopen = r));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w <= 480 });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 1200));
if (scriptFile) {
  const body = fs.readFileSync(scriptFile, 'utf8');
  const res = await send('Runtime.evaluate', {
    expression: `(async () => { const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); ${body} })()`,
    awaitPromise: true, returnByValue: true,
  });
  const rr = res.result && res.result.result;
  if (rr && rr.value !== undefined) console.log('SCRIPT_RESULT:', JSON.stringify(rr.value));
  if (res.result && res.result.exceptionDetails) console.log('SCRIPT_ERROR:', JSON.stringify(res.result.exceptionDetails).slice(0, 800));
}
await new Promise((r) => setTimeout(r, 400));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close(); process.exit(0);
