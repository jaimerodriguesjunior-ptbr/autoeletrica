import { NextRequest, NextResponse } from "next/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const cnpj = formData.get("cnpj") as string;
        const password = formData.get("password") as string;
        const environmentRaw = (formData.get("environment") as string) || "production";
        const environment = environmentRaw === "homologation" ? "homologation" : "production";

        if (!file || !cnpj || !password) {
            return NextResponse.json({ error: "Arquivo, CNPJ ou Senha faltando." }, { status: 400 });
        }

        const token = await getNuvemFiscalToken(environment);
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Cert = buffer.toString("base64");

        // Enviar JSON com certificado em Base64 e senha
        const baseUrl = environment === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");
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
            let details: any = null;
            try {
                details = await response.json();
            } catch {
                details = await response.text();
            }

            const message =
                details?.message ||
                details?.error?.message ||
                details?.detail ||
                (typeof details === "string" ? details : "Falha no upload do certificado");

            return NextResponse.json({ error: message, details }, { status: response.status });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Erro no upload do certificado:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
