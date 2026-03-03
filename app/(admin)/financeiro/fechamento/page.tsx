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
    FileText
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type ClosingData = {
    faturamento: {
        total_pecas: number;
        total_servicos: number;
    };
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
    };
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

    const handleExportZip = async () => {
        if (!profile?.organization_id || !data) return;
        setExporting(true);

        try {
            const zip = new JSZip();
            const folderName = `Fechamento_${MONTHS[month]}_${year}`;
            const root = zip.folder(folderName);

            if (!root) throw new Error("Erro ao criar pasta no ZIP");

            // 1. Gerar Relatório CSV de Resumo
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
                ["MOVIMENTACAO FISCAL"],
                ["NFS-e Emitidas (Servicos)", data.fiscal.autorizadas_nfse],
                ["NFC-e Emitidas (Pecas)", data.fiscal.autorizadas_nfce],
                ["Canceladas (NFS-e + NFC-e)", data.fiscal.canceladas_nfse + data.fiscal.canceladas_nfce],
                ["NFe Compras (Qtd)", data.fiscal.entradas_qtd],
                ["NFe Compras (Valor)", data.fiscal.entradas_valor.toFixed(2)],
                [""],
                ["MEIOS DE PAGAMENTO"],
                ...data.pagamentos.map(p => [PAYMENT_METHOD_LABELS[p.metodo] || p.metodo, p.total.toFixed(2)])
            ].map(e => e.join(";")).join("\n");

            root.file("Resumo_Fechamento.csv", "\ufeff" + csvContent);

            // 2. Buscar XMLs de Saída (NFC-e) - Versão Simplificada (links ou conteúdo se disponível)
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 1).toISOString();

            const { data: fiscalFiles } = await supabase
                .from('fiscal_invoices')
                .select('direction, xml_content, chave_acesso, numero, status')
                .eq('organization_id', profile.organization_id)
                .gte('data_emissao', startDate)
                .lt('data_emissao', endDate);

            if (fiscalFiles && fiscalFiles.length > 0) {
                const outFolder = root.folder("XMLs_Saida_Vendas");
                const inFolder = root.folder("XMLs_Entrada_Compras");

                fiscalFiles.forEach(doc => {
                    if (doc.xml_content) {
                        const fileName = `${doc.numero || doc.chave_acesso || 'doc'}.xml`;
                        if (doc.direction === 'output' && outFolder) {
                            outFolder.file(fileName, doc.xml_content);
                        } else if (doc.direction === 'entry' && inFolder) {
                            inFolder.file(fileName, doc.xml_content);
                        }
                    }
                });
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

    useEffect(() => {
        fetchClosingData();
    }, [fetchClosingData]);

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
                        disabled={exporting || loading}
                    >
                        {exporting ? <Loader2 className="animate-spin text-stone-300" size={16} /> : <FileArchive className="text-stone-300" size={16} />}
                        {exporting ? "Gerando ZIP..." : "Exportar Contabilidade (.zip)"}
                    </button>
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
