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
    User
} from "lucide-react";
import { useRouter } from "next/navigation";
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

export default function NovaVenda() {
    const router = useRouter();
    const supabase = createClient();
    const { profile, loading: authLoading } = useAuth();

    // --- ESTADOS ---
    const [loadingInit, setLoadingInit] = useState(true);
    const [saving, setSaving] = useState(false);

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

            setListaClientes(clientsRes.data || []);
            setListaProdutos(productsRes.data || []);
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
                    description: "Venda Balcão",
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
                            nome: "Consumidor Final"
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
                            description: "Venda Balcão",
                            total: total,
                        })
                        .select()
                        .single();

                    saleData = retry.data;
                    saleError = retry.error;
                }
            }

            if (saleError) throw saleError;

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

            alert("Venda Realizada com Sucesso!");
            router.push("/atendimento");

        } catch (error: any) {
            console.error("Erro ao salvar:", error);
            alert("Erro ao finalizar Venda: " + error.message);
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
                <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
                    <h3 className="font-bold text-[#1A1A1A] mb-3 flex items-center gap-2">
                        <User size={18} className="text-[#FACC15]" /> Cliente (Opcional)
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            placeholder="Consumidor Final"
                            value={clienteSelecionado ? clienteSelecionado.nome : ""}
                            onClick={() => setModalClienteAberto(true)}
                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none cursor-pointer border-2 border-stone-300 hover:border-[#FACC15] transition font-medium placeholder:text-stone-400"
                        />
                        {clienteSelecionado && (
                            <button
                                onClick={() => setClienteSelecionado(null)}
                                className="w-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center transition shrink-0"
                            >
                                <X size={20} />
                            </button>
                        )}
                        <button
                            onClick={() => setModalClienteAberto(true)}
                            className={`w-14 rounded-2xl flex items-center justify-center transition shrink-0 ${clienteSelecionado ? "bg-green-100 text-green-700" : "bg-[#1A1A1A] text-white"
                                }`}
                        >
                            <Search size={20} />
                        </button>
                    </div>
                </div>

                {/* CARD ITENS */}
                <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm space-y-4">
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

                                    <div className="text-right min-w-[70px]">
                                        <span className="font-bold text-[#1A1A1A] block">R$ {(item.valor * item.qtd).toFixed(2)}</span>
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

                        <div className="flex-1 overflow-auto space-y-2">
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
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
