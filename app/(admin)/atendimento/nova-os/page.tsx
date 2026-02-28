"use client";

import { useState, useRef, useEffect } from "react";
import {
    ArrowLeft,
    Camera,
    Plus,
    Trash2,
    Save,
    Car,
    CheckCircle,
    X,
    Search,
    ChevronLeft,
    Loader2,
    AlertCircle,
    ArrowRight,
    Minus,
    Calendar,
    Mic,
    Gauge,
    Thermometer,
    Fuel,
    Eye,
    UserCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
    pecaCliente?: boolean;
};

type VeiculoConfirmado = {
    id: string;
    placa: string;
    modelo: string;
    fabricante?: string;
};

export default function NovaOS() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const appointmentToken = searchParams.get('appointment_token');
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
    const [previsaoEntrega, setPrevisaoEntrega] = useState("");

    // Passo 2: Dados do Painel
    const painelInputRef = useRef<HTMLInputElement>(null);
    const [odometro, setOdometro] = useState("");
    const [nivelCombustivel, setNivelCombustivel] = useState("");
    const [temperaturaMotor, setTemperaturaMotor] = useState("");
    const [painelObs, setPainelObs] = useState("");
    const [analisandoPainel, setAnalisandoPainel] = useState(false);
    const [painelFotoPreview, setPainelFotoPreview] = useState<string | null>(null);
    const [painelFile, setPainelFile] = useState<File | null>(null);

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
        setClienteSelecionado(null);
        setPrevisaoEntrega("");
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
            const total = itens.reduce((acc, item) => item.pecaCliente ? acc : acc + item.valor * item.qtd, 0);

            const insertPayload: any = {
                organization_id: profile?.organization_id,
                client_id: clienteSelecionado.id,
                vehicle_id: veiculoConfirmado.id,
                status: "orcamento",
                description: defeito,
                total: total,
                previsao_entrega: previsaoEntrega || null,
                odometro: odometro || null,
                nivel_combustivel: nivelCombustivel || null,
                temperatura_motor: temperaturaMotor || null,
                painel_obs: painelObs || null,
            };

            // Herdar token do agendamento (consistência do portal)
            if (appointmentToken) {
                insertPayload.public_token = appointmentToken;
            }

            const { data: osData, error: osError } = await supabase
                .from("work_orders")
                .insert(insertPayload)
                .select()
                .single();

            if (osError) throw osError;

            // Vincular agendamento à OS criada
            if (appointmentToken) {
                await supabase
                    .from('appointments')
                    .update({ work_order_id: osData.id })
                    .eq('token', appointmentToken);
            }

            await supabase
                .from("vehicles")
                .update({ client_id: clienteSelecionado.id })
                .eq("id", veiculoConfirmado.id);

            if (itens.length > 0) {
                const itensParaSalvar = itens.map((item) => ({
                    work_order_id: osData.id,
                    organization_id: profile?.organization_id,
                    product_id: item.tipo === "peca" ? item.db_id : null,
                    service_id: item.tipo === "servico" ? item.db_id : null,
                    tipo: item.tipo,
                    name: item.nome,
                    quantity: item.qtd,
                    unit_price: item.valor,
                    total_price: item.pecaCliente ? 0 : item.valor * item.qtd,
                    peca_cliente: item.pecaCliente || false,
                }));

                const { error: itemsError } = await supabase.from("work_order_items").insert(itensParaSalvar);
                if (itemsError) throw itemsError;

                // Baixar do estoque as peças que não são do cliente
                for (const item of itens) {
                    if (item.tipo === "peca" && item.db_id && !item.pecaCliente) {
                        const { data: prodData } = await supabase
                            .from('products')
                            .select('estoque_atual')
                            .eq('id', item.db_id)
                            .single();

                        if (prodData) {
                            await supabase
                                .from('products')
                                .update({ estoque_atual: (prodData.estoque_atual || 0) - item.qtd })
                                .eq('id', item.db_id);
                        }
                    }
                }
            }

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
            window.location.href = "/atendimento";

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

    const selecionarItem = (item: any, tipo: "peca" | "servico") => {
        const itemExistente = itens.find(i => i.db_id === item.id && i.tipo === tipo);

        if (itemExistente) {
            setItens(prev => prev.map(i =>
                i.id === itemExistente.id ? { ...i, qtd: i.qtd + 1 } : i
            ));
        } else {
            const semEstoque = tipo === "peca" && (item.estoque_atual || 0) <= 0;
            const valorUnitario = item.price || item.preco_venda || 0;

            setItens([
                ...itens,
                {
                    id: Math.random(),
                    db_id: item.id,
                    nome: item.nome,
                    valor: valorUnitario,
                    tipo,
                    qtd: 1,
                    semEstoque
                },
            ]);
        }
        setModalItemAberto(false);
    };

    const alterarQuantidade = (id: string | number, delta: number) => {
        setItens(prev => prev.map(item => {
            if (item.id === id) {
                const novaQtd = item.qtd + delta;
                return novaQtd > 0 ? { ...item, qtd: novaQtd } : item;
            }
            return item;
        }));
    };

    const removerItem = (id: string | number) => setItens(itens.filter((item) => item.id !== id));

    const total = itens.reduce((acc, item) => item.pecaCliente ? acc : acc + item.valor * item.qtd, 0);

    const togglePecaCliente = (id: string | number) => {
        setItens(prev => prev.map(item =>
            item.id === id ? { ...item, pecaCliente: !item.pecaCliente } : item
        ));
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
            <input type="file" ref={evidenceInputRef} accept="image/*" multiple className="hidden" onChange={handleFotoEvidencia} />

            {/* CABEÇALHO */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => (step === 1 ? (window.location.href = "/atendimento") : resetarPasso1())}
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
                    <div className="bg-white rounded-[32px] p-8 border-2 border-stone-300 shadow-sm text-center space-y-6">
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
                                                className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border-2 border-yellow-300 focus:ring-2 focus:ring-[#FACC15]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-stone-400 ml-2">ANO</label>
                                            <input
                                                type="text"
                                                value={anoInput}
                                                onChange={(e) => setAnoInput(e.target.value)}
                                                placeholder="2015"
                                                className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border-2 border-yellow-300 focus:ring-2 focus:ring-[#FACC15]"
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
                                            className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border-2 border-yellow-300 focus:ring-2 focus:ring-[#FACC15]"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-stone-400 ml-2">OBSERVAÇÕES (Opcional)</label>
                                        <input
                                            type="text"
                                            value={obsVeiculoInput}
                                            onChange={(e) => setObsVeiculoInput(e.target.value)}
                                            placeholder="Ex: Arranhão porta esquerda"
                                            className="w-full bg-white rounded-xl p-3 font-medium text-[#1A1A1A] outline-none border-2 border-yellow-300 focus:ring-2 focus:ring-[#FACC15]"
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
                    <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
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
                            <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm space-y-4">
                                <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                                    <ArrowRight size={18} className="text-[#FACC15]" /> Checklist do Veículo
                                </h3>

                                {/* Input oculto para câmera do painel */}
                                <input type="file" ref={painelInputRef} accept="image/*" className="hidden" onChange={handleFotoPainel} />

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

                            {/* CARD 1: RELATO (Defeito) */}
                            <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
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

                            {/* CARD 2: ITENS */}
                            <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm space-y-4">
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
                                        <div key={item.id} className={`p-3 rounded-2xl ${item.pecaCliente ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-[#F8F7F2]'}`}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className={`font-bold text-sm text-[#1A1A1A] ${item.pecaCliente ? 'line-through opacity-60' : ''}`}>{item.nome}</p>
                                                    <p className="text-[10px] text-stone-500 uppercase font-bold">
                                                        {item.tipo}
                                                    </p>
                                                </div>

                                                {/* CONTROLE DE QUANTIDADE */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center bg-white rounded-lg px-1">
                                                        <button
                                                            onClick={() => alterarQuantidade(item.id, -1)}
                                                            className="p-1 hover:text-red-500"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span className="text-xs font-bold w-6 text-center">{item.qtd}</span>
                                                        <button
                                                            onClick={() => alterarQuantidade(item.id, 1)}
                                                            className="p-1 hover:text-green-500"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col items-end">
                                                        <div className={`flex items-center gap-1 bg-white px-2 py-1 rounded-lg border focus-within:border-[#FACC15] focus-within:ring-1 focus-within:ring-[#FACC15] shadow-sm ${item.pecaCliente ? 'border-yellow-200 opacity-60' : 'border-stone-200'}`}>
                                                            <span className="text-xs text-stone-400 font-bold">R$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={item.valor}
                                                                disabled={item.pecaCliente}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    setItens(prev => prev.map(i => i.id === item.id ? { ...i, valor: isNaN(val) ? 0 : val } : i));
                                                                }}
                                                                className={`w-16 text-right font-bold outline-none text-sm bg-transparent ${item.pecaCliente ? 'text-stone-400 line-through' : 'text-[#1A1A1A]'}`}
                                                            />
                                                        </div>
                                                        {item.qtd > 1 && (
                                                            <span className={`text-[10px] font-bold mt-1 ${item.pecaCliente ? 'text-stone-300 line-through' : 'text-stone-400'}`}>
                                                                Total: R$ {((item.valor || 0) * item.qtd).toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button onClick={() => removerItem(item.id)} className="text-stone-300 hover:text-red-500 pl-2 border-l border-stone-200">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Botão Peça do Cliente */}
                                            {item.tipo === "peca" && (
                                                <button
                                                    onClick={() => togglePecaCliente(item.id)}
                                                    className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full transition ${item.pecaCliente
                                                        ? 'bg-yellow-400 text-[#1A1A1A]'
                                                        : 'bg-stone-200 text-stone-500 hover:bg-yellow-100 hover:text-yellow-700'
                                                        }`}
                                                >
                                                    <UserCheck size={12} />
                                                    {item.pecaCliente ? 'PEÇA DO CLIENTE ✓' : 'Peça do cliente?'}
                                                </button>
                                            )}
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

                            {/* CARD 3: PREVISÃO (Último passo, separado) */}
                            <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
                                <label className="text-xs font-bold text-stone-400 mb-2 flex items-center gap-1">
                                    <Calendar size={14} /> Previsão de Entrega (Opcional)
                                </label>
                                <input
                                    type="date"
                                    value={previsaoEntrega}
                                    onChange={(e) => setPrevisaoEntrega(e.target.value)}
                                    className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] font-bold outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                                />
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
                                    onClick={() => {
                                        setModalClienteView("cadastrar");
                                        setNovoNomeCliente(termoBuscaCliente);
                                    }}
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
                                    type="tel"
                                />
                                <button
                                    onClick={handleSalvarNovoCliente}
                                    disabled={loadingCadastroRapido}
                                    className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3 rounded-xl flex items-center justify-center gap-2"
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
                        <div className="flex bg-stone-200 p-1.5 rounded-2xl border-2 border-stone-300 shadow-inner gap-1">
                            <button
                                onClick={() => setAbaItem("pecas")}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition border-2 ${abaItem === "pecas" ? "bg-white shadow-md text-[#1A1A1A] border-stone-300" : "text-stone-500 hover:text-[#1A1A1A] border-transparent"
                                    }`}
                            >
                                Peças
                            </button>
                            <button
                                onClick={() => setAbaItem("servicos")}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition border-2 ${abaItem === "servicos" ? "bg-white shadow-md text-[#1A1A1A] border-stone-300" : "text-stone-500 hover:text-[#1A1A1A] border-transparent"
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
                            className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
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
                                            <span className="font-bold">R$ {p.preco_venda?.toFixed(2)}</span>
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
