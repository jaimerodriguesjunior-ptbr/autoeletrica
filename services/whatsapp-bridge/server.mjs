import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function createBridge({ evolutionUrl, evolutionKey, token, fetchImpl = fetch }) {
  if (!evolutionUrl || !evolutionKey || !token || token.length < 32) throw new Error('Configure EVOLUTION_URL, EVOLUTION_API_KEY e MB_WHATSAPP_BRIDGE_TOKEN (32+ caracteres).');
  async function evolution(path, method = 'GET', body) {
    const r = await fetchImpl(`${evolutionUrl.replace(/\/$/, '')}${path}`, { method, headers: { apikey: evolutionKey, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(35000) });
    if (!r.ok) { const e = new Error('Evolution indisponível'); e.status = r.status; throw e; }
    return r.json();
  }
  return http.createServer(async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    const received = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) { reply(401, { error: 'Não autorizado' }); return; }
    const match = /^\/organizations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(status|connect|disconnect|send)$/i.exec(req.url || '');
    if (req.method !== 'POST' || !match) { reply(404, { error: 'Rota inválida' }); return; }
    // Prefixo exclusivo e fixo: nenhum chamador pode escolher uma sessão da ótica.
    const instance = `mbgarage-${match[1].toLowerCase()}`;
    const action = match[2];
    try {
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 15 * 1024 * 1024) { reply(413, { error: 'Arquivo muito grande' }); return; } chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const status = async () => { try { return (await evolution(`/instance/connectionState/${instance}`)).instance?.state || 'close'; } catch (e) { if (e.status === 404) return 'missing'; throw e; } };
      if (action === 'status') { reply(200, { state: await status() }); return; }
      if (action === 'disconnect') { if (await status() !== 'missing') await evolution(`/instance/logout/${instance}`, 'DELETE'); reply(200, { state: 'close' }); return; }
      if (action === 'connect') {
        if (await status() === 'missing') await evolution('/instance/create', 'POST', { instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: false, syncFullHistory: false, readMessages: false, readStatus: false, alwaysOnline: false, groupsIgnore: true });
        if (await status() === 'open') { reply(200, { state: 'open' }); return; }
        const result = await evolution(`/instance/connect/${instance}`);
        reply(200, { state: 'connecting', code: result.code || '' }); return;
      }
      if (!/^55[1-9]\d{9,10}$/.test(body.phone) || !/^[\w-]+\.pdf$/.test(body.filename) || typeof body.media !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.media)) { reply(400, { error: 'Documento inválido' }); return; }
      if (body.caption !== undefined && (typeof body.caption !== 'string' || body.caption.length > 1000)) { reply(400, { error: 'Mensagem inválida' }); return; }
      const pdf = Buffer.from(body.media, 'base64');
      if (pdf.length > 10 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== '%PDF-') { reply(400, { error: 'PDF inválido' }); return; }
      if (await status() !== 'open') { reply(409, { error: 'WhatsApp desconectado' }); return; }
      // Sem tentativas automáticas: timeout tem resultado incerto.
      const result = await evolution(`/message/sendMedia/${instance}`, 'POST', { number: body.phone, mediatype: 'document', mimetype: 'application/pdf', fileName: body.filename, caption: body.caption || '', media: body.media });
      if (!result.key?.id) throw new Error('Resposta sem ID');
      reply(200, { messageId: result.key.id });
    } catch { reply(502, { error: 'Operação não confirmada pela Evolution API' }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createBridge({ evolutionUrl: process.env.EVOLUTION_URL, evolutionKey: process.env.EVOLUTION_API_KEY, token: process.env.MB_WHATSAPP_BRIDGE_TOKEN });
  server.requestTimeout = 60000;
  server.listen(Number(process.env.PORT || 3101), '0.0.0.0');
}
