import { NextResponse } from 'next/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

function resolveBaseUrl(environment: 'production' | 'homologation') {
    if (environment === 'homologation') {
        return process.env.NUVEMFISCAL_HOM_URL || process.env.NUVEMFISCAL_URL || 'https://api.sandbox.nuvemfiscal.com.br';
    }

    return process.env.NUVEMFISCAL_PROD_URL || process.env.NUVEMFISCAL_URL || 'https://api.nuvemfiscal.com.br';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const environment = searchParams.get('env') === 'homologation' ? 'homologation' : 'production';
        const token = await getNuvemFiscalToken(environment);
        const baseUrl = resolveBaseUrl(environment).replace(/\/$/, '');

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
                const url = `${baseUrl}${endpoint}`;
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
            environment,
            base_url: baseUrl,
            results
        });

    } catch (error: any) {
        return NextResponse.json({ sucesso: false, erro: error.message }, { status: 500 });
    }
}
