import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
    try {
        const token = await getNuvemFiscalToken();

        const endpoints = [
            '/nfe/emitir',
            '/nfce/emitir',
            '/nfce',
            '/nfe',
            '/v2/nfce/emitir',
            '/empresas'
        ];

        const results = [];

        for (const endpoint of endpoints) {
            try {
                const url = `${process.env.NUVEMFISCAL_URL}${endpoint}`;
                const response = await fetch(url, {
                    method: 'POST', // Tentando POST pois é o método de emissão
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({}) // Payload vazio para forçar erro de validação (400/422) em vez de 404
                });

                results.push({
                    endpoint,
                    status: response.status,
                    statusText: response.statusText,
                    exists: response.status !== 404 && response.status !== 405
                });
            } catch (e: any) {
                results.push({ endpoint, error: e.message });
            }
        }

        return NextResponse.json({
            sucesso: true,
            base_url: process.env.NUVEMFISCAL_URL,
            results
        });

    } catch (error: any) {
        return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
    }
}
