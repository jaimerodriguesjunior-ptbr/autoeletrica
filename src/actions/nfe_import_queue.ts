"use server";

import { XMLParser } from "fast-xml-parser";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";

type QueueStatus = "pending" | "imported" | "ignored" | "error" | "duplicated";

export type NfeQueueItem = {
    id: string;
    chave_acesso: string;
    nuvemfiscal_document_id: string | null;
    nsu: number | null;
    resumo: boolean;
    xml_completo_disponivel?: boolean;
    status: QueueStatus;
    numero: string | null;
    serie: string | null;
    emitente_nome: string | null;
    emitente_cnpj: string | null;
    data_emissao: string | null;
    valor_total: number | null;
    error_message: string | null;
    created_at: string;
};

type DistribuicaoDocumento = {
    id: string;
    nsu?: number | null;
    schema?: string | null;
    tipo_documento?: string | null;
    chave_acesso?: string | null;
    resumo?: boolean | null;
    valor_nfe?: number | null;
    emitente_cpf_cnpj?: string | null;
    emitente_nome_razao_social?: string | null;
    data_emissao?: string | null;
    data_evento?: string | null;
};

const NFE_IMPORT_LOOKBACK_DAYS = 60;
const NFE_ENVIRONMENT: "production" = "production";
const NFE_AMBIENTE = "producao";
const DISTRIBUTION_POLL_INTERVAL_MS = 750;
const DISTRIBUTION_POLL_MAX_ATTEMPTS = 12;

function onlyDigits(value?: string | null) {
    return String(value || "").replace(/\D/g, "");
}

function nfeBaseUrl() {
    return process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br";
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestNfeDistribution(
    requestPayload: Record<string, unknown>,
    token: string,
) {
    const endpoint = `${nfeBaseUrl()}/distribuicao/nfe`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        cache: "no-store",
    });
    const responseText = await response.text();
    const initialResult = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
        throw new Error(initialResult?.error?.message || initialResult?.message || responseText || "Falha ao consultar distribuicao NF-e.");
    }

    let result = initialResult;
    let pollAttempts = 0;

    while (String(result?.status || "").toLowerCase() === "processando") {
        const distributionId = String(result?.id || "").trim();
        if (!distributionId) {
            throw new Error("A Nuvem Fiscal iniciou uma consulta assincrona sem retornar o identificador do pedido.");
        }
        if (pollAttempts >= DISTRIBUTION_POLL_MAX_ATTEMPTS) {
            throw new Error("A consulta ainda esta sendo processada pela Nuvem Fiscal. Tente novamente em alguns instantes.");
        }

        pollAttempts++;
        await sleep(DISTRIBUTION_POLL_INTERVAL_MS);

        const pollResponse = await fetch(`${endpoint}/${distributionId}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        const pollText = await pollResponse.text();
        const pollResult = pollText ? JSON.parse(pollText) : {};

        if (!pollResponse.ok) {
            throw new Error(pollResult?.error?.message || pollResult?.message || pollText || "Falha ao acompanhar a consulta de distribuicao NF-e.");
        }

        result = pollResult;
    }

    if (String(result?.status || "").toLowerCase() === "erro") {
        throw new Error(result?.error?.message || result?.mensagem || result?.motivo_status || "A Nuvem Fiscal nao conseguiu concluir a consulta de distribuicao NF-e.");
    }

    return result;
}

async function getOrgAndCompany() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario nao autenticado.");

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) throw new Error("Organizacao nao encontrada.");

    const { data: company } = await supabase
        .from("company_settings")
        .select("cnpj, cpf_cnpj")
        .eq("organization_id", profile.organization_id)
        .single();

    const cpfCnpj = onlyDigits(company?.cnpj || company?.cpf_cnpj);
    if (!cpfCnpj) throw new Error("CNPJ da oficina nao configurado.");

    return { organizationId: profile.organization_id as string, cpfCnpj };
}

function parseNfeXml(xmlText: string) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: false,
        parseAttributeValue: false,
    });
    const xml = parser.parse(xmlText);
    const nfeProc = xml.nfeProc || xml.NFe;
    const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
    return { xml, infNFe };
}

function extractNfeMetaFromXml(xmlText: string) {
    const { xml, infNFe } = parseNfeXml(xmlText);
    if (!infNFe) return {};

    const ide = infNFe.ide || {};
    const emit = infNFe.emit || {};
    const total = infNFe.total?.ICMSTot || {};
    let chave = String(xml.nfeProc?.protNFe?.infProt?.chNFe || "").trim();
    if (!/^[0-9]{44}$/.test(chave)) {
        chave = String(infNFe["@_Id"] || "").replace(/^NFe/, "").trim();
    }

    return {
        chave_acesso: /^[0-9]{44}$/.test(chave) ? chave : undefined,
        numero: ide.nNF ? String(ide.nNF) : undefined,
        serie: ide.serie ? String(ide.serie) : undefined,
        emitente_nome: emit.xNome ? String(emit.xNome) : undefined,
        emitente_cnpj: emit.CNPJ ? String(emit.CNPJ) : undefined,
        data_emissao: ide.dhEmi ? String(ide.dhEmi) : undefined,
        valor_total: total.vNF ? Number(total.vNF) : undefined,
    };
}

function hasCompleteNfeItems(xmlText: string) {
    try {
        const { infNFe } = parseNfeXml(xmlText);
        return Boolean(infNFe?.det);
    } catch {
        return false;
    }
}

async function downloadDocumentXml(documentId: string, token: string) {
    const response = await fetch(`${nfeBaseUrl()}/distribuicao/nfe/documentos/${documentId}/xml`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nao foi possivel baixar o XML (${response.status}): ${errorText}`);
    }

    return response.text();
}

async function manifestScience(cpfCnpj: string, chaveAcesso: string, token: string) {
    const response = await fetch(`${nfeBaseUrl()}/distribuicao/nfe/manifestacoes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            cpf_cnpj: cpfCnpj,
            ambiente: NFE_AMBIENTE,
            chave_acesso: chaveAcesso,
            tipo_evento: "210210",
        }),
    });

    if (!response.ok && response.status !== 409) {
        const errorText = await response.text();
        throw new Error(`Nao foi possivel manifestar ciencia (${response.status}): ${errorText}`);
    }
}

async function ensureDistributionConfig(cpfCnpj: string, token: string) {
    const response = await fetch(`${nfeBaseUrl()}/empresas/${cpfCnpj}/distnfe`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            ambiente: NFE_AMBIENTE,
            distribuicao_automatica: false,
            ciencia_automatica: false,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nao foi possivel configurar a Distribuicao NF-e (${response.status}): ${errorText}`);
    }
}

export async function listNfeImportQueue() {
    try {
        const { organizationId } = await getOrgAndCompany();
        const supabaseAdmin = createAdminClient();

        const { data, error } = await supabaseAdmin
            .from("nfe_import_queue")
            .select("id, chave_acesso, nuvemfiscal_document_id, nsu, resumo, status, numero, serie, emitente_nome, emitente_cnpj, data_emissao, valor_total, error_message, created_at, xml_content")
            .eq("organization_id", organizationId)
            .in("status", ["pending", "error"])
            .order("data_emissao", { ascending: false, nullsFirst: false });

        if (error) throw error;

        const queueItems = ((data || []) as any[]).map((item) => {
            const { xml_content, ...queueItem } = item;
            return {
                ...queueItem,
                xml_completo_disponivel: xml_content ? hasCompleteNfeItems(String(xml_content)) : false,
            } as NfeQueueItem;
        });
        const keys = queueItems.map((item) => item.chave_acesso).filter(Boolean);
        if (keys.length === 0) return { success: true, data: queueItems };

        const { data: imported, error: importedError } = await supabaseAdmin
            .from("fiscal_invoices")
            .select("chave_acesso")
            .eq("organization_id", organizationId)
            .in("chave_acesso", keys);

        if (importedError) throw importedError;

        const importedKeys = new Set((imported || []).map((item: any) => item.chave_acesso).filter(Boolean));
        const pendingItems = queueItems.filter((item) => !importedKeys.has(item.chave_acesso));

        if (importedKeys.size > 0) {
            await supabaseAdmin
                .from("nfe_import_queue")
                .update({
                    status: "imported",
                    imported_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("organization_id", organizationId)
                .in("chave_acesso", Array.from(importedKeys));
        }

        return { success: true, data: pendingItems };
    } catch (error: any) {
        return { success: false, error: error.message, data: [] as NfeQueueItem[] };
    }
}

export async function syncNfeFromSefaz() {
    try {
        const { organizationId, cpfCnpj } = await getOrgAndCompany();
        const supabaseAdmin = createAdminClient();

        let { data: state } = await supabaseAdmin
            .from("nfe_distribution_state")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("cpf_cnpj", cpfCnpj)
            .eq("ambiente", NFE_AMBIENTE)
            .maybeSingle();

        if (!state) {
            const { data: insertedState, error: stateError } = await supabaseAdmin
                .from("nfe_distribution_state")
                .insert({
                    organization_id: organizationId,
                    cpf_cnpj: cpfCnpj,
                    ambiente: NFE_AMBIENTE,
                    ultimo_nsu: 0,
                    initial_sync_completed: false,
                })
                .select("*")
                .single();

            if (stateError) throw stateError;
            state = insertedState;
        }

        const isInitialSync = !state.initial_sync_completed;
        const token = await getNuvemFiscalToken(NFE_ENVIRONMENT, "empresa nfe distribuicao-nfe");
        await ensureDistributionConfig(cpfCnpj, token);

        const result = await requestNfeDistribution({
            cpf_cnpj: cpfCnpj,
            ambiente: NFE_AMBIENTE,
            tipo_consulta: "dist-nsu",
            dist_nsu: Number(state.ultimo_nsu || 0),
            ignorar_tempo_espera: false,
        }, token);

        const minDate = new Date();
        minDate.setDate(minDate.getDate() - NFE_IMPORT_LOOKBACK_DAYS);

        const docs = (result.documentos || []) as DistribuicaoDocumento[];
        let inserted = 0;
        let skippedOld = 0;
        let skippedDuplicated = 0;
        let skippedNonNote = 0;
        let skippedMissingKey = 0;

        for (const doc of docs) {
            if (doc.tipo_documento && String(doc.tipo_documento).trim().toLowerCase() !== "nota") {
                skippedNonNote++;
                continue;
            }
            if (!doc.chave_acesso) {
                skippedMissingKey++;
                continue;
            }

            const existingInvoice = await supabaseAdmin
                .from("fiscal_invoices")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("chave_acesso", doc.chave_acesso)
                .maybeSingle();

            if (existingInvoice.data) {
                skippedDuplicated++;
                continue;
            }

            const emissionDate = doc.data_emissao ? new Date(doc.data_emissao) : null;
            if (isInitialSync && emissionDate && emissionDate < minDate) {
                skippedOld++;
                continue;
            }

            const { error: upsertError } = await supabaseAdmin
                .from("nfe_import_queue")
                .upsert({
                    organization_id: organizationId,
                    chave_acesso: doc.chave_acesso,
                    nuvemfiscal_document_id: doc.id,
                    nsu: doc.nsu || null,
                    schema: doc.schema || null,
                    resumo: Boolean(doc.resumo),
                    status: "pending",
                    emitente_nome: doc.emitente_nome_razao_social || null,
                    emitente_cnpj: doc.emitente_cpf_cnpj || null,
                    data_emissao: doc.data_emissao || null,
                    valor_total: doc.valor_nfe || null,
                    metadata: doc,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "organization_id,chave_acesso" });

            if (upsertError) throw upsertError;
            inserted++;
        }

        const initialSyncCompleted = isInitialSync
            ? docs.length === 0 || Number(result.ultimo_nsu || 0) >= Number(result.max_nsu || 0)
            : true;

        await supabaseAdmin
            .from("nfe_distribution_state")
            .update({
                ultimo_nsu: result.ultimo_nsu ?? state.ultimo_nsu ?? 0,
                max_nsu: result.max_nsu ?? state.max_nsu ?? null,
                initial_sync_completed: initialSyncCompleted,
                last_sync_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", state.id);

        return {
            success: true,
            inserted,
            received: docs.length,
            skippedOld,
            skippedDuplicated,
            skippedNonNote,
            skippedMissingKey,
            ultimoNsu: result.ultimo_nsu ?? null,
            maxNsu: result.max_nsu ?? null,
            codigoStatus: result.codigo_status ?? null,
            motivoStatus: result.motivo_status ?? null,
            cpfCnpj,
            initialSync: isInitialSync,
            initialSyncCompleted,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function searchNfeByAccessKey(chaveAcesso: string) {
    try {
        const cleanKey = onlyDigits(chaveAcesso);
        if (!/^[0-9]{44}$/.test(cleanKey)) {
            throw new Error("Chave de acesso invalida. Informe os 44 digitos da NF-e.");
        }

        const { organizationId, cpfCnpj } = await getOrgAndCompany();
        const supabaseAdmin = createAdminClient();
        const token = await getNuvemFiscalToken(NFE_ENVIRONMENT, "empresa nfe distribuicao-nfe");
        await ensureDistributionConfig(cpfCnpj, token);

        const result = await requestNfeDistribution({
            cpf_cnpj: cpfCnpj,
            ambiente: NFE_AMBIENTE,
            tipo_consulta: "cons-chave",
            cons_chave: cleanKey,
            ignorar_tempo_espera: false,
        }, token);

        const docs = ((result.documentos || []) as DistribuicaoDocumento[])
            .filter(doc => (!doc.tipo_documento || String(doc.tipo_documento).trim().toLowerCase() === "nota") && doc.chave_acesso);

        if (docs.length === 0) {
            return {
                success: true,
                inserted: 0,
                alreadyImported: false,
                found: false,
                codigoStatus: result.codigo_status ?? null,
                motivoStatus: result.motivo_status ?? null,
                cpfCnpj,
            };
        }

        const doc = docs[0];
        const existingInvoice = await supabaseAdmin
            .from("fiscal_invoices")
            .select("id, numero, emitente_nome, data_emissao")
            .eq("organization_id", organizationId)
            .eq("chave_acesso", doc.chave_acesso)
            .maybeSingle();

        if (existingInvoice.data) {
            return {
                success: true,
                inserted: 0,
                alreadyImported: true,
                found: true,
                invoice: existingInvoice.data,
                codigoStatus: result.codigo_status ?? null,
                motivoStatus: result.motivo_status ?? null,
                cpfCnpj,
            };
        }

        const { data: queueItem, error: upsertError } = await supabaseAdmin
            .from("nfe_import_queue")
            .upsert({
                organization_id: organizationId,
                chave_acesso: doc.chave_acesso,
                nuvemfiscal_document_id: doc.id,
                nsu: doc.nsu || null,
                schema: doc.schema || null,
                resumo: Boolean(doc.resumo),
                status: "pending",
                emitente_nome: doc.emitente_nome_razao_social || null,
                emitente_cnpj: doc.emitente_cpf_cnpj || null,
                data_emissao: doc.data_emissao || doc.data_evento || null,
                valor_total: doc.valor_nfe || null,
                metadata: doc,
                updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,chave_acesso" })
            .select("id")
            .single();

        if (upsertError) throw upsertError;

        return {
            success: true,
            inserted: 1,
            alreadyImported: false,
            found: true,
            queueId: queueItem?.id || null,
            resumo: Boolean(doc.resumo),
            codigoStatus: result.codigo_status ?? null,
            motivoStatus: result.motivo_status ?? null,
            cpfCnpj,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getNfeQueueXml(queueId: string) {
    try {
        const { organizationId, cpfCnpj } = await getOrgAndCompany();
        const supabaseAdmin = createAdminClient();
        const { data: queueItem, error } = await supabaseAdmin
            .from("nfe_import_queue")
            .select("*")
            .eq("id", queueId)
            .eq("organization_id", organizationId)
            .single();

        if (error) throw error;
        if (!queueItem) throw new Error("Nota nao encontrada na fila.");

        let xmlContent = queueItem.xml_content as string | null;
        const cachedXmlHasItems = xmlContent ? hasCompleteNfeItems(xmlContent) : false;
        if (!xmlContent || !cachedXmlHasItems) {
            if (!queueItem.nuvemfiscal_document_id) throw new Error("Documento sem identificador na Nuvem Fiscal.");
            const token = await getNuvemFiscalToken(NFE_ENVIRONMENT, "empresa nfe distribuicao-nfe");

            if ((queueItem.resumo || !cachedXmlHasItems) && queueItem.chave_acesso) {
                await manifestScience(cpfCnpj, queueItem.chave_acesso, token);
            }

            xmlContent = await downloadDocumentXml(queueItem.nuvemfiscal_document_id, token);
            const meta = extractNfeMetaFromXml(xmlContent);

            await supabaseAdmin
                .from("nfe_import_queue")
                .update({
                    xml_content: xmlContent,
                    resumo: !hasCompleteNfeItems(xmlContent),
                    numero: meta.numero || queueItem.numero,
                    serie: meta.serie || queueItem.serie,
                    emitente_nome: meta.emitente_nome || queueItem.emitente_nome,
                    emitente_cnpj: meta.emitente_cnpj || queueItem.emitente_cnpj,
                    data_emissao: meta.data_emissao || queueItem.data_emissao,
                    valor_total: meta.valor_total || queueItem.valor_total,
                    error_message: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", queueId);
        }

        if (!hasCompleteNfeItems(xmlContent)) {
            return {
                success: false,
                error: "Esta nota ainda veio como resumo. A ciencia da operacao foi enviada, mas o XML completo so deve ser tentado na proxima janela de consulta da SEFAZ. Aguarde cerca de 1 hora antes de clicar em Verificar novas emissoes novamente. Se tiver urgencia, copie a chave da nota e localize o XML manualmente.",
            };
        }

        return { success: true, xmlContent };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markNfeQueueImported(queueId?: string | null, chaveAcesso?: string) {
    try {
        const { organizationId } = await getOrgAndCompany();
        const supabaseAdmin = createAdminClient();
        let query = supabaseAdmin
            .from("nfe_import_queue")
            .update({
                status: "imported",
                imported_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId);

        if (queueId) {
            query = query.eq("id", queueId);
        } else if (chaveAcesso) {
            query = query.eq("chave_acesso", chaveAcesso);
        } else {
            throw new Error("Informe o item da fila ou a chave de acesso da NF-e.");
        }

        const { error } = await query;
        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
