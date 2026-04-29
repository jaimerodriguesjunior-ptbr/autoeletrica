"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { getEntryInvoiceWithItems, type ParsedNFeItem } from "@/src/actions/fiscal_db";
import { emitirNFeDevolucao } from "@/src/actions/fiscal_emission";
import { ArrowLeft, Loader2, RotateCcw, CheckCircle, AlertCircle, Package } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

type ItemState = ParsedNFeItem & {
    selected: boolean;
    qtd_devolver: number;
};

type EntryInvoice = {
    id: string;
    numero: string | null;
    emitente_nome: string | null;
    emitente_cnpj: string | null;
    valor_total: number | null;
    data_emissao: string | null;
    chave_acesso: string | null;
};

export default function DevolucaoPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const params = useParams();
    const invoiceId = params.id as string;

    const [invoice, setInvoice] = useState<EntryInvoice | null>(null);
    const [items, setItems] = useState<ItemState[]>([]);
    const [loading, setLoading] = useState(true);
    const [emitting, setEmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [environment, setEnvironment] = useState<"production" | "homologation">("production");

    useEffect(() => {
        if (!profile?.organization_id || !invoiceId) return;
        loadInvoice();
    }, [profile, invoiceId]);

    const loadInvoice = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getEntryInvoiceWithItems(invoiceId);
            if (!data) {
                setError("Nota de entrada não encontrada.");
                return;
            }
            setInvoice(data.invoice as EntryInvoice);
            setItems(
                data.items.map((item) => ({
                    ...item,
                    selected: true,
                    qtd_devolver: item.quantidade,
                }))
            );
        } catch (e: any) {
            setError(e.message || "Erro ao carregar nota.");
        } finally {
            setLoading(false);
        }
    };

    const selectedItems = items.filter((i) => i.selected && i.qtd_devolver > 0);

    const valorTotal = selectedItems.reduce((acc, item) => {
        return acc + item.qtd_devolver * item.valor_unitario;
    }, 0);

    const handleQtdChange = (idx: number, value: string) => {
        const num = parseFloat(value) || 0;
        setItems((prev) =>
            prev.map((item, i) =>
                i === idx
                    ? { ...item, qtd_devolver: Math.min(Math.max(0, num), item.quantidade) }
                    : item
            )
        );
    };

    const handleToggle = (idx: number) => {
        setItems((prev) =>
            prev.map((item, i) =>
                i === idx ? { ...item, selected: !item.selected } : item
            )
        );
    };

    const handleEmitir = async () => {
        if (!profile?.organization_id) return;
        if (selectedItems.length === 0) {
            alert("Selecione ao menos um item para devolver.");
            return;
        }
        if (!invoice?.chave_acesso) {
            alert("Nota de entrada sem chave de acesso. Não é possível emitir devolução.");
            return;
        }

        const confirmMsg =
            `Emitir NF-e de Devolução em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Fornecedor: ${invoice.emitente_nome}\n` +
            `Itens: ${selectedItems.length}\n` +
            `Total: R$ ${valorTotal.toFixed(2)}`;

        if (!confirm(confirmMsg)) return;

        setEmitting(true);
        setError(null);

        try {
            const itensPayload = selectedItems.map((item) => ({
                codigo: item.codigo,
                descricao: item.descricao,
                ncm: item.ncm,
                unidade: item.unidade,
                quantidade: item.qtd_devolver,
                valor_unitario: item.valor_unitario,
                valor_total: parseFloat((item.qtd_devolver * item.valor_unitario).toFixed(2)),
            }));

            const result = await emitirNFeDevolucao({
                organization_id: profile.organization_id,
                entry_invoice_id: invoiceId,
                itens: itensPayload,
                valor_total: parseFloat(valorTotal.toFixed(2)),
                environment,
            });

            if (result.success) {
                setSuccess(true);
                setTimeout(() => router.push("/fiscal"), 2500);
            } else {
                setError(result.error || "Erro desconhecido na emissão.");
            }
        } catch (e: any) {
            setError(e.message || "Erro ao emitir.");
        } finally {
            setEmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    if (error && !invoice) {
        return (
            <div className="max-w-2xl mx-auto p-8 text-center">
                <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                <p className="text-red-600 font-bold mb-4">{error}</p>
                <Link href="/fiscal">
                    <button className="px-6 py-2 rounded-full bg-stone-800 text-white font-bold">
                        Voltar
                    </button>
                </Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <CheckCircle className="text-green-500" size={64} />
                <p className="text-xl font-bold text-green-700">NF-e de Devolução enviada!</p>
                <p className="text-stone-500">Redirecionando para o painel fiscal...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-32 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/fiscal">
                    <button className="p-2 rounded-full bg-stone-100 hover:bg-stone-200 transition">
                        <ArrowLeft size={20} />
                    </button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
                        <RotateCcw size={22} className="text-orange-500" />
                        Emitir NF-e de Devolução
                    </h1>
                    <p className="text-stone-500 text-sm">
                        Selecione os itens a devolver ao fornecedor
                    </p>
                </div>
            </div>

            {/* Ambiente */}
            <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-stone-200 shadow-sm w-fit">
                <button
                    onClick={() => setEnvironment("homologation")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${environment === "homologation" ? "bg-yellow-100 text-yellow-700" : "text-stone-400 hover:text-stone-600"}`}
                >
                    Homologação
                </button>
                <button
                    onClick={() => setEnvironment("production")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${environment === "production" ? "bg-green-100 text-green-700" : "text-stone-400 hover:text-stone-600"}`}
                >
                    Produção
                </button>
            </div>

            {/* Dados da nota de entrada */}
            {invoice && (
                <div className="bg-white rounded-[20px] border border-stone-100 shadow-sm p-6 space-y-3">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Nota de Entrada Referenciada</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-stone-400 font-bold">Nº da Nota</p>
                            <p className="font-bold text-[#1A1A1A]">{invoice.numero || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-400 font-bold">Fornecedor</p>
                            <p className="font-bold text-[#1A1A1A] truncate">{invoice.emitente_nome || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-400 font-bold">CNPJ</p>
                            <p className="font-bold text-[#1A1A1A]">{invoice.emitente_cnpj || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-400 font-bold">Emissão</p>
                            <p className="font-bold text-[#1A1A1A]">
                                {invoice.data_emissao
                                    ? new Date(invoice.data_emissao).toLocaleDateString("pt-BR")
                                    : "—"}
                            </p>
                        </div>
                    </div>
                    {invoice.chave_acesso && (
                        <div>
                            <p className="text-xs text-stone-400 font-bold">Chave de Acesso</p>
                            <p className="text-xs font-mono bg-stone-50 rounded p-2 mt-1 select-all break-all text-stone-600">
                                {invoice.chave_acesso}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Itens */}
            <div className="bg-white rounded-[20px] border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-2">
                    <Package size={18} className="text-stone-500" />
                    <p className="font-bold text-[#1A1A1A]">Itens para Devolução</p>
                </div>

                {items.length === 0 ? (
                    <div className="p-8 text-center text-stone-400">
                        <p>Nenhum item encontrado no XML desta nota.</p>
                        <p className="text-xs mt-1">Verifique se o XML foi importado corretamente.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-stone-50 text-stone-500 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-4 py-3 text-left w-10"></th>
                                    <th className="px-4 py-3 text-left">Produto</th>
                                    <th className="px-4 py-3 text-left">NCM</th>
                                    <th className="px-4 py-3 text-right">Qtd. Original</th>
                                    <th className="px-4 py-3 text-right">Qtd. Devolver</th>
                                    <th className="px-4 py-3 text-right">Vl. Unitário</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {items.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className={`transition ${item.selected ? "" : "opacity-40"}`}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={item.selected}
                                                onChange={() => handleToggle(idx)}
                                                className="w-4 h-4 accent-[#1A1A1A] cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-[#1A1A1A] text-xs">{item.descricao}</p>
                                            <p className="text-stone-400 text-xs">{item.codigo}</p>
                                        </td>
                                        <td className="px-4 py-3 text-stone-500 font-mono text-xs">{item.ncm}</td>
                                        <td className="px-4 py-3 text-right text-stone-600">
                                            {item.quantidade} {item.unidade}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                min={0}
                                                max={item.quantidade}
                                                step={0.001}
                                                value={item.qtd_devolver}
                                                onChange={(e) => handleQtdChange(idx, e.target.value)}
                                                disabled={!item.selected}
                                                className="w-20 text-right border border-stone-200 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#FACC15] disabled:bg-stone-50 disabled:text-stone-400"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right text-stone-600">
                                            R$ {item.valor_unitario.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-[#1A1A1A]">
                                            R$ {(item.qtd_devolver * item.valor_unitario).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Erro */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-[16px] p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Rodapé fixo */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-4 flex justify-between items-center z-50">
                <div>
                    <p className="text-xs text-stone-400 font-bold uppercase">Total da Devolução</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">
                        R$ {valorTotal.toFixed(2)}
                    </p>
                    <p className="text-xs text-stone-400">
                        {selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"} selecionado
                        {selectedItems.length !== 1 ? "s" : ""}
                        {" · "}
                        <span className={environment === "production" ? "text-green-600 font-bold" : "text-yellow-600 font-bold"}>
                            {environment === "production" ? "Produção" : "Homologação"}
                        </span>
                    </p>
                </div>

                <button
                    onClick={handleEmitir}
                    disabled={emitting || selectedItems.length === 0}
                    className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-8 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {emitting ? (
                        <><Loader2 size={18} className="animate-spin" /> Emitindo...</>
                    ) : (
                        <><RotateCcw size={18} /> Emitir Devolução</>
                    )}
                </button>
            </div>
        </div>
    );
}
