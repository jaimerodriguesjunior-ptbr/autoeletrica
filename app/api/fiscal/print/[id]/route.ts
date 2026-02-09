
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";

import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const invoiceId = params.id;
    const supabase = createClient();

    try {
        // 1. Get Invoice Data
        const { data: invoice, error } = await supabase
            .from("fiscal_invoices")
            .select("*")
            .eq("id", invoiceId)
            .single();

        if (error || !invoice) {
            return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
        }

        if (!invoice.nuvemfiscal_uuid) {
            // Fallback to pdf_url if UUID is missing
            if (invoice.pdf_url) return NextResponse.redirect(invoice.pdf_url);
            return NextResponse.json({ error: "UUID da NuvemFiscal não encontrado" }, { status: 400 });
        }

        // NFC-e: Always use the stored pdf_url if available (Nuvem Fiscal provides it directly on emission)
        if (invoice.tipo_documento === 'NFCe' && invoice.pdf_url) {
            console.log(`[PDF Proxy] NFC-e: Redirecting to stored pdf_url: ${invoice.pdf_url}`);
            return NextResponse.redirect(invoice.pdf_url);
        }

        // 2. Authenticate with NuvemFiscal
        const env = (invoice.environment as 'production' | 'homologation') || 'production';
        const token = await getNuvemFiscalToken(env);

        const baseUrl = env === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        // 3. Fetch PDF Binary
        // Endpoint: /nfse/{id}/pdf OR /nfce/{id}/pdf
        let endpointType = "nfse";
        if (invoice.tipo_documento === 'NFCe') {
            endpointType = "nfce";
        }

        const pdfUrl = `${baseUrl}/${endpointType}/${invoice.nuvemfiscal_uuid}/pdf`;

        console.log(`[PDF Proxy] Fetching from: ${pdfUrl}`);

        const response = await fetch(pdfUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`[PDF Proxy] Error ${response.status}: ${response.statusText}`);
            // If PDF not available via API, try saving the link_url again or redirecting
            if (invoice.pdf_url && invoice.pdf_url.startsWith('http')) {
                return NextResponse.redirect(invoice.pdf_url);
            }
            return NextResponse.json({ error: "Falha ao obter PDF da NuvemFiscal" }, { status: response.status });
        }

        // 4. Return PDF Stream
        const pdfArrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(pdfArrayBuffer);

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="nfse-${invoice.numero}.pdf"`,
            },
        });

    } catch (error: any) {
        console.error("[PDF Proxy] Unhandled Error:", error);
        return NextResponse.json({ error: "Erro interno ao gerar PDF" }, { status: 500 });
    }
}
