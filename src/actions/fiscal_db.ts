"use server";

import { createClient } from "@/src/utils/supabase/server";

export async function getPendingWorkOrders(organizationId: string) {
    const supabase = createClient();

    // Buscar OS com status 'pronto' ou 'entregue' que NÃO tenham nota fiscal vinculada
    // Como o Supabase não tem um "NOT IN" simples com subquery na JS lib, 
    // vamos buscar as OSs e filtrar (ou usar rpc se fosse performance crítica, mas aqui é ok)

    // 1. Buscar IDs de OS que já têm nota (exceto canceladas/erro)
    const { data: invoices } = await supabase
        .from('fiscal_invoices')
        .select('work_order_id')
        .eq('organization_id', organizationId)
        .not('work_order_id', 'is', null)
        .neq('status', 'error')
        .neq('status', 'cancelled');

    const invoiceOsIds = invoices?.map(i => i.work_order_id) || [];

    // 2. Buscar OSs candidatas
    let query = supabase
        .from('work_orders')
        .select(`
            id, created_at, total, status, client_id,
            clients (nome, cpf_cnpj),
            vehicles (placa, modelo)
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pronto', 'entregue'])
        .order('created_at', { ascending: false });

    if (invoiceOsIds.length > 0) {
        query = query.not('id', 'in', `(${invoiceOsIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Erro ao buscar OS pendentes:", error);
        return [];
    }

    return data;
}

export async function searchProducts(query: string) {
    const supabase = createClient();

    // Busca produtos por nome ou marca
    const { data, error } = await supabase
        .from('products')
        .select('id, nome, marca, preco_venda, ncm, cfop, unidade')
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

    // Busca serviços por nome
    const { data, error } = await supabase
        .from('services')
        .select('id, nome, price, codigo_servico, aliquota_iss')
        .ilike('nome', `%${query}%`)
        .limit(20);

    if (error) {
        console.error("Erro ao buscar serviços:", error);
        return [];
    }

    return data;
}

export async function getProductFiscalData(productId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('products')
        .select('ncm, cfop, unidade')
        .eq('id', productId)
        .single();

    if (error) return null;
    return data;
}

export async function getServiceFiscalData(serviceId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('services')
        .select('codigo_servico, aliquota_iss')
        .eq('id', serviceId)
        .single();

    if (error) return null;
    return data;
}

export async function getFiscalInvoices(organizationId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar notas fiscais:", error);
        return [];
    }

    return data;
}
