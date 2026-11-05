import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge } from './server.mjs';
const org = '12345678-1234-1234-1234-123456789abc';
const token = 'a'.repeat(40);
test('autenticação, isolamento, PDF e confirmação do provedor', async () => {
  const calls = [];
  const server = createBridge({ token, evolutionUrl: 'http://evolution', evolutionKey: 'secret', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.includes('connectionState') ? { instance: { state: 'open' } } : { key: { id: 'provider-id' } });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (path, body = {}, auth = token) => fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await send(`/organizations/${org}/status`, {}, 'wrong')).status, 401);
    assert.equal((await send('/organizations/optica-1/send')).status, 404);
    assert.equal(calls.length, 0);
    assert.equal((await send(`/organizations/${org}/send`, { phone: '5544999999999', filename: 'a.pdf', media: Buffer.from('not pdf').toString('base64') })).status, 400);
    assert.equal(calls.length, 0);
    const response = await send(`/organizations/${org}/send`, { phone: '5544999999999', filename: 'a.pdf', caption: 'Olá! Aqui é da Oficina Exemplo.', media: Buffer.from('%PDF-1.4\n').toString('base64') });
    assert.deepEqual(await response.json(), { messageId: 'provider-id' });
    assert.ok(calls.every(c => c.url.endsWith(`mbgarage-${org}`)));
    const payload = JSON.parse(calls[1].options.body);
    assert.equal(payload.mediatype, 'document'); assert.equal(payload.mimetype, 'application/pdf');
    assert.equal(payload.fileName, 'a.pdf');
    assert.equal(payload.caption, 'Olá! Aqui é da Oficina Exemplo.');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('falha do provedor não confirma envio nem repete a transmissão', async () => {
  let sends = 0;
  const server = createBridge({ token, evolutionUrl: 'http://evolution', evolutionKey: 'secret', fetchImpl: async url => {
    if (url.includes('connectionState')) return Response.json({ instance: { state: 'open' } });
    sends++; throw new Error('timeout');
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/organizations/${org}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ phone: '5544999999999', filename: 'a.pdf', media: Buffer.from('%PDF-1.4\n').toString('base64') }) });
    assert.equal(response.status, 502); assert.equal(sends, 1);
    assert.equal((await response.json()).messageId, undefined);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('cria sessão sem configurar webhook e devolve o QR code', async () => {
  const calls = [];
  let created = false;
  const server = createBridge({ token, evolutionUrl: 'http://evolution', evolutionKey: 'secret', fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('connectionState')) return created ? Response.json({ instance: { state: 'close' } }) : new Response('{}', { status: 404 });
    if (url.endsWith('/instance/create')) { created = true; return Response.json({ instance: {} }); }
    return Response.json({ code: 'qr-code' });
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/organizations/${org}/connect`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' });
    assert.deepEqual(await response.json(), { state: 'connecting', code: 'qr-code' });
    const create = calls.find(c => c.url.endsWith('/instance/create'));
    const body = JSON.parse(create.options.body);
    assert.equal(body.instanceName, `mbgarage-${org}`);
    assert.equal('webhook' in body, false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
