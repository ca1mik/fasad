(async () => {
  const origin = 'http://127.0.0.1:8000/api/v1';
  const login = await fetch(`${origin}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: process.env.FASAD_AUDIT_LOGIN || 'admin',
      password: process.env.FASAD_AUDIT_PASSWORD || 'admin123',
    }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  const token = (await login.json()).data.token.access_token;
  const paths = [
    '/leads?page=1&size=50', '/orders?page=1&size=50', '/clients?page=1&size=50',
    '/workers?page=1&size=50', '/production/queue?page=1&size=50',
    '/price-book?page=1&size=50', '/messaging/conversations?page=1&size=50',
  ];
  const started = performance.now();
  const responses = await Promise.all(Array.from({ length: 20 }, () => paths.map(async path => {
    const response = await fetch(`${origin}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    await response.arrayBuffer();
    return { path, status: response.status };
  })).flat());
  const failures = responses.filter(response => response.status !== 200);
  console.log(JSON.stringify({ requests: responses.length, ms: Math.round(performance.now() - started),
    failures: failures.slice(0, 10) }));
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
