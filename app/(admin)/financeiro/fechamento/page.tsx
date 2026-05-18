"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import {
    Download,
    TrendingUp,
    Receipt,
    CreditCard,
    ArrowUpRight,
    Loader2,
    FileArchive,
    FileText,
    Mail,
    CheckCircle,
    AlertCircle,
    X
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getClosingLog } from "@/src/actions/closing_log";
import { inutilizarNumeracaoNFCe, listarInutilizacoesNFCe } from "@/src/actions/fiscal_emission";

type ClosingData = {
    faturamento: {
        total_pecas: number;
        total_servicos: number;
    };
    faturamento_por_cfop: {
        cfop: string;
        total: number;
    }[];
    pagamentos: {
        metodo: string;
        total: number;
    }[];
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

type InutilizacaoItem = {
    id: number;
    environment: "production" | "homologation";
    year: number;
    serie: number;
    numero_inicial: number;
    numero_final: number;
    justificativa: string;
    protocol: string | null;
    external_id: string | null;
    status: string | null;
    response_json: any;
    created_at: string;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    pix: "Pix",
    cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    cheque_pre: "Cheque",
    outros: "Outros"
};

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FechamentoMensal() {
    const supabase = createClient();
    const { profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getMonth();
    });
    const [year, setYear] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getFullYear();
    });

    const [data, setData] = useState<ClosingData | null>(null);

    const fetchXmlText = useCallback(async (xmlUrl?: string | null) => {
        if (!xmlUrl) return null;

        try {
            const response = await fetch(xmlUrl);
            if (!response.ok) return null;
            return await response.text();
        } catch (error) {
            console.warn("Nao foi possivel baixar XML para o ZIP:", error);
            return null;
        }
    }, []);

    const fetchClosingData = useCallback(async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        try {
            const { data: res, error } = await supabase.rpc('get_monthly_closing_data', {
                p_organization_id: profile.organization_id,
                p_month: month + 1,
                p_year: year
            });
            if (error) throw error;
            setData(res);
        } catch (err) {
            console.error("Erro ao buscar dados de fechamento:", err);
        } finally {
            setLoading(false);
        }
    }, [profile, month, year, supabase]);

    const [exporting, setExporting] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [invalidating, setInvalidating] = useState(false);
    const [invalidateEnvironment, setInvalidateEnvironment] = useState<"production" | "homologation">("production");
    const [invalidateSerie, setInvalidateSerie] = useState(2);
    const [invalidateStart, setInvalidateStart] = useState("");
    const [invalidateEnd, setInvalidateEnd] = useState("");
    const [invalidateReason, setInvalidateReason] = useState("Falha operacional no controle de numeracao, sem autorizacao de uso para os numeros informados.");
    const [inutilizacoes, setInutilizacoes] = useState<InutilizacaoItem[]>([]);

    type ClosingLog = { id?: string; year: number; month: number; sent_at: string; status: string; error_message: string | null } | null;
    const [closingLog, setClosingLog] = useState<ClosingLog>(null);
    const [bannerDismissed, setBannerDismissed] = useState(false);

    const refreshInutilizacoes = useCallback(async () => {
        if (!profile?.organization_id) return;
        const res = await listarInutilizacoesNFCe({
            organizationId: profile.organization_id,
            year,
            environment: invalidateEnvironment,
        });
        if (res.success) setInutilizacoes((res.data as InutilizacaoItem[]) || []);
    }, [profile?.organization_id, year, invalidateEnvironment]);

    const downloadInutilizacaoJson = (item: InutilizacaoItem) => {
        const blob = new Blob([JSON.stringify(item.response_json || {}, null, 2)], { type: "application/json;charset=utf-8" });
        saveAs(blob, `Inutilizacao_NFCe_S${item.serie}_${item.numero_inicial}-${item.numero_final}_${item.year}.json`);
    };

    const downloadInutilizacaoPdf = (item: InutilizacaoItem) => {
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("Comprovante de Inutilizacao de Numeracao NFC-e", 14, 18);
        doc.setFontSize(10);
        doc.text(`Empresa ID: ${profile?.organization_id || "-"}`, 14, 28);
        doc.text(`Ambiente: ${item.environment === "production" ? "Producao" : "Homologacao"}`, 14, 34);
        doc.text(`Ano: ${item.year}`, 14, 40);
        doc.text(`Serie: ${item.serie}`, 14, 46);
        doc.text(`Faixa: ${item.numero_inicial} a ${item.numero_final}`, 14, 52);
        doc.text(`Protocolo: ${item.protocol || "-"}`, 14, 58);
        doc.text(`Status: ${item.status || "-"}`, 14, 64);
        doc.text(`Data da solicitacao: ${new Date(item.created_at).toLocaleString("pt-BR")}`, 14, 70);
        autoTable(doc, {
            startY: 78,
            head: [["Campo", "Valor"]],
            body: [
                ["Justificativa", item.justificativa],
                ["ID externo", item.external_id || "-"],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [28, 25, 23] },
        });
        doc.save(`Comprovante_Inutilizacao_NFCe_S${item.serie}_${item.numero_inicial}-${item.numero_final}_${item.year}.pdf`);
    };

    const handleInvalidateNumbers = async () => {
        if (!profile?.organization_id) return;
        const start = parseInt(invalidateStart, 10);
        const end = parseInt(invalidateEnd, 10);
        if (!start || !end) {
            alert("Informe numero inicial e final para inutilizacao.");
            return;
        }
        if (end < start) {
            alert("Numero final deve ser maior ou igual ao inicial.");
            return;
        }
        if (!invalidateReason || invalidateReason.trim().length < 15) {
            alert("A justificativa deve ter no minimo 15 caracteres.");
            return;
        }

        const envLabel = invalidateEnvironment === "production" ? "producao" : "homologacao";
        if (!confirm(`Confirmar inutilizacao NFC-e serie ${invalidateSerie}, faixa ${start} a ${end}, ano ${year}, em ${envLabel}?`)) return;

        setInvalidating(true);
        try {
            const res = await inutilizarNumeracaoNFCe({
                organizationId: profile.organization_id,
                year,
                serie: invalidateSerie,
                numeroInicial: start,
                numeroFinal: end,
                justificativa: invalidateReason,
                environment: invalidateEnvironment,
            });

            if (!res.success) {
                alert(`Erro na inutilizacao: ${res.error}`);
                return;
            }

            const protocolo = res.data?.numero_protocolo || res.data?.autorizacao?.numero_protocolo || "N/A";
            const status = res.data?.status || res.data?.autorizacao?.status || "solicitado";
            alert(`Inutilizacao enviada com sucesso.\nStatus: ${status}\nProtocolo: ${protocolo}`);
            await refreshInutilizacoes();
        } catch (err: any) {
            alert("Erro ao inutilizar faixa: " + err.message);
        } finally {
            setInvalidating(false);
        }
    };

    const buildZipBlob = async (): Promise<{ blob: Blob; folderName: string }> => {
        if (!profile?.organization_id || !data) throw new Error("Dados não disponíveis");
        const zip = new JSZip();
        const folderName = `Fechamento_${MONTHS[month]}_${year}`;
        const root = zip.folder(folderName);
        if (!root) throw new Error("Erro ao criar pasta no ZIP");

        const csvContent = [
            ["RELATORIO DE FECHAMENTO MENSAL"],
            ["Periodo", `${MONTHS[month]} / ${year}`],
            ["Empresa ID", profile.organization_id],
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
        pdfDoc.text(`Empresa ID: ${profile.organization_id}`, 14, 34);
        autoTable(pdfDoc, {
            startY: 42,
            head: [['Faturamento', 'Valor (R$)']],
            body: [
                ['Venda de Peças (Produtos)', data.faturamento.total_pecas.toFixed(2)],
                ['Prestação de Serviços', data.faturamento.total_servicos.toFixed(2)],
                ['Total Bruto', (data.faturamento.total_pecas + data.faturamento.total_servicos).toFixed(2)],
            ]
        });
        autoTable(pdfDoc, {
            startY: (pdfDoc as any).lastAutoTable.finalY + 10,
            head: [['Faturamento por CFOP', 'Valor (R$)']],
            body: data.faturamento_por_cfop.map(c => [c.cfop === '5933' ? '5933 (Serviço)' : c.cfop, c.total.toFixed(2)])
        });
        autoTable(pdfDoc, {
            startY: (pdfDoc as any).lastAutoTable.finalY + 10,
            head: [['Movimentação Fiscal', 'Quantidade / Valor']],
            body: [
                ['NFS-e Emitidas (Serviços)', data.fiscal.autorizadas_nfse.toString()],
                ['NFC-e Emitidas (Peças)', data.fiscal.autorizadas_nfce.toString()],
                ['Canceladas (NFS-e + NFC-e)', (data.fiscal.canceladas_nfse + data.fiscal.canceladas_nfce).toString()],
                ['NFe Compras — Qtd', data.fiscal.entradas_qtd.toString()],
                ['NFe Compras — Valor (R$)', data.fiscal.entradas_valor.toFixed(2)],
                ['NF-e Devoluções — Qtd', data.fiscal.devolucoes_qtd.toString()],
                ['NF-e Devoluções — Valor (R$)', data.fiscal.devolucoes_valor.toFixed(2)],
            ]
        });
        autoTable(pdfDoc, {
            startY: (pdfDoc as any).lastAutoTable.finalY + 10,
            head: [['Meios de Pagamento', 'Valor (R$)']],
            body: data.pagamentos.map(p => [PAYMENT_METHOD_LABELS[p.metodo] || p.metodo, p.total.toFixed(2)])
        });
        root.file("Resumo_Fechamento.pdf", pdfDoc.output('arraybuffer'));

        const startDate = new Date(year, month, 1).toISOString();
        const endDate = new Date(year, month + 1, 1).toISOString();
        const baseFields = 'id, direction, tipo_documento, xml_content, xml_url, chave_acesso, numero, status, motivo_rejeicao, error_message, data_emissao, created_at';
        const [{ data: datedFiscalFiles }, { data: fallbackFiscalFiles }] = await Promise.all([
            supabase.from('fiscal_invoices').select(baseFields)
                .eq('organization_id', profile.organization_id).neq('environment', 'homologation')
                .gte('data_emissao', startDate).lt('data_emissao', endDate),
            supabase.from('fiscal_invoices').select(baseFields)
                .eq('organization_id', profile.organization_id).neq('environment', 'homologation')
                .is('data_emissao', null).gte('created_at', startDate).lt('created_at', endDate)
        ]);
        const fiscalFiles = [...(datedFiscalFiles || []), ...(fallbackFiscalFiles || [])]
            .filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
        const rejectedDocs = fiscalFiles.filter(d => d.status === "rejected" || d.status === "error");
        const rejectedRows = [
            ["TIPO", "NUMERO", "STATUS", "MOTIVO", "CHAVE_ACESSO"],
            ...rejectedDocs.map(d => [
                d.tipo_documento || "",
                d.numero || "",
                d.status || "",
                (d.motivo_rejeicao || d.error_message || "").replace(/\r?\n/g, " "),
                d.chave_acesso || "",
            ])
        ];
        root.file("Numeracoes_Rejeitadas.csv", "\ufeff" + rejectedRows.map(r => r.join(";")).join("\n"));

        const { data: inutilizacoesZip } = await supabase
            .from("fiscal_inutilizations")
            .select("environment, year, serie, numero_inicial, numero_final, justificativa, protocol, external_id, status, response_json, created_at")
            .eq("organization_id", profile.organization_id)
            .eq("model", "NFCe")
            .eq("environment", "production")
            .eq("year", year)
            .order("created_at", { ascending: false });

        const inutilRows = [
            ["AMBIENTE", "ANO", "SERIE", "NUMERO_INICIAL", "NUMERO_FINAL", "PROTOCOLO", "STATUS", "DATA", "JUSTIFICATIVA"],
            ...((inutilizacoesZip || []) as any[]).map(i => [
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
        root.file("Inutilizacoes_NFCe.csv", "\ufeff" + inutilRows.map(r => r.join(";")).join("\n"));

        if (inutilizacoesZip && inutilizacoesZip.length > 0) {
            const inutilFolder = root.folder("Inutilizacoes_Comprovantes");
            for (const i of inutilizacoesZip as any[]) {
                inutilFolder?.file(
                    `NFCe_S${i.serie}_${i.numero_inicial}-${i.numero_final}_${i.year}.json`,
                    JSON.stringify(i.response_json || {}, null, 2)
                );
            }
        }

        if (fiscalFiles.length > 0) {
            const outFolder = root.folder("XMLs_Saida_Vendas");
            const inFolder = root.folder("XMLs_Entrada_Compras");
            const cancelFolder = root.folder("XMLs_Cancelados");
            for (const d of fiscalFiles) {
                let xmlContent = d.xml_content;
                if (!xmlContent && d.xml_url) xmlContent = await fetchXmlText(d.xml_url);
                if (xmlContent) {
                    const xmlFileName = `${d.numero || d.chave_acesso || 'doc'}.xml`;
                    if (d.status === 'cancelled' && cancelFolder) cancelFolder.file(`Cancelado_${xmlFileName}`, xmlContent);
                    else if (d.direction === 'output' && outFolder) outFolder.file(xmlFileName, xmlContent);
                    else if (d.direction === 'entry' && inFolder) inFolder.file(xmlFileName, xmlContent);
                }
            }
        }
        return { blob: await zip.generateAsync({ type: "blob" }), folderName };
    };

    const handleExportZip = async () => {
        if (!profile?.organization_id || !data) return;
        setExporting(true);

        try {
            const zip = new JSZip();
            const folderName = `Fechamento_${MONTHS[month]}_${year}`;
            const root = zip.folder(folderName);

            if (!root) throw new Error("Erro ao criar pasta no ZIP");

            // 1. Gerar Relatório CSV de Resumo (Mantido como extra para importar no sistema)
            const csvContent = [
                ["RELATORIO DE FECHAMENTO MENSAL"],
                ["Periodo", `${MONTHS[month]} / ${year}`],
                ["Empresa ID", profile.organization_id],
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

            root.file("Resumo_Fechamento.csv", "\ufeff" + csvContent);

            // 1.5 Gerar Relatório PDF em alta qualidade
            const doc = new jsPDF();

            doc.setFontSize(16);
            doc.text("Relatório de Fechamento Mensal", 14, 20);

            doc.setFontSize(10);
            doc.text(`Período: ${MONTHS[month]} / ${year}`, 14, 28);
            doc.text(`Empresa ID: ${profile.organization_id}`, 14, 34);

            autoTable(doc, {
                startY: 42,
                head: [['Faturamento', 'Valor (R$)']],
                body: [
                    ['Venda de Peças (Produtos)', data.faturamento.total_pecas.toFixed(2)],
                    ['Prestação de Serviços', data.faturamento.total_servicos.toFixed(2)],
                    ['Total Bruto', (data.faturamento.total_pecas + data.faturamento.total_servicos).toFixed(2)],
                ]
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Faturamento por CFOP', 'Valor (R$)']],
                body: data.faturamento_por_cfop.map(c => [
                    c.cfop === '5933' ? '5933 (Serviço)' : c.cfop,
                    c.total.toFixed(2)
                ])
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Movimentação Fiscal', 'Quantidade/Valor']],
                body: [
                    ['NFS-e Emitidas (Serviços)', data.fiscal.autorizadas_nfse.toString()],
                    ['NFC-e Emitidas (Peças)', data.fiscal.autorizadas_nfce.toString()],
                    ['Canceladas (NFS-e + NFC-e)', (data.fiscal.canceladas_nfse + data.fiscal.canceladas_nfce).toString()],
                    ['NFe Compras (Qtd)', data.fiscal.entradas_qtd.toString()],
                    ['NFe Compras (Valor)', data.fiscal.entradas_valor.toFixed(2)],
                    ['NF-e Devoluções (Qtd)', data.fiscal.devolucoes_qtd.toString()],
                    ['NF-e Devoluções (Valor R$)', data.fiscal.devolucoes_valor.toFixed(2)],
                ]
            });

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['Meios de Pagamento', 'Valor (R$)']],
                body: data.pagamentos.map(p => [
                    PAYMENT_METHOD_LABELS[p.metodo] || p.metodo,
                    p.total.toFixed(2)
                ])
            });

            const pdfBuffer = doc.output('arraybuffer');
            root.file("Resumo_Fechamento.pdf", pdfBuffer);

            // 2. Buscar XMLs de Saída (NFC-e / NFS-e) e Entrada (NFe)
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 1).toISOString();

            const baseFields = 'id, direction, tipo_documento, xml_content, xml_url, chave_acesso, numero, status, motivo_rejeicao, error_message, data_emissao, created_at';
            const [{ data: datedFiscalFiles }, { data: fallbackFiscalFiles }] = await Promise.all([
                supabase
                    .from('fiscal_invoices')
                    .select(baseFields)
                    .eq('organization_id', profile.organization_id)
                    .neq('environment', 'homologation')
                    .gte('data_emissao', startDate)
                    .lt('data_emissao', endDate),
                supabase
                    .from('fiscal_invoices')
                    .select(baseFields)
                    .eq('organization_id', profile.organization_id)
                    .neq('environment', 'homologation')
                    .is('data_emissao', null)
                    .gte('created_at', startDate)
                    .lt('created_at', endDate)
            ]);

            const fiscalFiles = [...(datedFiscalFiles || []), ...(fallbackFiscalFiles || [])]
                .filter((doc, index, array) => array.findIndex(item => item.id === doc.id) === index);

            const rejectedDocs = fiscalFiles.filter(doc => doc.status === "rejected" || doc.status === "error");
            const rejectedRows = [
                ["TIPO", "NUMERO", "STATUS", "MOTIVO", "CHAVE_ACESSO"],
                ...rejectedDocs.map(doc => [
                    doc.tipo_documento || "",
                    doc.numero || "",
                    doc.status || "",
                    (doc.motivo_rejeicao || doc.error_message || "").replace(/\r?\n/g, " "),
                    doc.chave_acesso || "",
                ])
            ];
            root.file("Numeracoes_Rejeitadas.csv", "\ufeff" + rejectedRows.map(r => r.join(";")).join("\n"));

            const { data: inutilizacoesZip } = await supabase
                .from("fiscal_inutilizations")
                .select("environment, year, serie, numero_inicial, numero_final, justificativa, protocol, external_id, status, response_json, created_at")
                .eq("organization_id", profile.organization_id)
                .eq("model", "NFCe")
                .eq("environment", "production")
                .eq("year", year)
                .order("created_at", { ascending: false });

            const inutilRows = [
                ["AMBIENTE", "ANO", "SERIE", "NUMERO_INICIAL", "NUMERO_FINAL", "PROTOCOLO", "STATUS", "DATA", "JUSTIFICATIVA"],
                ...((inutilizacoesZip || []) as any[]).map(i => [
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
            root.file("Inutilizacoes_NFCe.csv", "\ufeff" + inutilRows.map(r => r.join(";")).join("\n"));

            if (inutilizacoesZip && inutilizacoesZip.length > 0) {
                const inutilFolder = root.folder("Inutilizacoes_Comprovantes");
                for (const i of inutilizacoesZip as any[]) {
                    inutilFolder?.file(
                        `NFCe_S${i.serie}_${i.numero_inicial}-${i.numero_final}_${i.year}.json`,
                        JSON.stringify(i.response_json || {}, null, 2)
                    );
                }
            }

            if (fiscalFiles.length > 0) {
                const outFolder = root.folder("XMLs_Saida_Vendas");
                const inFolder = root.folder("XMLs_Entrada_Compras");
                const cancelFolder = root.folder("XMLs_Cancelados");

                for (const doc of fiscalFiles) {
                    let xmlContent = doc.xml_content;
                    if (!xmlContent && doc.xml_url) {
                        xmlContent = await fetchXmlText(doc.xml_url);
                    }

                    if (xmlContent) {
                        const fileName = `${doc.numero || doc.chave_acesso || 'doc'}.xml`;
                        if (doc.status === 'cancelled' && cancelFolder) {
                            cancelFolder.file(`Cancelado_${fileName}`, xmlContent);
                        } else if (doc.direction === 'output' && outFolder) {
                            outFolder.file(fileName, xmlContent);
                        } else if (doc.direction === 'entry' && inFolder) {
                            inFolder.file(fileName, xmlContent);
                        }
                    }
                }
            }

            // 3. Gerar o arquivo final
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `${folderName}.zip`);

        } catch (err) {
            console.error("Erro ao exportar ZIP:", err);
            alert("Erro ao gerar o pacote. Verifique o console.");
        } finally {
            setExporting(false);
        }
    };

    const handleSendEmailContador = async (isAuto = false) => {
        if (sendingEmail) return;
        setSendingEmail(true);
        const period = { year, month: month + 1 };
        try {
            const { blob, folderName } = await buildZipBlob();
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const res = await fetch("/api/email/zip-contador", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ zipBase64: base64, fileName: `${folderName}.zip`, year: period.year, month: period.month }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Erro ao enviar");
            const updatedLog = await getClosingLog(period.year, period.month);
            setClosingLog(updatedLog);
            setBannerDismissed(false);
            if (!isAuto) alert("E-mail enviado com sucesso para o contador!");
        } catch (err: any) {
            console.error("Erro ao enviar e-mail para o contador:", err);
            const updatedLog = await getClosingLog(period.year, period.month);
            setClosingLog(updatedLog ?? { year: period.year, month: period.month, sent_at: new Date().toISOString(), status: 'error', error_message: err.message || "Erro ao enviar" });
            setBannerDismissed(false);
            if (!isAuto) alert(err.message || "Erro ao enviar e-mail.");
        } finally {
            setSendingEmail(false);
        }
    };

    useEffect(() => {
        fetchClosingData();
    }, [fetchClosingData]);

    useEffect(() => {
        refreshInutilizacoes();
    }, [refreshInutilizacoes]);

    useEffect(() => {
        if (!profile?.organization_id) return;
        getClosingLog(year, month + 1).then(log => {
            setClosingLog(log);
            setBannerDismissed(false);
        });
    }, [profile, year, month]);

    const totalGeral = (data?.faturamento.total_pecas || 0) + (data?.faturamento.total_servicos || 0);

    return (
        <div className="max-w-6xl mx-auto pb-12 px-4 sm:px-6 lg:px-8 pt-8">
            {/* Header com Controles e Botão */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 border-b border-stone-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Fechamento de Caixa Mensal</h1>
                    <p className="text-stone-500 text-sm mt-1">Resumo consolidado financeiro e fiscal para envio à contabilidade.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center bg-white border border-stone-300 rounded-md shadow-sm overflow-hidden text-sm">
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="bg-transparent border-none outline-none font-medium text-stone-800 px-3 py-1.5 cursor-pointer hover:bg-stone-50 transition"
                        >
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <div className="w-px h-5 bg-stone-300"></div>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="bg-transparent border-none outline-none font-medium text-stone-800 px-3 py-1.5 cursor-pointer hover:bg-stone-50 transition"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-4 py-1.5 rounded-md font-medium text-sm shadow-sm transition-colors disabled:opacity-70"
                        onClick={handleExportZip}
                        disabled={exporting || sendingEmail || loading}
                    >
                        {exporting ? <Loader2 className="animate-spin text-stone-300" size={16} /> : <FileArchive className="text-stone-300" size={16} />}
                        {exporting ? "Gerando ZIP..." : "Exportar (.zip)"}
                    </button>
                    <button
                        className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-1.5 rounded-md font-medium text-sm shadow-sm transition-colors disabled:opacity-70"
                        onClick={() => handleSendEmailContador()}
                        disabled={exporting || sendingEmail || loading}
                        title="Envia o ZIP de contabilidade para o e-mail do contador cadastrado nas configurações"
                    >
                        {sendingEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                        {sendingEmail ? "Enviando..." : "Enviar para Contador"}
                    </button>
                </div>
            </div>

            {closingLog && !bannerDismissed && (
                <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-4 text-sm font-medium ${
                    closingLog.status === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {closingLog.status === 'success'
                            ? <CheckCircle size={16} />
                            : <AlertCircle size={16} />
                        }
                        <span>
                            {closingLog.status === 'success'
                                ? `Fechamento de ${MONTHS[closingLog.month - 1]}/${closingLog.year} enviado ao contador em ${new Date(closingLog.sent_at).toLocaleString('pt-BR')}.`
                                : `Erro ao enviar fechamento de ${MONTHS[closingLog.month - 1]}/${closingLog.year}: ${closingLog.error_message || 'Erro desconhecido'}`
                            }
                        </span>
                    </div>
                    <button
                        onClick={() => setBannerDismissed(true)}
                        className="ml-4 hover:opacity-70 transition-opacity"
                        title="Fechar"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-4 mb-6">
                <div className="flex flex-col gap-1 mb-3">
                    <h2 className="text-sm font-bold text-stone-900">Inutilizacao de Numeracao NFC-e</h2>
                    <p className="text-xs text-stone-500">
                        Envia a solicitacao para a Nuvem Fiscal e guarda o comprovante para o ZIP do contador.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <select
                        value={invalidateEnvironment}
                        onChange={(e) => setInvalidateEnvironment(e.target.value as "production" | "homologation")}
                        className="border border-stone-300 rounded-md px-3 py-2 text-sm bg-white"
                    >
                        <option value="production">Producao</option>
                        <option value="homologation">Homologacao</option>
                    </select>
                    <input
                        type="number"
                        min={1}
                        value={invalidateSerie}
                        onChange={(e) => setInvalidateSerie(parseInt(e.target.value || "0", 10))}
                        className="border border-stone-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Serie"
                    />
                    <input
                        type="number"
                        min={1}
                        value={invalidateStart}
                        onChange={(e) => setInvalidateStart(e.target.value)}
                        className="border border-stone-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Numero inicial"
                    />
                    <input
                        type="number"
                        min={1}
                        value={invalidateEnd}
                        onChange={(e) => setInvalidateEnd(e.target.value)}
                        className="border border-stone-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Numero final"
                    />
                    <button
                        onClick={handleInvalidateNumbers}
                        disabled={invalidating || !profile?.organization_id}
                        className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md font-medium text-sm disabled:opacity-60"
                    >
                        {invalidating ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                        {invalidating ? "Enviando..." : "Inutilizar"}
                    </button>
                </div>
                <textarea
                    value={invalidateReason}
                    onChange={(e) => setInvalidateReason(e.target.value)}
                    className="mt-3 w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Justificativa"
                />
                <div className="mt-4 border-t border-stone-100 pt-3">
                    <p className="text-xs font-bold text-stone-700 mb-2">
                        Comprovantes salvos ({invalidateEnvironment === "production" ? "producao" : "homologacao"})
                    </p>
                    {inutilizacoes.length === 0 ? (
                        <p className="text-xs text-stone-500">Nenhuma inutilizacao salva para {year} neste ambiente.</p>
                    ) : (
                        <div className="space-y-2">
                            {inutilizacoes.map((item) => (
                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-stone-200 px-3 py-2">
                                    <div>
                                        <p className="text-sm font-semibold text-stone-800">
                                            Serie {item.serie} - {item.numero_inicial} a {item.numero_final}
                                        </p>
                                        <p className="text-xs text-stone-500">
                                            Protocolo: {item.protocol || "-"} - Status: {item.status || "-"} - {new Date(item.created_at).toLocaleString("pt-BR")}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => downloadInutilizacaoPdf(item)}
                                            className="px-3 py-1.5 rounded-md bg-stone-900 text-white text-xs font-semibold"
                                        >
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => downloadInutilizacaoJson(item)}
                                            className="px-3 py-1.5 rounded-md bg-stone-100 text-stone-800 text-xs font-semibold"
                                        >
                                            JSON
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-stone-50 rounded-lg border border-stone-200 border-dashed">
                    <Loader2 className="animate-spin text-stone-400 mb-3" size={28} />
                    <p className="text-stone-500 font-medium text-sm">Buscando dados no sistema...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Destaque: Base Simples Nacional */}
                    <div className="col-span-1 md:col-span-2 bg-[#1A1A1A] rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between text-white shadow-sm border border-black gap-4">
                        <div>
                            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                                <FileText size={14} /> Receita Bruta Total
                            </p>
                            <h2 className="text-3xl font-black tracking-tight">
                                <span className="text-stone-500 text-xl font-medium mr-2">R$</span>
                                {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                            <p className="text-stone-400 text-xs mt-1">
                                Valor a ser utilizado como Base de Cálculo para apuração do DAS (Simples Nacional / MEI).
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Faturamento Detalhado */}
                        <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-stone-50 px-5 py-3 border-b border-stone-200">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-stone-500" /> Origem do Faturamento
                                </h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-stone-100">
                                        <tr className="hover:bg-stone-50">
                                            <td className="px-5 py-3 text-stone-600 font-medium">Venda de Peças (Produtos)</td>
                                            <td className="px-5 py-3 text-right font-bold text-stone-900">
                                                R$ {data?.faturamento.total_pecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="px-5 py-3 text-stone-600 font-medium">Prestação de Serviços</td>
                                            <td className="px-5 py-3 text-right font-bold text-stone-900">
                                                R$ {data?.faturamento.total_servicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr className="bg-stone-50">
                                            <td className="px-5 py-3 text-stone-800 font-bold">Total Bruto</td>
                                            <td className="px-5 py-3 text-right font-black text-stone-900 text-base">
                                                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Faturamento por CFOP */}
                        <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-stone-50 px-5 py-3 border-b border-stone-200">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                    <FileText size={16} className="text-stone-500" /> Faturamento por CFOP
                                </h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-white border-b border-stone-100 text-left text-xs uppercase text-stone-500 font-semibold tracking-wider">
                                        <tr>
                                            <th className="px-5 py-3">Código</th>
                                            <th className="px-5 py-3 text-right">Valor Consolidado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {data?.faturamento_por_cfop?.map((c, idx) => (
                                            <tr key={idx} className="hover:bg-stone-50">
                                                <td className="px-5 py-3 text-stone-700 font-medium">
                                                    {c.cfop === '5933' ? '5933 (Serviço)' : c.cfop}
                                                </td>
                                                <td className="px-5 py-3 text-right font-bold text-stone-900">
                                                    R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Movimentação Fiscal */}
                        <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-stone-50 px-5 py-3 border-b border-stone-200">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                    <Receipt size={16} className="text-stone-500" /> Resumo Fiscal (NF)
                                </h3>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-stone-100">
                                        <tr className="hover:bg-stone-50">
                                            <td className="px-5 py-3 text-stone-600 font-medium">NFS-e Emitidas (Serviços)</td>
                                            <td className="px-5 py-3 text-right font-bold text-stone-900">{data?.fiscal.autorizadas_nfse || 0} doc(s)</td>
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="px-5 py-3 text-stone-600 font-medium">NFC-e Emitidas (Peças/Produtos)</td>
                                            <td className="px-5 py-3 text-right font-bold text-stone-900">{data?.fiscal.autorizadas_nfce || 0} doc(s)</td>
                                        </tr>
                                        <tr className="hover:bg-stone-50 text-xs">
                                            <td className="px-5 py-2 text-stone-400 font-medium">Total Canceladas</td>
                                            <td className="px-5 py-2 text-right font-bold text-red-400">{(data?.fiscal.canceladas_nfse || 0) + (data?.fiscal.canceladas_nfce || 0)} doc(s)</td>
                                        </tr>
                                        <tr className="hover:bg-stone-50">
                                            <td className="px-5 py-3 text-stone-600 font-medium">NF-e Compras (Importadas do Fornecedor)</td>
                                            <td className="px-5 py-3 text-right font-bold text-stone-900">{data?.fiscal.entradas_qtd} doc(s)</td>
                                        </tr>
                                        <tr className="bg-stone-50 border-t-2 border-stone-200">
                                            <td className="px-5 py-3 text-stone-800 font-bold">Valor Total em Compras (XML Entrada)</td>
                                            <td className="px-5 py-3 text-right font-black text-stone-900 text-base">
                                                R$ {data?.fiscal.entradas_valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Meios de Pagamento */}
                        <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden h-full flex flex-col">
                            <div className="bg-stone-50 px-5 py-3 border-b border-stone-200">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                                    <CreditCard size={16} className="text-stone-500" /> Recebimentos por Meio de Pagamento
                                </h3>
                            </div>
                            <div className="p-0 flex-1">
                                {data?.pagamentos && data.pagamentos.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead className="bg-white border-b border-stone-100 text-left text-xs uppercase text-stone-500 font-semibold tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Meio</th>
                                                <th className="px-5 py-3 text-right">Valor Consolidado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {data.pagamentos.map((pag, idx) => (
                                                <tr key={idx} className="hover:bg-stone-50">
                                                    <td className="px-5 py-3 text-stone-700 font-medium capitalize">
                                                        {PAYMENT_METHOD_LABELS[pag.metodo] || pag.metodo}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-stone-900">
                                                        R$ {pag.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-sm text-stone-500">
                                        Nenhuma movimentação para este período.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
