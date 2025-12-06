"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { 
  ArrowLeft, Package, DollarSign, Barcode, 
  Save, AlertCircle, Calculator, Loader2
} from "lucide-react";

export default function NovoProduto() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);

  // Estados dos Campos
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [codigoRef, setCodigoRef] = useState("");
  const [ean, setEan] = useState(""); // Código de barras (futuro)
  
  const [estoqueAtual, setEstoqueAtual] = useState("");
  const [estoqueMin, setEstoqueMin] = useState("5");
  const [localizacao, setLocalizacao] = useState("");

  // Precificação
  const [custoReposicao, setCustoReposicao] = useState(""); // Custo atual de compra
  const [custoContabil, setCustoContabil] = useState(""); // Custo da NF (opcional)
  const [margem, setMargem] = useState("50");
  const [precoVenda, setPrecoVenda] = useState("");

  // Calculadora Automática
  const calcularPrecoSugerido = () => {
    const custo = parseFloat(custoReposicao) || 0;
    const m = parseFloat(margem) || 0;
    return (custo + (custo * (m / 100))).toFixed(2);
  };

  const handleSalvar = async () => {
    if (!profile?.organization_id) return;
    if (!nome) return alert("Nome do produto é obrigatório");
    if (!precoVenda) return alert("Defina um preço de venda");

    setSaving(true);

    try {
      const { error } = await supabase.from('products').insert({
        organization_id: profile.organization_id,
        nome,
        marca,
        codigo_ref: codigoRef,
        estoque_atual: Number(estoqueAtual) || 0,
        estoque_min: Number(estoqueMin) || 0,
        custo_reposicao: Number(custoReposicao) || 0,
        custo_contabil: Number(custoContabil) || 0,
        preco_venda: Number(precoVenda) || 0,
        localizacao
      });

      if (error) throw error;

      alert("Produto cadastrado!");
      router.push("/estoque");

    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center gap-4">
        <Link href="/estoque">
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Novo Produto</h1>
          <p className="text-stone-500 text-xs">Cadastre peças ou itens de revenda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ESQUERDA: DADOS */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
            <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
              <Package size={18} /> Identificação
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">NOME DA PEÇA</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lâmpada H4" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">MARCA</label>
                  <input type="text" value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ex: Philips" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">CÓDIGO (REF)</label>
                  <input type="text" value={codigoRef} onChange={e => setCodigoRef(e.target.value)} placeholder="REF-1234" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
            <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
              <Package size={18} /> Estoque Inicial
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">QTD ATUAL</label>
                <input type="number" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} placeholder="0" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">MÍNIMO</label>
                <input type="number" value={estoqueMin} onChange={e => setEstoqueMin(e.target.value)} placeholder="5" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">LOCAL</label>
                <input type="text" value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="A-12" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]" />
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA: PREÇO */}
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>
            
            <h3 className="font-bold flex items-center gap-2 mb-6">
              <DollarSign size={18} className="text-[#FACC15]" /> Formação de Preço
            </h3>

            <div className="space-y-4 relative z-10">
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
                    placeholder="0.00" 
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
                    placeholder="50" 
                    className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-[#FACC15] transition" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">%</span>
                </div>
              </div>

              {/* Sugestão Visual */}
              <div className="bg-white/10 rounded-2xl p-4 mt-4 border border-dashed border-white/20" onClick={() => setPrecoVenda(calcularPrecoSugerido())} role="button">
                <div className="flex items-center gap-2 text-[#FACC15] mb-1">
                  <Calculator size={14} />
                  <span className="text-xs font-bold uppercase">Sugerido (Clique para usar)</span>
                </div>
                <p className="text-3xl font-bold">R$ {calcularPrecoSugerido()}</p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-[#FACC15] ml-2">PREÇO DE VENDA FINAL</label>
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

          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
             <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">CUSTO CONTÁBIL (NF)</label>
                <input type="number" value={custoContabil} onChange={e => setCustoContabil(e.target.value)} placeholder="0.00" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-stone-500 outline-none" />
              </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-24 md:bottom-6 right-6 left-6 md:left-auto md:w-96 z-40">
        <button 
          onClick={handleSalvar}
          disabled={saving}
          className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg flex justify-center items-center gap-2 hover:scale-105 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
          {saving ? "Salvando..." : "Salvar Produto"}
        </button>
      </div>

    </div>
  );
}