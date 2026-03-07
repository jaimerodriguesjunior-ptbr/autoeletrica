"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    Loader2, CheckCircle, Clock, AlertCircle,
    FileText, DollarSign, Wrench, Package,
    ChevronDown, ChevronUp, MessageCircle, Car
} from "lucide-react";

const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatarData = (dateStr: string) => {
    if (!dateStr) return '';
    // Se for apenas data YYYY-MM-DD, força meio-dia para evitar problemas de fuso no new Date()
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix", pix_maquininha: "Pix Maquininha",
    cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", cheque_pre: "Cheque", outros: "Outros"
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    entregue: { label: "Entregue", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle },
    em_execucao: { label: "Em Execução", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Wrench },
    aguardando: { label: "Aguardando", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
    aprovado: { label: "Aprovado", color: "text-indigo-600 bg-indigo-50 border-indigo-200", icon: CheckCircle },
    cancelado: { label: "Cancelado", color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle },
    pronto: { label: "Pronto", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle },
};

function ConteudoExtrato() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [data, setData] = useState<any>(null);
    const [osExpandida, setOsExpandida] = useState<string | null>(null);
    const [mesesVisiveis, setMesesVisiveis] = useState(1); // Quantos meses mostrar

    useEffect(() => {
        if (token) {
            fetchExtrato();
        } else {
            setErro("Link inválido ou expirado.");
            setLoading(false);
        }
    }, [token]);

    const fetchExtrato = async () => {
        try {
            const res = await fetch(`/api/portal/extrato?token=${encodeURIComponent(token!)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Erro ao buscar dados.");
            setData(json);
        } catch (error: any) {
            setErro(error.message || "Não foi possível carregar o extrato.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8F7F2] flex flex-col items-center justify-center gap-3">
                <Loader2 className="animate-spin text-[#1A1A1A]" size={32} />
                <p className="text-stone-500 text-sm font-medium">Carregando extrato...</p>
            </div>
        );
    }

    if (erro) {
        return (
            <div className="min-h-screen bg-[#F8F7F2] flex flex-col items-center justify-center gap-3 px-6">
                <AlertCircle size={40} className="text-red-400" />
                <p className="text-stone-700 font-bold text-center">{erro}</p>
                <p className="text-stone-400 text-xs text-center">Verifique se o link foi enviado corretamente.</p>
            </div>
        );
    }

    const { client, empresa, workOrders, transactions, resumo } = data;

    const getTransacoesOS = (woId: string) => transactions.filter((t: any) => t.work_order_id === woId);

    return (
        <div className="min-h-screen bg-[#F8F7F2]">
            {/* HEADER */}
            <div className="bg-[#1A1A1A] text-white px-6 py-8">
                <div className="max-w-lg mx-auto">
                    {empresa?.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={empresa.logo_url} alt="Logo" className="h-10 mb-4 brightness-0 invert" />
                    )}
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-1">Extrato do Cliente</p>
                    <h1 className="text-2xl font-black">{client.nome}</h1>
                    {empresa?.nome_fantasia && (
                        <p className="text-xs text-stone-400 mt-1">{empresa.nome_fantasia}</p>
                    )}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

                {/* RESUMO FINANCEIRO */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border-2 border-stone-200 rounded-2xl p-4 text-center shadow-sm">
                        <p className="text-[9px] uppercase font-bold text-stone-400 tracking-wider">Total Serviços</p>
                        <p className="text-lg font-black text-[#1A1A1A] mt-1">{fmt(resumo.totalServicos)}</p>
                    </div>
                    <div className="bg-white border-2 border-green-200 rounded-2xl p-4 text-center shadow-sm">
                        <p className="text-[9px] uppercase font-bold text-green-500 tracking-wider">Total Pago</p>
                        <p className="text-lg font-black text-green-600 mt-1">{fmt(resumo.totalPago)}</p>
                    </div>
                    <div className={`border-2 rounded-2xl p-4 text-center shadow-sm ${resumo.totalPendente > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-stone-200'}`}>
                        <p className={`text-[9px] uppercase font-bold tracking-wider ${resumo.totalPendente > 0 ? 'text-orange-500' : 'text-stone-400'}`}>Saldo Devedor</p>
                        <p className={`text-lg font-black mt-1 ${resumo.totalPendente > 0 ? 'text-orange-600' : 'text-stone-400'}`}>{fmt(resumo.totalPendente)}</p>
                    </div>
                </div>

                {/* SEPARAR OS: PENDENTES vs QUITADAS */}
                {(() => {
                    // Classificar cada OS
                    const osPendentes: any[] = [];
                    const osQuitadas: any[] = [];

                    workOrders.forEach((wo: any) => {
                        const txOS = getTransacoesOS(wo.id);
                        const totalPagoOS = txOS.filter((t: any) => t.status === 'paid').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                        const pendente = (wo.total || 0) - totalPagoOS;

                        if (pendente > 0) {
                            osPendentes.push(wo);
                        } else {
                            osQuitadas.push(wo);
                        }
                    });

                    // Agrupar quitadas por mês
                    const quitadasPorMes: Record<string, any[]> = {};
                    osQuitadas.forEach((wo: any) => {
                        const d = new Date(wo.created_at);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        if (!quitadasPorMes[key]) quitadasPorMes[key] = [];
                        quitadasPorMes[key].push(wo);
                    });

                    const mesesOrdenados = Object.keys(quitadasPorMes).sort((a, b) => b.localeCompare(a));
                    const mesesParaMostrar = mesesOrdenados.slice(0, mesesVisiveis);
                    const temMaisMeses = mesesOrdenados.length > mesesVisiveis;

                    const MESES_PT: Record<string, string> = {
                        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
                        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
                        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
                    };

                    const renderCard = (wo: any, destacar?: boolean) => {
                        const statusInfo = STATUS_LABELS[wo.status] || { label: wo.status, color: "text-stone-600 bg-stone-50 border-stone-200", icon: Clock };
                        const StatusIcon = statusInfo.icon;
                        const txOS = getTransacoesOS(wo.id);
                        const totalPagoOS = txOS.filter((t: any) => t.status === 'paid').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                        const totalPendenteOS = txOS.filter((t: any) => t.status === 'pending').reduce((s: number, t: any) => s + (t.amount || 0), 0);
                        const isExpanded = osExpandida === wo.id;
                        const proximoPendente = txOS.filter((t: any) => t.status === 'pending').sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

                        return (
                            <div key={wo.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${destacar ? 'border-orange-300' : 'border-stone-200'}`}>
                                <button
                                    onClick={() => setOsExpandida(isExpanded ? null : wo.id)}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-stone-50 transition"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}>
                                                <StatusIcon size={10} /> {statusInfo.label}
                                            </span>
                                            <span className="text-[10px] text-stone-400">
                                                {formatarData(wo.created_at)}
                                            </span>
                                        </div>
                                        <p className="font-bold text-[#1A1A1A] text-sm truncate">
                                            {wo.description || `OS #${String(wo.id).slice(0, 6)}`}
                                        </p>
                                        {wo.vehicles && (
                                            <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                                <Car size={10} /> {wo.vehicles.modelo} • {wo.vehicles.placa}
                                            </p>
                                        )}
                                        {/* STATUS DE PAGAMENTO */}
                                        {wo.status !== 'cancelado' && txOS.length > 0 && (
                                            <div className="mt-1.5">
                                                {totalPendenteOS > 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                                        <Clock size={10} />
                                                        Pendente: {fmt(totalPendenteOS)}
                                                        {proximoPendente && ` — vence ${formatarData(proximoPendente.date)}`}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                                        <CheckCircle size={10} /> Pago
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {wo.status !== 'cancelado' && txOS.length === 0 && wo.status === 'entregue' && (
                                            <div className="mt-1.5">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-400 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full">
                                                    <AlertCircle size={10} /> Sem pagamento registrado
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right ml-3 flex-shrink-0">
                                        <p className="font-black text-[#1A1A1A]">{fmt(wo.total)}</p>
                                        {isExpanded ? <ChevronUp size={16} className="text-stone-400 ml-auto" /> : <ChevronDown size={16} className="text-stone-400 ml-auto" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-stone-200 px-4 pb-4 space-y-3 animate-in slide-in-from-top-1">
                                        {wo.work_order_items && wo.work_order_items.length > 0 && (
                                            <div className="pt-3">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Itens do Serviço</p>
                                                <div className="space-y-1.5">
                                                    {wo.work_order_items.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-2">
                                                                {item.tipo === 'servico' ? <Wrench size={12} className="text-yellow-500" /> : <Package size={12} className="text-stone-400" />}
                                                                <span className={`text-stone-700 ${item.peca_cliente ? 'line-through opacity-50' : ''}`}>
                                                                    {item.name}
                                                                </span>
                                                                {item.peca_cliente && <span className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-bold">PEÇA CLIENTE</span>}
                                                            </div>
                                                            <span className={`font-bold ${item.peca_cliente ? 'text-stone-300' : 'text-[#1A1A1A]'}`}>
                                                                {fmt(item.total_price)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {txOS.length > 0 && (
                                            <div className="pt-2 border-t border-stone-100">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Pagamentos</p>
                                                <div className="space-y-1.5">
                                                    {txOS.map((tx: any) => {
                                                        const isPaid = tx.status === 'paid';
                                                        const isOverdue = !isPaid && new Date(tx.date).getTime() < new Date(new Date().toISOString().split('T')[0]).getTime();

                                                        let statusLabel = "Pago";
                                                        if (!isPaid) {
                                                            statusLabel = isOverdue ? "Vencido em" : "Previsto para";
                                                        }

                                                        return (
                                                            <div key={tx.id} className="flex justify-between items-center text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    {isPaid ? (
                                                                        <CheckCircle size={12} className="text-green-500" />
                                                                    ) : isOverdue ? (
                                                                        <AlertCircle size={12} className="text-red-500" />
                                                                    ) : (
                                                                        <Clock size={12} className="text-yellow-500" />
                                                                    )}
                                                                    <span className="text-stone-600">
                                                                        {statusLabel}
                                                                    </span>
                                                                    <span className="text-[10px] text-stone-400">
                                                                        {formatarData(tx.date)}
                                                                    </span>
                                                                </div>
                                                                {!isPaid ? (
                                                                    <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                        {fmt(tx.amount)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="font-bold text-green-600">
                                                                        {fmt(tx.amount)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {txOS.length === 0 && wo.status !== 'cancelado' && (
                                            <div className="pt-2 border-t border-stone-100">
                                                <p className="text-xs text-stone-400 italic text-center py-2">
                                                    Nenhum pagamento registrado para esta OS.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return (
                        <>
                            {/* SEÇÃO 1: PENDENTES (sempre visível) */}
                            {osPendentes.length > 0 && (
                                <div>
                                    <h2 className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Clock size={14} /> Pagamentos Pendentes ({osPendentes.length})
                                    </h2>
                                    <div className="space-y-3">
                                        {osPendentes.map((wo: any) => renderCard(wo, true))}
                                    </div>
                                </div>
                            )}

                            {/* SEÇÃO 2: HISTÓRICO POR MÊS */}
                            <div>
                                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FileText size={14} /> Histórico de Serviços
                                </h2>

                                {workOrders.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
                                        <p className="text-stone-400 text-sm">Nenhum serviço encontrado.</p>
                                    </div>
                                ) : mesesParaMostrar.length === 0 && osPendentes.length > 0 ? (
                                    <div className="bg-white rounded-2xl border border-stone-200 p-6 text-center">
                                        <p className="text-stone-400 text-sm">Todos os serviços possuem pagamentos pendentes.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        {mesesParaMostrar.map(mesKey => {
                                            const [ano, mes] = mesKey.split('-');
                                            const label = `${MESES_PT[mes]} ${ano}`;
                                            return (
                                                <div key={mesKey}>
                                                    <p className="text-[11px] font-bold text-stone-400 mb-2 pl-1">{label}</p>
                                                    <div className="space-y-3">
                                                        {quitadasPorMes[mesKey].map((wo: any) => renderCard(wo, false))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {temMaisMeses && (
                                            <button
                                                onClick={() => setMesesVisiveis(prev => prev + 1)}
                                                className="w-full py-3 bg-white border-2 border-dashed border-stone-300 rounded-2xl text-sm font-bold text-stone-500 hover:border-[#FACC15] hover:text-[#1A1A1A] transition flex items-center justify-center gap-2"
                                            >
                                                <ChevronDown size={16} /> Carregar meses anteriores
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    );
                })()}

                {/* RODAPÉ */}
                {empresa?.telefone && (
                    <div className="text-center pt-4 pb-8">
                        <p className="text-[10px] text-stone-400 mb-2">Dúvidas? Fale conosco</p>
                        <a
                            href={`https://wa.me/55${empresa.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-green-600 transition"
                        >
                            <MessageCircle size={16} /> WhatsApp
                        </a>
                    </div>
                )}

                <p className="text-center text-[10px] text-stone-300 pb-4">
                    Gerado em {new Date().toLocaleDateString('pt-BR')} • Powered by AutoElétrica
                </p>
            </div>
        </div>
    );
}

export default function ExtratoPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center">
                <Loader2 className="animate-spin text-[#1A1A1A]" size={32} />
            </div>
        }>
            <ConteudoExtrato />
        </Suspense>
    );
}
