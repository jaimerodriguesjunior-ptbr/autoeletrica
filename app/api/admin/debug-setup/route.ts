import { NextResponse } from "next/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";
import { createClient } from "@/src/utils/supabase/server";

export async function GET() {
    try {
        const token = await getNuvemFiscalToken('production');
        const supabase = createClient();
        const { data: company } = await supabase.from("company_settings").select("*").single();

        return NextResponse.json({
            message: "Dependências OK",
            token_preview: token?.substring(0, 10),
            company_found: !!company
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
    }
}
