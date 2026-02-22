"use client";

import { useEffect, useState } from "react";
import {
    Plus, Search, ShoppingBag, User,
    ChevronRight, Clock, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";

type WorkOrder = {
    id: string | number;
    status: string;
    total: number;
    created_at: string;
    clients: {
        nome: string;
    } | null;
    // Vehicles might be null for sales
    vehicles: {
        modelo: string;
        placa: string;
    } | null;
};

export default function SalesList() {
    const supabase = createClient();
    const { profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<WorkOrder[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (profile?.organization_id) {
            fetchSales();
        }
    }, [profile]);

    const fetchSales = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('work_orders')
                .select(`
          id,
          status,
          total,
          created_at,
          clients ( nome ),
          vehicles ( modelo, placa )
        `)
                .eq('organization_id', profile?.organization_id)
                .is('vehicle_id', null) // FILTER FOR SALES (Assuming Sales have NO vehicle)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setOrders(data as unknown as WorkOrder[]);
        } catch (error) {
            console.error("Erro ao buscar Vendas:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    const filteredOrders = orders.filter(os => {
        const searchLower = searchTerm.toLowerCase();
        return (
            (os.clients?.nome || "").toLowerCase().includes(searchLower) ||
            String(os.id).toLowerCase().includes(searchLower)
        );
    });

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#1A1A1A]">Vendas de Peças</h2>
                    <p className="text-stone-500 text-sm">Vendas diretas no balcão</p>
                </div>

                <Link href="/atendimento/nova-venda">
                    <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-5 py-2.5 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 transition hover:scale-105">
                        <Plus size={18} /> Nova Venda
                    </button>
                </Link>
            </div>

            <div className="bg-white p-2 rounded-[24px] shadow-sm border-2 border-stone-300 flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por cliente ou código..."
                        className="w-full pl-12 pr-4 py-3 bg-stone-50 rounded-2xl outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 transition text-sm font-medium text-[#1A1A1A]"
                    />
                </div>
            </div>

            <div className="bg-white rounded-[32px] border-2 border-stone-300 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
                <div className="overflow-auto p-4 space-y-2 h-full">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
                            <Loader2 className="animate-spin text-[#FACC15]" size={32} />
                            <p className="text-xs font-medium">Buscando vendas...</p>
                        </div>
                    ) : (
                        filteredOrders.length > 0 ? (
                            filteredOrders.map((os) => (
                                <Link key={os.id} href={`/os/detalhes/${os.id}`} className="block">
                                    <div className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-3xl bg-white hover:bg-stone-50 transition cursor-pointer border-2 border-stone-200 hover:border-stone-300 shadow-sm mb-2">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-orange-50 text-orange-400 group-hover:bg-white transition`}>
                                                <ShoppingBag size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#1A1A1A] text-lg">
                                                        Venda #{os.id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-stone-500">
                                                    <span className="flex items-center gap-1">
                                                        <User size={14} /> {os.clients?.nome || "Consumidor"}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} /> {formatDate(os.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                                            <span className={`px-4 py-2 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200`}>
                                                Concluído
                                            </span>
                                            <div className="text-right min-w-[80px]">
                                                <p className="text-xs text-stone-400 font-medium">Total</p>
                                                <p className="font-bold text-[#1A1A1A]">
                                                    {os.total > 0 ? formatCurrency(os.total) : "--"}
                                                </p>
                                            </div>
                                            <div className="w-10 h-10 rounded-full border border-stone-100 flex items-center justify-center text-stone-300 group-hover:bg-[#1A1A1A] group-hover:text-[#FACC15] group-hover:border-transparent transition">
                                                <ChevronRight size={20} />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
                                <div className="bg-stone-50 p-4 rounded-full mb-2">
                                    <ShoppingBag size={32} />
                                </div>
                                <p>Nenhuma venda encontrada.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
