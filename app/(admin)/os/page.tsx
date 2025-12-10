"use client";

import { useEffect, useState } from "react";
import { 
  Plus, Search, Car, User, 
  ChevronRight, Clock, Loader2, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";

// Interface ajustada para refletir que ID pode vir como número
type WorkOrder = {
  id: string | number;
  status: string;
  total: number;
  created_at: string;
  clients: {
    nome: string;
  } | null;
  vehicles: {
    modelo: string;
    placa: string;
  } | null;
};

export default function ServicosOS() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchOrders();
    }
  }, [profile]);

  const fetchOrders = async () => {
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
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data as unknown as WorkOrder[]);
    } catch (error) {
      console.error("Erro ao buscar OS:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Helpers de UI ---

  const formatStatus = (slug: string) => {
    const map: Record<string, string> = {
      orcamento: "Orçamento",
      aprovado: "Aprovado",
      aguardando_peca: "Aguardando Peça",
      em_servico: "Em Execução",
      pronto: "Pronto",
      entregue: "Finalizado",
      cancelado: "Cancelado"
    };
    return map[slug] || slug;
  };

  const getStatusStyle = (slug: string) => {
    switch (slug) {
      case "orcamento": return "bg-stone-100 text-stone-600 border border-stone-200";
      case "aprovado": return "bg-blue-50 text-blue-700 border border-blue-100";
      case "em_servico": return "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse";
      case "aguardando_peca": return "bg-orange-50 text-orange-700 border border-orange-100";
      case "pronto": return "bg-green-100 text-green-700 border border-green-200 font-bold";
      case "entregue": return "bg-stone-800 text-[#FACC15] border border-stone-900";
      default: return "bg-stone-50 text-stone-500";
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }).format(date);
  };

  // --- Lógica de Filtro (CORRIGIDA) ---

  const filteredOrders = orders.filter(os => {
    // 1. Filtro de Texto (Busca)
    const searchLower = searchTerm.toLowerCase();
    
    // Proteção: Converte valores para String antes de comparar e trata nulos
    const matchSearch = 
      (os.clients?.nome || "").toLowerCase().includes(searchLower) ||
      (os.vehicles?.placa || "").toLowerCase().includes(searchLower) ||
      (os.vehicles?.modelo || "").toLowerCase().includes(searchLower) ||
      String(os.id).toLowerCase().includes(searchLower); // <--- AQUI ESTAVA O ERRO (Adicionado String())

    if (!matchSearch) return false;

    // 2. Filtro de Abas
    if (filtroAtivo === "todos") return true;
    
    if (filtroAtivo === "orçamentos") return os.status === "orcamento";
    
    if (filtroAtivo === "em andamento") {
      return ["aprovado", "em_servico", "aguardando_peca"].includes(os.status);
    }
    
    if (filtroAtivo === "finalizados") {
      return ["pronto", "entregue", "cancelado"].includes(os.status);
    }

    return true;
  });

  return (
    <div className="space-y-6 h-full flex flex-col pb-24">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Ordens de Serviço</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie os veículos na oficina</p>
        </div>
        
        <Link href="/os/nova">
          <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105">
            <Plus size={20} /> Nova OS
          </button>
        </Link>
      </div>

      {/* 2. FILTROS */}
      <div className="bg-white p-2 rounded-[24px] shadow-sm border border-stone-100 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, cliente ou código..." 
            className="w-full pl-12 pr-4 py-3 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-[#FACC15]/50 transition text-sm font-medium text-[#1A1A1A]"
          />
        </div>
        <div className="flex bg-stone-50 p-1 rounded-2xl overflow-x-auto scrollbar-hide">
          {["todos", "em andamento", "orçamentos", "finalizados"].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setFiltroAtivo(tab)} 
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize whitespace-nowrap transition ${filtroAtivo === tab ? "bg-white text-[#1A1A1A] shadow-sm" : "text-stone-400 hover:text-stone-600"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 3. LISTA */}
      <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm flex-1 overflow-hidden flex flex-col min-h-[400px]">
        <div className="px-8 py-6 border-b border-stone-50 flex justify-between items-center">
          <h3 className="font-bold text-[#1A1A1A]">Lista de Veículos</h3>
          <span className="bg-stone-100 text-stone-500 px-3 py-1 rounded-full text-xs font-bold">
            {loading ? "..." : `${filteredOrders.length} encontrados`}
          </span>
        </div>

        <div className="overflow-auto p-4 space-y-2 h-full">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
              <Loader2 className="animate-spin text-[#FACC15]" size={32} />
              <p className="text-xs font-medium">Buscando ordens...</p>
            </div>
          ) : (
            filteredOrders.length > 0 ? (
              filteredOrders.map((os) => (
                <Link key={os.id} href={`/os/detalhes/${os.id}`} className="block">
                  <div className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-3xl hover:bg-[#F9F8F4] transition cursor-pointer border border-transparent hover:border-stone-100">
                    
                    {/* Lado Esquerdo */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-stone-50 text-stone-400 group-hover:bg-white transition`}>
                         <Car size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1A1A1A] text-lg">
                             {os.vehicles?.modelo || "Veículo não identificado"}
                          </span>
                          {os.vehicles?.placa && (
                            <span className="text-xs font-mono bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md border border-stone-200">
                             {os.vehicles.placa}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-stone-500">
                          <span className="flex items-center gap-1">
                            <User size={14}/> {os.clients?.nome || "Consumidor"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14}/> {formatDate(os.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito */}
                    <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                      <span className={`px-4 py-2 rounded-full text-xs font-bold ${getStatusStyle(os.status)}`}>
                        {formatStatus(os.status)}
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
                  <AlertCircle size={32} />
                </div>
                <p>Nenhuma ordem de serviço encontrada.</p>
                {filtroAtivo !== "todos" && (
                  <button onClick={() => setFiltroAtivo("todos")} className="text-[#FACC15] font-bold text-sm hover:underline">
                    Limpar filtros
                  </button>
                )}
              </div>
            )
          )}
      </div>
      </div>
    </div>
  );
}