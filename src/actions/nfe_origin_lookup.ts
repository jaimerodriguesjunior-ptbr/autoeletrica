"use server";

import { getNfeQueueXml, searchNfeByAccessKey } from "@/src/actions/nfe_import_queue";
import { extractItemsFromInfNFe, extractItemsFromXmlContent, participantFromOriginEmit } from "@/src/lib/nfe_xml";
import { createClient } from "@/src/utils/supabase/server";

async function getInvoiceWithItemsLocal(invoiceId: string) {
    const supabase = createClient();
    const { data: invoice, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("tipo_documento", "NFe")
        .single();

    if (error || !invoice) return null;

    let xmlContent = invoice.xml_content as string | null;
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
        } catch {
            xmlContent = null;
        }
    }

    if (xmlContent) {
        const parsed = await extractItemsFromXmlContent(xmlContent);
        return {
            invoice: { ...invoice, xml_content: xmlContent },
            items: parsed.items,
            originParticipant: participantFromOriginEmit(parsed.infNFe?.emit),
        };
    }

    if (invoice.payload_json?.infNFe) {
        return {
            invoice,
            items: extractItemsFromInfNFe(invoice.payload_json.infNFe),
            originParticipant: participantFromOriginEmit(invoice.payload_json.infNFe?.emit),
        };
    }

    return { invoice, items: [], originParticipant: null };
}

export async function resolveEntryInvoiceByAccessKeyWithItemsAction(chaveAcesso: string) {
    const cleanKey = String(chaveAcesso || "").replace(/\D/g, "");
    if (!/^[0-9]{44}$/.test(cleanKey)) {
        return { success: false, error: "Informe uma chave de acesso válida com 44 dígitos." };
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado." };

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) {
        return { success: false, error: "Organização não encontrada." };
    }

    const { data: existingInvoice } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("chave_acesso", cleanKey)
        .maybeSingle();

    if (existingInvoice) {
        const data = await getInvoiceWithItemsLocal(existingInvoice.id);
        if (!data?.items?.length) {
            return { success: false, error: "NF-e localizada, mas sem XML completo para carregar os produtos." };
        }

        return { success: true, source: "imported", invoice: data.invoice, items: data.items, originParticipant: data.originParticipant };
    }

    const searchResult = await searchNfeByAccessKey(cleanKey);
    if (!searchResult.success) {
        return { success: false, error: searchResult.error || "Não foi possível consultar a NF-e pela chave." };
    }

    if (searchResult.alreadyImported && searchResult.invoice?.id) {
        const data = await getInvoiceWithItemsLocal(searchResult.invoice.id);
        if (!data?.items?.length) {
            return { success: false, error: "NF-e localizada, mas sem XML completo para carregar os produtos." };
        }

        return { success: true, source: "imported", invoice: data.invoice, items: data.items, originParticipant: data.originParticipant };
    }

    if (!searchResult.found || !searchResult.queueId) {
        return {
            success: false,
            error: searchResult.found
                ? "NF-e localizada, mas não foi possível abrir o XML agora."
                : "Nenhuma NF-e foi localizada para essa chave no CNPJ da empresa.",
        };
    }

    const xmlResult = await getNfeQueueXml(searchResult.queueId);
    if (!xmlResult.success || !xmlResult.xmlContent) {
        return {
            success: false,
            error: xmlResult.error || "A NF-e ainda não retornou XML completo. Tente novamente mais tarde.",
        };
    }

    const parsed = await extractItemsFromXmlContent(xmlResult.xmlContent);
    if (!parsed.items.length) {
        return { success: false, error: "XML localizado, mas não trouxe produtos para devolução." };
    }

    const ide = parsed.infNFe?.ide || {};
    const emit = parsed.infNFe?.emit || {};
    const total = parsed.infNFe?.total?.ICMSTot || {};

    return {
        success: true,
        source: "sefaz",
        invoice: {
            id: `access-key-${cleanKey}`,
            numero: ide.nNF ? String(ide.nNF) : null,
            emitente_nome: emit.xNome ? String(emit.xNome) : null,
            emitente_cnpj: emit.CNPJ ? String(emit.CNPJ) : null,
            valor_total: total.vNF ? Number(total.vNF) : null,
            data_emissao: ide.dhEmi ? String(ide.dhEmi) : null,
            chave_acesso: cleanKey,
        },
        items: parsed.items,
        originParticipant: participantFromOriginEmit(parsed.infNFe?.emit),
    };
}

export async function resolveEntryInvoiceXmlByAccessKeyAction(chaveAcesso: string) {
    const cleanKey = String(chaveAcesso || "").replace(/\D/g, "");
    if (!/^[0-9]{44}$/.test(cleanKey)) {
        return { success: false, error: "Informe uma chave de acesso válida com 44 dígitos." };
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado." };

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) {
        return { success: false, error: "Organização não encontrada." };
    }

    const { data: existingInvoice } = await supabase
        .from("fiscal_invoices")
        .select("id, xml_content, xml_url")
        .eq("organization_id", profile.organization_id)
        .eq("chave_acesso", cleanKey)
        .maybeSingle();

    if (existingInvoice?.xml_content) {
        return { success: true, xmlContent: existingInvoice.xml_content };
    }

    if (existingInvoice?.xml_url) {
        const response = await fetch(existingInvoice.xml_url);
        if (response.ok) {
            const xmlContent = await response.text();
            await supabase
                .from("fiscal_invoices")
                .update({ xml_content: xmlContent })
                .eq("id", existingInvoice.id);
            return { success: true, xmlContent };
        }
    }

    const searchResult = await searchNfeByAccessKey(cleanKey);
    if (!searchResult.success) {
        return { success: false, error: searchResult.error || "Não foi possível consultar a NF-e pela chave." };
    }

    if (searchResult.alreadyImported && searchResult.invoice?.id) {
        const data = await getInvoiceWithItemsLocal(searchResult.invoice.id);
        const xmlContent = data?.invoice?.xml_content;
        if (xmlContent) return { success: true, xmlContent };
    }

    if (!searchResult.found || !searchResult.queueId) {
        return {
            success: false,
            error: searchResult.found
                ? "NF-e localizada, mas não foi possível abrir o XML agora."
                : "Nenhuma NF-e foi localizada para essa chave no CNPJ da empresa.",
        };
    }

    const xmlResult = await getNfeQueueXml(searchResult.queueId);
    if (!xmlResult.success || !xmlResult.xmlContent) {
        return {
            success: false,
            error: xmlResult.error || "A NF-e ainda não retornou XML completo. Tente novamente mais tarde.",
        };
    }

    return { success: true, xmlContent: xmlResult.xmlContent };
}
