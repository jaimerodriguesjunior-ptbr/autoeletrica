"use server";

import { createClient } from "@/src/utils/supabase/server";
import { extractItemsFromInfNFe } from "@/src/lib/nfe_xml";
import type { ParsedNFeItem } from "@/src/types/nfe";

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
            .eq("direction", "output")
            .eq("status", "authorized")
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

            const documentos_emitidos = [
                invoiceSummary.hasProductInvoice ? "NFCe/NFe" : null,
                invoiceSummary.hasNFSe ? "NFSe" : null,
            ].filter(Boolean);

            // A OS continua vinculada a uma nota autorizada, mas ainda tem outra
            // categoria fiscal para emitir (inclusive se a tentativa anterior dela falhou).
            const emissao_parcial = documentos_emitidos.length > 0 && pending_documentos.length > 0;

            return {
                ...os,
                pending_documentos,
                documentos_emitidos,
                emissao_parcial,
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

export type { ParsedNFeItem };

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
    let parsedInfNFe: any = null;

    if (invoice.xml_content) {
        try {
            const { XMLParser } = await import("fast-xml-parser");
            const parser = new XMLParser({ ignoreAttributes: false });
            const xml = parser.parse(invoice.xml_content);
            const nfeProc = xml.nfeProc || xml.NFe;
            const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
            items = extractItemsFromInfNFe(infNFe);
            parsedInfNFe = infNFe;
        } catch (e) {
            console.warn("[getEntryInvoiceWithItems] Erro ao parsear XML:", e);
        }
    }

    if (!parsedInfNFe && invoice.payload_json?.infNFe) {
        parsedInfNFe = invoice.payload_json.infNFe;
    }

    return { invoice, items, parsedInfNFe };
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
    let parsedInfNFe: any = null;

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
            parsedInfNFe = infNFe;
        } catch (e) {
            console.warn("[getNFeInvoiceWithItems] Erro ao parsear XML:", e);
        }
    }

    if (items.length === 0 && invoice.payload_json?.infNFe) {
        items = extractItemsFromInfNFe(invoice.payload_json.infNFe);
    }
    if (!parsedInfNFe && invoice.payload_json?.infNFe) {
        parsedInfNFe = invoice.payload_json.infNFe;
    }

    return { invoice, items, parsedInfNFe };
}

export async function getEntryInvoiceWithItemsAction(invoiceId: string) {
    "use server";
    return getEntryInvoiceWithItems(invoiceId);
}

export async function getNFeInvoiceWithItemsAction(invoiceId: string) {
    "use server";
    return getNFeInvoiceWithItems(invoiceId);
}

export async function searchCloneableNFeInvoicesAction(params: {
    organizationId: string;
    environment: "production" | "homologation";
    query?: string;
    status?: "authorized" | "error" | "rejected" | "all";
}) {
    "use server";
    const supabase = createClient();
    const term = (params.query || "").trim();

    let query = supabase
        .from("fiscal_invoices")
        .select("id, numero, serie, status, environment, destinatario_nome, destinatario_cnpj, valor_total, data_emissao, chave_acesso, payload_json")
        .eq("organization_id", params.organizationId)
        .eq("tipo_documento", "NFe")
        .eq("direction", "output")
        .eq("environment", params.environment)
        .order("data_emissao", { ascending: false })
        .limit(30);

    if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
    }

    if (term) {
        const clean = term.replace(/\D/g, "");
        query = query.or([
            `numero.ilike.%${term}%`,
            `destinatario_nome.ilike.%${term}%`,
            `destinatario_cnpj.ilike.%${clean || term}%`,
            `chave_acesso.ilike.%${clean || term}%`,
        ].join(","));
    }

    const { data, error } = await query;

    if (error) {
        console.error("Erro ao buscar NF-e para clonagem:", error);
        return [];
    }

    return data || [];
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

export interface LocalNcmItem {
    codigo: string;
    descricao: string;
    vigente?: boolean;
    segmento?: string;
    relevancia_oficina?: number;
    termos_busca?: string;
}

function sanitizePostgrestSearch(text: string): string {
    return text.replace(/[(),."':;\\%*?[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

function getSearchVariants(text: string): string[] {
    const clean = sanitizePostgrestSearch(text);
    if (!clean) return [];
    const noAccents = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const variants = new Set<string>([clean, noAccents]);

    // Trata termos frequentes em autoelétrica para garantir correspondência com acentuação
    const lower = noAccents.toLowerCase();
    if (lower.includes("rele")) variants.add(lower.replace(/rele/g, "rel\u00e9"));
    if (lower.includes("lampada")) variants.add(lower.replace(/lampada/g, "l\u00e2mpada"));
    if (lower.includes("fusivel")) variants.add(lower.replace(/fusivel/g, "fus\u00edvel"));
    if (lower.includes("ignicao")) variants.add(lower.replace(/ignicao/g, "igni\u00e7\u00e3o"));
    if (lower.includes("eletronico")) variants.add(lower.replace(/eletronico/g, "eletr\u00f4nico"));
    if (lower.includes("eletrico")) variants.add(lower.replace(/eletrico/g, "el\u00e9trico"));

    if (/(?:auto ?falante|alto ?falante|altifalante|falante)/.test(lower)) {
        variants.add("alto-falante");
        variants.add("alto falante");
        variants.add("altifalante");
    }
    if (lower.includes("rele")) variants.add(lower.replace(/rele/g, "relé"));
    if (lower.includes("lampada")) variants.add(lower.replace(/lampada/g, "lâmpada"));
    if (lower.includes("fusivel")) variants.add(lower.replace(/fusivel/g, "fusível"));
    if (lower.includes("ignicao")) variants.add(lower.replace(/ignicao/g, "ignição"));
    if (lower.includes("eletronico")) variants.add(lower.replace(/eletronico/g, "eletrônico"));
    if (lower.includes("eletrico")) variants.add(lower.replace(/eletrico/g, "elétrico"));

    return Array.from(variants).filter(v => v.length >= 2);
}

function checkIsVigente(dataFim?: string | null): boolean {
    if (!dataFim) return true;
    const clean = String(dataFim).trim();
    if (clean === "31/12/9999" || clean === "9999-12-31") return true;

    let endDate: Date | null = null;
    if (clean.includes("/")) {
        const parts = clean.split("/");
        if (parts.length === 3) {
            endDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
    } else if (clean.includes("-")) {
        endDate = new Date(clean);
    }

    if (!endDate || isNaN(endDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
}

export async function searchLocalNcm(query: string): Promise<LocalNcmItem[]> {
    if (!query || query.trim().length < 2) return [];

    const supabase = createClient();
    const variants = getSearchVariants(query);
    if (variants.length === 0) return [];

    const digitsOnly = query.replace(/\D/g, "");

    let queryBuilder = supabase
        .from("ncm_catalog")
        .select("codigo, descricao, vigente, segmento, relevancia_oficina, termos_busca")
        .eq("vigente", true);

    const conditions: string[] = [];
    if (digitsOnly.length >= 2) {
        conditions.push(`codigo.ilike.${digitsOnly}%`);
    }

    for (const v of variants) {
        conditions.push(`descricao.ilike.%${v}%`);
        conditions.push(`termos_busca.ilike.%${v}%`);
    }

    if (conditions.length > 0) {
        queryBuilder = queryBuilder.or(conditions.join(","));
    }

    const { data, error } = await queryBuilder
        .order("relevancia_oficina", { ascending: false })
        .order("codigo", { ascending: true })
        .limit(20);

    if (error) {
        console.error("Erro ao buscar NCM local:", error);
        return [];
    }

    return (data || []) as LocalNcmItem[];
}

export async function syncNcmDatabase() {
    try {
        const { createAdminClient } = await import("@/src/utils/supabase/admin");
        const supabaseAdmin = createAdminClient();

        console.log("[NCM Sync] Iniciando download do JSON oficial do Siscomex...");
        const response = await fetch("https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json", {
            headers: {
                "Accept": "application/json",
                "User-Agent": "AutoEletrica-Fiscal/1.0"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`Falha no download da tabela NCM (${response.status}): ${response.statusText}`);
        }

        const json = await response.json();
        const rawList = Array.isArray(json) ? json : (json.Nomenclaturas || json.nomenclaturas || []);

        if (!Array.isArray(rawList) || rawList.length === 0) {
            throw new Error("Formato inválido do JSON do Siscomex ou lista vazia.");
        }

        console.log(`[NCM Sync] ${rawList.length} registros recebidos. Montando mapa hierárquico de categorias...`);

        // Mapeia todas as descrições (2, 4, 5, 6, 7 e 8 dígitos) para enriquecer os itens folha
        const byCode = new Map<string, string>();
        for (const item of rawList) {
            const cleanCode = String(item.Codigo || item.codigo || "").replace(/\D/g, "");
            const rawDesc = String(item.Descricao || item.descricao || "").replace(/^[-—\s]+/, "").trim();
            if (cleanCode && rawDesc) {
                byCode.set(cleanCode, rawDesc);
            }
        }

        const formatted = rawList
            .filter((item: any) => {
                const code = String(item.Codigo || item.codigo || "").replace(/\D/g, "");
                return code.length === 8;
            })
            .map((item: any) => {
                const code = String(item.Codigo || item.codigo || "").replace(/\D/g, "").slice(0, 8);
                const dataFim = item.Data_Fim || item.data_fim || null;

                // Constrói descrição contextualizada combinando a categoria pai e o item folha
                const prefixes = [
                    code.slice(0, 4),
                    code.slice(0, 5),
                    code.slice(0, 6),
                    code.slice(0, 7),
                    code
                ];
                const parts: string[] = [];
                const seen = new Set<string>();
                for (const p of prefixes) {
                    const desc = byCode.get(p);
                    if (desc && !seen.has(desc.toLowerCase())) {
                        parts.push(desc);
                        seen.add(desc.toLowerCase());
                    }
                }

                const fullDescription = parts.length > 0 ? parts.join(" - ") : (item.Descricao || item.descricao || "").trim();

                return {
                    codigo: code,
                    descricao: fullDescription,
                    data_inicio: item.Data_Inicio || item.data_inicio || null,
                    data_fim: dataFim,
                    tipo: item.Tipo || item.tipo || "NCM",
                    vigente: checkIsVigente(dataFim),
                    updated_at: new Date().toISOString()
                };
            });

        console.log(`[NCM Sync] ${formatted.length} NCMs válidos prontos para upsert. Inserindo em lotes...`);

        const CHUNK_SIZE = 1000;
        let totalUpserted = 0;

        for (let i = 0; i < formatted.length; i += CHUNK_SIZE) {
            const chunk = formatted.slice(i, i + CHUNK_SIZE);
            const { error } = await supabaseAdmin
                .from("ncm_catalog")
                .upsert(chunk, { onConflict: "codigo" });

            if (error) {
                console.error(`[NCM Sync] Erro no lote ${i} - ${i + chunk.length}:`, error);
                throw error;
            }

            totalUpserted += chunk.length;
        }

        return { success: true, count: totalUpserted };
    } catch (e: any) {
        console.error("[NCM Sync] Erro ao sincronizar banco de NCMs:", e);
        return { success: false, error: e.message || "Erro desconhecido" };
    }
}

