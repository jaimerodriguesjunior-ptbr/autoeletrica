'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function WhatsAppSettings() {
  const [enabled, setEnabled] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [state, setState] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => { fetch('/api/whatsapp/settings').then(r => r.json()).then(d => {
    if (d.error) throw new Error(d.error);
    setEnabled(d.enabled); setCanManage(d.canManage);
  }).catch(e => setMessage(e.message)).finally(() => setBusy(false)); }, []);
  async function act(action: string) {
    setBusy(true); setMessage(''); setCode('');
    try {
      const r = await fetch('/api/whatsapp/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, enabled: !enabled }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      if (action === 'toggle') { setEnabled(d.enabled); setState(''); }
      else { setState(d.state); setCode(d.code || ''); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Falha na conexão.'); }
    finally { setBusy(false); }
  }
  return <section className="bg-white border border-stone-200 rounded-2xl p-6 my-6 space-y-4">
    <h2 className="font-bold text-xl">WhatsApp da oficina</h2>
    <p>Envie recibos e notas em PDF pelo número da sua empresa.</p>
    <label className="flex gap-3 items-center"><input type="checkbox" checked={enabled} disabled={busy || !canManage} onChange={() => act('toggle')} /> Ativar envio pelo WhatsApp</label>
    {!canManage && <p className="text-sm">A configuração é feita pelo gerente.</p>}
    <p className="text-sm text-stone-500">Desativar bloqueia novos envios. Para encerrar a sessão no aparelho, use Desconectar.</p>
    {canManage && <div className="flex gap-3 flex-wrap">{['connect', 'status', 'disconnect'].map((a, i) => <button key={a} className="px-4 py-2 bg-stone-100 rounded-xl disabled:opacity-50" disabled={busy || (!enabled && a !== 'disconnect')} onClick={() => { if (a !== 'disconnect' || window.confirm('Desconectar o WhatsApp desta oficina?')) act(a); }}>{['Conectar / renovar QR code', 'Atualizar estado', 'Desconectar'][i]}</button>)}</div>}
    {state && <p role="status">{state === 'open' ? 'Conectado' : state === 'connecting' ? 'Aguardando conexão. Leia o QR code e atualize o estado.' : 'Desconectado'}</p>}
    {code && <div><QRCodeSVG value={code} size={240} /><p>No WhatsApp, abra Aparelhos conectados → Conectar aparelho. Se expirar, renove o QR code.</p></div>}
    {message && <p role="alert" className="text-red-700">{message}</p>}
  </section>;
}
