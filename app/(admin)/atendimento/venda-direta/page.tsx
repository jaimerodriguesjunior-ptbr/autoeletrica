"use client";

import { useState, useEffect } from "react";
import {
    ArrowLeft,
    Search,
    User,
    ChevronRight,
    Loader2,
    Wrench,
    ShoppingBag,
    Plus,
    X,
    CheckCircle,
    Save,
    AlertCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";

type Client = { id: string; nome: string; whatsapp: string | null };
type Service = { id: string; nome: string; price: number };

export default function VendaDiretaWizard() {
    const router = useRouter();
    const supabase = createClient();
    const { profile, loading: authLoading } = useAuth();

    const [loadingInit, setLoadingInit] = useState(true);
    const [saving, setSaving] = useState(false);

    // Etapas: 1 = Cliente, 2 = Tipo de Venda
    const [step, setStep] = useState<1 | 2>(1);

    // Dados Cliente e Serviços
    const [listaClientes, setListaClientes] = useState<Client[]>([]);
    const [listaServicos, setListaServicos] = useState<Service[]>([]);
    const [clienteSelecionado, setClienteSelecionado] = useState<Client | null>(null);
    const [termoBuscaCliente, setTermoBuscaCliente] = useState("");

    // Modal Cliente Rápido
    const [modalClienteAberto, setModalClienteAberto] = useState(false);
    const [novoNomeCliente, setNovoNomeCliente] = useState("");
    const [novoZapCliente, setNovoZapCliente] = useState("");
    const [loadingCadastroRapido, setLoadingCadastroRapido] = useState(false);

    // Modal Serviço
    const [modalServicosAberto, setModalServicosAberto] = useState(false);
    const [termoBuscaServico, setTermoBuscaServico] = useState("");

    // Modal Serviço Rápido
    const [modalCadastroRapidoServicoAberto, setModalCadastroRapidoServicoAberto] = useState(false);
    const [nomeNovoServico, setNomeNovoServico] = useState("");
    const [salvandoNovoServico, setSalvandoNovoServico] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (profile?.organization_id) {
            fetchDados();
        } else {
            setLoadingInit(false);
        }
    }, [profile, authLoading]);

    const fetchDados = async () => {
        try {
            const [clientesRes, servicosRes] = await Promise.all([
                supabase.from("clients").select("id, nome, whatsapp").order("nome"),
                supabase.from("services").select("id, nome, price").order("nome")
            ]);
            setListaClientes(clientesRes.data || []);
            setListaServicos(servicosRes.data || []);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoadingInit(false);
        }
    };

    const handleAvançarStep2 = (cliente: Client) => {
        setClienteSelecionado(cliente);
        setStep(2);
    };

    const handleCadastroClienteRapido = async () => {
        if (!novoNomeCliente.trim()) return alert("O nome do cliente é obrigatório.");

        setLoadingCadastroRapido(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    nome: novoNomeCliente,
                    whatsapp: novoZapCliente || null,
                    organization_id: profile?.organization_id,
                    public_token: crypto.randomUUID().replace(/-/g, '')
                }])
                .select()
                .single();

            if (error) throw error;

            fetchDados();
            setModalClienteAberto(false);
            setNovoNomeCliente("");
            setNovoZapCliente("");
            handleAvançarStep2(data); // Avança direto após cadastrar

        } catch (error: any) {
            alert('Erro ao salvar cliente: ' + error.message);
        } finally {
            setLoadingCadastroRapido(false);
        }
    };

    const handleCriarServicoBancada = () => {
        if (!clienteSelecionado) return;
        setModalServicosAberto(true);
        setTermoBuscaServico("");
    };

    const handleSelecionarServico = async (servico: Service) => {
        if (!clienteSelecionado) return;
        setSaving(true);
        try {
            // 1. Cria OS sem veículo, direto no status 'aprovado' (Fila)
            const { data: osData, error: osError } = await supabase
                .from('work_orders')
                .insert([{
                    client_id: clienteSelecionado.id,
                    vehicle_id: null,
                    status: 'aprovado',
                    tipo: 'bancada',
                    total: servico.price,
                    organization_id: profile?.organization_id
                }])
                .select()
                .single();

            if (osError) throw osError;

            // 2. Insere o serviço selecionado na OS
            const { error: itemError } = await supabase
                .from('work_order_items')
                .insert([{
                    work_order_id: osData.id,
                    service_id: servico.id,
                    product_id: null,
                    name: servico.nome,
                    unit_price: servico.price,
                    quantity: 1,
                    total_price: servico.price,
                    tipo: 'servico',
                    organization_id: profile?.organization_id
                }]);

            if (itemError) {
                // Cleanup: Deleta a OS órfã se falhar ao inserir o item
                await supabase.from('work_orders').delete().eq('id', osData.id);
                throw itemError;
            }

            router.push(`/os/detalhes/${osData.id}`);

        } catch (error: any) {
            alert('Erro ao criar serviço: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCadastroRapidoServico = async () => {
        if (!nomeNovoServico.trim()) return alert("O nome do serviço é obrigatório.");

        setSalvandoNovoServico(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .insert([{
                    nome: nomeNovoServico,
                    price: 0,
                    organization_id: profile?.organization_id
                }])
                .select()
                .single();

            if (error) throw error;

            setListaServicos(prev => [...prev, data]);
            setModalCadastroRapidoServicoAberto(false);
            setNomeNovoServico("");

            // Já aplica o serviço criado na OS
            handleSelecionarServico(data);

        } catch (error: any) {
            alert('Erro ao salvar serviço: ' + error.message);
        } finally {
            setSalvandoNovoServico(false);
        }
    };

    const handleNavegarVendaPecas = () => {
        if (!clienteSelecionado) return;
        router.push(`/atendimento/nova-venda?client_id=${clienteSelecionado.id}`);
    };

    const clientesFiltrados = listaClientes.filter(c =>
        c.nome.toLowerCase().includes(termoBuscaCliente.toLowerCase()) ||
        (c.whatsapp && c.whatsapp.includes(termoBuscaCliente))
    );

    if (loadingInit) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-screen bg-[#F8F7F2]">
                <Loader2 className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-8 bg-[#F8F7F2] min-h-screen">
            {/* CABEÇALHO */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/atendimento">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-stone-200 hover:bg-stone-50 transition cursor-pointer">
                        <ArrowLeft size={20} className="text-stone-600" />
                    </div>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A]">Nova Venda Direta</h1>
                    <p className="text-stone-500 text-xs text-center w-full mt-1">
                        Passo {step} de 2: {step === 1 ? "Identificação do Cliente" : "Tipo de Operação"}
                    </p>
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="max-w-3xl mx-auto">

                {step === 1 && (
                    <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-md border-2 border-stone-200 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
                                <User size={20} /> Selecione o Cliente
                            </h2>
                            <button
                                onClick={() => setModalClienteAberto(true)}
                                className="bg-[#1A1A1A] text-[#FACC15] px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-black transition flex items-center gap-2"
                            >
                                <Plus size={16} /> Novo Cliente
                            </button>
                        </div>

                        {/* BUSCA */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar cliente por nome ou celular..."
                                value={termoBuscaCliente}
                                onChange={(e) => setTermoBuscaCliente(e.target.value)}
                                className="w-full bg-[#F8F7F2] rounded-2xl py-4 pl-12 pr-4 outline-none border-2 border-stone-200 focus:border-[#FACC15] transition text-[#1A1A1A] shadow-inner"
                            />
                        </div>

                        {/* LISTA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {clientesFiltrados.map((cliente) => (
                                <div
                                    key={cliente.id}
                                    onClick={() => handleAvançarStep2(cliente)}
                                    className="p-4 rounded-2xl border-2 border-stone-200 shadow-sm bg-white hover:border-[#FACC15] hover:shadow-md hover:bg-yellow-50 cursor-pointer transition flex justify-between items-center group"
                                >
                                    <div>
                                        <p className="font-bold text-[#1A1A1A] group-hover:text-yellow-800 transition">{cliente.nome}</p>
                                        <p className="text-xs text-stone-500">{cliente.whatsapp || "Sem celular"}</p>
                                    </div>
                                    <ChevronRight className="text-stone-300 group-hover:text-yellow-600 transition" />
                                </div>
                            ))}

                            {clientesFiltrados.length === 0 && (
                                <div className="col-span-1 md:col-span-2 text-center py-8">
                                    <p className="text-stone-400 mb-2">Nenhum cliente encontrado.</p>
                                    <button
                                        onClick={() => {
                                            setNovoNomeCliente(termoBuscaCliente);
                                            setModalClienteAberto(true);
                                        }}
                                        className="text-[#1A1A1A] font-bold text-sm underline hover:text-yellow-600 transition"
                                    >
                                        Cadastrar "{termoBuscaCliente}" agora
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 2 && clienteSelecionado && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        {/* CARD RESUMO CLIENTE */}
                        <div className="bg-[#1A1A1A] text-[#FACC15] rounded-[24px] p-4 flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <User size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider block">Cliente Selecionado</p>
                                    <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
                                        <p className="text-lg font-bold truncate leading-tight">{clienteSelecionado.nome}</p>
                                        {clienteSelecionado.whatsapp && (
                                            <span className="text-xs font-medium text-white/80">
                                                {clienteSelecionado.whatsapp}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setStep(1)}
                                className="text-xs font-bold underline hover:text-white transition-colors"
                            >
                                Trocar
                            </button>
                        </div>

                        {/* OPÇÕES */}
                        <div>
                            <h2 className="text-xl font-bold text-[#1A1A1A] text-center mb-6">O que vamos fazer agora?</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* OPÇÃO 1: VENDA DE PEÇAS */}
                                <button
                                    onClick={handleNavegarVendaPecas}
                                    className="bg-white rounded-[32px] p-8 border-2 border-stone-200 shadow-md hover:border-[#1A1A1A] hover:shadow-xl transition flex flex-col items-center gap-4 text-center group"
                                >
                                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <ShoppingBag size={40} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[#1A1A1A] text-lg text-center mb-2">Venda Direta de Peças</h3>
                                        <p className="text-stone-500 text-xs text-center leading-relaxed max-w-[200px]">
                                            Apenas vender peças no balcão, gerando recibo ou nota fiscal imediatamente.
                                        </p>
                                    </div>
                                </button>

                                {/* OPÇÃO 2: SERVIÇO DE BANCADA */}
                                <button
                                    onClick={handleCriarServicoBancada}
                                    disabled={saving}
                                    className="bg-white rounded-[32px] p-8 border-2 border-stone-200 shadow-md hover:border-[#FACC15] hover:shadow-xl transition flex flex-col items-center gap-4 text-center group disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    {saving ? (
                                        <div className="w-20 h-20 bg-stone-100 text-stone-400 rounded-full flex items-center justify-center">
                                            <Loader2 size={40} className="animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Wrench size={40} />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Serviço de Bancada</h3>
                                        <p className="text-sm text-stone-500">
                                            Limpeza de bicos, consertos rápidos ou outros serviços mecânicos avulsos.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL CADASTRAR CLIENTE (RÁPIDO) */}
            {modalClienteAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-[#1A1A1A]">Novo Cliente</h2>
                            <button onClick={() => setModalClienteAberto(false)} className="text-stone-400 hover:text-red-500 transition"><X /></button>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">NOME / EMPRESA *</label>
                            <input
                                type="text"
                                value={novoNomeCliente}
                                onChange={(e) => setNovoNomeCliente(e.target.value)}
                                placeholder="Ex: Oficina do João"
                                className="w-full bg-[#F8F7F2] rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#FACC15] font-bold text-sm text-[#1A1A1A]"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">WHATSAPP</label>
                            <input
                                type="tel"
                                value={novoZapCliente}
                                onChange={(e) => setNovoZapCliente(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full bg-[#F8F7F2] rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#FACC15] font-bold text-sm text-[#1A1A1A]"
                            />
                        </div>

                        <button
                            onClick={handleCadastroClienteRapido}
                            disabled={loadingCadastroRapido}
                            className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3.5 rounded-xl shadow-md hover:scale-[1.02] transition flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
                        >
                            {loadingCadastroRapido ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Salvar e Avançar
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL ADICIONAR SERVIÇO */}
            {modalServicosAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4 h-[500px] flex flex-col">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg text-[#1A1A1A]">Selecionar Serviço</h2>
                            <button onClick={() => setModalServicosAberto(false)} className="text-stone-400 hover:text-[#1A1A1A] transition">
                                <X />
                            </button>
                        </div>

                        <div className="relative">
                            <input
                                autoFocus
                                placeholder="Buscar serviço..."
                                value={termoBuscaServico}
                                onChange={(e) => setTermoBuscaServico(e.target.value)}
                                className="w-full bg-[#F8F7F2] p-4 pl-10 rounded-2xl border-2 border-stone-200 shadow-inner focus:border-[#FACC15] outline-none text-sm text-[#1A1A1A] placeholder:text-stone-400 font-medium transition"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        </div>

                        <div className="flex-1 overflow-auto space-y-2 pb-4 pr-1 custom-scrollbar">
                            {saving ? (
                                <div className="text-center py-4 text-stone-400 flex flex-col items-center">
                                    <Loader2 className="animate-spin mb-2 text-[#FACC15]" size={32} />
                                    <span className="font-bold">Criando Ordem de Serviço...</span>
                                </div>
                            ) : (
                                <>
                                    {listaServicos
                                        .filter((s) => s.nome.toLowerCase().includes(termoBuscaServico.toLowerCase()))
                                        .map((s) => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleSelecionarServico(s)}
                                                className="w-full flex justify-between p-4 bg-white border-2 border-stone-200 hover:border-[#FACC15] shadow-sm hover:shadow-md rounded-2xl text-left transition group"
                                            >
                                                <div>
                                                    <p className="font-bold text-[#1A1A1A] group-hover:text-yellow-800 transition">{s.nome}</p>
                                                </div>
                                                <span className="font-bold text-[#1A1A1A]">R$ {(s.price || 0).toFixed(2)}</span>
                                            </button>
                                        ))}

                                    <div className="mt-4 border-t border-stone-200 pt-4 flex flex-col items-center">
                                        <p className="text-xs text-stone-500 mb-2">Não encontrou o que procurava?</p>
                                        <button
                                            onClick={() => {
                                                setNomeNovoServico(termoBuscaServico);
                                                setModalCadastroRapidoServicoAberto(true);
                                                setModalServicosAberto(false);
                                            }}
                                            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-[#1A1A1A] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                                        >
                                            Cadastrar Novo Serviço <Plus size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CADASTRO RÁPIDO DE SERVIÇO */}
            {modalCadastroRapidoServicoAberto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg text-[#1A1A1A]">Novo Serviço</h2>
                            <button
                                onClick={() => {
                                    setModalServicosAberto(true); // Volta para a tela de buscar
                                    setModalCadastroRapidoServicoAberto(false);
                                    setNomeNovoServico("");
                                }}
                                className="text-stone-400 hover:text-red-500 transition"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2 shadow-sm">
                                <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-yellow-800 font-medium leading-tight">
                                    Isto cria um serviço com valor zerado R$ 0,00. Você poderá editar o valor dentro da OS recém criada.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">NOME DO SERVIÇO *</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={nomeNovoServico}
                                    onChange={(e) => setNomeNovoServico(e.target.value)}
                                    placeholder="Ex: Troca de Óleo e Filtro"
                                    className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-200 shadow-inner focus:border-[#FACC15] outline-none font-bold text-[#1A1A1A]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCadastroRapidoServico();
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleCadastroRapidoServico}
                                disabled={salvandoNovoServico || !nomeNovoServico.trim()}
                                className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 hover:bg-black shadow-md transition disabled:opacity-50"
                            >
                                {salvandoNovoServico ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {salvandoNovoServico ? "Salvando..." : "Salvar e Continuar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
