import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET() {
    const supabase = createClient();

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, nome, marca');

        if (error) throw error;

        return NextResponse.json({ success: true, count: products.length, products });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
