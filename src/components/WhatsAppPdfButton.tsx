'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
export default function WhatsAppPdfButton({ kind, documentId, phone = '' }: { kind: 'transaction' | 'sale' | 'invoice'; documentId: string; phone?: string | null }) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState(phone || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const response = await fetch('/api/whatsapp/settings', { cache: 'no-store' });
        const data = await response.json();
        if (active && request === sequence) setEnabled(response.ok && data.enabled === true);
      } catch {
        if (active && request === sequence) setEnabled(false);
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  async function send() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage(''); setAttempted(true);
    try {
      const r = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: documentId, phone: number, requestId: crypto.randomUUID() }) });
      const d = await r.json(); setMessage(d.error || d.message);
    } catch { setMessage('Não foi possível confirmar o envio. Confira a conversa antes de reenviar.'); }
    finally { setBusy(false); lock.current = false; }
  }
  return <>{enabled && <button type="button" title="Enviar PDF por WhatsApp" aria-label="Enviar PDF por WhatsApp" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-green-100 px-4 py-2 text-sm font-bold text-green-800 transition hover:bg-green-200" onClick={() => { setOpen(true); setMessage(''); setAttempted(false); }}><MessageCircle size={16} aria-hidden="true" /> PDF</button>}
    {open && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print-hide"><div role="dialog" aria-modal="true" aria-label="Enviar PDF por WhatsApp" className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 text-stone-800">
      <h2 className="font-bold">{attempted && !busy ? 'Resultado do envio' : 'Confirmar envio do PDF'}</h2><p>Será enviado pelo WhatsApp conectado da sua oficina. Confirme o destinatário.</p>
      <label className="block">WhatsApp com DDD<input className="border rounded p-2 w-full" value={number} onChange={e => setNumber(e.target.value)} disabled={busy || attempted} /></label>
      {message && <p role="status" className="rounded-xl bg-stone-100 p-3 text-sm text-stone-800">{message}</p>}<div className="flex gap-4">{(!attempted || busy) && <button disabled={busy} onClick={send} className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50">{busy ? 'Enviando…' : 'Confirmar envio'}</button>}<button disabled={busy} onClick={() => setOpen(false)} className="rounded px-4 py-2 bg-stone-700 text-white disabled:opacity-50">Fechar</button></div>
    </div></div>}</>;
}
