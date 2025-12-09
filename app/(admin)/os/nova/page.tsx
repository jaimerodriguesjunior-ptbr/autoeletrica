"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  Plus,
  Trash2,
  Save,
  MessageCircle,
  Car,
  CheckCircle,
  Wrench,
  X,
  Search,
  ChevronLeft,
  Package,
  AlertTriangle,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";

// --- TIPOS ---
type Client = { id: string; nome: string; whatsapp: string | null };
type Product = { id: string; nome: string; preco_venda: number; estoque_atual: number };
type Service = { id: string; nome: string; price: number };

type OSItem = {
  id: string | number;
  db_id: string;
  nome: string;
  valor: number;
  tipo: "peca" | "servico";
  qtd: number;
  semEstoque?: boolean;
};

type VeiculoConfirmado = {
  id: string;
  placa: string;
  modelo: string;
  fabricante?: string;
};

export default function NovaOS() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth();

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // --- CONTROLE DE ETAPAS ---
  const [step, setStep] = useState<1 | 2>(1);

  // --- ESTADOS GERAIS ---
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingVehicle, setSearchingVehicle] = useState(false);

  // Passo 1: Veículo
  const [placaInput, setPlacaInput] = useState("");
  const [placaFoto, setPlacaFoto] = useState<string | null>(null);
  const [modeloInput, setModeloInput] = useState("");
  const [fabricanteInput, setFabricanteInput] = useState("");
  const [anoInput, setAnoInput] = useState("");
  const [obsVeiculoInput, setObsVeiculoInput] = useState("");

  const [veiculoConfirmado, setVeiculoConfirmado] = useState<VeiculoConfirmado | null>(null);
  const [veiculoNaoEncontrado, setVeiculoNaoEncontrado] = useState(false);

  // Passo 2: OS
  const [defeito, setDefeito] = useState("");
  const [itens, setItens] = useState<OSItem[]>([]);
  const [fotosEvidencia, setFotosEvidencia] = useState<string[]>([]);

  // Dados do Banco
  const [listaClientes, setListaClientes] = useState<Client[]>([]);
  const [listaProdutos, setListaProdutos] = useState<Product[]>([]);
  const [listaServicos, setListaServicos] = useState<Service[]>([]);

  // Modais e Seleções
  const [clienteSelecionado, setClienteSelecionado] = useState<Client | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalClienteView, setModalClienteView] = useState<"buscar" | "cadastrar">("buscar");
  const [modalItemAberto, setModalItemAberto] = useState(false);
  const [abaItem, setAbaItem] = useState<"pecas" | "servicos">("pecas");

  // Filtros e Inputs Modais
  const [termoBuscaItem, setTermoBuscaItem] = useState("");
  const [termoBuscaCliente, setTermoBuscaCliente] = useState("");
  const [novoNomeCliente, setNovoNomeCliente] = useState("");
  const [novoZapCliente, setNovoZapCliente] = useState("");
  const [loadingCadastroRapido, setLoadingCadastroRapido] = useState(false);

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (authLoading) return;
    if (profile?.organization_id) {
      fetchDadosIniciais();
    } else {
      setLoadingInit(false);
    }
  }, [profile, authLoading]);

  const fetchDadosIniciais = async () => {
    try {
      const [clientsRes, productsRes, servicesRes] = await Promise.all([
        supabase.from("clients").select("id, nome, whatsapp").order("nome"),
        supabase.from("products").select("id, nome, preco_venda, estoque_atual").order("nome"),
        supabase.from("services").select("id, nome, price").order("nome"),
      ]);

      setListaClientes(clientsRes.data || []);
      setListaProdutos(productsRes.data || []);
      setListaServicos(servicesRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoadingInit(false);
    }
  };

  // --- FUNÇÕES DE CÂMERA ---
  const abrirCameraPlaca = () => fileInputRef.current?.click();
  const handleFotoPlaca = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setPlacaFoto(URL.createObjectURL(e.target.files[0]));
  };
  const removerFotoPlaca = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlacaFoto(null);
  };

  const abrirCameraEvidencia = () => evidenceInputRef.current?.click();
  const handleFotoEvidencia = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const novasFotos = Array.from(e.target.files).map((file) => URL.createObjectURL(file));
      setFotosEvidencia([...fotosEvidencia, ...novasFotos]);
    }
  };
  const removerFotoEvidencia = (index: number) => {
    setFotosEvidencia(fotosEvidencia.filter((_, i) => i !== index));
  };

  // --- RESET ---
  const resetarPasso1 = () => {
    setStep(1);
    setVeiculoNaoEncontrado(false);
    setPlacaInput("");
    setPlacaFoto(null);
    setModeloInput("");
    setFabricanteInput("");
    setAnoInput("");
    setObsVeiculoInput("");
    setVeiculoConfirmado(null);
  };

  // ============================================================
  // PASSO 1: VEÍCULO
  // ============================================================

 // ... (código anterior)

  const handleBuscarVeiculo = async () => {
    // Validação básica
    if (!placaInput || placaInput.length < 7) return alert("Digite uma placa válida.");
    
    setSearchingVehicle(true);
    setVeiculoNaoEncontrado(false);

    // Limpa campos para garantir que não fique lixo de memória
    setModeloInput("");
    setFabricanteInput("");
    setAnoInput("");
    setObsVeiculoInput("");

    try {
      // 1. Busca EXCLUSIVA no Banco de Dados da Oficina
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, placa, modelo, fabricante, ano, obs")
        .eq("organization_id", profile?.organization_id)
        .eq("placa", placaInput.toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // CENÁRIO A: Veículo JÁ CADASTRADO
        // Recupera os dados e avança para a OS
        setVeiculoConfirmado({
          id: data.id,
          placa: data.placa,
          modelo: data.modelo,
          fabricante: data.fabricante,
        });
        setStep(2);
      } else {
        // CENÁRIO B: Veículo NÃO CADASTRADO
        // Simplesmente libera o formulário para cadastro manual
        setVeiculoNaoEncontrado(true);
      }

    } catch (error: any) {
      console.error(error);
      alert("Erro ao buscar veículo: " + error.message);
    } finally {
      setSearchingVehicle(false);
    }
  };

  // ... (restante do código: handleCadastrarVeiculoAvancar, etc)
  
// ... (logo após o handleBuscarVeiculo)

  const handleCadastrarVeiculoAvancar = async () => {
    // Validação simples
    if (!modeloInput) return alert("Informe o modelo do veículo.");
    
    setSearchingVehicle(true);

    try {
      // Cria o veículo no banco
      const { data, error } = await supabase
        .from("vehicles")
        .insert({
          organization_id: profile?.organization_id,
          placa: placaInput.toUpperCase(),
          modelo: modeloInput,
          fabricante: fabricanteInput,
          ano: anoInput,
          obs: obsVeiculoInput,
          // Nota: Não vinculamos client_id aqui, pois o vínculo será feito na OS
        })
        .select()
        .single();

      if (error) throw error;

      // Define como confirmado e avança
      setVeiculoConfirmado({
        id: data.id,
        placa: data.placa,
        modelo: data.modelo,
        fabricante: data.fabricante,
      });
      
      setStep(2); // Vai para o passo da OS

    } catch (error: any) {
      alert("Erro ao cadastrar veículo: " + error.message);
    } finally {
      setSearchingVehicle(false);
    }
  };

  // ... (continua para handleFinalizarOS)

 // ============================================================
  // PASSO 2: FINALIZAR OS
  // ============================================================

  const handleFinalizarOS = async () => {
    if (!clienteSelecionado) return alert("Selecione um cliente.");
    if (!veiculoConfirmado) return alert("Erro: Veículo não identificado.");

    setSaving(true);

    try {
      // 1. REMOVIDO: Não atualizamos mais o dono do veículo automaticamente
      // para preservar o cadastro original. O vínculo é feito apenas na OS abaixo.
      // await supabase.from("vehicles").update({ client_id: clienteSelecionado.id }).eq("id", veiculoConfirmado.id);

      // 2. Header OS (Aqui fica gravado quem é o cliente e o carro NESTA data)
      const total = itens.reduce((acc, item) => acc + item.valor * item.qtd, 0);
      const { data: osData, error: osError } = await supabase
        .from("work_orders")
        .insert({
          organization_id: profile?.organization_id,
          client_id: clienteSelecionado.id, // O dono neste momento
          vehicle_id: veiculoConfirmado.id, // O carro
          status: "orcamento",
          description: defeito,
          total: total,
        })
        .select()
        .single();

      if (osError) throw osError;

      // 3. Itens
      if (itens.length > 0) {
        const itensParaSalvar = itens.map((item) => ({
          work_order_id: osData.id,
          organization_id: profile?.organization_id,
          product_id: item.tipo === "peca" ? item.db_id : null,
          service_id: item.tipo === "servico" ? item.db_id : null,

          // Campos novos
          tipo: item.tipo,
          name: item.nome,
          quantity: item.qtd,
          unit_price: item.valor,
          total_price: item.valor * item.qtd,

          // Campos legados (se seu banco ainda usar, senão pode ignorar)
          nome_item: item.nome,
          valor_unitario: item.valor,
          subtotal: item.valor * item.qtd,
          quantidade: item.qtd,
        }));

        const { error: itemsError } = await supabase.from("work_order_items").insert(itensParaSalvar);
        if (itemsError) throw itemsError;
      }

      alert("OS Criada com Sucesso!");
      window.location.href = "/os";
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao finalizar OS: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CADASTRO RÁPIDO DE CLIENTE (função separada)
  // ============================================================

  const handleSalvarNovoCliente = async () => {
    if (!novoNomeCliente) return alert("Nome é obrigatório");

    try {
      setLoadingCadastroRapido(true);

      const { data, error } = await supabase
        .from("clients")
        .insert({
          organization_id: profile?.organization_id,
          nome: novoNomeCliente,
          whatsapp: novoZapCliente,
        })
        .select()
        .single();

      if (error) throw error;

      const novo = { id: data.id, nome: data.nome, whatsapp: data.whatsapp };
      setListaClientes([...listaClientes, novo]);
      setClienteSelecionado(novo);
      setModalClienteAberto(false);
      setNovoNomeCliente("");
      setNovoZapCliente("");
    } catch (e: any) {
      alert("Erro ao cadastrar cliente: " + e.message);
    } finally {
      setLoadingCadastroRapido(false);
    }
  };

  // --- UTILS ---
  const selecionarItem = (item: any, tipo: "peca" | "servico") => {
    const semEstoque = tipo === "peca" && (item.estoque_atual || 0) <= 0;
    const valorUnitario = item.price || item.preco_venda || item.preco_base || 0;

    setItens([
      ...itens,
      { id: Math.random(), db_id: item.id, nome: item.nome, valor: valorUnitario, tipo, qtd: 1, semEstoque },
    ]);
    setModalItemAberto(false);
  };

  const removerItem = (id: string | number) => setItens(itens.filter((item) => item.id !== id));
  const total = itens.reduce((acc, item) => acc + item.valor * item.qtd, 0);
  const selecionarCliente = (c: Client) => {
    setClienteSelecionado(c);
    setModalClienteAberto(false);
  };

  if (loadingInit)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#FACC15]" size={40} />
      </div>
    );

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* INPUTS ESCONDIDOS */}
      <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFotoPlaca} />
      <input type="file" ref={evidenceInputRef} accept="image/*" multiple className="hidden" onChange={handleFotoEvidencia} />

      {/* CABEÇALHO */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => (step === 1 ? (window.location.href = "/os") : resetarPasso1())}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Nova OS</h1>
          <p className="text-stone-500 text-xs">
            {step === 1 ? "Passo 1: Identificar Veículo" : "Passo 2: Detalhes do Serviço"}
          </p>
        </div>
      </div>

      {/* PASSO 1 */}
      {step === 1 && (
        <div className="animate-in slide-in-from-left duration-300">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-stone-100 text-center space-y-6">
            <div className="w-16 h-16 bg-[#F8F7F2] rounded-full flex items-center justify-center mx-auto text-[#1A1A1A]">
              <Car size={32} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#1A1A1A]">Qual é o veículo?</h2>
              <p className="text-stone-400 text-sm">Digite a placa ou tire uma foto</p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  value={placaInput}
                  onChange={(e) => {
                    setPlacaInput(e.target.value.toUpperCase());
                    setVeiculoNaoEncontrado(false);
                  }}
                  placeholder="ABC-1234"
                  className="w-full text-center text-3xl font-bold uppercase tracking-widest bg-[#F8F7F2] rounded-2xl py-6 outline-none focus:ring-2 focus:ring-[#FACC15] placeholder:text-stone-300 pr-16"
                  maxLength={8}
                />
                <button
                  onClick={abrirCameraPlaca}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-stone-200 hover:border-[#FACC15] text-stone-400 hover:text-[#FACC15] transition"
                >
                  {placaFoto ? (
                    <div className="relative w-full h-full group">
                      <Image src={placaFoto} alt="Placa" fill className="object-cover rounded-lg" />
                      <div
                        onClick={removerFotoPlaca}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white rounded-lg transition-opacity"
                      >
                        <X size={14} />
                      </div>
                    </div>
                  ) : (
                    <Camera size={20} />
                  )}
                </button>
              </div>

              {veiculoNaoEncontrado && (
                <div className="bg-yellow-50 p-6 rounded-[24px] border border-yellow-100 text-left space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 text-yellow-800 text-sm font-bold border-b border-yellow-200 pb-2">
                    <AlertCircle size={16} /> Veículo Novo - Preencha os dados
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-400 ml-2">FABRICANTE</label>
                      <input
                        type="text"
                        autoFocus
                        value={fabricanteInput}
                        onChange={(e) => setFabricanteInput(e.target.value)}
                        placeholder="VW, Fiat..."
                        className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border border-yellow-200 focus:ring-2 focus:ring-[#FACC15]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-stone-400 ml-2">ANO</label>
                      <input
                        type="text"
                        value={anoInput}
                        onChange={(e) => setAnoInput(e.target.value)}
                        placeholder="2015"
                        className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border border-yellow-200 focus:ring-2 focus:ring-[#FACC15]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 ml-2">MODELO / VERSÃO</label>
                    <input
                      type="text"
                      value={modeloInput}
                      onChange={(e) => setModeloInput(e.target.value)}
                      placeholder="Ex: Gol G5 1.6 Power"
                      className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border border-yellow-200 focus:ring-2 focus:ring-[#FACC15]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-400 ml-2">OBSERVAÇÕES (Opcional)</label>
                    <input
                      type="text"
                      value={obsVeiculoInput}
                      onChange={(e) => setObsVeiculoInput(e.target.value)}
                      placeholder="Ex: Arranhão porta esquerda"
                      className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border border-yellow-200 focus:ring-2 focus:ring-[#FACC15]"
                    />
                  </div>

                  <button
                    onClick={handleCadastrarVeiculoAvancar}
                    disabled={searchingVehicle}
                    className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-xl shadow-md hover:scale-105 transition flex items-center justify-center gap-2 mt-2"
                  >
                    {searchingVehicle ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Salvar Veículo e Avançar
                  </button>
                </div>
              )}

              {!veiculoNaoEncontrado && (
                <button
                  onClick={handleBuscarVeiculo}
                  disabled={searchingVehicle || placaInput.length < 7}
                  className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl shadow-lg hover:scale-105 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {searchingVehicle ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                  Buscar Veículo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASSO 2 */}
      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          {/* Veículo */}
          <div className="bg-[#1A1A1A] text-[#FACC15] rounded-3xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-white/10 rounded-xl">
                <Car size={24} />
              </div>
              <div>
                <p className="text-xs text-white/60 font-bold uppercase">Veículo Selecionado</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-xl font-bold">{veiculoConfirmado?.placa}</h3>
                  <span className="text-sm font-medium text-white">
                    {veiculoConfirmado?.fabricante} {veiculoConfirmado?.modelo}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={resetarPasso1} className="text-xs font-bold underline hover:text-white">
              Trocar
            </button>
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
            <h3 className="font-bold text-[#1A1A1A] mb-3 flex items-center gap-2">
              <ArrowRight size={18} className="text-[#FACC15]" /> Quem é o cliente?
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="Toque para selecionar..."
                value={clienteSelecionado ? clienteSelecionado.nome : ""}
                onClick={() => {
                  setModalClienteAberto(true);
                  setModalClienteView("buscar");
                }}
                className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none cursor-pointer border border-transparent hover:border-[#FACC15] transition font-medium"
              />
              <button
                onClick={() => {
                  setModalClienteAberto(true);
                  setModalClienteView("buscar");
                }}
                className={`w-14 rounded-2xl flex items-center justify-center transition shrink-0 ${
                  clienteSelecionado ? "bg-green-100 text-green-700" : "bg-[#1A1A1A] text-white"
                }`}
              >
                {clienteSelecionado ? <CheckCircle size={24} /> : <Search size={20} />}
              </button>
            </div>
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <h3 className="font-bold text-[#1A1A1A] ml-2 flex items-center gap-2">
              <Camera size={18} /> Fotos e Evidências
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide">
              <button
                onClick={abrirCameraEvidencia}
                className="flex-none w-32 h-32 bg-white rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-2 text-stone-400 hover:border-[#FACC15] hover:text-[#FACC15] transition snap-start"
              >
                <Camera size={24} />
                <span className="text-xs font-bold">Adicionar</span>
              </button>
              {fotosEvidencia.map((foto, index) => (
                <div
                  key={index}
                  className="flex-none w-32 h-32 bg-stone-100 rounded-3xl relative overflow-hidden snap-center border border-stone-100 group"
                >
                  <Image src={foto} alt={`Evidência ${index}`} fill className="object-cover" />
                  <button
                    onClick={() => removerFotoEvidencia(index)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Relato */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
            <h3 className="font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
              <ArrowRight size={18} className="text-[#FACC15]" /> O que precisa ser feito?
            </h3>
            <textarea
              rows={3}
              value={defeito}
              onChange={(e) => setDefeito(e.target.value)}
              placeholder="Descreva o defeito ou serviço..."
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none resize-none focus:ring-2 focus:ring-[#FACC15]"
            ></textarea>
          </div>

          {/* Itens */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                <ArrowRight size={18} className="text-[#FACC15]" /> Itens do Orçamento
              </h3>
              <button
                onClick={() => setModalItemAberto(true)}
                className="text-xs font-bold bg-[#F8F7F2] text-[#1A1A1A] px-3 py-2 rounded-full flex items-center gap-1 hover:bg-[#FACC15] transition"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-[#F8F7F2] rounded-2xl">
                  <div>
                    <p className="font-bold text-sm text-[#1A1A1A]">{item.nome}</p>
                    <p className="text-[10px] text-stone-500 uppercase font-bold">
                      {item.tipo} • {item.qtd}x
                    </p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="font-bold text-[#1A1A1A]">R$ {(item.valor * item.qtd).toFixed(2)}</span>
                    <button onClick={() => removerItem(item.id)} className="text-stone-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-center text-stone-400 text-sm py-6 border-2 border-dashed border-stone-100 rounded-2xl">
                  Nenhum item adicionado.
                </p>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-stone-500 font-bold text-sm">Total Estimado</p>
              <p className="text-2xl font-bold text-[#1A1A1A]">R$ {total.toFixed(2)}</p>
            </div>
          </div>

          {/* Botão Final */}
          <div className="pt-4">
            <button
              onClick={handleFinalizarOS}
              disabled={saving}
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              Iniciar Ordem de Serviço (OS)
            </button>
          </div>
        </div>
      )}

      {/* MODAL CLIENTES */}
      {modalClienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4">
            {modalClienteView === "buscar" ? (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">Buscar Cliente</h2>
                  <button onClick={() => setModalClienteAberto(false)}>
                    <X />
                  </button>
                </div>
                <input
                  autoFocus
                  placeholder="Nome..."
                  value={termoBuscaCliente}
                  onChange={(e) => setTermoBuscaCliente(e.target.value)}
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl"
                />
                <div className="max-h-60 overflow-auto space-y-2">
                  {listaClientes
                    .filter((c) => c.nome.toLowerCase().includes(termoBuscaCliente.toLowerCase()))
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selecionarCliente(c)}
                        className="w-full text-left p-3 hover:bg-stone-50 rounded-xl font-medium"
                      >
                        {c.nome}
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => setModalClienteView("cadastrar")}
                  className="w-full py-3 border-2 border-dashed border-stone-200 rounded-xl text-stone-500 font-bold hover:border-[#FACC15]"
                >
                  Cadastrar Novo
                </button>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">Novo Cliente</h2>
                  <button onClick={() => setModalClienteView("buscar")}>
                    <ChevronLeft />
                  </button>
                </div>
                <input
                  placeholder="Nome"
                  value={novoNomeCliente}
                  onChange={(e) => setNovoNomeCliente(e.target.value)}
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl"
                />
                <input
                  placeholder="WhatsApp"
                  value={novoZapCliente}
                  onChange={(e) => setNovoZapCliente(e.target.value)}
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl"
                />
                <button
                  onClick={handleSalvarNovoCliente}
                  disabled={loadingCadastroRapido}
                  className="w-full bg-[#1A1A1A] text-[#FACC15] py-3 rounded-xl font-bold flex justify-center gap-2"
                >
                  {loadingCadastroRapido ? <Loader2 className="animate-spin" /> : "Salvar"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL ITENS */}
      {modalItemAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4 h-[500px] flex flex-col">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Adicionar Item</h2>
              <button onClick={() => setModalItemAberto(false)}>
                <X />
              </button>
            </div>
            <div className="flex gap-2 bg-[#F8F7F2] p-1 rounded-xl">
              <button
                onClick={() => setAbaItem("pecas")}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                  abaItem === "pecas" ? "bg-white shadow text-[#1A1A1A]" : "text-stone-400"
                }`}
              >
                Peças
              </button>
              <button
                onClick={() => setAbaItem("servicos")}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                  abaItem === "servicos" ? "bg-white shadow text-[#1A1A1A]" : "text-stone-400"
                }`}
              >
                Serviços
              </button>
            </div>
            <input
              autoFocus
              placeholder="Buscar..."
              value={termoBuscaItem}
              onChange={(e) => setTermoBuscaItem(e.target.value)}
              className="w-full bg-[#F8F7F2] p-3 rounded-xl"
            />
            <div className="flex-1 overflow-auto space-y-2">
              {abaItem === "pecas" &&
                listaProdutos
                  .filter((p) => p.nome.toLowerCase().includes(termoBuscaItem.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selecionarItem(p, "peca")}
                      className="w-full flex justify-between p-3 hover:bg-stone-50 rounded-xl text-left"
                    >
                      <div>
                        <p className="font-bold">{p.nome}</p>
                        <p className="text-xs text-stone-400">Estoque: {p.estoque_atual}</p>
                      </div>
                      <span className="font-bold">R$ {p.preco_venda.toFixed(2)}</span>
                    </button>
                  ))}

              {abaItem === "servicos" &&
                listaServicos
                  .filter((s) => s.nome.toLowerCase().includes(termoBuscaItem.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selecionarItem(s, "servico")}
                      className="w-full flex justify-between p-3 hover:bg-stone-50 rounded-xl text-left"
                    >
                      <p className="font-bold">{s.nome}</p>
                      <span className="font-bold">R$ {(s.price || 0).toFixed(2)}</span>
                    </button>
                  ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
