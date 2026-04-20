import { NextRequest, NextResponse } from "next/server";
import { registerCompanyInNuvemFiscal } from "@/src/actions/fiscal";

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const result = await registerCompanyInNuvemFiscal(payload);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || "Erro interno ao salvar configurações" },
            { status: 500 }
        );
    }
}
