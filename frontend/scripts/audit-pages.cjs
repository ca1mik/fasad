const routes = [
  '/dashboard', '/inbox', '/leads', '/orders', '/clients', '/manager',
  '/materials', '/stock', '/cutting-batch', '/film-cutting', '/production',
  '/production/queue', '/workers', '/reports', '/reports/inactive',
  '/admin', '/admin/users', '/admin/roles', '/admin/permissions',
  '/admin/directions', '/admin/channels', '/admin/audit', '/admin/price-book',
];

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
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
        if (pending) {
          this.pending.delete(message.id);
          if (message.error) pending.reject(new Error(message.error.message));
          else pending.resolve(message.result);
        }
      } else {
        this.events.push(message);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
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
  const samples = [
    ['leads?page=1&size=1', id => [`/leads/${id}`, `/leads/${id}/blank`, `/leads/${id}/cutting`]],
    ['orders?page=1&size=1', id => [`/orders/${id}`]],
    ['clients?page=1&size=1', id => [`/clients/${id}`]],
    ['workers?page=1&size=1', id => [`/workers/${id}`]],
    ['messaging/conversations?page=1&size=1', id => [`/inbox/${id}`]],
    ['production/queue?page=1&size=1', id => [`/production/stages/${id}`]],
  ];
  for (const [path, makeRoutes] of samples) {
    const response = await fetch(`http://127.0.0.1:8000/api/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const first = (await response.json()).data?.[0];
      if (first?.id) routes.push(...makeRoutes(first.id));
    }
  }
  if (process.argv.length > 2) routes.splice(0, routes.length, ...process.argv.slice(2));
  const targets = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
  const cdp = new Cdp(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await cdp.open();
  await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map(method => cdp.send(method)));
  await cdp.send('Network.setCookie', { name: 'access_token', value: token, url: 'http://127.0.0.1:3001/', sameSite: 'Lax' });
  const failures = [];
  for (const width of [390, 1440]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const route of routes) {
      cdp.events.length = 0;
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:3001${route}` });
      await new Promise(resolve => setTimeout(resolve, Number(process.env.FASAD_AUDIT_PAUSE_MS || 900)));
      const state = await cdp.send('Runtime.evaluate', {
        expression: `({url: location.pathname, title: document.title, text: document.body.innerText.slice(0,350),
          scroll: document.documentElement.scrollWidth, width: innerWidth, ready: document.readyState})`,
        returnByValue: true,
      });
      const value = state.result.value;
      const context = [...cdp.events].reverse().find(e =>
        e.method === 'Runtime.executionContextCreated' && e.params.context.auxData?.isDefault,
      )?.params.context.id;
      const errors = cdp.events.filter(e =>
        (e.method === 'Runtime.exceptionThrown' && e.params.exceptionDetails.executionContextId === context) ||
        (e.method === 'Network.responseReceived' && e.params.response.status >= 500),
      );
      const overflow = width === 390 && value.scroll > width + 2 && !['/reports/print'].includes(route);
      const badRoute = value.url !== route;
      const outcome = { width, route, ...value, errors: errors.map(e => ({
        kind: e.method,
        detail: e.method === 'Runtime.exceptionThrown' ?
          (e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text) :
          `${e.params.response.status} ${e.params.response.url}`,
      })) };
      if (errors.length || overflow || badRoute) {
        failures.push({ ...outcome, overflow, badRoute });
      }
      console.log(`${width} ${route} => ${value.url} scroll=${value.scroll} errors=${errors.length}`);
    }
  }
  cdp.ws.close();
  console.log(JSON.stringify({ checked: routes.length * 2, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
