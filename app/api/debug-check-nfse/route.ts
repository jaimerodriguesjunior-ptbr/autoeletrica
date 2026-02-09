import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { getNuvemFiscalToken } from '@/src/lib/nuvemfiscal';

export async function GET() {
    const supabase = createClient();

    try {
        const { data: company } = await supabase.from('company_settings').select('*').single();
        const token = await getNuvemFiscalToken();

        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas/${company.cpf_cnpj}/nfse`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();

        return NextResponse.json({
            status: response.status,
            ok: response.ok,
            response: result
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
