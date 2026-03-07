"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import {
    Loader2, ArrowLeft, Printer, MessageCircle,
    CheckCircle, Package, Receipt
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/src/contexts/AuthContext";

type ExtratoData = {
    id: string;
    created_at: string;
    total: number;
    description: string;
    clients: {
        id: string;
        nome: string;
        whatsapp: string | null;
        cpf_cnpj: string | null;
        public_token: string | null;
    } | null;
    work_order_items: {
        id: string;
        name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }[];
    transactions: {
        id: string;
        amount: number;
        payment_method: string;
        status: string;
        date: string;
    }[];
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix", pix_maquininha: "Pix Maquininha",
    cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", cheque_pre: "Cheque", outros: "Outros"
};

export default function ReciboVendaPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { profile } = useAuth();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [wo, setWo] = useState<ExtratoData | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const { data, error } = await supabase
                .from('work_orders')
                .select(`
                    id, created_at, total, description,
                    clients ( id, nome, whatsapp, cpf_cnpj, public_token ),
                    work_order_items ( id, name, quantity, unit_price, total_price ),
                    transactions ( id, amount, payment_method, status, date )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setWo(data as unknown as ExtratoData);
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar recibo");
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsApp = () => {
        if (!wo?.clients?.whatsapp) return alert("Cliente não possui WhatsApp cadastrado.");
        const numero = wo.clients.whatsapp.replace(/\D/g, '');
        const mensagem = `Olá, ${wo.clients.nome}! Aqui está o comprovante da sua compra na AutoElétrica:\n\n*Recibo #${wo.id}*\nValor Total: R$ ${wo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nObrigado pela preferência!`;
        window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    if (!wo) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <p className="text-stone-500">Recibo não encontrado.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-[#1A1A1A] flex items-center gap-2">
                            <Receipt className="text-[#FACC15]" size={28} />
                            Recibo de Venda
                        </h1>
                        <p className="text-stone-500 text-sm">Comprovante de venda no balcão</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/imprimir/os/${wo.id}`} target="_blank" className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                        <Printer size={16} /> Imprimir
                    </Link>
                    {wo.clients?.whatsapp && (
                        <button onClick={handleWhatsApp} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-green-500/20">
                            <MessageCircle size={16} /> WhatsApp
                        </button>
                    )}
                </div>
            </div>

            {/* Recibo Card */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-stone-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-[#FACC15]" />

                <div className="flex flex-col md:flex-row justify-between mb-8 pb-8 border-b border-dashed border-stone-200">
                    <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Cliente</p>
                        {wo.clients ? (
                            <Link href={`/clientes/${wo.clients.id}`} className="block group">
                                <p className="text-lg font-black text-[#1A1A1A] group-hover:text-blue-600 transition">{wo.clients.nome}</p>
                                {wo.clients.cpf_cnpj && <p className="text-xs text-stone-500">{wo.clients.cpf_cnpj}</p>}
                            </Link>
                        ) : (
                            <p className="text-lg font-black text-[#1A1A1A]">Consumidor Final</p>
                        )}
                    </div>
                    <div className="text-left md:text-right mt-4 md:mt-0">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Identificação</p>
                        <p className="text-lg font-black text-[#1A1A1A]">#{wo.id}</p>
                        <p className="text-xs text-stone-500">{new Date(wo.created_at).toLocaleDateString('pt-BR')} às {new Date(wo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>

                {/* Itens */}
                <div className="mb-8">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Itens da Venda</p>
                    <div className="space-y-3">
                        {wo.work_order_items?.map((item, idx) => (
                            <div key={item.id || idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-400">
                                        <Package size={14} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-[#1A1A1A] text-sm">{item.name}</p>
                                        <p className="text-[10px] text-stone-500">{item.quantity}x R$ {Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <p className="font-bold text-[#1A1A1A]">R$ {Number(item.total_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Totais e Pagamentos */}
                <div className="bg-[#1A1A1A] text-white rounded-[24px] p-6">
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/10">
                        <p className="text-stone-400 font-bold uppercase text-xs tracking-widest">Valor Pago</p>
                        <p className="text-3xl font-black text-[#FACC15]">R$ {wo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Formas de Pagamento Registradas</p>
                    {wo.transactions && wo.transactions.length > 0 ? (
                        <div className="space-y-2">
                            {wo.transactions.map((tx) => (
                                <div key={tx.id} className="flex justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        {tx.status === 'paid' ? <CheckCircle size={14} className="text-green-500" /> : <Loader2 size={14} className="text-yellow-500 animate-spin" />}
                                        {PAYMENT_LABELS[tx.payment_method] || tx.payment_method}
                                    </span>
                                    <span className="font-bold">R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-stone-500 text-sm italic">Nenhum pagamento registrado no momento.</p>
                    )}
                </div>

                {wo.description && wo.description !== "Venda Balcão" && (
                    <div className="mt-8 pt-8 border-t border-dashed border-stone-200">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Observações</p>
                        <p className="text-sm text-stone-600 italic">"{wo.description}"</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .max-w-2xl, .max-w-2xl * { visibility: visible; }
                    .max-w-2xl { position: absolute; left: 0; top: 0; padding: 0 !important; width: 100%; margin: 0; }
                    button, a { display: none !important; }
                    .bg-\\[\\#1A1A1A\\] { background-color: #f5f5f4 !important; color: black !important; -webkit-print-color-adjust: exact; }
                    .text-white { color: black !important; }
                    .border-white\\/10 { border-color: #e5e5e5 !important; }
                    .text-\\[\\#FACC15\\] { color: black !important; }
                }
            `}</style>
        </div>
    );
}
