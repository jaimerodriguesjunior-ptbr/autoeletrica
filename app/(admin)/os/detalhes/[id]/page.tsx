"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, CheckCircle, Clock, Wrench, Package,
  CheckSquare, MessageCircle, User, Car, Loader2, DollarSign,
  Plus, X, Calendar, CreditCard, Trash2, Printer, Camera, UserCheck, ShieldCheck,
  Gauge, Thermometer, Fuel, ChevronDown, ChevronUp, FileUp, Download
} from "lucide-react";
import { createClient } from "../../../../../src/lib/supabase";
import { useAuth } from "../../../../../src/contexts/AuthContext";

// Tipos
type WorkOrderItem = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  tipo: string;
  product_id: string | null;
  peca_cliente: boolean;
};

type WorkOrderFull = {
  id: string | number;
  status: string;
  description: string;
  total: number;
  created_at: string;
  previsao_entrega: string | null; // Novo campo
  public_token: string;
  photos: string[] | null;
  clients: {
    id: string;
    nome: string;
    whatsapp: string | null;
  } | null;
  vehicles: {
    modelo: string;
    placa: string;
    fabricante: string | null;
  } | null;
  work_order_items: WorkOrderItem[];
  aprovacao_ip?: string | null;
  aprovacao_dispositivo?: string | null;
  aprovacao_timestamp?: string | null;
  aprovacao_versao_hash?: string | null;
  odometro?: string | null;
  nivel_combustivel?: string | null;
  temperatura_motor?: string | null;
  painel_obs?: string | null;
  painel_foto?: string | null;
  scanner_pdf?: string | null;
};

type CatalogItem = { id: string; nome: string; price?: number; preco_venda?: number; estoque_atual?: number };

export default function DetalhesOS() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState<WorkOrderFull | null>(null);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Previsão de Entrega
  const [previsao, setPrevisao] = useState("");

  // Estados para Adicionar Item
  const [listaProdutos, setListaProdutos] = useState<CatalogItem[]>([]);
  const [listaServicos, setListaServicos] = useState<CatalogItem[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [abaItem, setAbaItem] = useState<"pecas" | "servicos">("pecas");
  const [termoBusca, setTermoBusca] = useState("");
  const [adicionandoItem, setAdicionandoItem] = useState(false);

  // Scanner PDF
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [uploadingScan, setUploadingScan] = useState(false);

  // Estados para Checkout (Financeiro)
  const [modalCheckoutAberto, setModalCheckoutAberto] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [dataCheque, setDataCheque] = useState("");
  const [valorFinal, setValorFinal] = useState("");
  const [parcelas, setParcelas] = useState(1);

  // Modal Metadados de Aprovação
  const [modalMetadados, setModalMetadados] = useState(false);
  const [checklistAberto, setChecklistAberto] = useState(false);

  // 1. Busca Dados da OS
  const fetchOS = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          clients ( id, nome, whatsapp ),
          vehicles ( modelo, placa, fabricante ),
          work_order_items ( id, name, unit_price, quantity, total_price, tipo, product_id, peca_cliente )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOs(data as unknown as WorkOrderFull);

      if (data) {
        setValorFinal(data.total.toString());
        // Formata data para o input type="date" (YYYY-MM-DD)
        if (data.previsao_entrega) {
          setPrevisao(new Date(data.previsao_entrega).toISOString().split('T')[0]);
        }
      }

    } catch (error) {
      console.error("Erro ao buscar detalhes:", error);
      alert("Ordem de serviço não encontrada.");
      router.push("/os");
    }
  }, [id, supabase, router]);

  // 2. Busca Catálogo
  const fetchCatalogo = useCallback(async () => {
    if (!profile?.organization_id) return;
    try {
      const [prodRes, servRes] = await Promise.all([
        supabase.from("products").select("id, nome, preco_venda, estoque_atual").order("nome"),
        supabase.from("services").select("id, nome, price").order("nome"),
      ]);
      setListaProdutos(prodRes.data || []);
      setListaServicos(servRes.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [supabase, profile]);

  useEffect(() => {
    if (id && profile?.organization_id) {
      setLoading(true);
      Promise.all([fetchOS(), fetchCatalogo()]).finally(() => setLoading(false));
    }
  }, [fetchOS, fetchCatalogo, id, profile]);

  // --- FUNÇÕES DE FOTO (CÓDIGO NOVO) ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !os) return;
    setUploading(true);

    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${os.id}/${Date.now()}.${fileExt}`;

      // 1. Upload para o bucket 'os-images'
      const { error: uploadError } = await supabase.storage
        .from('os-images')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      // 2. Pegar URL Pública
      const { data: publicUrlData } = supabase.storage
        .from('os-images')
        .getPublicUrl(fileName);
      const newPhotoUrl = publicUrlData.publicUrl;

      // 3. Atualizar Banco
      const currentPhotos = os.photos || [];
      const updatedPhotos = [...currentPhotos, newPhotoUrl];

      const { error: dbError } = await supabase
        .from('work_orders')
        .update({ photos: updatedPhotos })
        .eq('id', os.id);
      if (dbError) throw dbError;

      // 4. Atualizar Tela
      setOs({ ...os, photos: updatedPhotos });

    } catch (error: any) {
      alert("Erro ao enviar foto: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (photoUrl: string) => {
    if (!os || !confirm("Excluir esta foto?")) return;
    try {
      const currentPhotos = os.photos || [];
      const updatedPhotos = currentPhotos.filter((p) => p !== photoUrl);

      const { error } = await supabase.from('work_orders').update({ photos: updatedPhotos }).eq('id', os.id);
      if (error) throw error;

      setOs({ ...os, photos: updatedPhotos });
    } catch (error: any) {
      alert("Erro ao remover foto: " + error.message);
    }
  };


  const handleStatusChange = async (novoStatus: string) => {
    if (!os) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: novoStatus })
        .eq('id', os.id);
      if (error) throw error;
      setOs({ ...os, status: novoStatus });
    } catch (error: any) {
      alert("Erro ao atualizar status: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // Salvar Previsão ao mudar a data
  const handleSalvarPrevisao = async (novaData: string) => {
    setPrevisao(novaData);
    if (!os) return;

    try {
      await supabase
        .from('work_orders')
        .update({ previsao_entrega: novaData || null })
        .eq('id', os.id);
    } catch (error) {
      console.error("Erro ao salvar previsão", error);
    }
  };

  // REMOVER ITEM (COM ESTORNO)
  const handleRemoverItem = async (item: WorkOrderItem) => {
    if (!os) return;

    if (os.status === 'cancelado' || os.status === 'entregue') {
      return alert("Não é possível remover itens de uma OS finalizada ou cancelada.");
    }

    if (!confirm(`Deseja remover "${item.name}" da OS? O estoque será devolvido.`)) return;

    setUpdating(true);
    try {
      if (item.tipo === "peca" && item.product_id && !item.peca_cliente) {
        const { data: prodData } = await supabase
          .from('products')
          .select('estoque_atual')
          .eq('id', item.product_id)
          .single();

        if (prodData) {
          await supabase
            .from('products')
            .update({ estoque_atual: (prodData.estoque_atual || 0) + item.quantity })
            .eq('id', item.product_id);
        }
      }

      await supabase.from('work_order_items').delete().eq('id', item.id);

      const novoTotal = item.peca_cliente ? (os.total || 0) : (os.total || 0) - item.total_price;
      await supabase
        .from('work_orders')
        .update({ total: novoTotal })
        .eq('id', os.id);

      fetchOS();
      alert("Item removido e estoque atualizado.");

    } catch (error: any) {
      alert("Erro ao remover item: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // TOGGLE PEÇA DO CLIENTE
  const handleTogglePecaCliente = async (item: WorkOrderItem) => {
    if (!os) return;
    setUpdating(true);
    try {
      const novoValor = !item.peca_cliente;

      // 1. Atualiza o campo no banco
      await supabase
        .from('work_order_items')
        .update({ peca_cliente: novoValor })
        .eq('id', item.id);

      // 2. Gerenciar estoque
      if (item.tipo === 'peca' && item.product_id) {
        const { data: prodData } = await supabase
          .from('products')
          .select('estoque_atual')
          .eq('id', item.product_id)
          .single();

        if (prodData) {
          const ajuste = novoValor ? item.quantity : -item.quantity;
          await supabase
            .from('products')
            .update({ estoque_atual: (prodData.estoque_atual || 0) + ajuste })
            .eq('id', item.product_id);
        }
      }

      // 3. Recalcular total da OS (excluindo peças do cliente)
      const itensAtualizados = os.work_order_items.map(i =>
        i.id === item.id ? { ...i, peca_cliente: novoValor } : i
      );
      const novoTotal = itensAtualizados.reduce((acc, i) =>
        i.peca_cliente ? acc : acc + i.total_price, 0
      );

      await supabase
        .from('work_orders')
        .update({ total: novoTotal })
        .eq('id', os.id);

      fetchOS();
    } catch (error: any) {
      alert("Erro ao atualizar peça do cliente: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelarOS = async () => {
    if (!os) return;
    if (!confirm("ATENÇÃO: Isso irá cancelar a OS e devolver todas as peças ao estoque. Continuar?")) return;

    setUpdating(true);
    try {
      for (const item of os.work_order_items) {
        if (item.tipo === "peca" && item.product_id) {
          const { data: prodData } = await supabase
            .from('products')
            .select('estoque_atual')
            .eq('id', item.product_id)
            .single();

          if (prodData) {
            await supabase
              .from('products')
              .update({ estoque_atual: (prodData.estoque_atual || 0) + item.quantity })
              .eq('id', item.product_id);
          }
        }
      }

      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'cancelado' })
        .eq('id', os.id);

      if (error) throw error;

      alert("OS Cancelada com sucesso.");
      router.push("/os");

    } catch (error: any) {
      alert("Erro ao cancelar OS: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCheckout = async () => {
    if (!os || !profile?.organization_id) return;

    if (formaPagamento === "cheque_pre" && !dataCheque) {
      return alert("Para Cheque-pré, é obrigatório informar a data de depósito.");
    }

    setUpdating(true);

    try {
      const valorTotal = parseFloat(valorFinal);
      const transacoesParaInserir = [];
      const hoje = new Date();

      if (formaPagamento === 'cartao_credito') {
        const valorParcela = valorTotal / parcelas;

        for (let i = 1; i <= parcelas; i++) {
          const dataVencimento = new Date(hoje);
          dataVencimento.setDate(hoje.getDate() + (i * 30));

          transacoesParaInserir.push({
            organization_id: profile.organization_id,
            work_order_id: os.id,
            description: `Recebimento OS #${os.id} - ${os.clients?.nome} (Parc ${i}/${parcelas})`,
            amount: valorParcela,
            type: 'income',
            category: 'Serviços',
            status: 'pending',
            date: dataVencimento.toISOString().split('T')[0]
          });
        }

      } else if (formaPagamento === 'cheque_pre') {
        transacoesParaInserir.push({
          organization_id: profile.organization_id,
          work_order_id: os.id,
          description: `Recebimento OS #${os.id} - ${os.clients?.nome} (Cheque)`,
          amount: valorTotal,
          type: 'income',
          category: 'Serviços',
          status: 'pending',
          date: dataCheque
        });

      } else {
        transacoesParaInserir.push({
          organization_id: profile.organization_id,
          work_order_id: os.id,
          description: `Recebimento OS #${os.id} - ${os.clients?.nome} (${formaPagamento})`,
          amount: valorTotal,
          type: 'income',
          category: 'Serviços',
          status: 'paid',
          date: hoje.toISOString().split('T')[0]
        });
      }

      const { error: osError } = await supabase
        .from('work_orders')
        .update({
          status: 'entregue',
          total: valorTotal
        })
        .eq('id', os.id);

      if (osError) throw osError;

      const { error: transError } = await supabase
        .from('transactions')
        .insert(transacoesParaInserir);

      if (transError) throw transError;

      alert("OS Finalizada e Financeiro Lançado!");
      setModalCheckoutAberto(false);
      setOs({ ...os, status: 'entregue', total: valorTotal });

    } catch (error: any) {
      alert("Erro no checkout: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAdicionarItem = async (item: CatalogItem, tipo: "peca" | "servico") => {
    if (!os || !profile?.organization_id) return;
    setAdicionandoItem(true);

    const valorUnitario = item.price || item.preco_venda || 0;
    const quantidade = 1;
    const totalItem = valorUnitario * quantidade;

    try {
      const { error: itemError } = await supabase
        .from("work_order_items")
        .insert({
          work_order_id: os.id,
          organization_id: profile.organization_id,
          product_id: tipo === "peca" ? item.id : null,
          service_id: tipo === "servico" ? item.id : null,
          tipo: tipo,
          name: item.nome,
          quantity: quantidade,
          unit_price: valorUnitario,
          total_price: totalItem,
          peca_cliente: false
        });

      if (itemError) throw itemError;

      if (tipo === "peca") {
        const { data: prodData } = await supabase
          .from('products')
          .select('estoque_atual')
          .eq('id', item.id)
          .single();

        if (prodData) {
          const novoEstoque = (prodData.estoque_atual || 0) - quantidade;
          await supabase
            .from('products')
            .update({ estoque_atual: novoEstoque })
            .eq('id', item.id);
        }
      }

      const novoTotalOS = (os.total || 0) + totalItem;
      const { error: osError } = await supabase
        .from("work_orders")
        .update({ total: novoTotalOS })
        .eq("id", os.id);

      if (osError) throw osError;

      setModalAberto(false);
      fetchOS();
      alert("Item adicionado e estoque atualizado!");

    } catch (error: any) {
      alert("Erro ao adicionar item: " + error.message);
    } finally {
      setAdicionandoItem(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getStatusColor = (stepStatus: string) => {
    if (!os) return "";
    const currentStatus = os.status;
    const flow = ['orcamento', 'aprovado', 'aguardando_peca', 'em_servico', 'pronto', 'entregue'];
    const currentIndex = flow.indexOf(currentStatus);
    const stepIndex = flow.indexOf(stepStatus);

    if (currentStatus === 'cancelado') return "bg-gray-100 text-gray-400 border-gray-200 grayscale";

    if (currentStatus === stepStatus) return "bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A] shadow-lg scale-105";
    if (currentIndex > stepIndex) return "bg-green-200 text-green-800 border-green-300";
    return "bg-white text-stone-400 border-stone-100";
  };

  const handleWhatsapp = () => {
    if (os?.clients?.whatsapp) {
      const number = os.clients.whatsapp.replace(/\D/g, '');
      const osId = String(os.id);
      const baseUrl = window.location.origin;
      const trackingLink = `${baseUrl}/acompanhar?token=${os.public_token}`;
      const message = `Olá ${os.clients.nome}, tudo bem? 👋\n\n` +
        `Sobre o seu veículo: *${os.vehicles?.modelo}* (OS #${osId}).\n` +
        `Você pode acompanhar o status e o orçamento clicando aqui:\n\n` +
        `${trackingLink}`;
      window.open(`https://wa.me/55${number}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      alert("Cliente sem WhatsApp cadastrado.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#FACC15]" size={40} /></div>;
  if (!os) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">

      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/os">
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1A1A1A]">OS #{String(os.id).slice(0, 4).toUpperCase()}</h1>
              <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase border ${os.status === 'cancelado' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                {os.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-stone-500 text-xs flex items-center gap-2 mt-1">
              <Car size={12} /> {os.vehicles?.modelo} <span className="text-stone-300">|</span> <span className="font-mono">{os.vehicles?.placa}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {/* BOTÃO DE IMPRESSÃO (NOVO) */}
          <Link href={`/imprimir/os/${os.id}`} target="_blank">

            <button className="bg-white border border-stone-200 text-[#1A1A1A] px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-50 transition">
              <Printer size={18} /> Imprimir
            </button>
          </Link>

          <button
            onClick={handleWhatsapp}
            className="bg-green-100 text-green-700 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-200 transition"
          >
            <MessageCircle size={18} /> Falar com Cliente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* 2. CONTROLE DE FLUXO (ESQUERDA) */}
        <div className="md:col-span-2 space-y-6">

          <div className="bg-white rounded-[32px] p-8 border-2 border-stone-300 shadow-sm">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center gap-2">
              <Clock size={20} /> Linha do Tempo
            </h2>

            <div className="space-y-4 relative">
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-stone-100 -z-10"></div>

              {/* CARD: ORÇAMENTO */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('orcamento')} ${os.status !== 'orcamento' && os.aprovacao_timestamp ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                onClick={() => {
                  if (os.status !== 'orcamento' && os.aprovacao_timestamp) setModalMetadados(true);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><DollarSign size={20} /></div>
                  <div>
                    <p className="font-bold text-sm">Orçamento Criado</p>
                    <p className="text-xs opacity-80">{os.status !== 'orcamento' && os.aprovacao_timestamp ? 'Aprovado ✓ (clique para ver detalhes)' : 'Aguardando aprovação'}</p>
                  </div>
                </div>
                {os.status === 'orcamento' && (
                  <button onClick={() => {
                    const temPecaCliente = os.work_order_items?.some(i => i.peca_cliente);
                    if (temPecaCliente) {
                      const aceita = confirm(
                        '⚠️ ATENÇÃO: Esta OS contém peças trazidas pelo cliente.\n\n' +
                        'A aprovação local (feita pelo mecânico) não registra os dados de aceite do cliente e pode comprometer a segurança jurídica quanto à garantia dessas peças.\n\n' +
                        'Para proteção da oficina, recomenda-se que o cliente aprove pelo portal.\n\n' +
                        'Deseja aprovar localmente mesmo assim?'
                      );
                      if (!aceita) return;
                    }
                    handleStatusChange('aprovado');
                  }} disabled={updating} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2">
                    {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Aprovar
                  </button>
                )}
              </div>

              {/* CARD: APROVADO / AGUARDANDO PEÇA */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('aguardando_peca')}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Package size={20} /></div>
                  <div><p className="font-bold text-sm">Peças / Insumos</p><p className="text-xs opacity-80">Verificando estoque</p></div>
                </div>
                {(os.status === 'aprovado' || os.status === 'aguardando_peca') && (
                  <button onClick={() => handleStatusChange('em_servico')} disabled={updating} className="bg-[#FACC15] text-[#1A1A1A] px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-yellow-400 transition flex items-center gap-2">
                    <Wrench size={14} /> Iniciar Serviço
                  </button>
                )}
              </div>

              {/* CARD: EM SERVIÇO */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('em_servico')}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Wrench size={20} /></div>
                  <div><p className="font-bold text-sm">Em Execução</p><p className="text-xs opacity-80">Mecânico trabalhando</p></div>
                </div>
                {os.status === 'em_servico' && (
                  <button onClick={() => handleStatusChange('pronto')} disabled={updating} className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-green-600 transition flex items-center gap-2">
                    <CheckSquare size={14} /> Finalizar
                  </button>
                )}
              </div>

              {/* CARD: PRONTO */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('pronto')}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><CheckCircle size={20} /></div>
                  <div><p className="font-bold text-sm">Pronto p/ Entrega</p><p className="text-xs opacity-80">Veículo testado e liberado</p></div>
                </div>
                {os.status === 'pronto' && (
                  <button onClick={() => setModalCheckoutAberto(true)} disabled={updating} className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition flex items-center gap-2">
                    Entregar & Fechar
                  </button>
                )}
              </div>

            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
            <h3 className="font-bold text-[#1A1A1A] mb-2 text-sm flex items-center gap-2">
              <MessageCircle size={16} /> Relato / Defeito
            </h3>
            <p className="text-stone-600 text-sm bg-[#F8F7F2] p-4 rounded-2xl border border-stone-100">
              {os.description || "Nenhuma descrição informada."}
            </p>
          </div>


          {/* === GALERIA DE FOTOS (NOVO) === */}
          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-sm flex items-center gap-2">
                <Camera size={16} /> Fotos do Veículo
              </h3>
              <span className="text-xs text-stone-400">{os.photos?.length || 0} fotos</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* Botão Adicionar */}
              <label className="aspect-square rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#FACC15] hover:bg-yellow-50 transition gap-1 relative">
                {uploading ? <Loader2 className="animate-spin text-stone-400" /> : <Plus size={24} className="text-stone-300" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>

              {/* Lista de Fotos */}
              {os.photos?.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-100 group">
                  <Image src={url} alt="Foto OS" fill className="object-cover" />
                  <button
                    onClick={() => handleRemoveImage(url)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-sm z-10"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>



        </div>

        {/* 3. RESUMO (DIREITA) */}
        <div className="space-y-6">
          <div className="bg-stone-50 rounded-[32px] p-6 border-2 border-stone-300 shadow-sm h-fit">

            {/* CAMPO DE PREVISÃO (NOVO) */}
            <div className="mb-6 bg-white p-3 rounded-2xl border border-stone-100">
              <label className="text-[10px] font-bold text-stone-400 flex items-center gap-1 mb-1">
                <Calendar size={12} /> PREVISÃO DE ENTREGA
              </label>
              <input
                type="date"
                value={previsao}
                onChange={(e) => handleSalvarPrevisao(e.target.value)}
                className="w-full font-bold text-[#1A1A1A] outline-none bg-transparent"
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                <User size={16} /> Cliente
              </h3>
              {os.clients?.id && (
                <Link href={`/clientes/${os.clients.id}`} className="text-xs font-bold text-stone-400 hover:text-[#1A1A1A] transition flex items-center gap-1">
                  Editar
                </Link>
              )}
            </div>
            <div className="mb-6">
              <p className="text-lg font-bold text-[#1A1A1A]">{os.clients?.nome}</p>
              <p className="text-sm text-stone-500">{os.clients?.whatsapp || "Sem telefone"}</p>
            </div>

            {/* DADOS DO PAINEL */}
            {(os.odometro || os.nivel_combustivel || os.temperatura_motor || os.painel_obs) && (
              <>
                <div className="border-t border-stone-300 my-4"></div>
                <button
                  onClick={() => setChecklistAberto(!checklistAberto)}
                  className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition"
                >
                  <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                    <Gauge size={16} /> Checklist
                  </h3>
                  {checklistAberto ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
                </button>
                {checklistAberto && (
                  <div className="space-y-2 text-sm animate-in slide-in-from-top-2">
                    {os.odometro && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Gauge size={13} /> Odômetro</span>
                        <span className="font-bold text-[#1A1A1A]">{Number(os.odometro).toLocaleString('pt-BR')} km</span>
                      </div>
                    )}
                    {os.nivel_combustivel && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Fuel size={13} /> Combustível</span>
                        <span className="font-bold text-[#1A1A1A] capitalize">{os.nivel_combustivel}</span>
                      </div>
                    )}
                    {os.temperatura_motor && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Thermometer size={13} /> Temperatura</span>
                        <span className={`font-bold capitalize ${os.temperatura_motor === 'critica' ? 'text-red-600' :
                          os.temperatura_motor === 'elevada' ? 'text-yellow-600' : 'text-green-600'
                          }`}>{os.temperatura_motor}</span>
                      </div>
                    )}
                    {os.painel_obs && (
                      <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mt-2">
                        <p className="text-[10px] font-bold text-yellow-600 uppercase mb-1">Observações do Painel</p>
                        <p className="text-xs text-stone-600">{os.painel_obs}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="border-t border-stone-300 my-4"></div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A]">Itens da OS</h3>
              {os.status !== 'cancelado' && (
                <button
                  onClick={() => setModalAberto(true)}
                  className="bg-white hover:bg-stone-100 text-[#1A1A1A] p-2 rounded-full shadow-sm transition"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="space-y-3 text-sm">
              {os.work_order_items?.map((item) => (
                <div key={item.id} className={`rounded-xl p-3 ${item.peca_cliente ? 'bg-yellow-50 border-2 border-yellow-200' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`text-stone-600 font-medium ${item.peca_cliente ? 'line-through opacity-60' : ''}`}>{item.name}</p>
                      <p className="text-[10px] text-stone-400">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${item.peca_cliente ? 'text-stone-400 line-through' : 'text-[#1A1A1A]'}`}>{formatCurrency(item.total_price)}</span>

                      {/* BOTÃO PEÇA DO CLIENTE */}
                      {item.tipo === 'peca' && (
                        <button
                          onClick={() => handleTogglePecaCliente(item)}
                          disabled={updating}
                          className={`p-1.5 rounded-lg transition ${item.peca_cliente
                            ? 'bg-yellow-400 text-[#1A1A1A]'
                            : 'bg-stone-100 text-stone-400 hover:bg-yellow-100 hover:text-yellow-700'
                            }`}
                          title={item.peca_cliente ? 'Peça do cliente (clique para desmarcar)' : 'Marcar como peça do cliente'}
                        >
                          <UserCheck size={14} />
                        </button>
                      )}

                      {/* BOTÃO REMOVER */}
                      <button
                        onClick={() => handleRemoverItem(item)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        title="Remover Item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {item.peca_cliente && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-yellow-400 text-[#1A1A1A] px-2 py-0.5 rounded-full">
                      <UserCheck size={10} /> PEÇA DO CLIENTE
                    </span>
                  )}
                </div>
              ))}

              {(!os.work_order_items || os.work_order_items.length === 0) && (
                <p className="text-xs text-stone-400 italic text-center py-2">Nenhum item adicionado.</p>
              )}

              <div className="border-t border-stone-300 my-2 pt-4 flex justify-between text-lg">
                <span className="font-bold text-[#1A1A1A]">Total</span>
                <span className="font-bold text-[#1A1A1A]">{formatCurrency(os.total)}</span>
              </div>

              {/* RELATÓRIO DE SCANNER */}
              <div className="border-t border-stone-200 mt-4 pt-4">
                <input
                  type="file"
                  ref={scannerInputRef}
                  accept="application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    if (!e.target.files?.[0] || !os) return;
                    setUploadingScan(true);
                    try {
                      const file = e.target.files[0];
                      const fileName = `${os.id}/scanner_${Date.now()}.pdf`;
                      const { error: upErr } = await supabase.storage.from('os-images').upload(fileName, file);
                      if (upErr) throw upErr;
                      const { data: urlData } = supabase.storage.from('os-images').getPublicUrl(fileName);
                      await supabase.from('work_orders').update({ scanner_pdf: urlData.publicUrl }).eq('id', os.id);
                      setOs({ ...os, scanner_pdf: urlData.publicUrl });
                      alert('Relatório enviado!');
                    } catch (err: any) {
                      alert('Erro ao enviar: ' + err.message);
                    } finally {
                      setUploadingScan(false);
                    }
                  }}
                />
                <button
                  onClick={() => { if (scannerInputRef.current) scannerInputRef.current.value = ''; scannerInputRef.current?.click(); }}
                  disabled={uploadingScan}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-[#FACC15] hover:text-[#1A1A1A] transition font-bold text-sm"
                >
                  {uploadingScan ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  {uploadingScan ? 'Enviando...' : 'Relatório de Scanner'}
                </button>

                {os.scanner_pdf && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={os.scanner_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm font-bold hover:bg-blue-100 transition"
                    >
                      <Download size={16} />
                      Relatório de Scanner.pdf
                    </a>
                    <button
                      onClick={async () => {
                        if (!confirm('Deseja remover o relatório de scanner?')) return;
                        try {
                          await supabase.from('work_orders').update({ scanner_pdf: null }).eq('id', os.id);
                          setOs({ ...os, scanner_pdf: null });
                        } catch (err: any) {
                          alert('Erro ao remover: ' + err.message);
                        }
                      }}
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-500 hover:bg-red-100 transition"
                      title="Remover relatório"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-stone-400 mb-2">Criado em: {new Date(os.created_at).toLocaleDateString()}</p>
            {os.status !== 'cancelado' && os.status !== 'entregue' && (
              <button
                onClick={handleCancelarOS}
                className="text-red-400 text-xs font-bold hover:underline"
              >
                Cancelar Ordem de Serviço
              </button>
            )}
            {os.status === 'cancelado' && <p className="text-red-500 font-bold text-sm">ESTA ORDEM FOI CANCELADA</p>}
          </div>
        </div>

      </div>

      {/* MODAL ADICIONAR ITEM */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4 h-[500px] flex flex-col">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Adicionar à OS Existente</h2>
              <button onClick={() => setModalAberto(false)}>
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
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"
            />
            <div className="flex-1 overflow-auto space-y-2">
              {adicionandoItem && (
                <div className="text-center py-4 text-stone-400 flex flex-col items-center">
                  <Loader2 className="animate-spin mb-2" /> Salvando...
                </div>
              )}

              {!adicionandoItem && abaItem === "pecas" &&
                listaProdutos
                  .filter((p) => p.nome.toLowerCase().includes(termoBusca.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAdicionarItem(p, "peca")}
                      className="w-full flex justify-between p-3 hover:bg-stone-50 rounded-xl text-left"
                    >
                      <div>
                        <p className="font-bold">{p.nome}</p>
                        <p className="text-xs text-stone-400">Estoque: {p.estoque_atual}</p>
                      </div>
                      <span className="font-bold">R$ {p.preco_venda?.toFixed(2)}</span>
                    </button>
                  ))}

              {!adicionandoItem && abaItem === "servicos" &&
                listaServicos
                  .filter((s) => s.nome.toLowerCase().includes(termoBusca.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAdicionarItem(s, "servico")}
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

      {/* MODAL CHECKOUT FINANCEIRO */}
      {modalCheckoutAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
                <DollarSign /> Fechamento de OS
              </h2>
              <button onClick={() => setModalCheckoutAberto(false)}><X /></button>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl text-center">
              <p className="text-xs text-stone-500 uppercase font-bold">Total a Receber</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-stone-400 font-bold">R$</span>
                <input
                  type="number"
                  value={valorFinal}
                  onChange={(e) => setValorFinal(e.target.value)}
                  className="bg-transparent text-3xl font-bold text-[#1A1A1A] w-32 text-center outline-none border-b border-stone-300 focus:border-[#FACC15] transition"
                />
              </div>
              <p className="text-[10px] text-stone-400 mt-2">Você pode ajustar o valor final aqui (descontos)</p>
            </div>

            <div className="space-y-4">
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
                  <option value="cheque_pre">Cheque-pré (A prazo)</option>
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
                      <option key={n} value={n}>{n}x de {formatCurrency(Number(valorFinal) / n)}</option>
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
            </div>

            <button
              onClick={handleCheckout}
              disabled={updating}
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 hover:scale-105 transition"
            >
              {updating ? <Loader2 className="animate-spin" /> : <CheckCircle />}
              Confirmar Recebimento
            </button>
          </div>
        </div>
      )}

      {/* MODAL METADADOS DE APROVAÇÃO */}
      {modalMetadados && os.aprovacao_timestamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
                <ShieldCheck size={20} className="text-green-600" /> Dados da Aprovação
              </h2>
              <button onClick={() => setModalMetadados(false)}><X /></button>
            </div>

            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Data e Hora</p>
                <p className="text-sm font-bold text-[#1A1A1A]">
                  {new Date(os.aprovacao_timestamp).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Endereço IP</p>
                <p className="text-sm font-mono font-bold text-[#1A1A1A]">{os.aprovacao_ip || 'Não disponível'}</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Dispositivo</p>
                <p className="text-xs text-[#1A1A1A] break-all">{os.aprovacao_dispositivo || 'Não disponível'}</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Hash do Orçamento</p>
                <p className="text-[10px] font-mono text-stone-600 break-all">{os.aprovacao_versao_hash || 'Não disponível'}</p>
              </div>
            </div>

            <button
              onClick={() => setModalMetadados(false)}
              className="w-full bg-stone-100 text-stone-600 font-bold py-3 rounded-2xl border-2 border-stone-300 hover:bg-stone-200 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}