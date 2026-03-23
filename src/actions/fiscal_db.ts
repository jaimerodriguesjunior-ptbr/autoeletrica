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

    const invoicesByWorkOrder = new Map<number, { hasNFCe: boolean; hasNFSe: boolean }>();

    for (const invoice of invoices || []) {
        const current = invoicesByWorkOrder.get(invoice.work_order_id) || { hasNFCe: false, hasNFSe: false };

        if (invoice.tipo_documento === "NFCe") current.hasNFCe = true;
        if (invoice.tipo_documento === "NFSe") current.hasNFSe = true;

        invoicesByWorkOrder.set(invoice.work_order_id, current);
    }

    return workOrders
        .map((os) => {
            const itemSummary = itemsByWorkOrder.get(os.id) || { hasPecas: false, hasServicos: false };
            const invoiceSummary = invoicesByWorkOrder.get(os.id) || { hasNFCe: false, hasNFSe: false };

            const pending_documentos = [
                itemSummary.hasPecas && !invoiceSummary.hasNFCe ? "NFCe" : null,
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
