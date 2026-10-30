(async () => {
const count = Number(process.argv[2] || 2000);
const expectBlocked = count > 10_000;
const auth = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    login: process.env.FASAD_AUDIT_LOGIN || 'admin',
    password: process.env.FASAD_AUDIT_PASSWORD || 'admin123',
  }),
});
if (!auth.ok) throw new Error(`login failed: ${auth.status}`);
const token = (await auth.json()).data.token.access_token;
const targets = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 1;
const pending = new Map();
const errors = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    }
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  }
});
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  return (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
}
await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map(method => send(method)));
await send('Network.setCookie', { name: 'access_token', value: token, url: 'http://127.0.0.1:3001/' });
await send('Page.navigate', { url: 'http://127.0.0.1:3001/film-cutting' });
await new Promise(resolve => setTimeout(resolve, 1500));
console.log('page opened');
const focused = await evaluate(`(() => { const field = document.getElementById('bulk-parts-input');
  if (!field) return false; field.focus(); return true; })()`);
if (!focused) throw new Error('bulk input missing');
await send('Input.insertText', { text: `400 300 ${count}` });
await new Promise(resolve => setTimeout(resolve, 200));
console.log('input entered');
const clicked = await evaluate(`(() => { window.__auditStart = performance.now();
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Добавить в раскрой'));
  if (!button) return false; button.click(); return true; })()`);
if (!clicked) throw new Error('import button missing');
console.log('import clicked');
let state;
for (let attempt = 0; attempt < 90; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  state = await Promise.race([
    evaluate(`({done: ${expectBlocked ? "document.body.textContent.includes('не больше 10000 деталей')" : `[...document.querySelectorAll('*')].some(e => e.children.length === 0 && e.textContent === '${count} шт. в раскрое')`},
      elapsedMs: Math.round(performance.now() - window.__auditStart),
      nodes: document.querySelectorAll('*').length,
      mapButtons: [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Карта ')).length,
      badge: [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.includes('шт. в раскрое'))?.textContent,
      detailListPresent: [...document.querySelectorAll('*')].some(e => e.children.length === 0 && e.textContent.trim() === 'Список деталей'),
      url: location.pathname})`),
    new Promise((_, reject) => setTimeout(() => reject(new Error('browser unresponsive')), 30000)),
  ]);
  if (attempt % 5 === 0) console.log(JSON.stringify({ attempt, ...state }));
  if (state.done) break;
}
let modalOpened = null;
if (state.done && !expectBlocked && count <= 1000) {
  const clickedPart = await evaluate(`(() => { const part = document.querySelector('svg g.cursor-pointer');
    if (!part) return false; part.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  modalOpened = clickedPart && await evaluate(`document.body.textContent.includes('Название детали')`);
}
console.log(JSON.stringify({ count, ...state, modalOpened, errors: errors.slice(0, 3) }));
ws.close();
if (!state.done || state.detailListPresent || modalOpened === false || errors.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
