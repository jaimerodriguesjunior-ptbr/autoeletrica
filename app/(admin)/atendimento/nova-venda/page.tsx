"use client";

import { useState, useEffect } from "react";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Save,
    ShoppingBag,
    Search,
    X,
    Minus,
    Loader2,
    User,
    AlertCircle,
    CheckCircle2,
    Printer,
    Receipt,
    FileText,
    CheckCircle,
    DollarSign,
    CreditCard,
    Calendar
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";

// --- TIPOS ---
type Client = { id: string; nome: string; whatsapp: string | null };
type Product = { id: string; nome: string; preco_venda: number; estoque_atual: number };

type SaleItem = {
    id: string | number;
    db_id: string;
    nome: string;
    valor: number;
    tipo: "peca";
    qtd: number;
    semEstoque?: boolean;
};

function NovaVendaConteudo() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const clientIdUrl = searchParams.get('client_id');
    const supabase = createClient();
    const { profile, loading: authLoading } = useAuth();

    // --- ESTADOS ---
    const [loadingInit, setLoadingInit] = useState(true);
    const [saving, setSaving] = useState(false);

    const [modalSucessoAberto, setModalSucessoAberto] = useState(false);
    const [vendaFinalizadaId, setVendaFinalizadaId] = useState<string | number | null>(null);
    const [vendaFinalizadaTotal, setVendaFinalizadaTotal] = useState(0);
    const [observacao, setObservacao] = useState("");

    // Estados de Pagamento
    const [formaPagamento, setFormaPagamento] = useState("pix");
    const [parcelas, setParcelas] = useState(1);
    const [dataCheque, setDataCheque] = useState("");
    const [pagamentoRegistrado, setPagamentoRegistrado] = useState(false);

    const [modalEditarItemAberto, setModalEditarItemAberto] = useState(false);
    const [itemEditando, setItemEditando] = useState<SaleItem | null>(null);

    const [itens, setItens] = useState<SaleItem[]>([]);

    // Dados do Banco
    const [listaClientes, setListaClientes] = useState<Client[]>([]);
    const [listaProdutos, setListaProdutos] = useState<Product[]>([]);

    // Modais e Seleções
    const [clienteSelecionado, setClienteSelecionado] = useState<Client | null>(null);
    const [modalClienteAberto, setModalClienteAberto] = useState(false);
    const [modalItemAberto, setModalItemAberto] = useState(false);

    // Filtros
    const [termoBuscaItem, setTermoBuscaItem] = useState("");
    const [termoBuscaCliente, setTermoBuscaCliente] = useState("");

    // Cadastro Rápido de Peça
    const [modalCadastroRapidoAberto, setModalCadastroRapidoAberto] = useState(false);
    const [nomeNovoItem, setNomeNovoItem] = useState("");
    const [salvandoNovoItem, setSalvandoNovoItem] = useState(false);

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
            const [clientsRes, productsRes] = await Promise.all([
                supabase.from("clients").select("id, nome, whatsapp").order("nome"),
                supabase.from("products").select("id, nome, preco_venda, estoque_atual").order("nome"),
            ]);

            const clientes = clientsRes.data || [];
            const produtos = productsRes.data || [];

            setListaClientes(clientes);
            setListaProdutos(produtos);

            if (clientIdUrl) {
                const found = clientes.find(c => String(c.id) === String(clientIdUrl));
                if (found) setClienteSelecionado(found);
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoadingInit(false);
        }
    };

    const selecionarItem = (item: Product) => {
        const itemExistente = itens.find(i => i.db_id === item.id);

        if (itemExistente) {
            setItens(prev => prev.map(i =>
                i.id === itemExistente.id ? { ...i, qtd: i.qtd + 1 } : i
            ));
        } else {
            const semEstoque = (item.estoque_atual || 0) <= 0;

            setItens([
                ...itens,
                {
                    id: Math.random(),
                    db_id: item.id,
                    nome: item.nome,
                    valor: item.preco_venda || 0,
                    tipo: "peca",
                    qtd: 1,
                    semEstoque
                },
            ]);
        }
        setModalItemAberto(false);
        setTermoBuscaItem("");
    };

    const handleCadastroPecaRapido = async () => {
        if (!nomeNovoItem.trim()) return alert("O nome da peça é obrigatório.");

        setSalvandoNovoItem(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    nome: nomeNovoItem,
                    preco_venda: 0,
                    estoque_atual: 0,
                    organization_id: profile?.organization_id
                }])
                .select()
                .single();

            if (error) throw error;

            // Recarregar lista de produtos e selecionar
            await fetchDadosIniciais();
            selecionarItem(data);
            setModalCadastroRapidoAberto(false);
            setNomeNovoItem("");

        } catch (error: any) {
            alert('Erro ao salvar peça rápida: ' + error.message);
        } finally {
            setSalvandoNovoItem(false);
        }
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

    const total = itens.reduce((acc, item) => acc + item.valor * item.qtd, 0);

    const handleFinalizarVenda = async () => {
        if (itens.length === 0) return alert("Adicione pelo menos um item.");

        if (vendaFinalizadaId) {
            setModalSucessoAberto(true);
            return;
        }

        setSaving(true);

        try {
            // 1. Criar a Venda (Work Order do tipo Venda)
            // Usaremos vehicle_id: null se permitido, ou precisaremos de um dummy.
            // Status: 'entregue' (para indicar finalizada)

            let { data: saleData, error: saleError } = await supabase
                .from("work_orders")
                .insert({
                    organization_id: profile?.organization_id,
                    client_id: clienteSelecionado?.id || null,
                    vehicle_id: null,
                    status: "entregue",
                    tipo: "venda_balcao",
                    description: observacao || "Venda Balcão",
                    total: total,
                })
                .select()
                .single();

            // FALLBACK: Se o banco recusar client_id nulo, usamos "Consumidor Final"
            if (saleError && saleError.message?.includes("null value in column \"client_id\"")) {
                console.log("Client ID obrigatório, buscando substituto...");

                let { data: consumidor } = await supabase
                    .from("clients")
                    .select("id")
                    .ilike("nome", "Consumidor Final")
                    .maybeSingle();

                if (!consumidor) {
                    const { data: novo, error: errCriar } = await supabase
                        .from("clients")
                        .insert({
                            organization_id: profile?.organization_id,
                            nome: "Consumidor Final",
                            public_token: crypto.randomUUID().replace(/-/g, ""),
                        })
                        .select()
                        .single();
                    if (!errCriar) consumidor = novo;
                }

                if (consumidor) {
                    const retry = await supabase
                        .from("work_orders")
                        .insert({
                            organization_id: profile?.organization_id,
                            client_id: consumidor.id,
                            vehicle_id: null,
                            status: "entregue",
                            tipo: "venda_balcao",
                            description: observacao || "Venda Balcão",
                            total: total,
                        })
                        .select()
                        .single();

                    saleData = retry.data;
                    saleError = retry.error;
                }
            }

            if (saleError) throw saleError;
            console.log("SALE DATA ID CRIADO:", saleData.id)

            // 2. Salvar Itens e Baixar Estoque
            const itensParaSalvar = itens.map((item) => ({
                work_order_id: saleData.id,
                organization_id: profile?.organization_id,
                product_id: item.db_id,
                tipo: "peca",
                name: item.nome,
                quantity: item.qtd,
                unit_price: item.valor,
                total_price: item.valor * item.qtd,
            }));

            const { error: itemsError } = await supabase.from("work_order_items").insert(itensParaSalvar);
            if (itemsError) throw itemsError;

            // 3. Atualizar Estoque
            for (const item of itens) {
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

            setVendaFinalizadaId(saleData.id);
            setVendaFinalizadaTotal(total);
            setPagamentoRegistrado(false);
            setModalSucessoAberto(true);

        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao finalizar Venda: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRegistrarPagamento = async () => {
        if (!vendaFinalizadaId || !profile?.organization_id) return;

        if (formaPagamento === "cheque_pre" && !dataCheque) {
            return alert("Para lançamento A prazo, é obrigatório informar a data de depósito.");
        }

        setSaving(true);
        try {
            const transacoesParaInserir = [];
            const hoje = new Date();

            if (formaPagamento === 'cartao_credito') {
                const valorParcela = vendaFinalizadaTotal / parcelas;
                for (let i = 1; i <= parcelas; i++) {
                    const dataVencimento = new Date(hoje);
                    dataVencimento.setDate(hoje.getDate() + (i * 30));

                    transacoesParaInserir.push({
                        organization_id: profile.organization_id,
                        work_order_id: vendaFinalizadaId,
                        description: `Recebimento Venda #${vendaFinalizadaId} - ${clienteSelecionado?.nome || 'Consumidor Final'} (Parc ${i}/${parcelas})`,
                        amount: valorParcela,
                        type: 'income',
                        category: 'Vendas',
                        status: 'pending',
                        payment_method: formaPagamento,
                        date: new Date(dataVencimento.getTime() - dataVencimento.getTimezoneOffset() * 60000).toISOString().split('T')[0]
                    });
                }
            } else if (formaPagamento === 'cheque_pre') {
                transacoesParaInserir.push({
                    organization_id: profile.organization_id,
                    work_order_id: vendaFinalizadaId,
                    description: `Recebimento Venda #${vendaFinalizadaId} - ${clienteSelecionado?.nome || 'Consumidor Final'} (Cheque)`,
                    amount: vendaFinalizadaTotal,
                    type: 'income',
                    category: 'Vendas',
                    status: 'pending',
                    payment_method: formaPagamento,
                    date: dataCheque
                });
            } else {
                transacoesParaInserir.push({
                    organization_id: profile.organization_id,
                    work_order_id: vendaFinalizadaId,
                    description: `Recebimento Venda #${vendaFinalizadaId} - ${clienteSelecionado?.nome || 'Consumidor Final'} (${formaPagamento})`,
                    amount: vendaFinalizadaTotal,
                    type: 'income',
                    category: 'Vendas',
                    status: 'paid',
                    payment_method: formaPagamento,
                    date: new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().split('T')[0]
                });
            }

            const { error: transError } = await supabase
                .from('transactions')
                .insert(transacoesParaInserir);

            if (transError) throw transError;

            setPagamentoRegistrado(true);
            alert("Pagamento registrado com sucesso!");

        } catch (error: any) {
            alert("Erro ao lançar financeiro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loadingInit)
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-[#FACC15]" size={40} />
            </div>
        );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-32">

            {/* CABEÇALHO */}
            <div className="flex items-center gap-4">
                <Link href="/atendimento">
                    <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
                        <ArrowLeft size={20} />
                    </button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-[#1A1A1A]">Nova Venda</h1>
                    <p className="text-stone-500 text-xs">Venda direta de peças</p>
                </div>
            </div>

            <div className="space-y-6 animate-in slide-in-from-right duration-300">

                {/* Cliente (Opcional) */}
                {clienteSelecionado ? (
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
                            onClick={() => setClienteSelecionado(null)}
                            className="text-xs font-bold underline hover:text-white transition-colors"
                        >
                            Trocar
                        </button>
                    </div>
                ) : (
                    <div className="bg-white rounded-[32px] p-6 border-2 border-stone-200 shadow-md">
                        <h3 className="font-bold text-[#1A1A1A] mb-3 flex items-center gap-2">
                            <User size={18} className="text-[#FACC15]" /> Cliente (Opcional)
                        </h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                placeholder="Consumidor Final"
                                value=""
                                onClick={() => setModalClienteAberto(true)}
                                className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none cursor-pointer border-2 border-stone-200 shadow-inner hover:border-[#FACC15] transition font-medium placeholder:text-stone-400"
                            />
                            <button
                                onClick={() => setModalClienteAberto(true)}
                                className="w-14 bg-[#1A1A1A] text-white rounded-2xl flex items-center justify-center transition shrink-0"
                            >
                                <Search size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* CARD ITENS */}
                <div className="bg-white rounded-[32px] p-6 border-2 border-stone-200 shadow-md space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                            <ShoppingBag size={18} className="text-[#FACC15]" /> Itens da Venda
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
                                    <p className="text-[10px] text-stone-500 uppercase font-bold">Peça</p>
                                </div>

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

                                    <div className="text-right w-20">
                                        <button
                                            onClick={() => {
                                                setItemEditando(item);
                                                setModalEditarItemAberto(true);
                                            }}
                                            className="w-full text-right p-1 -m-1 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
                                            title="Editar valor"
                                        >
                                            <p className="font-bold text-sm text-[#1A1A1A]">R$ {(item.valor * item.qtd).toFixed(2)}</p>
                                        </button>
                                    </div>

                                    <button onClick={() => removerItem(item.id)} className="text-stone-300 hover:text-red-500 pl-2 border-l border-stone-200">
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
                        <p className="text-stone-500 font-bold text-sm">Total</p>
                        <p className="text-2xl font-bold text-[#1A1A1A]">R$ {total.toFixed(2)}</p>
                    </div>
                </div>

                {/* OBSERVACAO */}
                <div className="bg-white rounded-[32px] p-6 border-2 border-stone-200 shadow-md">
                    <h3 className="font-bold text-[#1A1A1A] mb-3 flex items-center gap-2">
                        <FileText size={18} className="text-[#FACC15]" /> Observações (Opcional)
                    </h3>
                    <textarea
                        rows={2}
                        placeholder="Anotações para aparecer no recibo (Ex: Cliente pediu para não embrulhar...)"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none border-2 border-stone-200 shadow-inner focus:border-[#FACC15] transition font-medium placeholder:text-stone-400 resize-none"
                    />
                </div>

                {/* Botão Final */}
                <div className="pt-4">
                    <button
                        onClick={handleFinalizarVenda}
                        disabled={saving}
                        className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg hover:scale-105 transition flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                        Finalizar Venda
                    </button>
                </div>
            </div>

            {/* MODAL CLIENTES */}
            {modalClienteAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4">
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
                                        onClick={() => {
                                            setClienteSelecionado(c);
                                            setModalClienteAberto(false);
                                        }}
                                        className="w-full text-left p-3 hover:bg-stone-50 rounded-xl font-medium"
                                    >
                                        {c.nome}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ITENS */}
            {modalItemAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4 h-[500px] flex flex-col">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg">Adicionar Peça</h2>
                            <button onClick={() => setModalItemAberto(false)}>
                                <X />
                            </button>
                        </div>

                        <input
                            autoFocus
                            placeholder="Buscar peça..."
                            value={termoBuscaItem}
                            onChange={(e) => setTermoBuscaItem(e.target.value)}
                            className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
                        />

                        <div className="flex-1 overflow-auto space-y-2 pb-4">
                            {listaProdutos
                                .filter((p) => p.nome.toLowerCase().includes(termoBuscaItem.toLowerCase()))
                                .map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => selecionarItem(p)}
                                        className="w-full flex justify-between p-3 hover:bg-stone-50 rounded-xl text-left"
                                    >
                                        <div>
                                            <p className="font-bold">{p.nome}</p>
                                            <p className="text-xs text-stone-400">Estoque: {p.estoque_atual}</p>
                                        </div>
                                        <span className="font-bold">R$ {p.preco_venda?.toFixed(2)}</span>
                                    </button>
                                ))}

                            <div className="mt-4 border-t border-stone-200 pt-4 flex flex-col items-center">
                                <p className="text-xs text-stone-500 mb-2">Não encontrou o que procurava?</p>
                                <button
                                    onClick={() => {
                                        setNomeNovoItem(termoBuscaItem);
                                        setModalCadastroRapidoAberto(true);
                                        setModalItemAberto(false);
                                    }}
                                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                                >
                                    Cadastrar Nova Peça <Plus size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CADASTRO RÁPIDO DE PEÇA */}
            {modalCadastroRapidoAberto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-lg text-[#1A1A1A]">Nova Peça</h2>
                            <button
                                onClick={() => {
                                    setModalItemAberto(true);
                                    setModalCadastroRapidoAberto(false);
                                    setNomeNovoItem("");
                                }}
                                className="text-stone-400 hover:text-red-500 transition"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                                <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-yellow-800 font-medium leading-tight">
                                    Isto cria um item básico para agilizar. Lembre-se de complementar as informações no painel depois (preços, estoque).
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">NOME DA PEÇA</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={nomeNovoItem}
                                    onChange={(e) => setNomeNovoItem(e.target.value)}
                                    placeholder="Ex: Filtro de Ar"
                                    className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none font-bold text-[#1A1A1A]"
                                />
                            </div>

                            <button
                                onClick={handleCadastroPecaRapido}
                                disabled={salvandoNovoItem}
                                className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3.5 rounded-xl shadow-md hover:scale-[1.02] transition flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
                            >
                                {salvandoNovoItem ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar Peça e Selecionar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUCESSO CHECKOUT AVANÇADO (Lançamento de Financeiro Embutido) */}
            {modalSucessoAberto && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
                                <DollarSign /> Fechamento de Venda
                            </h2>
                            <button onClick={() => setModalSucessoAberto(false)} className="p-2 hover:bg-stone-100 rounded-full transition"><X size={20} className="text-stone-400 hover:text-[#1A1A1A]" /></button>
                        </div>

                        <div className="bg-stone-50 p-4 rounded-2xl border-2 border-stone-200 text-center w-full mb-6">
                            <p className="text-xs text-stone-500 uppercase font-bold">Total da Venda #{vendaFinalizadaId}</p>
                            <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-stone-400 font-bold">R$</span>
                                <span className="bg-transparent text-3xl font-bold text-[#1A1A1A]">
                                    {vendaFinalizadaTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* BLOCO FORMULÁRIO DE PAGAMENTO (Se ainda não foi pago) */}
                        {!pagamentoRegistrado ? (
                            <div className="w-full space-y-4 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-2">FORMA DE PAGAMENTO</label>
                                    <select
                                        value={formaPagamento}
                                        onChange={(e) => setFormaPagamento(e.target.value)}
                                        className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium text-[#1A1A1A] border-2 border-stone-300 focus:border-[#FACC15]"
                                    >
                                        <option value="pix">Pix</option>
                                        <option value="dinheiro">Dinheiro</option>
                                        <option value="cartao_debito">Cartão de Débito</option>
                                        <option value="cartao_credito">Cartão de Crédito</option>
                                        <option value="cheque_pre">A prazo</option>
                                    </select>
                                </div>

                                {formaPagamento === "cartao_credito" && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                                            <CreditCard size={12} /> PARCELAS
                                        </label>
                                        <select
                                            value={parcelas}
                                            onChange={(e) => setParcelas(Number(e.target.value))}
                                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium text-[#1A1A1A] border-2 border-stone-300 focus:border-[#FACC15]"
                                        >
                                            {[1, 2, 3, 4, 5, 6, 10, 12].map(n => (
                                                <option key={n} value={n}>{n}x de {(vendaFinalizadaTotal / n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {formaPagamento === "cheque_pre" && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                                            <Calendar size={12} /> DATA DE DEPÓSITO
                                        </label>
                                        <input
                                            type="date"
                                            value={dataCheque}
                                            onChange={(e) => setDataCheque(e.target.value)}
                                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium text-[#1A1A1A] border-2 border-stone-300 focus:border-[#FACC15]"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handleRegistrarPagamento}
                                    disabled={saving}
                                    className="w-full bg-[#1A1A1A] hover:bg-black text-[#FACC15] font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 hover:scale-[1.02] transition"
                                >
                                    {saving ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                                    Confirmar Pagamento e Finalizar
                                </button>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center mb-6 animate-in zoom-in-50 duration-300">
                                <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-3">
                                    <CheckCircle size={32} />
                                </div>
                                <p className="text-[#1A1A1A] font-bold text-lg mb-1">Pagamento Lançado!</p>
                                <p className="text-stone-500 text-xs text-center">A transação já foi enviada para o seu financeiro com sucesso.</p>
                            </div>
                        )}

                        <div className="w-full space-y-3 pt-6 border-t-2 border-stone-100">
                            <Link href={`/imprimir/os/${vendaFinalizadaId}`} target="_blank" className="w-full block">
                                <button className="w-full bg-[#F8F7F2] hover:bg-stone-200 text-[#1A1A1A] font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2">
                                    <Printer size={20} /> Imprimir Recibo
                                </button>
                            </Link>

                        </div>

                        <div className="mt-6 flex flex-col w-full gap-2">
                            <button
                                onClick={() => {
                                    setModalSucessoAberto(false);
                                    setItens([]);
                                    setClienteSelecionado(null);
                                    setVendaFinalizadaId(null);
                                    setVendaFinalizadaTotal(0);
                                    setObservacao("");
                                    setPagamentoRegistrado(false);
                                }}
                                className="w-full bg-[#1A1A1A] text-white font-bold py-3 rounded-2xl transition hover:bg-black text-sm"
                            >
                                Iniciar Nova Venda (Limpar Carrinho)
                            </button>
                            <button
                                onClick={() => setModalSucessoAberto(false)}
                                className="w-full text-stone-500 hover:text-[#1A1A1A] font-bold text-sm py-2 underline transition"
                            >
                                Voltar para a Tela de Venda Atual
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR ITEM */}
            {
                modalEditarItemAberto && itemEditando && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-lg text-[#1A1A1A]">Editar Item</h2>
                                <button onClick={() => { setModalEditarItemAberto(false); setItemEditando(null); }}>
                                    <X size={20} className="text-stone-400" />
                                </button>
                            </div>

                            <div>
                                <p className="font-bold text-sm text-[#1A1A1A]">{itemEditando.nome}</p>
                                <p className="text-xs text-stone-500 uppercase">{itemEditando.tipo}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1">QUANTIDADE</label>
                                    <div className="flex items-center justify-between bg-[#F8F7F2] rounded-2xl p-2 border-2 border-stone-300">
                                        <button
                                            onClick={() => setItemEditando(prev => prev ? { ...prev, qtd: Math.max(1, prev.qtd - 1) } : prev)}
                                            className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#1A1A1A] hover:bg-stone-50"
                                        >
                                            <Minus size={20} />
                                        </button>
                                        <span className="font-bold text-2xl">{itemEditando.qtd}</span>
                                        <button
                                            onClick={() => setItemEditando(prev => prev ? { ...prev, qtd: prev.qtd + 1 } : prev)}
                                            className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#1A1A1A] hover:bg-stone-50"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1">VALOR UNITÁRIO (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={itemEditando.valor}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setItemEditando(prev => prev ? { ...prev, valor: isNaN(val) ? 0 : val } : prev);
                                        }}
                                        className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl text-center text-[#1A1A1A] font-bold outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                                    />
                                </div>

                                <div className="bg-stone-50 rounded-2xl p-3 text-center">
                                    <p className="text-xs text-stone-400 font-bold">TOTAL DO ITEM</p>
                                    <p className="text-xl font-bold text-[#1A1A1A]">R$ {((itemEditando.valor || 0) * itemEditando.qtd).toFixed(2)}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setItens(prev => prev.map(i => i.id === itemEditando.id ? { ...i, valor: itemEditando.valor, qtd: itemEditando.qtd } : i));
                                    setModalEditarItemAberto(false);
                                    setItemEditando(null);
                                }}
                                className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-xl shadow-md hover:scale-105 transition flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Salvar Alterações
                            </button>
                        </div>
                    </div>
                )
            }

        </div>
    );
}

export default function NovaVenda() {
    return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-screen bg-[#F8F7F2]"><Loader2 className="animate-spin text-stone-400" size={32} /></div>}>
            <NovaVendaConteudo />
        </Suspense>
    );
}
