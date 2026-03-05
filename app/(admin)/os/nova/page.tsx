// force-reload
"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Camera,
  Plus,
  Save,
  Car,
  CheckCircle,
  X,
  Search,
  ChevronLeft,
  Loader2,
  AlertCircle,
  ArrowRight,
  Mic,
  Gauge,
  Thermometer,
  Fuel,
  Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";

// Speech Recognition type for TypeScript
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
}

// --- TIPOS ---
type Client = { id: string; nome: string; whatsapp: string | null };

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
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Speech-to-text
  const [isListening, setIsListening] = useState(false);

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

  // Passo 2: Dados do Painel
  const painelInputRef = useRef<HTMLInputElement>(null);
  const [odometro, setOdometro] = useState("");
  const [nivelCombustivel, setNivelCombustivel] = useState("");
  const [temperaturaMotor, setTemperaturaMotor] = useState("");
  const [painelObs, setPainelObs] = useState("");
  const [analisandoPainel, setAnalisandoPainel] = useState(false);
  const [painelFotoPreview, setPainelFotoPreview] = useState<string | null>(null);
  const [painelFile, setPainelFile] = useState<File | null>(null);

  // Dados do Banco
  const [listaClientes, setListaClientes] = useState<Client[]>([]);

  // Modais e Seleções
  const [clienteSelecionado, setClienteSelecionado] = useState<Client | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalClienteView, setModalClienteView] = useState<"buscar" | "cadastrar">("buscar");

  // Filtros e Inputs Modais
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
      const [clientsRes] = await Promise.all([
        supabase.from("clients").select("id, nome, whatsapp").order("nome"),
      ]);

      setListaClientes(clientsRes.data || []);
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
    setClienteSelecionado(null);

    setOdometro("");
    setNivelCombustivel("");
    setTemperaturaMotor("");
    setPainelObs("");
    setPainelFotoPreview(null);
    setPainelFile(null);
  };

  // --- ANÁLISE DO PAINEL COM IA ---
  const handleFotoPainel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setPainelFotoPreview(URL.createObjectURL(file));
    setPainelFile(file);
    setAnalisandoPainel(true);

    try {
      // Converter para base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/painel-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await res.json();

      if (data.odometro && String(data.odometro) !== 'nao_identificado') {
        setOdometro(String(data.odometro).replace(/\D/g, ''));
      }
      if (data.combustivel && String(data.combustivel) !== 'nao_identificado') {
        const mapa: Record<string, string> = { 'vazio': 'vazio', '1/4': '1/4', '1/2': '1/2', '3/4': '3/4', 'cheio': 'cheio' };
        setNivelCombustivel(mapa[data.combustivel] || String(data.combustivel));
      }
      if (data.temperatura && String(data.temperatura) !== 'nao_identificado') {
        setTemperaturaMotor(String(data.temperatura));
      }
      if (data.luzes_alerta && Array.isArray(data.luzes_alerta) && data.luzes_alerta.length > 0) {
        setPainelObs('Luzes acesas: ' + data.luzes_alerta.join(', '));
      }
    } catch (error) {
      console.error('Erro ao analisar painel:', error);
      alert('Não foi possível analisar a foto. Preencha os campos manualmente.');
    } finally {
      setAnalisandoPainel(false);
    }
  };

  // ============================================================
  // PASSO 1: VEÍCULO
  // ============================================================

  const handleBuscarVeiculo = async () => {
    if (!placaInput || placaInput.length < 7) return alert("Digite uma placa válida.");

    setSearchingVehicle(true);
    setVeiculoNaoEncontrado(false);

    setModeloInput("");
    setFabricanteInput("");
    setAnoInput("");
    setObsVeiculoInput("");

    try {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          id, placa, modelo, fabricante, ano, obs,
          clients ( id, nome, whatsapp )
        `)
        .eq("organization_id", profile?.organization_id)
        .eq("placa", placaInput.toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setVeiculoConfirmado({
          id: data.id,
          placa: data.placa,
          modelo: data.modelo,
          fabricante: data.fabricante,
        });

        // @ts-ignore
        if (data.clients) {
          // @ts-ignore
          setClienteSelecionado(data.clients);
        }

        setStep(2);
      } else {
        setVeiculoNaoEncontrado(true);
      }

    } catch (error: any) {
      console.error(error);
      alert("Erro ao buscar veículo: " + error.message);
    } finally {
      setSearchingVehicle(false);
    }
  };

  const handleCadastrarVeiculoAvancar = async () => {
    if (!modeloInput) return alert("Informe o modelo do veículo.");

    setSearchingVehicle(true);

    try {
      const { data, error } = await supabase
        .from("vehicles")
        .insert({
          organization_id: profile?.organization_id,
          placa: placaInput.toUpperCase(),
          modelo: modeloInput,
          fabricante: fabricanteInput,
          ano: anoInput,
          obs: obsVeiculoInput,
        })
        .select()
        .single();

      if (error) throw error;

      setVeiculoConfirmado({
        id: data.id,
        placa: data.placa,
        modelo: data.modelo,
        fabricante: data.fabricante,
      });
      setStep(2);

    } catch (error: any) {
      alert("Erro ao cadastrar veículo: " + error.message);
    } finally {
      setSearchingVehicle(false);
    }
  };

  // ============================================================
  // PASSO 2: FINALIZAR OS
  // ============================================================

  const handleFinalizarOS = async () => {
    if (!clienteSelecionado) return alert("Selecione um cliente.");
    if (!veiculoConfirmado) return alert("Erro: Veículo não identificado.");

    setSaving(true);

    try {
      const { data: osData, error: osError } = await supabase
        .from("work_orders")
        .insert({
          organization_id: profile?.organization_id,
          client_id: clienteSelecionado.id,
          vehicle_id: veiculoConfirmado.id,
          status: "orcamento",
          description: defeito,
          odometro: odometro || null,
          nivel_combustivel: nivelCombustivel || null,
          temperatura_motor: temperaturaMotor || null,
          painel_obs: painelObs || null,
        })
        .select()
        .single();

      if (osError) throw osError;

      await supabase
        .from("vehicles")
        .update({ client_id: clienteSelecionado.id })
        .eq("id", veiculoConfirmado.id);



      // Upload foto do painel (se houver)
      if (painelFile) {
        const fileExt = painelFile.name.split('.').pop();
        const fileName = `${osData.id}/painel_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('os-images')
          .upload(fileName, painelFile);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('os-images')
            .getPublicUrl(fileName);

          const painelUrl = publicUrlData.publicUrl;

          await supabase
            .from('work_orders')
            .update({
              painel_foto: painelUrl,
              photos: [painelUrl]
            })
            .eq('id', osData.id);
        }
      }

      alert("OS Criada com Sucesso!");
      window.location.href = `/os/detalhes/${osData.id}`;

    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao finalizar OS: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // CADASTRO RÁPIDO DE CLIENTE
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* INPUTS ESCONDIDOS */}
      <input type="file" ref={fileInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFotoPlaca} />

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
                  placeholder="ABC1234"
                  className="w-full text-center text-3xl font-bold uppercase tracking-widest bg-[#F8F7F2] rounded-2xl py-6 outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] placeholder:text-stone-300 pr-16"
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
                className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none cursor-pointer border-2 border-stone-300 hover:border-[#FACC15] transition font-medium"
              />
              <button
                onClick={() => {
                  setModalClienteAberto(true);
                  setModalClienteView("buscar");
                }}
                className={`w-14 rounded-2xl flex items-center justify-center transition shrink-0 ${clienteSelecionado ? "bg-green-100 text-green-700" : "bg-[#1A1A1A] text-white"
                  }`}
              >
                {clienteSelecionado ? <CheckCircle size={24} /> : <Search size={20} />}
              </button>
            </div>
          </div>

          {clienteSelecionado && (
            <>
              {/* CHECKLIST DO VEÍCULO (Dados do Painel) */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
                <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                  <ArrowRight size={18} className="text-[#FACC15]" /> Checklist do Veículo
                </h3>

                {/* Input oculto para câmera do painel */}
                <input type="file" ref={painelInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFotoPainel} />

                {/* Odômetro com câmera */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Gauge size={12} /> ODÔMETRO (KM)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={odometro}
                      onChange={(e) => setOdometro(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ex: 45230"
                      className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] font-bold outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (painelInputRef.current) painelInputRef.current.value = '';
                        painelInputRef.current?.click();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-stone-200 hover:border-[#FACC15] text-stone-400 hover:text-[#FACC15] transition"
                    >
                      {analisandoPainel ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : painelFotoPreview ? (
                        <div className="relative w-full h-full">
                          <Image src={painelFotoPreview} alt="Painel" fill className="object-cover rounded-lg" />
                        </div>
                      ) : (
                        <Camera size={18} />
                      )}
                    </button>
                  </div>
                  {analisandoPainel && (
                    <p className="text-xs text-[#FACC15] font-bold ml-2 animate-pulse flex items-center gap-1">
                      <Eye size={12} /> IA analisando o painel...
                    </p>
                  )}
                </div>

                {/* Nível de Combustível */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Fuel size={12} /> NÍVEL DE COMBUSTÍVEL
                  </label>
                  <div className="flex gap-2">
                    {[
                      { val: 'vazio', label: 'Vazio' },
                      { val: '1/4', label: '¼' },
                      { val: '1/2', label: '½' },
                      { val: '3/4', label: '¾' },
                      { val: 'cheio', label: 'Cheio' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setNivelCombustivel(opt.val)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-2 ${nivelCombustivel === opt.val
                          ? 'bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A] shadow-md'
                          : 'bg-[#F8F7F2] text-stone-500 border-stone-300 hover:border-[#FACC15]'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Temperatura */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Thermometer size={12} /> TEMPERATURA DO MOTOR
                  </label>
                  <div className="flex gap-2">
                    {[
                      { val: 'normal', label: 'Normal', color: 'bg-green-100 text-green-700 border-green-300' },
                      { val: 'elevada', label: 'Elevada', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                      { val: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-700 border-red-300' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTemperaturaMotor(opt.val)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-2 ${temperaturaMotor === opt.val
                          ? `${opt.color} shadow-md scale-105`
                          : 'bg-[#F8F7F2] text-stone-500 border-stone-300 hover:border-[#FACC15]'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <AlertCircle size={12} /> OBSERVAÇÕES DO PAINEL
                  </label>
                  <textarea
                    rows={3}
                    value={painelObs}
                    onChange={(e) => setPainelObs(e.target.value)}
                    placeholder="Luzes acesas, barulhos, ou observações da inspeção..."
                    className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none resize-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] text-sm"
                  ></textarea>
                </div>
              </div>

              {/* CARD 1: RELATO (Defeito) */}
              <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                    <ArrowRight size={18} className="text-[#FACC15]" /> Reclamação do cliente/Problema
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        recognitionRef.current?.stop();
                        return;
                      }
                      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                      if (!SpeechRecognition) {
                        alert("Seu navegador não suporta reconhecimento de voz. Use o Google Chrome.");
                        return;
                      }
                      const recognition: ISpeechRecognition = new SpeechRecognition();
                      recognition.lang = "pt-BR";
                      recognition.interimResults = false;
                      recognition.continuous = true;
                      recognitionRef.current = recognition;
                      recognition.onresult = (event: any) => {
                        let transcript = "";
                        for (let i = event.resultIndex; i < event.results.length; i++) {
                          if (event.results[i].isFinal) {
                            transcript += event.results[i][0].transcript;
                          }
                        }
                        if (transcript) {
                          setDefeito((prev) => prev ? prev + " " + transcript : transcript);
                        }
                      };
                      recognition.onend = () => setIsListening(false);
                      recognition.onerror = () => setIsListening(false);
                      recognition.start();
                      setIsListening(true);
                    }}
                    className={`p-2.5 rounded-full transition-all duration-200 ${isListening
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse"
                      : "bg-[#F8F7F2] text-stone-500 hover:bg-[#FACC15] hover:text-[#1A1A1A]"
                      }`}
                    title={isListening ? "Parar gravação" : "Falar o problema"}
                  >
                    <Mic size={18} />
                  </button>
                </div>
                {isListening && (
                  <div className="flex items-center gap-2 mb-2 animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold text-red-500">Estou ouvindo... fale o problema do veículo</span>
                  </div>
                )}
                <textarea
                  rows={3}
                  value={defeito}
                  onChange={(e) => setDefeito(e.target.value)}
                  placeholder="Descreva o defeito ou serviço..."
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none resize-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                ></textarea>
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
            </>
          )}
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
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
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
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
                />
                <input
                  placeholder="WhatsApp"
                  value={novoZapCliente}
                  onChange={(e) => setNovoZapCliente(e.target.value)}
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
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

    </div>
  );
}
