import JSZip from "jszip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    pix: "Pix",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    cheque_pre: "Cheque",
    outros: "Outros"
};

export type ClosingData = {
    faturamento: { total_pecas: number; total_servicos: number };
    faturamento_por_cfop: { cfop: string; total: number }[];
    pagamentos: { metodo: string; total: number }[];
    fiscal: {
        autorizadas_nfse: number;
        canceladas_nfse: number;
        autorizadas_nfce: number;
        canceladas_nfce: number;
        entradas_qtd: number;
        entradas_valor: number;
        devolucoes_qtd: number;
        devolucoes_valor: number;
    };
};

async function fetchXmlText(xmlUrl: string): Promise<string | null> {
    try {
        const res = await fetch(xmlUrl);
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/**
 * @param month - 0-indexed (0 = Janeiro)
 */
export async function buildClosingZip(
    supabase: any,
    organizationId: string,
    month: number,
    year: number,
    data: ClosingData
): Promise<{ blob: Blob; folderName: string }> {
    const zip = new JSZip();
    const folderName = `Fechamento_${MONTHS[month]}_${year}`;
    const root = zip.folder(folderName);
    if (!root) throw new Error("Erro ao criar pasta no ZIP");

    const csvContent = [
        ["RELATORIO DE FECHAMENTO MENSAL"],
        ["Periodo", `${MONTHS[month]} / ${year}`],
        ["Empresa ID", organizationId],
        [""],
        ["FATURAMENTO"],
        ["Venda de Pecas", data.faturamento.total_pecas.toFixed(2)],
        ["Prestacao de Servicos", data.faturamento.total_servicos.toFixed(2)],
        ["Total Bruto", (data.faturamento.total_pecas + data.faturamento.total_servicos).toFixed(2)],
        [""],
        ["FATURAMENTO POR CFOP"],
        ...data.faturamento_por_cfop.map(c => [c.cfop, c.total.toFixed(2)]),
        [""],
        ["MOVIMENTACAO FISCAL"],
        ["NFS-e Emitidas (Servicos)", data.fiscal.autorizadas_nfse],
        ["NFC-e Emitidas (Pecas)", data.fiscal.autorizadas_nfce],
        ["Canceladas (NFS-e + NFC-e)", data.fiscal.canceladas_nfse + data.fiscal.canceladas_nfce],
        ["NFe Compras (Qtd)", data.fiscal.entradas_qtd],
        ["NFe Compras (Valor)", data.fiscal.entradas_valor.toFixed(2)],
        ["NF-e Devolucoes (Qtd)", data.fiscal.devolucoes_qtd],
        ["NF-e Devolucoes (Valor)", data.fiscal.devolucoes_valor.toFixed(2)],
        [""],
        ["MEIOS DE PAGAMENTO"],
        ...data.pagamentos.map(p => [PAYMENT_METHOD_LABELS[p.metodo] || p.metodo, p.total.toFixed(2)])
    ].map(e => e.join(";")).join("\n");
    root.file("Resumo_Fechamento.csv", "﻿" + csvContent);

    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(16);
    pdfDoc.text("Relatório de Fechamento Mensal", 14, 20);
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Período: ${MONTHS[month]} / ${year}`, 14, 28);
    pdfDoc.text(`Empresa ID: ${organizationId}`, 14, 34);
    autoTable(pdfDoc, {
        startY: 42,
        head: [["Faturamento", "Valor (R$)"]],
        body: [
            ["Venda de Peças (Produtos)", data.faturamento.total_pecas.toFixed(2)],
            ["Prestação de Serviços", data.faturamento.total_servicos.toFixed(2)],
            ["Total Bruto", (data.faturamento.total_pecas + data.faturamento.total_servicos).toFixed(2)],
        ]
    });
    autoTable(pdfDoc, {
        startY: (pdfDoc as any).lastAutoTable.finalY + 10,
        head: [["Faturamento por CFOP", "Valor (R$)"]],
        body: data.faturamento_por_cfop.map(c => [c.cfop === "5933" ? "5933 (Serviço)" : c.cfop, c.total.toFixed(2)])
    });
    autoTable(pdfDoc, {
        startY: (pdfDoc as any).lastAutoTable.finalY + 10,
        head: [["Movimentação Fiscal", "Quantidade / Valor"]],
        body: [
            ["NFS-e Emitidas (Serviços)", data.fiscal.autorizadas_nfse.toString()],
            ["NFC-e Emitidas (Peças)", data.fiscal.autorizadas_nfce.toString()],
            ["Canceladas (NFS-e + NFC-e)", (data.fiscal.canceladas_nfse + data.fiscal.canceladas_nfce).toString()],
            ["NFe Compras — Qtd", data.fiscal.entradas_qtd.toString()],
            ["NFe Compras — Valor (R$)", data.fiscal.entradas_valor.toFixed(2)],
            ["NF-e Devoluções — Qtd", data.fiscal.devolucoes_qtd.toString()],
            ["NF-e Devoluções — Valor (R$)", data.fiscal.devolucoes_valor.toFixed(2)],
        ]
    });
    autoTable(pdfDoc, {
        startY: (pdfDoc as any).lastAutoTable.finalY + 10,
        head: [["Meios de Pagamento", "Valor (R$)"]],
        body: data.pagamentos.map(p => [PAYMENT_METHOD_LABELS[p.metodo] || p.metodo, p.total.toFixed(2)])
    });
    root.file("Resumo_Fechamento.pdf", pdfDoc.output("arraybuffer"));

    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 1).toISOString();
    const baseFields = "id, direction, tipo_documento, xml_content, xml_url, chave_acesso, numero, status, motivo_rejeicao, error_message, data_emissao, created_at";

    const [{ data: datedFiles }, { data: fallbackFiles }] = await Promise.all([
        supabase.from("fiscal_invoices").select(baseFields)
            .eq("organization_id", organizationId).neq("environment", "homologation")
            .gte("data_emissao", startDate).lt("data_emissao", endDate),
        supabase.from("fiscal_invoices").select(baseFields)
            .eq("organization_id", organizationId).neq("environment", "homologation")
            .is("data_emissao", null).gte("created_at", startDate).lt("created_at", endDate),
    ]);

    const fiscalFiles: any[] = [...(datedFiles || []), ...(fallbackFiles || [])]
        .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);

    const rejectedDocs = fiscalFiles.filter(f => f.status === "rejected" || f.status === "error");
    const rejectedRows = [
        ["TIPO", "NUMERO", "STATUS", "MOTIVO", "CHAVE_ACESSO"],
        ...rejectedDocs.map(f => [
            f.tipo_documento || "",
            f.numero || "",
            f.status || "",
            (f.motivo_rejeicao || f.error_message || "").replace(/\r?\n/g, " "),
            f.chave_acesso || "",
        ])
    ];
    root.file("Numeracoes_Rejeitadas.csv", "\ufeff" + rejectedRows.map(r => r.join(";")).join("\n"));

    const { data: inutilizacoes } = await supabase
        .from("fiscal_inutilizations")
        .select("environment, model, year, serie, numero_inicial, numero_final, justificativa, protocol, external_id, status, response_json, created_at")
        .eq("organization_id", organizationId)
        .in("model", ["NFCe", "NFe"])
        .eq("environment", "production")
        .eq("year", year)
        .order("created_at", { ascending: false });

    const inutilRows = [
        ["MODELO", "AMBIENTE", "ANO", "SERIE", "NUMERO_INICIAL", "NUMERO_FINAL", "PROTOCOLO", "STATUS", "DATA", "JUSTIFICATIVA"],
        ...((inutilizacoes || []) as any[]).map(i => [
            i.model || "NFCe",
                i.environment === "production" ? "producao" : "homologacao",
            String(i.year),
            String(i.serie),
            String(i.numero_inicial),
            String(i.numero_final),
            i.protocol || "",
            i.status || "",
            new Date(i.created_at).toLocaleString("pt-BR"),
            (i.justificativa || "").replace(/\r?\n/g, " "),
        ])
    ];
    root.file("Inutilizacoes_Fiscais.csv", "\ufeff" + inutilRows.map(r => r.join(";")).join("\n"));

    if (inutilizacoes && inutilizacoes.length > 0) {
        const inutilFolder = root.folder("Inutilizacoes_Comprovantes");
        for (const i of inutilizacoes as any[]) {
            inutilFolder?.file(
                `${i.model || "NFCe"}_S${i.serie}_${i.numero_inicial}-${i.numero_final}_${i.year}.json`,
                JSON.stringify(i.response_json || {}, null, 2)
            );
        }
    }

    if (fiscalFiles.length > 0) {
        const outFolder = root.folder("XMLs_Saida_Vendas");
        const inFolder = root.folder("XMLs_Entrada_Compras");
        const cancelFolder = root.folder("XMLs_Cancelados");
        for (const f of fiscalFiles) {
            let xmlContent = f.xml_content;
            if (!xmlContent && f.xml_url) xmlContent = await fetchXmlText(f.xml_url);
            if (xmlContent) {
                const name = `${f.numero || f.chave_acesso || "doc"}.xml`;
                if (f.status === "cancelled" && cancelFolder) cancelFolder.file(`Cancelado_${name}`, xmlContent);
                else if (f.direction === "output" && outFolder) outFolder.file(name, xmlContent);
                else if (f.direction === "entry" && inFolder) inFolder.file(name, xmlContent);
            }
        }
    }

    return { blob: await zip.generateAsync({ type: "blob" }), folderName };
}
