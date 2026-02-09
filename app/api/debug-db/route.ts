import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET() {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: {
                ...data,
                nfse_password: data.nfse_password ? "***" : null // Mask password
            }
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
