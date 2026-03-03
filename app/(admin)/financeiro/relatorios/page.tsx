"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import {
    TrendingUp, CreditCard, Loader2, Wallet,
    PieChart, BarChart3, Activity
} from "lucide-react";

type ReportsData = {
    faturamento: { total_pecas: number; total_servicos: number };
    pagamentos: { metodo: string; total: number }[];
    despesas_categoria: { categoria: string; total: number }[];
    pendencias: { a_pagar: number; a_receber: number };
    os_finalizadas: number;
    top_vendas: { nome: string; tipo: 'peca' | 'servico'; quantidade: number; valor_total: number }[];
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix Remoto", pix_maquininha: "Pix na Maquininha",
    cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", cheque_pre: "Cheque", outros: "Outros"
};

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const fmt = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function RelatoriosDashboard() {
    const supabase = createClient();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(() => new Date().getMonth());
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [data, setData] = useState<ReportsData | null>(null);

    const fetchData = useCallback(async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        try {
            const { data: res, error } = await supabase.rpc('get_dashboard_metrics', {
                p_organization_id: profile.organization_id,
                p_month: month + 1,
                p_year: year
            });
            if (error) throw error;
            setData(res as ReportsData);
        } catch (err) {
            console.error("Erro ao buscar dados:", err);
        } finally {
            setLoading(false);
        }
    }, [profile, month, year, supabase]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalFat = (data?.faturamento.total_pecas || 0) + (data?.faturamento.total_servicos || 0);
    const totalDesp = data?.despesas_categoria.reduce((a, c) => a + c.total, 0) || 0;
    const lucro = totalFat - totalDesp;

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">Relatórios Analíticos</h1>
                    <p className="text-stone-500 text-sm">DRE gerencial e métricas de desempenho</p>
                </div>
                <div className="flex items-center bg-white border border-stone-300 rounded-lg shadow-sm overflow-hidden text-sm">
                    <select value={month} onChange={e => setMonth(+e.target.value)}
                        className="bg-transparent border-none outline-none font-bold text-stone-800 px-4 py-2 cursor-pointer">
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <div className="w-px h-6 bg-stone-300" />
                    <select value={year} onChange={e => setYear(+e.target.value)}
                        className="bg-transparent border-none outline-none font-bold text-stone-800 px-4 py-2 cursor-pointer">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-stone-400 mb-3" size={28} />
                    <p className="text-stone-500 text-sm">Carregando...</p>
                </div>
            ) : (
                <>
                    {/* RESULTADO DO PERÍODO */}
                    <div className="bg-[#1A1A1A] rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 text-white">
                        <div>
                            <p className="text-stone-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Activity size={13} /> Resultado do Período
                            </p>
                            <h2 className={`text-2xl font-black mt-1 ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(lucro)}</h2>
                        </div>
                        <div className="flex gap-6 text-sm">
                            <div className="text-center">
                                <p className="text-stone-400 text-[10px] font-bold uppercase">Faturamento</p>
                                <p className="font-bold text-white">{fmt(totalFat)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-stone-400 text-[10px] font-bold uppercase">Despesas</p>
                                <p className="font-bold text-red-400">{fmt(totalDesp)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-stone-400 text-[10px] font-bold uppercase">OS Entregues</p>
                                <p className="font-bold text-[#FACC15]">{data?.os_finalizadas || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* FATURAMENTO */}
                        <SectionCard title="Origem do Faturamento" icon={<TrendingUp size={15} />}>
                            <SimpleTable rows={[
                                ["Venda de Peças (Produtos)", fmt(data?.faturamento.total_pecas || 0)],
                                ["Mão de Obra (Serviços)", fmt(data?.faturamento.total_servicos || 0)],
                            ]} footer={["Faturamento Bruto Total", fmt(totalFat)]} />
                        </SectionCard>

                        {/* PENDÊNCIAS */}
                        <SectionCard title="Pendências do Mês" icon={<Wallet size={15} />}>
                            <SimpleTable rows={[
                                ["Contas a Receber", fmt(data?.pendencias.a_receber || 0), "text-yellow-700"],
                                ["Contas a Pagar", fmt(data?.pendencias.a_pagar || 0), "text-red-600"],
                            ]} />
                        </SectionCard>

                        {/* MEIOS DE PAGAMENTO */}
                        <SectionCard title="Entradas por Meio de Pagamento" icon={<CreditCard size={15} />}>
                            {data?.pagamentos && data.pagamentos.length > 0 ? (
                                <SimpleTable rows={data.pagamentos.map(p => [
                                    PAYMENT_LABELS[p.metodo] || p.metodo, fmt(p.total)
                                ])} />
                            ) : <EmptyMsg />}
                        </SectionCard>

                        {/* DESPESAS POR CATEGORIA */}
                        <SectionCard title="Despesas Pagas por Categoria" icon={<BarChart3 size={15} />}>
                            {data?.despesas_categoria && data.despesas_categoria.length > 0 ? (
                                <SimpleTable
                                    rows={data.despesas_categoria.map(c => [c.categoria, fmt(c.total), "text-red-600"])}
                                    footer={["Total de Despesas", fmt(totalDesp)]}
                                    footerClass="text-red-700"
                                />
                            ) : <EmptyMsg />}
                        </SectionCard>

                    </div>

                    {/* TOP VENDAS */}
                    <SectionCard title="Top Vendidos (Peças e Serviços)" icon={<PieChart size={15} />} badge="Top 10">
                        {data?.top_vendas && data.top_vendas.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-stone-200 text-xs uppercase text-stone-500 font-semibold tracking-wider">
                                        <tr>
                                            <th className="px-5 py-2.5 text-left">#</th>
                                            <th className="px-5 py-2.5 text-left">Item</th>
                                            <th className="px-5 py-2.5 text-left">Tipo</th>
                                            <th className="px-5 py-2.5 text-center">Qtd</th>
                                            <th className="px-5 py-2.5 text-right">Faturamento</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {data.top_vendas.map((item, i) => (
                                            <tr key={i} className="hover:bg-stone-50">
                                                <td className="px-5 py-2.5 font-bold text-stone-400">#{i + 1}</td>
                                                <td className="px-5 py-2.5 font-bold text-stone-800">{item.nome}</td>
                                                <td className="px-5 py-2.5">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.tipo === 'servico' ? 'bg-[#FACC15] text-[#1A1A1A]' : 'bg-stone-200 text-stone-700'}`}>
                                                        {item.tipo === 'servico' ? 'Serviço' : 'Peça'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-2.5 text-center text-stone-600">{item.quantidade}x</td>
                                                <td className="px-5 py-2.5 text-right font-bold text-stone-900">{fmt(item.valor_total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <EmptyMsg />}
                    </SectionCard>
                </>
            )}
        </div>
    );
}

/* ─── Componentes auxiliares compactos ─── */

function SectionCard({ title, icon, badge, children }: {
    title: string; icon: React.ReactNode; badge?: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                    <span className="text-stone-500">{icon}</span> {title}
                </h3>
                {badge && <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider bg-stone-200/60 px-2 py-0.5 rounded-full">{badge}</span>}
            </div>
            {children}
        </div>
    );
}

function SimpleTable({ rows, footer, footerClass }: {
    rows: string[][]; footer?: string[]; footerClass?: string;
}) {
    return (
        <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
                {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-stone-50">
                        <td className="px-5 py-3 text-stone-600 font-medium">{row[0]}</td>
                        <td className={`px-5 py-3 text-right font-bold ${row[2] || 'text-stone-900'}`}>{row[1]}</td>
                    </tr>
                ))}
                {footer && (
                    <tr className="bg-stone-50 border-t border-stone-200">
                        <td className="px-5 py-3 text-stone-800 font-bold">{footer[0]}</td>
                        <td className={`px-5 py-3 text-right font-black text-base ${footerClass || 'text-stone-900'}`}>{footer[1]}</td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function EmptyMsg() {
    return <div className="p-6 text-center text-sm text-stone-400">Nenhum dado neste período.</div>;
}
