"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  Search, Plus, Package, AlertTriangle,
  TrendingUp, Filter, RefreshCw, ArrowRight, Loader2, Wrench, Edit, Trash2, X, Save, AlertCircle, FileJson
} from "lucide-react";

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

type Service = {
  id: string;
  nome: string;
  price: number;
};

export default function EstoqueEServicos() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'products' | 'services'>('products');

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState<'todos' | 'baixo' | 'preco'>('todos');

  // Dados
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Estados do Modal de Serviço
  const [modalServiceOpen, setModalServiceOpen] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, servRes] = await Promise.all([
        supabase.from('products').select('*').order('nome', { ascending: true }),
        supabase.from('services').select('*').order('nome', { ascending: true })
      ]);

      if (prodRes.error) throw prodRes.error;
      if (servRes.error) throw servRes.error;

      setProducts(prodRes.data || []);
      setServices(servRes.data || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE PRODUTOS ---
  const getProductStatus = (p: Product) => {
    if (p.estoque_atual <= p.estoque_min) return 'baixo';
    if (p.custo_reposicao > p.custo_contabil) return 'atencao_preco';
    return 'ok';
  };

  const filteredProducts = products.filter(p => {
    // 1. Filtro de Texto
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca && p.marca.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Filtro de Categoria (Botões)
    if (productFilter === 'baixo') return p.estoque_atual <= p.estoque_min;
    if (productFilter === 'preco') return p.custo_reposicao > p.custo_contabil;

    return true;
  });

  // --- LÓGICA DE SERVIÇOS ---
  const filteredServices = services.filter(s =>
    s.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openServiceModal = (service?: Service) => {
    if (service) {
      setCurrentServiceId(service.id);
      setServiceName(service.nome);
      setServicePrice(service.price.toString());
    } else {
      setCurrentServiceId(null);
      setServiceName("");
      setServicePrice("");
    }
    setModalServiceOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceName || !servicePrice) return alert("Preencha nome e preço.");
    setServiceSaving(true);

    try {
      const payload = {
        organization_id: profile?.organization_id,
        nome: serviceName,
        price: Number(servicePrice)
      };

      if (currentServiceId) {
        const { error } = await supabase.from('services').update(payload).eq('id', currentServiceId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }

      await fetchData();
      setModalServiceOpen(false);
    } catch (error: any) {
      alert("Erro ao salvar serviço: " + error.message);
    } finally {
      setServiceSaving(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    }
  };

  // Totais para o Dashboard Rápido
  const totalItens = products.length;
  const totalBaixo = products.filter(p => p.estoque_atual <= p.estoque_min).length;
  const totalDefasado = products.filter(p => p.custo_reposicao > p.custo_contabil).length;

  return (
    <div className="space-y-6 pb-32">

      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Estoque e Serviços</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie seu catálogo de peças e mão de obra</p>
        </div>

        {view === 'products' ? (
          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = "/estoque/importar"}
              className="bg-white hover:bg-stone-50 text-[#1A1A1A] px-6 py-3 rounded-full font-bold text-sm shadow-md flex items-center gap-2 border border-stone-200 transition"
            >
              <FileJson size={20} /> Importar XML
            </button>
            <button
              onClick={() => window.location.href = "/estoque/novo"}
              className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105"
            >
              <Plus size={20} /> Novo Produto
            </button>
          </div>
        ) : (
          <button
            onClick={() => openServiceModal()}
            className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105"
          >
            <Plus size={20} /> Novo Serviço
          </button>
        )}
      </div>

      {/* 2. SELETOR DE ABAS PRINCIPAIS (MOVIDO PARA CIMA) */}
      <div className="flex p-1 bg-stone-200 rounded-[20px] w-fit">
        <button
          onClick={() => setView('products')}
          className={`px-6 py-3 rounded-[16px] text-sm font-bold transition-all ${view === 'products' ? 'bg-white text-[#1A1A1A] shadow-md' : 'text-stone-500 hover:text-stone-700'
            }`}
        >
          Produtos / Peças
        </button>
        <button
          onClick={() => setView('services')}
          className={`px-6 py-3 rounded-[16px] text-sm font-bold transition-all ${view === 'services' ? 'bg-white text-[#1A1A1A] shadow-md' : 'text-stone-500 hover:text-stone-700'
            }`}
        >
          Mão de Obra
        </button>
      </div>

      {/* 3. ALERTAS RÁPIDOS (MOVIDO PARA BAIXO - Visíveis apenas na aba Produtos) */}
      {view === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Package size={24} /></div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase">Total Itens</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">{totalItens}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl text-red-600"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase">Reposição Urgente</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">{totalBaixo}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[24px] shadow-sm border border-stone-100 flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-xl text-yellow-600"><TrendingUp size={24} /></div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase">Preço Defasado</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">{totalDefasado}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. ÁREA DE LISTAGEM */}
      <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm overflow-hidden min-h-[300px]">

        {/* BARRA DE FERRAMENTAS */}
        <div className="p-4 border-b border-stone-50 space-y-4">
          {/* Busca Geral */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={view === 'products' ? "Buscar peça por nome, marca..." : "Buscar serviço..."}
              className="w-full bg-[#F8F7F2] pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-[#FACC15] text-sm font-bold text-[#1A1A1A]"
            />
          </div>

          {/* Filtros Específicos de Produto */}
          {view === 'products' && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setProductFilter('todos')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition whitespace-nowrap ${productFilter === 'todos' ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setProductFilter('baixo')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1 whitespace-nowrap ${productFilter === 'baixo' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-stone-500 border-stone-200 hover:bg-red-50 hover:text-red-500'
                  }`}
              >
                <AlertTriangle size={14} /> Estoque Baixo
              </button>
              <button
                onClick={() => setProductFilter('preco')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1 whitespace-nowrap ${productFilter === 'preco' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-stone-500 border-stone-200 hover:bg-yellow-50 hover:text-yellow-600'
                  }`}
              >
                <TrendingUp size={14} /> Alerta de Preço
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
              <Loader2 className="animate-spin text-[#FACC15]" size={32} />
              <p className="text-xs font-medium">Carregando catálogo...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-[#F8F7F2] text-stone-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  {view === 'products' && <th className="px-6 py-4 text-center">Qtd</th>}
                  <th className="px-6 py-4 text-right">Valor Venda</th>
                  {view === 'products' && <th className="px-6 py-4 text-center">Status</th>}
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm">

                {/* --- LISTA DE PRODUTOS --- */}
                {view === 'products' && filteredProducts.map((p) => {
                  const status = getProductStatus(p);
                  return (
                    <tr key={p.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#1A1A1A]">{p.nome}</p>
                        <p className="text-xs text-stone-400">{p.marca || "Marca não inf."}</p>
                        {status === 'atencao_preco' && (
                          <div className="mt-1 flex items-center gap-2 text-[10px] bg-yellow-50 text-yellow-700 px-2 py-1 rounded w-fit">
                            <span>Pagou: R$ {p.custo_contabil.toFixed(2)}</span>
                            <ArrowRight size={10} />
                            <span className="font-bold">Hoje: R$ {p.custo_reposicao.toFixed(2)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-bold ${p.estoque_atual <= p.estoque_min ? 'text-red-500' : 'text-[#1A1A1A]'}`}>
                          {p.estoque_atual}
                        </span>
                        {p.estoque_atual <= p.estoque_min && <p className="text-[9px] text-red-400 font-bold">Mín: {p.estoque_min}</p>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-[#1A1A1A] text-lg">R$ {p.preco_venda?.toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {status === 'baixo' && <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Baixo</span>}
                        {status === 'atencao_preco' && <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold"><RefreshCw size={12} /> Defasado</span>}
                        {status === 'ok' && <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">OK</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
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

                {/* --- LISTA DE SERVIÇOS --- */}
                {view === 'services' && filteredServices.map((s) => (
                  <tr key={s.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-[#1A1A1A]">{s.nome}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="font-bold text-[#1A1A1A] text-lg">R$ {s.price?.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => openServiceModal(s)} className="p-2 hover:bg-stone-200 rounded-full text-stone-400 hover:text-[#1A1A1A] transition">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDeleteService(s.id)} className="p-2 hover:bg-red-50 rounded-full text-stone-400 hover:text-red-500 transition">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && ((view === 'products' && filteredProducts.length === 0) || (view === 'services' && filteredServices.length === 0)) && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-stone-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle size={32} className="text-stone-300" />
                        <p>Nenhum item encontrado com estes filtros.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL SERVIÇO */}
      {modalServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                <Wrench size={24} /> {currentServiceId ? "Editar Serviço" : "Novo Serviço"}
              </h2>
              <button onClick={() => setModalServiceOpen(false)}><X /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2">NOME DO SERVIÇO</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={e => setServiceName(e.target.value)}
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium"
                  placeholder="Ex: Instalação de Som"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-400 ml-2">PREÇO BASE (R$)</label>
                <input
                  type="number"
                  value={servicePrice}
                  onChange={e => setServicePrice(e.target.value)}
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>

            <button
              onClick={handleSaveService}
              disabled={serviceSaving}
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl flex justify-center gap-2 hover:scale-105 transition"
            >
              {serviceSaving ? <Loader2 className="animate-spin" /> : <Save />} Salvar Serviço
            </button>
          </div>
        </div>
      )}

    </div>
  );
}