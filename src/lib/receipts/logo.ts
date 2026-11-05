import 'server-only';
import type { ReceiptCompany } from './document';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

function image(bytes: Buffer) {
  const format = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'PNG' as const
    : bytes[0] === 255 && bytes[1] === 216 ? 'JPEG' as const
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'WEBP' as const : null;
  return format ? { bytes: new Uint8Array(bytes), format } : undefined;
}

export async function receiptLogo(company: ReceiptCompany) {
  // Logos são cadastradas no storage público do projeto. Não buscar destinos
  // arbitrários a partir do servidor nem seguir redirecionamentos externos.
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const src of [company.logo_impressos_url, company.logo_url].filter(Boolean)) {
    try {
      if (src!.startsWith('/') && !src!.startsWith('//')) {
        const root = path.resolve(process.cwd(), 'public');
        const local = path.resolve(root, '.' + decodeURIComponent(src!));
        if (!local.startsWith(root + path.sep) || !/\.(png|jpe?g|webp)$/i.test(local)) continue;
        if ((await stat(local)).size > 2 * 1024 * 1024) continue;
        const logo = image(await readFile(local));
        if (logo) return logo;
        continue;
      }
      if (!storageUrl) continue;
      const url = new URL(src!);
      if (url.origin !== new URL(storageUrl).origin || !url.pathname.startsWith('/storage/v1/object/public/')) continue;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!response.ok || Number(response.headers.get('content-length')) > 2 * 1024 * 1024) continue;
      const reader = response.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Logo muito grande'); }
        chunks.push(value);
      }
      const logo = image(Buffer.concat(chunks));
      if (logo) return logo;
    } catch { /* Tentar a logo geral se a de impressos não estiver disponível. */ }
  }
  return undefined;
}
