'use client';
import { useRef, useState } from 'react';
export default function WhatsAppPdfButton({ kind, documentId, phone = '' }: { kind: 'transaction' | 'sale' | 'invoice'; documentId: string; phone?: string | null }) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(phone || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [attempted, setAttempted] = useState(false);
  const lock = useRef(false);
  async function send() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setAttempted(true);
    try {
      const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: documentId, phone: number, requestId: crypto.randomUUID() }) });
      const d = await r.json(); setMessage(d.error || d.message);
    } catch { setMessage('Não foi possível confirmar o envio. Confira a conversa antes de reenviar.'); }
    finally { setBusy(false); lock.current = false; }
  }
  return <><button type="button" className="px-3 py-2 bg-green-100 text-green-800 rounded-xl text-sm font-bold" onClick={() => { setOpen(true); setMessage(''); setAttempted(false); }}>Enviar PDF por WhatsApp</button>
    {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print-hide"><div role="dialog" aria-modal="true" aria-label="Enviar PDF por WhatsApp" className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 text-stone-800">
      <h2 className="font-bold">Confirmar envio do PDF</h2><p>Será enviado pelo WhatsApp conectado da sua oficina. Confirme o destinatário.</p>
      <label className="block">WhatsApp com DDD<input className="border rounded p-2 w-full" value={number} onChange={e => setNumber(e.target.value)} disabled={busy || attempted} /></label>
      <p role="status">{message}</p><div className="flex gap-4"><button disabled={busy || attempted} onClick={send} className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Enviando…' : 'Confirmar envio'}</button><button disabled={busy} onClick={() => setOpen(false)}>Fechar</button></div>
    </div></div>}</>;
}
