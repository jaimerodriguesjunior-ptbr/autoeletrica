import { NextRequest, NextResponse } from "next/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const cnpj = formData.get("cnpj") as string;

        if (!file || !cnpj) {
            return NextResponse.json({ error: "Arquivo ou CNPJ faltando." }, { status: 400 });
        }

        const token = await getNuvemFiscalToken();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Enviar binário do certificado
        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas/${cnpj.replace(/\D/g, "")}/certificado`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-pkcs12"
            },
            body: buffer
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ error: errorData }, { status: response.status });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Erro no upload do certificado:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
