"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import {
    Loader2, ArrowLeft, Printer, MessageCircle,
    CheckCircle, Receipt, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/src/contexts/AuthContext";

type TransactionRecibo = {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    status: string;
    payment_method: string;
    created_at: string;
    work_orders?: {
        id: string;
        clients?: {
            nome: string;
            cpf_cnpj: string;
            whatsapp: string;
        }
    }
};

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix", pix_maquininha: "Pix Maquininha",
    cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", cheque_pre: "Cheque", outros: "Outros"
};

export default function ReciboFinanceiroPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;
    const { profile } = useAuth();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [tx, setTx] = useState<TransactionRecibo | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    work_orders (
                        id,
                        clients ( nome, cpf_cnpj, whatsapp )
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            setTx(data as unknown as TransactionRecibo);
        } catch (error) {
            console.error(error);
            alert("Erro ao carregar recibo da transação");
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsApp = () => {
        if (!tx) return;
        const client = tx.work_orders?.clients;
        if (!client?.whatsapp) return alert("Cliente não possui WhatsApp cadastrado.");
        const numero = client.whatsapp.replace(/\D/g, '');
        const mensagem = `Olá, ${client.nome}! Aqui está o comprovante do seu pagamento na AutoElétrica:\n\n*Recibo*\nReferência: ${tx.description}\nValor: R$ ${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\nObrigado!`;
        window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    if (!tx) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen">
                <p className="text-stone-500">Recibo não encontrado.</p>
            </div>
        );
    }

    const isIncome = tx.type === 'income';

    return (
        <div className="max-w-2xl mx-auto pb-32">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 print-hide">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200 transition"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-[#1A1A1A] flex items-center gap-2">
                            <Receipt className={isIncome ? "text-green-500" : "text-red-500"} size={28} />
                            Recibo de {isIncome ? 'Recebimento' : 'Pagamento'}
                        </h1>
                        <p className="text-stone-500 text-sm">Comprovante de transação financeira</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                        <Printer size={16} /> Imprimir
                    </button>
                    {tx.work_orders?.clients?.whatsapp && isIncome && (
                        <button onClick={handleWhatsApp} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-green-500/20">
                            <MessageCircle size={16} /> WhatsApp
                        </button>
                    )}
                </div>
            </div>

            {/* Recibo Card */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-stone-200 relative overflow-hidden print-area">
                <div className={`absolute top-0 left-0 w-full h-2 ${isIncome ? 'bg-green-500' : 'bg-red-500'}`} />

                <div className="flex flex-col md:flex-row justify-between mb-8 pb-8 border-b border-dashed border-stone-200">
                    <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{isIncome ? 'Recebemos de' : 'Pagamos a'}</p>
                        {tx.work_orders?.clients ? (
                            <div>
                                <p className="text-lg font-black text-[#1A1A1A]">{tx.work_orders.clients.nome}</p>
                                {tx.work_orders.clients.cpf_cnpj && <p className="text-xs text-stone-500">{tx.work_orders.clients.cpf_cnpj}</p>}
                            </div>
                        ) : (
                            <p className="text-lg font-black text-[#1A1A1A]">{tx.description.split(' - ')[1] || 'Não Informado'}</p>
                        )}
                    </div>
                    <div className="text-left md:text-right mt-4 md:mt-0">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Identificação da Transação</p>
                        <p className="text-lg font-black text-[#1A1A1A]">#{tx.id.split('-')[0]}</p>
                        <p className="text-xs text-stone-500">{new Date(tx.date).toLocaleDateString('pt-BR')} às {new Date(tx.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>

                {/* Detalhes */}
                <div className="mb-8">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Referente a</p>
                    <div className="flex justify-between items-center bg-stone-50 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-white border flex items-center justify-center ${isIncome ? 'border-green-200 text-green-500' : 'border-red-200 text-red-500'}`}>
                                {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            </div>
                            <div>
                                <p className="font-bold text-[#1A1A1A] text-sm">{tx.description}</p>
                                <p className="text-[10px] text-stone-500">Categoria: {tx.category}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Totais e Pagamentos */}
                <div className={`${isIncome ? 'bg-green-50' : 'bg-red-50'} rounded-[24px] p-6`}>
                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-stone-200/50">
                        <p className={`${isIncome ? 'text-green-700' : 'text-red-700'} font-bold uppercase text-xs tracking-widest`}>A Importância de</p>
                        <p className={`text-3xl font-black ${isIncome ? 'text-green-600' : 'text-red-600'}`}>R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <p className={`text-[10px] font-bold ${isIncome ? 'text-green-700' : 'text-red-700'} uppercase tracking-widest mb-3`}>Detalhes do Pagamento</p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2 text-stone-600 font-medium">
                                <CheckCircle size={14} className={isIncome ? "text-green-500" : "text-red-500"} />
                                Status
                            </span>
                            <span className="font-bold text-[#1A1A1A]">{tx.status === 'paid' ? 'Pago/Efetivado' : 'Pendente'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2 text-stone-600 font-medium">
                                Forma
                            </span>
                            <span className="font-bold text-[#1A1A1A]">{PAYMENT_LABELS[tx.payment_method] || tx.payment_method || 'Não Informada'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-hide { display: none !important; }
                    .print-area { position: absolute; left: 0; top: 0; padding: 0 !important; width: 100%; margin: 0; box-shadow: none !important; border: none !important; }
                    .bg-green-50, .bg-red-50 { background-color: transparent !important; border: 1px solid #e5e5e5; }
                    .text-green-600, .text-red-600 { color: black !important; }
                    .text-green-700, .text-red-700 { color: #666 !important; }
                }
            `}</style>
        </div>
    );
}
