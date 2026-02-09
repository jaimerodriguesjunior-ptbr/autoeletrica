import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET() {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('clients')
            .select('non_existent_column')
            .limit(1);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            sample: data
        });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
