import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";

import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

async function fetchPdfBuffer(url: string, headers?: HeadersInit) {
    const response = await fetch(url, {
        method: "GET",
        headers,
    });

    if (!response.ok) {
        return { success: false as const, status: response.status };
    }

    const pdfArrayBuffer = await response.arrayBuffer();
    return {
        success: true as const,
        buffer: Buffer.from(pdfArrayBuffer),
    };
}

function buildDownloadName(invoice: any, extension: "pdf" | "xml") {
    const tipoPrefix = invoice.direction === "entry"
        ? "nfe-entrada"
        : invoice.tipo_documento === "NFCe"
            ? "nfce"
            : "nfse";

    return `${tipoPrefix}-${invoice.numero || "documento"}.${extension}`;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const invoiceId = params.id;
    const supabase = createClient();

    try {
        const { data: invoice, error } = await supabase
            .from("fiscal_invoices")
            .select("*")
            .eq("id", invoiceId)
            .single();

        if (error || !invoice) {
            return NextResponse.json({ error: "Nota nao encontrada" }, { status: 404 });
        }

        const download = request.nextUrl.searchParams.get("download") === "true";
        const pdfDisposition = download
            ? `attachment; filename="${buildDownloadName(invoice, "pdf")}"`
            : `inline; filename="${buildDownloadName(invoice, "pdf")}"`;

        if (invoice.direction === "entry") {
            if (!invoice.xml_content) {
                return NextResponse.json({ error: "XML da nota de entrada nao encontrado" }, { status: 404 });
            }

            const xmlDisposition = download
                ? `attachment; filename="${buildDownloadName(invoice, "xml")}"`
                : `inline; filename="${buildDownloadName(invoice, "xml")}"`;

            return new NextResponse(invoice.xml_content, {
                headers: {
                    "Content-Type": "application/xml; charset=utf-8",
                    "Content-Disposition": xmlDisposition,
                },
            });
        }

        if (!invoice.nuvemfiscal_uuid) {
            if (invoice.pdf_url) {
                const directPdf = await fetchPdfBuffer(invoice.pdf_url);

                if (directPdf.success) {
                    return new NextResponse(directPdf.buffer, {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": pdfDisposition,
                        },
                    });
                }
            }

            return NextResponse.json({ error: "UUID da NuvemFiscal nao encontrado" }, { status: 400 });
        }

        const env = (invoice.environment as "production" | "homologation") || "production";
        const token = await getNuvemFiscalToken(env);

        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const endpointType = invoice.tipo_documento === "NFCe" ? "nfce" : "nfse";
        const pdfUrl = `${baseUrl}/${endpointType}/${invoice.nuvemfiscal_uuid}/pdf`;

        console.log(`[PDF Proxy] Fetching from: ${pdfUrl}`);

        const response = await fetchPdfBuffer(pdfUrl, {
            Authorization: `Bearer ${token}`,
        });

        if (!response.success) {
            console.error(`[PDF Proxy] Error ${response.status} while fetching ${pdfUrl}`);

            if (invoice.pdf_url && invoice.pdf_url.startsWith("http")) {
                const directPdf = await fetchPdfBuffer(invoice.pdf_url);

                if (directPdf.success) {
                    return new NextResponse(directPdf.buffer, {
                        headers: {
                            "Content-Type": "application/pdf",
                            "Content-Disposition": pdfDisposition,
                        },
                    });
                }
            }

            return NextResponse.json({ error: "Falha ao obter PDF da NuvemFiscal" }, { status: response.status });
        }

        return new NextResponse(response.buffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": pdfDisposition,
            },
        });
    } catch (error: any) {
        console.error("[PDF Proxy] Unhandled Error:", error);
        return NextResponse.json({ error: "Erro interno ao gerar PDF" }, { status: 500 });
    }
}
