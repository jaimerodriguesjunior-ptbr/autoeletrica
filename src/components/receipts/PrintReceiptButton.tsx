'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer } from 'lucide-react';
import ReceiptPaper, { receiptPrintStyles } from './ReceiptPaper';
import type { ReceiptDocument } from '@/src/lib/receipts/document';

export default function PrintReceiptButton({ kind, documentId }: { kind: 'transaction' | 'sale'; documentId: string }) {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!receipt) return;
    let cancelled = false;
    const afterPrint = () => { setReceipt(null); setBusy(false); };
    window.addEventListener('afterprint', afterPrint);
    async function print() {
      try {
        const images = Array.from(document.querySelectorAll<HTMLImageElement>('#receipt-print-root img'));
        await Promise.allSettled(images.map(image => image.decode()));
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (!cancelled) { window.print(); setBusy(false); }
      } catch {
        if (!cancelled) { setError('Não foi possível abrir a impressão. Tente novamente.'); setReceipt(null); setBusy(false); }
      }
    }
    print();
    return () => { cancelled = true; window.removeEventListener('afterprint', afterPrint); };
  }, [receipt]);
  async function prepare() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/receipts/${kind}/${encodeURIComponent(documentId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReceipt(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível preparar a impressão.'); setBusy(false); }
  }
  return <>
    <button type="button" disabled={busy} onClick={prepare} className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap transition disabled:opacity-50">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} {busy ? 'Preparando…' : 'Imprimir'}
    </button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {receipt && createPortal(<div id="receipt-print-root"><ReceiptPaper receipt={receipt} />
      <style>{receiptPrintStyles}</style>
    </div>, document.body)}
  </>;
}
