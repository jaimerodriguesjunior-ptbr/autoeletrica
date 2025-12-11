"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { 
  ArrowLeft, Package, DollarSign, 
  Save, Calculator, Trash2, Loader2, AlertCircle, Wallet
} from "lucide-react";

export default function EditarProduto() {
  const router = useRouter();
  const { id } = useParams(); // Pega o ID da URL
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [codigoRef, setCodigoRef] = useState("");
  
  const [estoqueAtual, setEstoqueAtual] = useState("");
  const [estoqueMin, setEstoqueMin] = useState("");
  const [localizacao, setLocalizacao] = useState("");

  const [custoReposicao, setCustoReposicao] = useState("");
  const [custoContabil, setCustoContabil] = useState(""); 
  const [margem, setMargem] = useState("100"); // Padrão ajustado para 100%
  const [precoVenda, setPrecoVenda] = useState("");

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setNome(data.nome);
        setMarca(data.marca || "");
        setCodigoRef(data.codigo_ref || "");
        setEstoqueAtual(data.estoque_atual.toString());
        setEstoqueMin(data.estoque_min.toString());
        setLocalizacao(data.localizacao || "");
        
        setCustoReposicao(data.custo_reposicao.toString());
        setCustoContabil(data.custo_contabil?.toString() || "0");
        
        // Se já tiver preço, tenta calcular a margem real, senão usa 100
        // (Lógica simples para não quebrar visualmente, mas o usuário pode ajustar)
        setPrecoVenda(data.preco_venda.toString());
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao carregar produto.");
      router.push("/estoque");
    } finally {
      setLoading(false);
    }
  };

  // --- NOVO: Lógica de Espelhamento ---
  const handleCustoRealChange = (valor: string) => {
    setCustoContabil(valor);
    // Ao editar o custo real, atualiza o de reposição automaticamente
    setCustoReposicao(valor);
  };

  const handleUpdate = async () => {
    if (!profile?.organization_id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({
          nome,
          marca,
          codigo_ref: codigoRef,
          estoque_atual: Number(estoqueAtual),
          estoque_min: Number(estoqueMin),
          custo_reposicao: Number(custoReposicao),
          custo_contabil: Number(custoContabil),
          preco_venda: Number(precoVenda),
          localizacao
        })
        .eq('id', id);

      if (error) throw error;

      alert("Produto atualizado!");
      router.push("/estoque");

    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      router.push("/estoque");
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    }
  };

  const calcularPrecoSugerido = () => {
    const custo = parseFloat(custoReposicao) || 0;
    const m = parseFloat(margem) || 0;
    return (custo + (custo * (m / 100))).toFixed(2);
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#FACC15]" size={40}/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/estoque">
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Editar Produto</h1>
            <p className="text-stone-500 text-xs">Gerencie os detalhes deste item</p>
          </div>
        </div>

        <button onClick={handleDelete} className="text-red-400 hover:text-red-600 flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full hover:bg-red-50 transition">
          <Trash2 size={18} /> Excluir Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* DADOS (ESQUERDA) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
            <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
              <Package size={18} /> Identificação
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">NOME DA PEÇA</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">MARCA</label>
                  <input type="text" value={marca} onChange={e => setMarca(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">CÓDIGO (REF)</label>
                  <input type="text" value={codigoRef} onChange={e => setCodigoRef(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
            <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
              <Package size={18} /> Estoque
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">QTD ATUAL</label>
                <input type="number" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">MÍNIMO</label>
                <input type="number" value={estoqueMin} onChange={e => setEstoqueMin(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">LOCAL</label>
                <input type="text" value={localizacao} onChange={e => setLocalizacao(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
            </div>
          </div>
        </div>

        {/* PREÇOS (DIREITA) */}
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>
            
            <h3 className="font-bold flex items-center gap-2 mb-6">
              <DollarSign size={18} className="text-[#FACC15]" /> Precificação
            </h3>

            <div className="space-y-4 relative z-10">
              
              {/* --- 1. CUSTO REAL (NOVA POSIÇÃO E ESTILO) --- */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                   CUSTO REAL DE COMPRA <Wallet size={10} />
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">R$</span>
                  <input 
                    type="number" 
                    value={custoContabil} 
                    onChange={e => handleCustoRealChange(e.target.value)} // Gatilho do espelhamento
                    placeholder="0.00" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-10 font-bold text-white outline-none focus:border-[#FACC15] transition focus:bg-white/10" 
                  />
                </div>
              </div>

              {/* --- 2. CUSTO REPOSIÇÃO --- */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                  CUSTO REPOSIÇÃO <AlertCircle size={10} />
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">R$</span>
                  <input 
                    type="number" 
                    value={custoReposicao}
                    onChange={(e) => setCustoReposicao(e.target.value)}
                    className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 pl-10 font-bold text-white outline-none focus:border-[#FACC15] transition" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">MARGEM DE LUCRO %</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={margem}
                    onChange={(e) => setMargem(e.target.value)}
                    className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-[#FACC15] transition" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">%</span>
                </div>
              </div>

              {/* Sugestão Visual */}
              <div className="bg-white/10 rounded-2xl p-4 mt-4 border border-dashed border-white/20 cursor-pointer hover:bg-white/20 transition" onClick={() => setPrecoVenda(calcularPrecoSugerido())} role="button">
                <div className="flex items-center gap-2 text-[#FACC15] mb-1">
                  <Calculator size={14} />
                  <span className="text-xs font-bold uppercase">Sugerido (Clique)</span>
                </div>
                <p className="text-2xl font-bold">R$ {calcularPrecoSugerido()}</p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-[#FACC15] ml-2">PREÇO DE VENDA</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1A1A1A] font-bold">R$</span>
                  <input 
                    type="number" 
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(e.target.value)}
                    className="w-full bg-[#FACC15] text-[#1A1A1A] rounded-2xl p-4 pl-10 font-bold outline-none shadow-lg transition" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* O BLOCO BRANCO QUE FICAVA AQUI FOI REMOVIDO */}

        </div>
      </div>

      <div className="fixed bottom-24 md:bottom-6 right-6 left-6 md:left-auto md:w-96 z-40">
        <button 
          onClick={handleUpdate}
          disabled={saving}
          className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg flex justify-center items-center gap-2 hover:scale-105 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

    </div>
  );
}