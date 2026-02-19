"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { getFiscalInvoices } from "@/src/actions/fiscal_db";
import { consultarNFSe, cancelarNota } from "@/src/actions/fiscal_emission";
import {
    FileText, Plus, Search, Loader2, AlertCircle,
    CheckCircle, XCircle, Clock, Download, RefreshCw, Edit, Ban, Printer, MessageCircle
} from "lucide-react";
import Link from "next/link";

type Invoice = {
    id: string;
    numero: string;
    serie: string;
    status: string;
    tipo_documento: string;
    created_at: string;
    pdf_url: string | null;
    xml_url: string | null;
    error_message: string | null;
    work_order_id: number | null;
    chave_acesso: string | null;
    motivo_rejeicao?: string | null;
    work_orders?: {
        clients: {
            nome: string;
            whatsapp: string;
        } | null
    } | null;
};

export default function FiscalDashboard() {
    const { profile } = useAuth();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [environment, setEnvironment] = useState<'production' | 'homologation'>('production');

    // Filtros
    const [statusFilter, setStatusFilter] = useState("all");
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    // Ref para evitar loop infinito no polling
    const invoicesRef = useRef<Invoice[]>([]);
    invoicesRef.current = invoices;

    // Smart Polling Logic
    useEffect(() => {
        const checkForUpdates = async () => {
            const processingInvoices = invoicesRef.current.filter(inv => inv.status === 'processing');
            if (processingInvoices.length === 0) return;

            let updated = false;
            for (const inv of processingInvoices) {
                if (inv.tipo_documento === 'NFSe') {
                    const res = await consultarNFSe(inv.id);
                    if (res.success && res.status !== 'processing') {
                        updated = true;
                    }
                }
            }
            if (updated) {
                fetchInvoices();
            }
        };

        // Calcula intervalo baseado em notas recentes
        const getInterval = () => {
            const processingInvoices = invoicesRef.current.filter(inv => inv.status === 'processing');
            if (processingInvoices.length === 0) return null;

            const hasRecent = processingInvoices.some(inv => {
                const created = new Date(inv.created_at).getTime();
                return (Date.now() - created) < 60000;
            });
            return hasRecent ? 5000 : 30000;
        };

        const intervalMs = getInterval();
        if (!intervalMs) return;

        console.log(`[Smart Polling] Intervalo: ${intervalMs}ms`);
        const intervalId = setInterval(checkForUpdates, intervalMs);

        return () => clearInterval(intervalId);
    }, [invoices.filter(inv => inv.status === 'processing').length]); // Dependência estável: quantidade de notas processando

    useEffect(() => {
        if (profile?.organization_id) {
            fetchInvoices();
        }
    }, [profile]);

    const fetchInvoices = async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        try {
            const data = await getFiscalInvoices(profile.organization_id);
            setInvoices(data as Invoice[]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = (invoiceId: string) => {
        // Tenta imprimir direto usando um iframe invisível para abrir o dialog de impressão do browser
        const url = `/api/fiscal/print/${invoiceId}`;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
            try {
                iframe.contentWindow?.print();
            } catch (e) {
                console.error("Erro ao abrir dialog de impressão", e);
                window.open(url, '_blank'); // Fallback
            }
            // Remove o iframe após um tempo (assumindo que o usuario imprimiu ou cancelou)
            setTimeout(() => document.body.removeChild(iframe), 60000);
        };
    };

    const handleWhatsApp = (invoice: Invoice) => {
        const phone = invoice.work_orders?.clients?.whatsapp?.replace(/\D/g, "");
        const link = invoice.pdf_url || ""; // Link oficial (pode exigir login se for IPM, mas é o que temos)
        const text = `Olá, segue o link da sua Nota Fiscal: ${link}`;

        // Se tiver telefone, abre direto. Se não, abre o WA para escolher contato.
        let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        if (phone && phone.length >= 10) {
            url = `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
        }
        window.open(url, '_blank');
    };

    const handleRefreshStatus = async (invoiceId: string) => {
        const toastId = alert("Consultando status...");
        try {
            const res = await consultarNFSe(invoiceId);
            if (res.success) {
                if (res.status === 'error') {
                    // Tenta pegar a mensagem de erro mais específica possível
                    let msg = res.data?.motivo_status || res.data?.error?.message;

                    // Verifica se tem mensagens de erro detalhadas (comum na NuvemFiscal)
                    if (res.data?.mensagens && Array.isArray(res.data.mensagens)) {
                        const detalhes = res.data.mensagens.map((m: any) => `${m.codigo}: ${m.descricao}`).join('\n');
                        if (detalhes) msg = detalhes;
                    }

                    alert(`Erro da Prefeitura:\n${msg || "Erro desconhecido"}`);
                } else {
                    alert(`Status atualizado: ${res.status}`);
                }
                fetchInvoices();
            } else {
                alert(`Erro: ${res.error}`);
            }
        } catch (e) {
            alert("Erro ao consultar.");
        }
    };

    const handleCancelar = async (invoiceId: string) => {
        const justificativa = prompt("Motivo do cancelamento (Mínimo 15 caracteres):");
        if (!justificativa) return;
        if (justificativa.length < 15) return alert("Justificativa muito curta.");

        if (!confirm("Tem certeza que deseja cancelar esta nota? Ação irreversível.")) return;

        try {
            const res = await cancelarNota(invoiceId, justificativa);
            if (res.success) {
                alert("Sucesso: " + res.message);
                fetchInvoices();
            } else {
                alert("Erro: " + res.error);
            }
        } catch (e: any) {
            alert("Erro ao cancelar: " + e.message);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'authorized':
                return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> Autorizada</span>;
            case 'error':
                return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><XCircle size={12} /> Erro</span>;
            case 'processing':
                return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Processando</span>;
            case 'cancelled':
                return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><XCircle size={12} /> Cancelada</span>;
            default:
                return <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><Clock size={12} /> Rascunho</span>;
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchTerm || (inv.numero || "").includes(searchTerm) || (inv.status || "").includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
        let matchesDate = true;
        if (startDate) {
            matchesDate = new Date(inv.created_at) >= new Date(startDate + "T00:00:00");
        }
        if (endDate && matchesDate) {
            matchesDate = new Date(inv.created_at) <= new Date(endDate + "T23:59:59");
        }
        return matchesSearch && matchesStatus && matchesDate;
    });

    return (
        <div className="space-y-6 pb-32">
            {/* CABEÇALHO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1A1A1A]">Fiscal</h1>
                    <p className="text-stone-500">Gerencie suas notas fiscais emitidas.</p>
                </div>

                <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-stone-200 shadow-sm">
                    <button
                        onClick={() => setEnvironment('homologation')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${environment === 'homologation' ? 'bg-yellow-100 text-yellow-700' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Homologação
                    </button>
                    <button
                        onClick={() => setEnvironment('production')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${environment === 'production' ? 'bg-green-100 text-green-700' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                        Produção
                    </button>
                </div>
            </div>

            {/* AÇÕES */}
            <div className="flex justify-end">
                <Link href={`/fiscal/emitir?env=${environment}`}>
                    <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105">
                        <Plus size={20} /> Nova Nota
                    </button>
                </Link>
            </div>

            {/* FILTROS E RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600"><CheckCircle size={24} /></div>
                    <div>
                        <p className="text-2xl font-bold text-[#1A1A1A]">{invoices.filter(i => i.status === 'authorized').length}</p>
                        <p className="text-xs text-stone-500 font-bold uppercase">Autorizadas</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500"><AlertCircle size={24} /></div>
                    <div>
                        <p className="text-2xl font-bold text-[#1A1A1A]">{invoices.filter(i => i.status === 'error').length}</p>
                        <p className="text-xs text-stone-500 font-bold uppercase">Com Erro</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500"><Clock size={24} /></div>
                    <div>
                        <p className="text-2xl font-bold text-[#1A1A1A]">{invoices.filter(i => i.status === 'processing' || i.status === 'draft').length}</p>
                        <p className="text-xs text-stone-500 font-bold uppercase">Pendentes</p>
                    </div>
                </div>
            </div>

            {/* LISTA */}
            <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-6 border-b border-stone-100 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2"><FileText size={20} /> Histórico de Emissões</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Filtro Status */}
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] cursor-pointer shadow-sm text-stone-600 font-medium"
                            >
                                <option value="all">Status: Todos</option>
                                <option value="authorized">Autorizadas</option>
                                <option value="processing">Processando</option>
                                <option value="error">Com Erro</option>
                                <option value="cancelled">Canceladas</option>
                            </select>

                            {/* Filtro Data Inicial */}
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm text-stone-600"
                                title="Data Inicial"
                            />
                            <span className="text-stone-300 text-sm">até</span>
                            {/* Filtro Data Final */}
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm text-stone-600"
                                title="Data Final"
                            />

                            {/* Busca */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar nota..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#F8F7F2] text-stone-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="px-6 py-4">Número / Série</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-[#FACC15]" /></td></tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-10 text-stone-400">Nenhuma nota encontrada.</td></tr>
                            ) : (
                                filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-[#1A1A1A]">{inv.numero ? `#${inv.numero}` : 'S/N'}</p>
                                            <p className="text-xs text-stone-400">Série {inv.serie || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-bold">{inv.tipo_documento}</span>
                                        </td>
                                        <td className="px-6 py-4 text-stone-600">
                                            {new Date(inv.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(inv.status)}
                                            {inv.error_message && (
                                                <p className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={inv.error_message}>{inv.error_message}</p>
                                            )}
                                            {inv.tipo_documento === 'NFSe' && inv.chave_acesso && (
                                                <div className="mt-1">
                                                    <p className="text-[10px] text-stone-400 font-bold">Cód. Verificação:</p>
                                                    <p className="text-[10px] text-stone-600 font-mono select-all bg-stone-100 p-1 rounded w-fit">{inv.chave_acesso}</p>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {/* Botão de Impressão */}
                                                {(inv.status === 'authorized' || inv.status === 'canceled') && (
                                                    <button
                                                        onClick={() => handlePrint(inv.id)}
                                                        className="p-2 bg-stone-50 hover:bg-stone-100 rounded-lg transition text-stone-600"
                                                        title="Imprimir Nota Direto"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                )}

                                                {/* Botão Download (Apenas se tiver PDF) */}
                                                {(inv.status === 'authorized' || inv.status === 'canceled') && (
                                                    <a
                                                        href={`/api/fiscal/print/${inv.id}?download=true`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 bg-stone-50 hover:bg-stone-100 rounded-lg transition text-stone-600"
                                                        title="Baixar XML/PDF"
                                                    >
                                                        <Download size={16} />
                                                    </a>
                                                )}

                                                {/* Botão WhatsApp */}
                                                {(inv.status === 'authorized') && (
                                                    <button
                                                        onClick={() => handleWhatsApp(inv)}
                                                        className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition"
                                                        title={inv.work_orders?.clients?.whatsapp ? `Enviar para ${inv.work_orders.clients.whatsapp}` : "Compartilhar no WhatsApp"}
                                                    >
                                                        <MessageCircle size={16} />
                                                    </button>
                                                )}

                                                {/* Botão de Cancelar (Apenas Autorizadas) */}
                                                {inv.status === 'authorized' && (
                                                    <button
                                                        onClick={() => handleCancelar(inv.id)}
                                                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                                                        title="Cancelar Nota"
                                                    >
                                                        <Ban size={16} />
                                                    </button>
                                                )}
                                                {/* Botão de Detalhes ou Reenviar se erro */}
                                                {(inv.status === 'processing' || inv.status === 'error') && inv.tipo_documento === 'NFSe' && (
                                                    <button
                                                        onClick={() => handleRefreshStatus(inv.id)}
                                                        className={`p-2 rounded-lg transition ${inv.status === 'error' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                                        title={inv.status === 'error' ? "Ver Detalhes do Erro" : "Atualizar Status"}
                                                    >
                                                        {inv.status === 'error' ? <AlertCircle size={16} /> : <RefreshCw size={16} />}
                                                    </button>
                                                )}
                                                {/* Botão de Ver Erro (Para mostrar ao contador) */}
                                                {(inv.status === 'error' || inv.status === 'rejected') && (
                                                    <button
                                                        onClick={() => alert(`Detalhes do Erro:\n\n${inv.error_message || inv.motivo_rejeicao || "Sem detalhes disponíveis."}`)}
                                                        className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition"
                                                        title="Ver Detalhes do Erro"
                                                    >
                                                        <AlertCircle size={16} />
                                                    </button>
                                                )}

                                                {/* Botão de Correção para Erros */}
                                                {inv.status === 'error' && (
                                                    <Link href={`/fiscal/corrigir/${inv.id}`}>
                                                        <button
                                                            className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg transition"
                                                            title="Corrigir e Reemitir"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
}
