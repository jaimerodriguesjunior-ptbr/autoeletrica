export type WorkOrderFiscalInvoice = {
    id: string;
    tipo_documento: string;
    status: string;
    numero: string | null;
    error_message: string | null;
    payload_json?: any;
};

export const ACTIVE_FISCAL_STATUSES = ["authorized", "processing", "draft", "pending"];

// Compartilhado pela disponibilidade e pelo backend. Naturezas especiais de
// NF-e (remessa, retorno, devolucao etc.) nao consomem a venda dos produtos.
export function isProductSaleInvoice(invoice: { tipo_documento: string; payload_json?: any }) {
    if (invoice.tipo_documento === "NFCe") return true;
    if (invoice.tipo_documento !== "NFe") return false;
    let payload = invoice.payload_json;
    if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    const ide = payload?.infNFe?.ide;
    if (String(ide?.finNFe ?? 1) !== "1" || String(ide?.tpNF ?? 1) !== "1") return false;
    const nature = String(ide?.natOp || "").trim().toUpperCase();
    // Cadastro legado sem natureza: exigir conferencia em vez de liberar outra venda.
    return !nature || /^VENDA(?:\s|$)/.test(nature);
}

export type WorkOrderFiscalItem = {
    tipo: string;
    peca_cliente: boolean;
    total_price: number;
};

// As notas devem vir da mais recente para a mais antiga, no mesmo ambiente.
export function getWorkOrderFiscalCategories(items: WorkOrderFiscalItem[], invoices: WorkOrderFiscalInvoice[]) {
    return (["NFCe", "NFSe"] as const).map((type) => {
        const categoryItems = items.filter((item) => type === "NFCe"
            ? item.tipo === "peca" && !item.peca_cliente
            : item.tipo === "servico");
        const categoryInvoices = invoices.filter((invoice) => type === "NFCe"
            ? ["NFCe", "NFe"].includes(invoice.tipo_documento)
            : invoice.tipo_documento === "NFSe");
        const saleInvoices = categoryInvoices.filter((entry) => type === "NFSe" || isProductSaleInvoice(entry));

        return {
            type,
            label: type === "NFCe" ? "Produtos" : "Serviços",
            amount: categoryItems.reduce((total, item) => total + Number(item.total_price || 0), 0),
            hasItems: categoryItems.length > 0,
            invoices: categoryInvoices,
            authorized: saleInvoices.some((entry) => entry.status === "authorized"),
            processing: saleInvoices.some((entry) => entry.status !== "authorized" && ACTIVE_FISCAL_STATUSES.includes(entry.status)),
        };
    }).filter((category) => category.hasItems || category.invoices.length > 0);
}
