"use client";

import { useEffect, useState } from "react";
// Removido next/link para evitar erro de build no preview
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { 
  Search, Plus, Package, AlertTriangle, 
  TrendingUp, Filter, RefreshCw, ArrowRight, Loader2
} from "lucide-react";

// Tipo que reflete nossa tabela 'products'
type Product = {
  id: string;
  nome: string;
  marca: string | null;
  estoque_atual: number;
  estoque_min: number;
  custo_contabil: number;
  custo_reposicao: number;
  preco_venda: number;
};

export default function Estoque() {
  const supabase = createClient();
  const { profile } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchProducts();
    }
  }, [profile]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
    } finally {
      setLoading(false);
    }
  };

  // Lógica de Status (Frontend)
  const getStatus = (p: Product) => {
    if (p.estoque_atual <= p.estoque_min) return 'baixo';
    // Se o custo de repor for maior que o contábil + 10%, alerta de preço
    if (p.custo_reposicao > p.custo_contabil * 1.1) return 'atencao_preco';
    return 'ok';
  };

  // Filtro Local
  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Totais para os Cards
  const totalItens = products.length;
  const totalBaixo = products.filter(p => p.estoque_atual <= p.estoque_min).length;
  const totalPreco = products.filter(p => p.custo_reposicao > p.custo_contabil).length;

  return (
    <div className="space-y-6 pb-32">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Controle de Estoque</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie peças, preços e margens</p>
        </div>
        
        {/* Substituído Link por button com window.location para compatibilidade */}
        <button 
          onClick={() => window.location.href = "/estoque/novo"}
          className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105"
        >
          <Plus size={20} /> Novo Produto
        </button>
      </div>

      {/* 2. ALERTAS RÁPIDOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-xl text-green-600"><Package size={24} /></div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase">Total Itens</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{totalItens} <span className="text-xs font-normal text-stone-400">cadastrados</span></p>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-xl text-red-600"><AlertTriangle size={24} /></div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase">Estoque Baixo</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{totalBaixo} <span className="text-xs font-normal text-stone-400">produtos</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
          <div className="bg-yellow-100 p-3 rounded-xl text-yellow-700"><RefreshCw size={24} /></div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase">Custo Subiu</p>
            <p className="text-2xl font-bold text-[#1A1A1A]">{totalPreco} <span className="text-xs font-normal text-stone-400">revisar venda</span></p>
          </div>
        </div>
      </div>

      {/* 3. LISTAGEM */}
      <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm overflow-hidden min-h-[300px]">
        
        {/* Filtros */}
        <div className="p-4 border-b border-stone-50 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar peça por nome ou marca..." 
              className="w-full bg-[#F8F7F2] pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-[#FACC15] text-sm font-bold text-[#1A1A1A]" 
            />
          </div>
          <button className="bg-[#F8F7F2] p-3 rounded-2xl text-stone-500 hover:text-[#1A1A1A]"><Filter size={20}/></button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
               <Loader2 className="animate-spin text-[#FACC15]" size={32} />
               <p className="text-xs font-medium">Carregando estoque...</p>
             </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-[#F8F7F2] text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4 text-center">Qtd</th>
                  <th className="px-6 py-4 text-right hidden md:table-cell">Custo (NF)</th>
                  <th className="px-6 py-4 text-right hidden md:table-cell">Reposição</th>
                  <th className="px-6 py-4 text-right">Venda</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredProducts.map((p) => {
                  const status = getStatus(p);
                  return (
                    <tr key={p.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#1A1A1A]">{p.nome}</p>
                        <p className="text-xs text-stone-400">{p.marca || "Genérico"}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-bold ${p.estoque_atual <= p.estoque_min ? 'text-red-500' : 'text-[#1A1A1A]'}`}>
                          {p.estoque_atual}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-stone-400 font-mono text-xs hidden md:table-cell">
                        R$ {p.custo_contabil?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right hidden md:table-cell">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-bold ${p.custo_reposicao > p.custo_contabil ? 'text-red-500' : 'text-stone-600'}`}>
                            R$ {p.custo_reposicao?.toFixed(2)}
                          </span>
                          {p.custo_reposicao > p.custo_contabil && (
                            <span className="text-[10px] text-red-400 flex items-center gap-1">
                              <TrendingUp size={10} /> Subiu
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-[#1A1A1A] text-lg">R$ {p.preco_venda?.toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {status === 'baixo' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Baixo</span>}
                        {status === 'atencao_preco' && <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold"><RefreshCw size={12} /> Preço</span>}
                        {status === 'ok' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">OK</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {/* Substituído Link por button com window.location */}
                        <button 
                          onClick={() => window.location.href = `/estoque/${p.id}`}
                          className="p-2 hover:bg-stone-200 rounded-full text-stone-400 hover:text-[#1A1A1A] transition"
                        >
                          <ArrowRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-stone-400">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}