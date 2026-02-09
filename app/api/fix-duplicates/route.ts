import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET() {
    const supabase = createClient();

    // Executar SQL diretamente via RPC ou query se possível. 
    // Como não temos RPC genérico, vamos usar a query builder para deletar.

    try {
        const { error, count } = await supabase
            .from('company_settings')
            .delete({ count: 'exact' })
            .is('organization_id', null)
            .eq('cnpj', '35181069000143');

        if (error) throw error;

        return NextResponse.json({ success: true, deleted: count });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
