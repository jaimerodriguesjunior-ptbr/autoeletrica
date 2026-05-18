"use server";

import { createClient } from "@/src/utils/supabase/server";

export async function getPendingWorkOrders(organizationId: string) {
    const supabase = createClient();

    const { data: workOrders, error } = await supabase
        .from("work_orders")
        .select(`
            id, created_at, total, status, client_id,
            clients (nome, cpf_cnpj),
            vehicles (placa, modelo)
        `)
        .eq("organization_id", organizationId)
        .in("status", ["pronto", "entregue"])
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar OS pendentes:", error);
        return [];
    }

    if (!workOrders || workOrders.length === 0) return [];

    const workOrderIds = workOrders.map((os) => os.id);

    const [{ data: osItems, error: itemsError }, { data: invoices, error: invoicesError }] = await Promise.all([
        supabase
            .from("work_order_items")
            .select("work_order_id, tipo, peca_cliente")
            .in("work_order_id", workOrderIds),
        supabase
            .from("fiscal_invoices")
            .select("work_order_id, tipo_documento, status")
            .eq("organization_id", organizationId)
            .in("work_order_id", workOrderIds)
            .not("work_order_id", "is", null)
            .not("status", "in", "(error,cancelled,rejected)")
    ]);

    if (itemsError) {
        console.error("Erro ao buscar itens das OS:", itemsError);
        return [];
    }

    if (invoicesError) {
        console.error("Erro ao buscar notas fiscais das OS:", invoicesError);
        return [];
    }

    const itemsByWorkOrder = new Map<number, { hasPecas: boolean; hasServicos: boolean }>();

    for (const item of osItems || []) {
        const current = itemsByWorkOrder.get(item.work_order_id) || { hasPecas: false, hasServicos: false };

        if (item.tipo === "peca" && !item.peca_cliente) {
            current.hasPecas = true;
        }

        if (item.tipo === "servico") {
            current.hasServicos = true;
        }

        itemsByWorkOrder.set(item.work_order_id, current);
    }

    const invoicesByWorkOrder = new Map<number, { hasProductInvoice: boolean; hasNFSe: boolean }>();

    for (const invoice of invoices || []) {
        const current = invoicesByWorkOrder.get(invoice.work_order_id) || { hasProductInvoice: false, hasNFSe: false };

        if (invoice.tipo_documento === "NFCe" || invoice.tipo_documento === "NFe") current.hasProductInvoice = true;
        if (invoice.tipo_documento === "NFSe") current.hasNFSe = true;

        invoicesByWorkOrder.set(invoice.work_order_id, current);
    }

    return workOrders
        .map((os) => {
            const itemSummary = itemsByWorkOrder.get(os.id) || { hasPecas: false, hasServicos: false };
            const invoiceSummary = invoicesByWorkOrder.get(os.id) || { hasProductInvoice: false, hasNFSe: false };

            const pending_documentos = [
                itemSummary.hasPecas && !invoiceSummary.hasProductInvoice ? "NFCe/NFe" : null,
                itemSummary.hasServicos && !invoiceSummary.hasNFSe ? "NFSe" : null,
            ].filter(Boolean);

            return {
                ...os,
                pending_documentos,
            };
        })
        .filter((os: any) => os.pending_documentos.length > 0);
}

export async function searchProducts(query: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("products")
        .select("id, nome, marca, preco_venda, ncm, cfop, unidade")
        .or(`nome.ilike.%${query}%,marca.ilike.%${query}%`)
        .limit(20);

    if (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
    }

    return data;
}

export async function searchServices(query: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("services")
        .select("id, nome, price, codigo_servico, aliquota_iss")
        .ilike("nome", `%${query}%`)
        .limit(20);

    if (error) {
        console.error("Erro ao buscar servicos:", error);
        return [];
    }

    return data;
}

export async function getProductFiscalData(productId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("products")
        .select("ncm, cfop, unidade")
        .eq("id", productId)
        .single();

    if (error) return null;
    return data;
}

export async function getServiceFiscalData(serviceId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("services")
        .select("codigo_servico, aliquota_iss")
        .eq("id", serviceId)
        .single();

    if (error) return null;
    return data;
}

export async function getFiscalInvoices(organizationId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("fiscal_invoices")
        .select("*, work_orders(clients(nome, whatsapp))")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar notas fiscais:", error);
        return [];
    }

    return data;
}

export type ParsedNFeItem = {
    codigo: string;
    descricao: string;
    ncm: string;
    unidade: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
};

function extractItemsFromInfNFe(infNFe: any): ParsedNFeItem[] {
    let dets = infNFe?.det;
    if (dets && !Array.isArray(dets)) dets = [dets];

    return (dets || []).map((d: any): ParsedNFeItem => ({
        codigo: String(d.prod?.cProd || ""),
        descricao: String(d.prod?.xProd || ""),
        ncm: String(d.prod?.NCM || ""),
        unidade: String(d.prod?.uCom || "UN"),
        quantidade: Number(d.prod?.qCom || 0),
        valor_unitario: Number(d.prod?.vUnCom || 0),
        valor_total: Number(d.prod?.vProd || 0),
    }));
}

export async function getEntryInvoiceWithItems(invoiceId: string) {
    const supabase = createClient();

    const { data: invoice, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("direction", "entry")
        .single();

    if (error || !invoice) return null;

    let items: ParsedNFeItem[] = [];

    if (invoice.xml_content) {
        try {
            const { XMLParser } = await import("fast-xml-parser");
            const parser = new XMLParser({ ignoreAttributes: false });
            const xml = parser.parse(invoice.xml_content);
            const nfeProc = xml.nfeProc || xml.NFe;
            const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
            items = extractItemsFromInfNFe(infNFe);
        } catch (e) {
            console.warn("[getEntryInvoiceWithItems] Erro ao parsear XML:", e);
        }
    }

    return { invoice, items };
}

export async function getNFeInvoiceWithItems(invoiceId: string) {
    const supabase = createClient();

    const { data: invoice, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("tipo_documento", "NFe")
        .single();

    if (error || !invoice) return null;

    let items: ParsedNFeItem[] = [];

    let xmlContent = invoice.xml_content;

    if (!xmlContent && invoice.xml_url) {
        try {
            const response = await fetch(invoice.xml_url);
            if (response.ok) {
                xmlContent = await response.text();
                await supabase
                    .from("fiscal_invoices")
                    .update({ xml_content: xmlContent })
                    .eq("id", invoiceId);
            }
        } catch (e) {
            console.warn("[getNFeInvoiceWithItems] Nao foi possivel baixar XML da NF-e:", e);
        }
    }

    if (xmlContent) {
        try {
            const { XMLParser } = await import("fast-xml-parser");
            const parser = new XMLParser({ ignoreAttributes: false });
            const xml = parser.parse(xmlContent);
            const nfeProc = xml.nfeProc || xml.NFe;
            const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
            items = extractItemsFromInfNFe(infNFe);
        } catch (e) {
            console.warn("[getNFeInvoiceWithItems] Erro ao parsear XML:", e);
        }
    }

    if (items.length === 0 && invoice.payload_json?.infNFe) {
        items = extractItemsFromInfNFe(invoice.payload_json.infNFe);
    }

    return { invoice, items };
}

export async function getEntryInvoiceWithItemsAction(invoiceId: string) {
    "use server";
    return getEntryInvoiceWithItems(invoiceId);
}

export async function getNFeInvoiceWithItemsAction(invoiceId: string) {
    "use server";
    return getNFeInvoiceWithItems(invoiceId);
}

export async function backfillEntryInvoicesChave(organizationId: string) {
    const supabase = createClient();

    const { data: allEntries } = await supabase
        .from("fiscal_invoices")
        .select("id, xml_content, chave_acesso")
        .eq("organization_id", organizationId)
        .eq("direction", "entry")
        .not("xml_content", "is", null);

    const invoices = (allEntries || []).filter(
        (inv) => !inv.chave_acesso || !/^[0-9]{44}$/.test(inv.chave_acesso)
    );

    if (!invoices.length) return { fixed: 0 };

    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: false,
        parseAttributeValue: false,
    });

    console.log(`[Backfill] ${invoices.length} nota(s) com chave vazia para corrigir.`);

    let fixed = 0;
    for (const invoice of invoices) {
        if (!invoice.xml_content) continue;
        try {
            const xml = parser.parse(invoice.xml_content);

            // Diagnóstico: ver estrutura raiz do XML
            const rootKeys = Object.keys(xml).join(", ");
            let chave = String(xml.nfeProc?.protNFe?.infProt?.chNFe || "").trim();

            if (!/^[0-9]{44}$/.test(chave)) {
                const nfeProc = xml.nfeProc || xml.NFe;
                const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
                const idAttr = infNFe?.["@_Id"] || "";
                chave = String(idAttr).replace(/^NFe/, "").trim();
                console.log(`[Backfill] id=${invoice.id} rootKeys=${rootKeys} idAttr=${idAttr} chave=${chave.substring(0, 10)}...`);
            }

            if (/^[0-9]{44}$/.test(chave)) {
                await supabase
                    .from("fiscal_invoices")
                    .update({ chave_acesso: chave })
                    .eq("id", invoice.id);
                fixed++;
            } else {
                console.warn(`[Backfill] id=${invoice.id} — chave não encontrada. rootKeys=${rootKeys}`);
            }
        } catch (e: any) {
            console.warn(`[Backfill] id=${invoice.id} erro: ${e.message}`);
        }
    }

    console.log(`[Backfill] Concluído. ${fixed} corrigida(s).`);
    return { fixed };
}

export async function updateProductNCM(productId: string, ncm: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from("products")
        .update({ ncm })
        .eq("id", productId);

    if (error) {
        console.error("Erro ao atualizar NCM do produto:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
