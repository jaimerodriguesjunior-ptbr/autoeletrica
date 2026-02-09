import { NextRequest, NextResponse } from "next/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const cnpj = formData.get("cnpj") as string;
        const password = formData.get("password") as string;

        if (!file || !cnpj || !password) {
            return NextResponse.json({ error: "Arquivo, CNPJ ou Senha faltando." }, { status: 400 });
        }

        const token = await getNuvemFiscalToken();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Cert = buffer.toString("base64");

        // Enviar JSON com certificado em Base64 e senha
        const baseUrl = process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br";
        const response = await fetch(`${baseUrl}/empresas/${cnpj.replace(/\D/g, "")}/certificado`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                certificado: base64Cert,
                password: password
            })
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
