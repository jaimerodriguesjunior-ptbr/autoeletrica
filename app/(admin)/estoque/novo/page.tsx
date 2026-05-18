"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { getCompanySettings } from "@/src/actions/fiscal";
import {
  ArrowLeft, Package, DollarSign, Barcode,
  Save, AlertCircle, Calculator, Loader2, Wallet, Sparkles, X
} from "lucide-react";

export default function NovoProduto() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [fetchingNCM, setFetchingNCM] = useState(false);
  const [ncmOptions, setNcmOptions] = useState<{ code: string; description: string }[] | null>(null);
  const [ncmAiStatus, setNcmAiStatus] = useState<{ label: string; tone: "green" | "yellow" | "red"; confidence?: number } | null>(null);

  // Estados dos Campos
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [codigoRef, setCodigoRef] = useState("");
  const [ean, setEan] = useState("");
  const [ncm, setNcm] = useState("");

  const [estoqueAtual, setEstoqueAtual] = useState("");
  const [estoqueMin, setEstoqueMin] = useState("5");
  const [localizacao, setLocalizacao] = useState("");

  // Precificação
  const [custoReposicao, setCustoReposicao] = useState("");
  const [custoContabil, setCustoContabil] = useState("");

  // --- ALTERADO: Margem padrão agora é 100% ---
  const [margem, setMargem] = useState("100");
  const [precoVenda, setPrecoVenda] = useState("");

  // Markup da empresa
  const [markupAtivo, setMarkupAtivo] = useState(false);
  const [markupValor, setMarkupValor] = useState(2.0);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getCompanySettings();
      if (settings) {
        setMarkupAtivo(settings.aplicar_markup_importacao ?? false);
        setMarkupValor(settings.markup_valor_importacao ?? 2.0);
      }
    };
    loadSettings();
  }, []);

  // --- NOVO: Lógica de Espelhamento ---
  // Quando muda o Custo Real, atualiza também o de Reposição
  const handleCustoRealChange = (valor: string) => {
    setCustoContabil(valor);
    setCustoReposicao(valor);
    // Auto-aplicar markup se configurado
    if (markupAtivo && valor) {
      const custo = parseFloat(valor) || 0;
      setPrecoVenda((custo * markupValor).toFixed(2));
    }
  };

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
        ean: ean || null,
        ncm: ncm ? ncm.replace(/\D/g, "").slice(0, 8) : null,
        estoque_atual: Number(estoqueAtual) || 0,
        estoque_min: Number(estoqueMin) || 0,
        custo_reposicao: Number(custoReposicao) || 0,
        custo_contabil: Number(custoContabil) || 0,
        preco_venda: Number(precoVenda) || 0,
        localizacao
      });

      if (error) throw error;

      // Contribui para a base global se EAN for válido
      if (ean && /^\d{8}$|^\d{12}$|^\d{13}$/.test(ean)) {
        await supabase.rpc('upsert_global_product', {
          p_ean: ean,
          p_name: nome,
          p_brand: marca || null,
          p_reference_code: codigoRef || null
        });
      }

      alert("Produto cadastrado!");
      router.push("/estoque");

    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFetchNCM = async () => {
    if (!nome.trim()) {
      alert("Preencha a descrição/nome da peça antes de buscar NCM.");
      return;
    }

    setFetchingNCM(true);
    try {
      const res = await fetch("/api/fiscal/ncm-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: nome })
      });
      const data = await res.json();
      const confidence = typeof data.confidence === "number" ? Math.max(0, Math.min(100, Math.round(data.confidence))) : undefined;
      const status = data.error
        ? { label: "Sem confiança", tone: "red" as const, confidence }
        : data.needs_review
          ? { label: "Revisar", tone: "yellow" as const, confidence }
          : { label: "Confiável", tone: "green" as const, confidence };
      setNcmAiStatus(status);

      if (data.options && data.options.length > 1) {
        setNcmOptions(data.options);
      } else if (data.recommendation) {
        setNcm(String(data.recommendation).replace(/\D/g, "").slice(0, 8));
      } else if (data.options?.[0]?.code) {
        setNcm(String(data.options[0].code).replace(/\D/g, "").slice(0, 8));
      } else {
        alert(data.error || "A IA não conseguiu sugerir um NCM confiável.");
      }
    } catch (e: any) {
      alert("Erro ao buscar NCM com IA: " + e.message);
    } finally {
      setFetchingNCM(false);
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
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lâmpada H4" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">MARCA</label>
                  <input type="text" value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ex: Philips" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">CÓDIGO (REF)</label>
                  <input type="text" value={codigoRef} onChange={e => setCodigoRef(e.target.value)} placeholder="REF-1234" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1"><Barcode size={12} /> EAN (CÓDIGO DE BARRAS)</label>
                <input type="text" value={ean} onChange={e => setEan(e.target.value)} placeholder="Ex: 7891234567890" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">NCM</label>
                {ncmAiStatus && (
                  <div className={`ml-2 mt-1 inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    ncmAiStatus.tone === "green"
                      ? "bg-emerald-100 text-emerald-700"
                      : ncmAiStatus.tone === "yellow"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}>
                    <span>{ncmAiStatus.label}</span>
                    {typeof ncmAiStatus.confidence === "number" && <span>{ncmAiStatus.confidence}%</span>}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ncm}
                    onChange={e => {
                      setNcm(e.target.value.replace(/\D/g, "").slice(0, 8));
                      setNcmAiStatus(null);
                    }}
                    placeholder="Ex: 84099120"
                    maxLength={8}
                    className="flex-1 bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  />
                  <button
                    type="button"
                    onClick={handleFetchNCM}
                    disabled={fetchingNCM}
                    className="px-4 rounded-2xl border-2 border-stone-300 bg-white hover:bg-stone-50 text-[#1A1A1A] font-bold text-xs flex items-center gap-2 disabled:opacity-60"
                  >
                    {fetchingNCM ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    IA
                  </button>
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
                <input type="number" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} placeholder="0" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">MÍNIMO</label>
                <input type="number" value={estoqueMin} onChange={e => setEstoqueMin(e.target.value)} placeholder="5" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">LOCAL</label>
                <input type="text" value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="A-12" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]" />
              </div>
            </div>
          </div>
        </div>

        {/* DIREITA: PREÇO (LAYOUT NOVO) */}
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>

            <h3 className="font-bold flex items-center gap-2 mb-6">
              <DollarSign size={18} className="text-[#FACC15]" /> Formação de Preço
            </h3>

            <div className="space-y-4 relative z-10">

              {/* --- 1. CUSTO REAL (NOVO LUGAR) --- */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                  CUSTO REAL DE COMPRA <Wallet size={10} />
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">R$</span>
                  <input
                    type="number"
                    value={custoContabil}
                    onChange={(e) => handleCustoRealChange(e.target.value)} // Gatilho duplo
                    placeholder="0.00"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-10 font-bold text-white outline-none focus:border-[#FACC15] transition focus:bg-white/10"
                  />
                </div>
              </div>

              {/* --- 2. CUSTO REPOSIÇÃO (ESPELHADO MAS EDITÁVEL) --- */}
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
                    placeholder="100"
                    className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 font-bold text-white outline-none focus:border-[#FACC15] transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500">%</span>
                </div>
              </div>

              {/* Sugestão Visual */}
              <div className="bg-white/10 rounded-2xl p-4 mt-4 border border-dashed border-white/20 cursor-pointer hover:bg-white/20 transition" onClick={() => setPrecoVenda(calcularPrecoSugerido())} role="button">
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

          {/* REMOVIDO: Antigo bloco do Custo Contábil */}

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

      {ncmOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[24px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#1A1A1A]">Escolha o NCM sugerido</h3>
              <button onClick={() => setNcmOptions(null)} className="text-stone-400 hover:text-[#1A1A1A]"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {ncmOptions.map((opt, i) => (
                <button
                  key={`${opt.code}-${i}`}
                  onClick={() => { setNcm(opt.code); setNcmOptions(null); }}
                  className="w-full text-left border border-stone-200 rounded-xl p-3 hover:bg-stone-50"
                >
                  <p className="font-bold text-[#1A1A1A]">{opt.code}</p>
                  <p className="text-xs text-stone-500">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
