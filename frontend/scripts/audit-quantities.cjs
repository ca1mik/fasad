class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(message.params.exceptionDetails.text);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
}

async function main() {
  const auth = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: process.env.FASAD_AUDIT_LOGIN || 'admin',
      password: process.env.FASAD_AUDIT_PASSWORD || 'admin123',
    }),
  });
  if (!auth.ok) throw new Error(`login failed: ${auth.status}`);
  const token = (await auth.json()).data.token.access_token;
  const targets = await fetch('http://127.0.0.1:9223/json').then(response => response.json());
  const cdp = new Cdp(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all(['Page.enable', 'Runtime.enable'].map(method => cdp.send(method)));
  await cdp.send('Network.setCookie', {
    name: 'access_token', value: token, url: 'http://127.0.0.1:3001/', sameSite: 'Lax',
  });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:3001/leads' });
  await new Promise(resolve => setTimeout(resolve, 1800));
  const rowSelector = `(() => [...document.querySelectorAll('table tbody tr')]
    .find(row => row.querySelectorAll('input[inputmode="decimal"]').length >= 3))()`;
  if (!await cdp.evaluate(`Boolean(${rowSelector})`)) throw new Error('lead parts row missing');
  async function enter(index, value) {
    const focused = await cdp.evaluate(`(() => {
      const input = ${rowSelector}.querySelectorAll('input[inputmode="decimal"]')[${index}];
      if (!input) return false;
      input.focus(); input.select(); return true;
    })()`);
    if (!focused) throw new Error(`input ${index} missing`);
    await cdp.send('Input.insertText', { text: value });
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  async function state() {
    return cdp.evaluate(`(() => {
      const buttons = [...document.querySelectorAll('button')];
      const find = text => buttons.find(button => button.textContent.includes(text));
      return {
        quantity: ${rowSelector}.querySelectorAll('input[inputmode="decimal"]')[2].value,
        alert: [...document.querySelectorAll('[role="alert"]')].map(item => item.textContent.trim()),
        createOrderDisabled: find('Создать заказ')?.disabled,
        leadDisabled: find('Только заявка')?.disabled,
        cuttingDisabled: find('Создать и раскроить')?.disabled,
        transferDisabled: document.querySelector('#lead-cutting button')?.disabled,
      };
    })()`);
  }
  await enter(0, '600');
  await enter(1, '400');
  await enter(2, '3');
  const valid = await state();
  await enter(2, '1.5');
  const fractional = await state();
  await enter(2, '1000000000');
  const huge = await state();
  console.log(JSON.stringify({ valid, fractional, huge, errors: cdp.errors }, null, 2));
  cdp.ws.close();
  if (valid.transferDisabled || valid.createOrderDisabled ||
      !fractional.createOrderDisabled || !fractional.transferDisabled ||
      !huge.createOrderDisabled || !huge.transferDisabled ||
      !fractional.alert.some(item => item.includes('целым')) ||
      !huge.alert.some(item => item.includes('10000')) || cdp.errors.length) {
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
