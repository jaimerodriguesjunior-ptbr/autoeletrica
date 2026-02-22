"use client";

import { useState } from "react";
import ServiceOrderList from "@/components/atendimento/ServiceOrderList";
import SalesList from "@/components/atendimento/SalesList";
import { Wrench, ShoppingBag } from "lucide-react";

export default function AtendimentoPage() {
    const [activeTab, setActiveTab] = useState<"os" | "vendas">("os");

    return (
        <div className="space-y-6 h-full flex flex-col pb-24">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1A1A1A]">Atendimento</h1>
                    <p className="text-stone-500 text-sm mt-1">Gerencie ordens de serviço e vendas de peças</p>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-stone-200 p-1.5 rounded-2xl flex gap-2 w-full md:w-fit border-2 border-stone-300 shadow-sm">
                <button
                    onClick={() => setActiveTab("os")}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${activeTab === "os"
                        ? "bg-white text-[#1A1A1A] shadow-md border-stone-300"
                        : "text-stone-500 hover:text-[#1A1A1A] border-transparent"
                        }`}
                >
                    <Wrench size={18} /> Ordem de Serviço
                </button>
                <button
                    onClick={() => setActiveTab("vendas")}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${activeTab === "vendas"
                        ? "bg-white text-[#1A1A1A] shadow-md border-stone-300"
                        : "text-stone-500 hover:text-[#1A1A1A] border-transparent"
                        }`}
                >
                    <ShoppingBag size={18} /> Venda de Peças
                </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1">
                {activeTab === "os" ? (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <ServiceOrderList />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <SalesList />
                    </div>
                )}
            </div>
        </div>
    );
}
