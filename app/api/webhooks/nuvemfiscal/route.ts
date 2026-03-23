import { createClient } from "@/src/utils/supabase/server";
import { NextResponse } from "next/server";

async function tryFetchXmlContent(xmlUrl?: string | null) {
    if (!xmlUrl) return null;

    try {
        const response = await fetch(xmlUrl);
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.warn("[Webhook] Nao foi possivel baixar XML automaticamente:", error);
        return null;
    }
}

function getIssueDateFromWebhook(body: any) {
    return (
        body.data_emissao ||
        body.data?.data_emissao ||
        body.dhEmi ||
        body.data?.dhEmi ||
        body.dh_emi ||
        body.data?.dh_emi ||
        body.infNFe?.ide?.dhEmi ||
        body.data?.infNFe?.ide?.dhEmi ||
        null
    );
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        const webhookSecret = process.env.NUVEMFISCAL_WEBHOOK_SECRET;

        if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
            console.warn("[Webhook] Tentativa nao autorizada.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        console.log("[Webhook NuvemFiscal] Recebido:", JSON.stringify(body, null, 2));

        const nuvemFiscalId = body.id || body.data?.id;
        const statusNuvem = body.status || body.data?.status;
        const motivo = body.motivo_status || body.data?.motivo_status;
        const pdfUrl = body.pdf_url || body.data?.pdf_url || null;
        const xmlUrl = body.xml_url || body.data?.xml_url || null;

        if (!nuvemFiscalId) {
            return NextResponse.json({ message: "ID nao encontrado no payload" }, { status: 400 });
        }

        const supabase = createClient();

        let novoStatus = "processing";
        let errorMessage = null;

        if (statusNuvem === "autorizado") {
            novoStatus = "authorized";
        } else if (["erro", "rejeitado", "negado"].includes(statusNuvem)) {
            novoStatus = "error";
            errorMessage = motivo || "Erro reportado via Webhook";
        } else if (statusNuvem === "cancelado") {
            novoStatus = "cancelled";
        } else {
            console.log("[Webhook] Status ignorado:", statusNuvem);
            return NextResponse.json({ message: "Status ignorado" });
        }

        const updatePayload: Record<string, any> = {
            status: novoStatus,
            error_message: errorMessage,
            pdf_url: pdfUrl,
            xml_url: xmlUrl,
            numero: body.numero || body.data?.numero,
            serie: body.serie || body.data?.serie,
            chave_acesso: body.chave || body.data?.chave,
        };

        const issueDate = getIssueDateFromWebhook(body);
        if (issueDate) {
            updatePayload.data_emissao = issueDate;
        }

        if (novoStatus === "authorized" && xmlUrl) {
            const xmlContent = await tryFetchXmlContent(xmlUrl);
            if (xmlContent) {
                updatePayload.xml_content = xmlContent;
            }
        }

        const { error } = await supabase
            .from("fiscal_invoices")
            .update(updatePayload)
            .eq("nuvemfiscal_uuid", nuvemFiscalId);

        if (error) {
            console.error("[Webhook] Erro ao atualizar banco:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Status atualizado com sucesso" });
    } catch (error: any) {
        console.error("[Webhook] Erro interno:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
