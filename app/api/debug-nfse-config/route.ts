import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
    const supabase = createClient();

    try {
        // 1. Get data from DB
        const { data: company, error } = await supabase
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) throw error;
        if (!company.nfse_login || !company.nfse_password) {
            return NextResponse.json({ success: false, error: "Credentials not found in DB" });
        }

        // 2. Authenticate
        const token = await getNuvemFiscalToken();

        // 3. Configure NFS-e
        const nfsePayload = {
            ambiente: "homologacao",
            prefeitura: {
                login: company.nfse_login,
                senha: company.nfse_password
            },
            rps: {
                lote: 1,
                serie: "1",
                numero: 1
            }
        };

        console.log("Payload NFS-e:", JSON.stringify(nfsePayload, null, 2));

        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas/${company.cpf_cnpj}/nfse`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nfsePayload)
        });

        const resultText = await response.text();
        let resultJson;
        try {
            resultJson = JSON.parse(resultText);
        } catch (e) {
            resultJson = resultText;
        }

        return NextResponse.json({
            status: response.status,
            ok: response.ok,
            payload: nfsePayload,
            response: resultJson
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
