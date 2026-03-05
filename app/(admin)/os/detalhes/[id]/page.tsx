"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, CheckCircle, Clock, Wrench, Package, Save,
  CheckSquare, MessageCircle, User, Car, Loader2, DollarSign,
  Plus, Minus, X, Calendar, CreditCard, Trash2, Printer, Camera, UserCheck, ShieldCheck,
  Gauge, Thermometer, Fuel, ChevronDown, ChevronUp, FileUp, Download, Search, AlertTriangle, Mic, AlertCircle
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
    id: string;
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
  defeitos_constatados?: string | null;
  servicos_executados?: string | null;
  appointments?: {
    id: string;
    type: string;
    status: string;
    description: string;
    start_time: string;
    duration_minutes: number;
  }[];
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

  // Laudo Técnico (Novos Campos)
  const [defeitosConstatados, setDefeitosConstatados] = useState("");
  const [servicosExecutados, setServicosExecutados] = useState("");
  const [salvandoLaudo, setSalvandoLaudo] = useState(false);

  // Previsão de Entrega
  const [previsao, setPrevisao] = useState("");

  // Speech Recognition (Laudo)
  const recognitionDefeitosRef = useRef<any>(null);
  const recognitionServicosRef = useRef<any>(null);
  const [isListeningDefeitos, setIsListeningDefeitos] = useState(false);
  const [isListeningServicos, setIsListeningServicos] = useState(false);

  const startSpeech = (target: 'defeitos' | 'servicos') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador n\u00e3o suporta reconhecimento de voz. Use o Google Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        if (target === 'defeitos') {
          setDefeitosConstatados(prev => prev ? prev + ' ' + transcript : transcript);
        } else {
          setServicosExecutados(prev => prev ? prev + ' ' + transcript : transcript);
        }
      }
    };
    recognition.onend = () => {
      if (target === 'defeitos') setIsListeningDefeitos(false);
      else setIsListeningServicos(false);
    };
    recognition.onerror = () => {
      if (target === 'defeitos') setIsListeningDefeitos(false);
      else setIsListeningServicos(false);
    };
    if (target === 'defeitos') {
      recognitionDefeitosRef.current = recognition;
      setIsListeningDefeitos(true);
    } else {
      recognitionServicosRef.current = recognition;
      setIsListeningServicos(true);
    }
    recognition.start();
  };

  const stopSpeech = (target: 'defeitos' | 'servicos') => {
    if (target === 'defeitos') {
      recognitionDefeitosRef.current?.stop();
    } else {
      recognitionServicosRef.current?.stop();
    }
  };

  // Estados para Adicionar Item
  const [listaProdutos, setListaProdutos] = useState<CatalogItem[]>([]);
  const [listaServicos, setListaServicos] = useState<CatalogItem[]>([]);
  const [termoBusca, setTermoBusca] = useState("");
  const [adicionandoItem, setAdicionandoItem] = useState(false);

  const [modalAdicionarTipo, setModalAdicionarTipo] = useState<'peca' | 'servico' | null>(null);
  const [modalEditarItemAberto, setModalEditarItemAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState<WorkOrderItem | null>(null);
  const [novoValorItem, setNovoValorItem] = useState('');
  const [novaQtdItem, setNovaQtdItem] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Cadastro Rápido de Item
  const [modalCadastroRapidoTipo, setModalCadastroRapidoTipo] = useState<'peca' | 'servico' | null>(null);
  const [nomeNovoItem, setNomeNovoItem] = useState("");
  const [salvandoNovoItem, setSalvandoNovoItem] = useState(false);

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

  // Diagnóstico OBD-II
  const [dtcAberto, setDtcAberto] = useState(false);
  const [dtcBusca, setDtcBusca] = useState("");
  const [dtcResultado, setDtcResultado] = useState<{ code: string; description_pt: string; source?: 'db' | 'ia' | 'error' } | null>(null);
  const [dtcsSalvos, setDtcsSalvos] = useState<{ id: string; code: string; description_pt: string; notes: string | null }[]>([]);
  const [buscandoDtc, setBuscandoDtc] = useState(false);
  const [salvandoDtc, setSalvandoDtc] = useState(false);
  const dtcTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [checklistAberto, setChecklistAberto] = useState(false);

  // Novo Agendamento
  const [modalAgendamentoAberto, setModalAgendamentoAberto] = useState(false);
  const [formAgendamento, setFormAgendamento] = useState({
    data: new Date().toISOString().split('T')[0],
    hora: '09:00',
    tipo: 'ja_tem_os',
    duracao: 60,
    desc: ''
  });
  const [salvandoAgendamento, setSalvandoAgendamento] = useState(false);

  // 1. Busca Dados da OS
  const fetchOS = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          clients ( id, nome, whatsapp ),
          vehicles ( id, modelo, placa, fabricante ),
          work_order_items ( id, name, unit_price, quantity, total_price, tipo, product_id, peca_cliente ),
          appointments ( id, type, status, description, start_time, duration_minutes )
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
        setDefeitosConstatados(data.defeitos_constatados || "");
        setServicosExecutados(data.servicos_executados || "");
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

  // Buscar DTCs salvos na OS
  const fetchDtcsSalvos = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('work_order_dtc_codes')
        .select('id, code, notes, obd2_codes(description_pt)')
        .eq('work_order_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDtcsSalvos(
        (data || []).map((d: any) => ({
          id: d.id,
          code: d.code,
          description_pt: d.obd2_codes?.description_pt || 'Descrição não encontrada',
          notes: d.notes,
        }))
      );
    } catch (err) {
      console.error('Erro ao buscar DTCs:', err);
    }
  }, [id, supabase]);

  // Buscar código OBD-II (com debounce + fallback IA)
  const executarBuscaDtc = async (code: string) => {
    console.log('[DTC] Iniciando busca para:', code);
    setBuscandoDtc(true);
    try {
      // 1. Busca no banco local
      const { data, error } = await supabase
        .from('obd2_codes')
        .select('code, description_pt')
        .eq('code', code)
        .maybeSingle();

      console.log('[DTC] Resultado banco:', { data, error });

      if (data) {
        console.log('[DTC] Encontrado no banco!');
        setDtcResultado({ ...data, source: 'db' });
      } else if (code.length >= 5) {
        // 2. Fallback: Busca via IA (apenas se código completo)
        console.log('[DTC] Não encontrado no banco, chamando IA...');
        try {
          const res = await fetch('/api/obd2-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const iaData = await res.json();
          console.log('[DTC] Resposta IA:', iaData);
          if (res.ok && iaData.description_pt) {
            setDtcResultado({ code: iaData.code, description_pt: iaData.description_pt, source: 'ia' });
          } else {
            // Pode ser rate limit, erro da Key do Gemini, etc.
            setDtcResultado({ code, description_pt: iaData.error || 'Erro interno da IA (Limite excedido)', source: 'error' });
          }
        } catch (iaErr) {
          console.error('[DTC] Erro na chamada IA:', iaErr);
          setDtcResultado({ code, description_pt: 'Falha de rede ao se conectar com a IA', source: 'error' });
        }
      } else {
        setDtcResultado(null);
      }
    } catch (err) {
      console.error('[DTC] Erro geral:', err);
      setDtcResultado(null);
    } finally {
      setBuscandoDtc(false);
    }
  };

  const handleBuscarDtc = (termo: string) => {
    setDtcBusca(termo);
    setDtcResultado(null);
    const code = termo.trim().toUpperCase();
    if (code.length < 2) return;

    // Debounce: espera 600ms após última tecla
    if (dtcTimerRef.current) clearTimeout(dtcTimerRef.current);
    dtcTimerRef.current = setTimeout(() => {
      executarBuscaDtc(code);
    }, 600);
  };

  // Adicionar código DTC à OS
  const handleAdicionarDtc = async () => {
    if (!dtcResultado || !os) return;
    // Verificar se já está salvo
    if (dtcsSalvos!.some(d => d.code === dtcResultado.code)) {
      alert('Este código já foi adicionado a esta OS.');
      return;
    }
    setSalvandoDtc(true);
    try {
      const { error } = await supabase
        .from('work_order_dtc_codes')
        .insert({ work_order_id: os!.id, code: dtcResultado.code });
      if (error) throw error;
      setDtcBusca('');
      setDtcResultado(null);
      fetchDtcsSalvos();
    } catch (err: any) {
      alert('Erro ao adicionar código: ' + err.message);
    } finally {
      setSalvandoDtc(false);
    }
  };

  // Remover código DTC da OS
  const handleRemoverDtc = async (dtcId: string) => {
    if (!confirm('Remover este código de diagnóstico?')) return;
    try {
      await supabase.from('work_order_dtc_codes').delete().eq('id', dtcId);
      fetchDtcsSalvos();
    } catch (err: any) {
      alert('Erro ao remover: ' + err.message);
    }
  };

  useEffect(() => {
    if (id && profile?.organization_id) {
      setLoading(true);
      Promise.all([fetchOS(), fetchCatalogo(), fetchDtcsSalvos()]).finally(() => setLoading(false));
    }
  }, [fetchOS, fetchCatalogo, fetchDtcsSalvos, id, profile]);

  // --- FUNÇÕES DE FOTO (CÓDIGO NOVO) ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !os) return;
    setUploading(true);

    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${os!.id}/${Date.now()}.${fileExt}`;

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
      const currentPhotos = os!.photos || [];
      const updatedPhotos = [...currentPhotos, newPhotoUrl];

      const { error: dbError } = await supabase
        .from('work_orders')
        .update({ photos: updatedPhotos })
        .eq('id', os!.id);
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
      const currentPhotos = os!.photos || [];
      const updatedPhotos = currentPhotos!.filter((p) => p !== photoUrl);

      const { error } = await supabase.from('work_orders').update({ photos: updatedPhotos }).eq('id', os!.id);
      if (error) throw error;

      setOs({ ...os, photos: updatedPhotos });
    } catch (error: any) {
      alert("Erro ao remover foto: " + error.message);
    }
  };

  const handleSalvarLaudo = async () => {
    if (!os) return;
    setSalvandoLaudo(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          defeitos_constatados: defeitosConstatados,
          servicos_executados: servicosExecutados
        })
        .eq('id', os!.id);
      if (error) throw error;
      setOs({ ...os, defeitos_constatados: defeitosConstatados, servicos_executados: servicosExecutados });
      alert("Laudo atualizado com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar laudo: " + err.message);
    } finally {
      setSalvandoLaudo(false);
    }
  };

  const handleStatusChange = async (novoStatus: string) => {
    if (!os) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: novoStatus })
        .eq('id', os!.id);
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
        .eq('id', os!.id);
    } catch (error) {
      console.error("Erro ao salvar previsão", error);
    }
  };

  // REMOVER ITEM (COM ESTORNO)
  const handleRemoverItem = async (item: WorkOrderItem) => {
    if (!os) return;

    if (os!.status === 'cancelado' || os!.status === 'entregue') {
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

      const novoTotal = item.peca_cliente ? (os!.total || 0) : (os!.total || 0) - item.total_price;
      await supabase
        .from('work_orders')
        .update({ total: novoTotal })
        .eq('id', os!.id);

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
      const itensAtualizados = os!.work_order_items.map(i =>
        i.id === item.id ? { ...i, peca_cliente: novoValor } : i
      );
      const novoTotal = itensAtualizados!.reduce((acc, i) =>
        i.peca_cliente ? acc : acc + i.total_price, 0
      );

      await supabase
        .from('work_orders')
        .update({ total: novoTotal })
        .eq('id', os!.id);

      fetchOS();
    } catch (error: any) {
      alert("Erro ao atualizar peça do cliente: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleAtualizarPrecoItem = async (item: WorkOrderItem, novoPreco: number) => {
    if (!os) return;
    setUpdating(true);
    try {
      const novoTotalPrice = novoPreco * item.quantity;

      await supabase
        .from('work_order_items')
        .update({ unit_price: novoPreco, total_price: novoTotalPrice })
        .eq('id', item.id);

      const itensAtualizados = os!.work_order_items.map(i =>
        i.id === item.id ? { ...i, unit_price: novoPreco, total_price: novoTotalPrice } : i
      );

      const novoTotalOS = itensAtualizados!.reduce((acc, i) =>
        i.peca_cliente ? acc : acc + i.total_price, 0
      );

      await supabase
        .from('work_orders')
        .update({ total: novoTotalOS })
        .eq('id', os!.id);

      fetchOS();
    } catch (error: any) {
      alert("Erro ao atualizar preço: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelarOS = async () => {
    if (!os) return;
    if (!confirm("ATENÇÃO: Isso irá cancelar a OS e devolver todas as peças ao estoque. Continuar?")) return;

    setUpdating(true);
    try {
      for (const item of os!.work_order_items) {
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
      }

      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'cancelado' })
        .eq('id', os!.id);

      if (error) throw error;

      alert("OS Cancelada com sucesso.");
      router.push("/os");

    } catch (error: any) {
      alert("Erro ao cancelar OS: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExcluirOS = async () => {
    if (!os) return;
    if (!confirm("🚨 PERIGO: Isso apagará permanentemente esta OS e todos os seus registros (fotos, itens, diagnósticos). Esta ação não pode ser desfeita. Continuar?")) return;

    setUpdating(true);
    try {
      // 1. Devolver estoque das peças (que não são do cliente)
      for (const item of os!.work_order_items || []) {
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
      }

      // 2. Apagar a OS (as foreign keys 'on delete cascade' devem cuidar do resto, mas garantimos os itens)
      await supabase.from('work_order_items').delete().eq('work_order_id', os!.id);

      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', os!.id);

      if (error) throw error;

      alert("OS Excluída permanentemente.");
      router.push("/os");

    } catch (error: any) {
      alert("Erro ao excluir OS: " + error.message);
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
            work_order_id: os!.id,
            description: `Recebimento OS #${os!.id} - ${os!.clients?.nome} (Parc ${i}/${parcelas})`,
            amount: valorParcela,
            type: 'income',
            category: 'Serviços',
            status: 'pending',
            payment_method: formaPagamento,
            date: dataVencimento.toISOString().split('T')[0]
          });
        }

      } else if (formaPagamento === 'cheque_pre') {
        transacoesParaInserir.push({
          organization_id: profile.organization_id,
          work_order_id: os!.id,
          description: `Recebimento OS #${os!.id} - ${os!.clients?.nome} (Cheque)`,
          amount: valorTotal,
          type: 'income',
          category: 'Serviços',
          status: 'pending',
          payment_method: formaPagamento,
          date: dataCheque
        });

      } else {
        transacoesParaInserir.push({
          organization_id: profile.organization_id,
          work_order_id: os!.id,
          description: `Recebimento OS #${os!.id} - ${os!.clients?.nome} (${formaPagamento})`,
          amount: valorTotal,
          type: 'income',
          category: 'Serviços',
          status: 'paid',
          payment_method: formaPagamento,
          date: hoje.toISOString().split('T')[0]
        });
      }

      const { error: osError } = await supabase
        .from('work_orders')
        .update({
          status: 'entregue',
          total: valorTotal
        })
        .eq('id', os!.id);

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
          work_order_id: os!.id,
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

      const novoTotalOS = (os!.total || 0) + totalItem;
      const { error: osError } = await supabase
        .from("work_orders")
        .update({ total: novoTotalOS })
        .eq("id", os!.id);

      if (osError) throw osError;

      setModalAdicionarTipo(null);
      setTermoBusca("");
      fetchOS();
      alert("Item adicionado e estoque atualizado!");

    } catch (error: any) {
      alert("Erro ao adicionar item: " + error.message);
    } finally {
      setAdicionandoItem(false);
    }
  };

  const handleCadastroRapido = async () => {
    if (!profile?.organization_id) return;
    if (!nomeNovoItem.trim()) {
      alert("Por favor, digite o nome do item.");
      return;
    }

    setSalvandoNovoItem(true);
    try {
      let insertedItem: any;

      if (modalCadastroRapidoTipo === 'peca') {
        const { data, error } = await supabase.from('products').insert({
          organization_id: profile.organization_id,
          nome: nomeNovoItem,
          marca: 'Sem Marca', // Requisito mínimo sugerido por conveniência
          codigo_ref: '', // Vazio
          estoque_atual: 0,
          estoque_min: 0,
          custo_reposicao: 0,
          custo_contabil: 0,
          preco_venda: 0
        }).select('id, nome, preco_venda, estoque_atual').single();

        if (error) throw error;
        insertedItem = data;
        setListaProdutos(prev => [...prev, insertedItem as CatalogItem]);

      } else {
        const { data, error } = await supabase.from('services').insert({
          organization_id: profile.organization_id,
          nome: nomeNovoItem,
          price: 0
        }).select('id, nome, price').single();

        if (error) throw error;
        insertedItem = data;
        setListaServicos(prev => [...prev, insertedItem as CatalogItem]);
      }

      const tipoLabel = modalCadastroRapidoTipo === 'peca' ? 'Peça' : 'Serviço';

      setTermoBusca(insertedItem.nome);
      setModalAdicionarTipo(modalCadastroRapidoTipo);
      setModalCadastroRapidoTipo(null);
      setNomeNovoItem("");

      alert(`${tipoLabel} cadastrado com sucesso! Lembre-se de complementar as informações no painel principal mais tarde.`);

    } catch (error: any) {
      alert("Erro ao realizar cadastro rápido: " + error.message);
    } finally {
      setSalvandoNovoItem(false);
    }
  };

  const handleSalvarAgendamento = async () => {
    if (!os || !profile?.organization_id || !formAgendamento.data || !formAgendamento.hora) return;
    setSalvandoAgendamento(true);
    try {
      const startTime = new Date(`${formAgendamento.data}T${formAgendamento.hora}:00`);

      if (startTime < new Date()) {
        return alert("Não é possível agendar para um horário no passado.");
      }

      const { error } = await supabase.from('appointments').insert({
        organization_id: profile.organization_id,
        client_id: os!.clients?.id || null,
        vehicle_id: os!.vehicles?.id || null,
        work_order_id: os!.id,
        type: formAgendamento.tipo,
        description: formAgendamento.desc,
        start_time: startTime.toISOString(),
        duration_minutes: formAgendamento.duracao
      });

      if (error) throw error;
      alert("Agendamento criado com sucesso!");
      setModalAgendamentoAberto(false);
      setFormAgendamento({ data: new Date().toISOString().split('T')[0], hora: "09:00", duracao: 60, tipo: "ja_tem_os", desc: "" });
      fetchOS(); // Atualiza a lista
    } catch (e: any) {
      alert("Erro ao criar agendamento: " + e.message);
    } finally {
      setSalvandoAgendamento(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getStatusColor = (stepStatus: string) => {
    if (!os) return "";
    const currentStatus = os!.status;
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
      const number = os!.clients.whatsapp.replace(/\D/g, '');
      const osId = String(os!.id);
      const baseUrl = window.location.origin;
      const trackingLink = `${baseUrl}/acompanhar?token=${os!.public_token}`;
      const message = `Olá ${os!.clients.nome}, tudo bem? 👋\n\n` +
        `Sobre o seu veículo: *${os!.vehicles?.modelo}* (OS #${osId}).\n` +
        `Você pode acompanhar o status e o orçamento clicando aqui:\n\n` +
        `${trackingLink}`;
      window.open(`https://wa.me/55${number}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      alert("Cliente sem WhatsApp cadastrado.");
    }
  };

  const osPecas = os?.work_order_items?.filter(item => item.tipo === 'peca') || [];
  const osServicos = os?.work_order_items?.filter(item => item.tipo === 'servico') || [];

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
              <h1 className="text-2xl font-bold text-[#1A1A1A]">OS #{String(os!.id).slice(0, 4).toUpperCase()}</h1>
              <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase border ${os!.status === 'cancelado' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                {os!.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-stone-500 text-xs flex items-center gap-2 mt-1">
              <Car size={12} /> {os!.vehicles?.modelo} <span className="text-stone-300">|</span> <span className="font-mono">{os!.vehicles?.placa}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto pb-2 md:pb-0">
          {profile?.usa_agendamento !== false && (
            <button
              onClick={() => setModalAgendamentoAberto(true)}
              className="bg-[#1A1A1A] text-[#FACC15] px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition flex-1 md:flex-none"
            >
              <Calendar size={18} /> <span className="hidden md:inline">+ Reagendar</span>
            </button>
          )}

          {/* BOTÃO DE IMPRESSÃO (NOVO) */}
          <Link href={`/imprimir/os/${os!.id}`} target="_blank" className="hidden md:block">
            <button className="bg-white border border-stone-200 text-[#1A1A1A] px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-stone-50 transition whitespace-nowrap">
              <Printer size={18} /> Imprimir
            </button>
          </Link>

          <button
            onClick={handleWhatsapp}
            className="bg-green-100 text-green-700 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-200 transition flex-1 md:flex-none"
          >
            <MessageCircle size={18} /> <span className="hidden md:inline">Cliente</span>
          </button>

          <button
            onClick={handleExcluirOS}
            title="Excluir Permanentemente"
            className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm"
          >
            <Trash2 size={20} />
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
                className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('orcamento')} ${os!.status !== 'orcamento' && os!.aprovacao_timestamp ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
                onClick={() => {
                  if (os!.status !== 'orcamento' && os!.aprovacao_timestamp) setModalMetadados(true);
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><DollarSign size={20} /></div>
                  <div>
                    <p className="font-bold text-sm">Orçamento Criado</p>
                    <p className="text-xs opacity-80">{os!.status !== 'orcamento' && os!.aprovacao_timestamp ? 'Aprovado ✓ (clique para ver detalhes)' : 'Aguardando aprovação'}</p>
                  </div>
                </div>
                {os!.status === 'orcamento' && (
                  <button onClick={() => {
                    const temPecaCliente = os!.work_order_items?.some(i => i.peca_cliente);
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
                {(os!.status === 'aprovado' || os!.status === 'aguardando_peca') && (
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
                {os!.status === 'em_servico' && (
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
                {os!.status === 'pronto' && (
                  <button onClick={() => setModalCheckoutAberto(true)} disabled={updating} className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition flex items-center gap-2">
                    Entregar & Fechar
                  </button>
                )}
              </div>

            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm">
            <h3 className="font-bold text-[#1A1A1A] mb-2 text-sm flex items-center gap-2">
              <MessageCircle size={16} /> Relato / Defeito Informado Pelo Cliente
            </h3>
            <p className="text-stone-600 text-sm bg-[#F8F7F2] p-4 rounded-2xl border border-stone-100">
              {os!.description || "Nenhuma descrição informada."}
            </p>
          </div>

          {/* LAUDO TÉCNICO E SERVIÇOS EXECUTADOS */}
          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm mt-6">
            <h3 className="font-bold text-[#1A1A1A] mb-4 text-sm flex items-center gap-2">
              <Wrench size={16} /> Laudo Técnico (Defeitos e Serviços Realizados)
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-stone-400 ml-1">DEFEITOS CONSTATADOS PELA OFICINA</label>
                  <button
                    type="button"
                    onClick={() => isListeningDefeitos ? stopSpeech('defeitos') : startSpeech('defeitos')}
                    className={`p-2 rounded-full transition-all duration-200 ${isListeningDefeitos
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                      : 'bg-[#F8F7F2] text-stone-500 hover:bg-[#FACC15] hover:text-[#1A1A1A]'
                      }`}
                    title={isListeningDefeitos ? 'Parar gravação' : 'Ditar defeitos'}
                  >
                    <Mic size={14} />
                  </button>
                </div>
                {isListeningDefeitos && (
                  <div className="flex items-center gap-2 mb-2 animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold text-red-500">Ouvindo... dite os defeitos encontrados</span>
                  </div>
                )}
                <textarea
                  value={defeitosConstatados}
                  onChange={e => setDefeitosConstatados(e.target.value)}
                  placeholder="Descreva aqui o que foi encontrado de problema após a avaliação..."
                  rows={3}
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 border border-stone-200 outline-none focus:border-[#FACC15] text-sm resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-stone-400 ml-1">SERVIÇOS EXECUTADOS</label>
                  <button
                    type="button"
                    onClick={() => isListeningServicos ? stopSpeech('servicos') : startSpeech('servicos')}
                    className={`p-2 rounded-full transition-all duration-200 ${isListeningServicos
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                      : 'bg-[#F8F7F2] text-stone-500 hover:bg-[#FACC15] hover:text-[#1A1A1A]'
                      }`}
                    title={isListeningServicos ? 'Parar gravação' : 'Ditar serviços'}
                  >
                    <Mic size={14} />
                  </button>
                </div>
                {isListeningServicos && (
                  <div className="flex items-center gap-2 mb-2 animate-pulse">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-xs font-bold text-red-500">Ouvindo... dite os serviços realizados</span>
                  </div>
                )}
                <textarea
                  value={servicosExecutados}
                  onChange={e => setServicosExecutados(e.target.value)}
                  placeholder="Descreva aqui o que foi feito para a resolução do problema..."
                  rows={3}
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 border border-stone-200 outline-none focus:border-[#FACC15] text-sm resize-none"
                />
              </div>

              <button
                onClick={handleSalvarLaudo}
                disabled={salvandoLaudo}
                className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50"
              >
                {salvandoLaudo ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Laudo Técnico
              </button>
            </div>
          </div>


          {/* === GALERIA DE FOTOS (NOVO) === */}
          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-sm flex items-center gap-2">
                <Camera size={16} /> Fotos do Veículo
              </h3>
              <span className="text-xs text-stone-400">{os!.photos?.length || 0} fotos</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* Botão Adicionar */}
              <label className="aspect-square rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#FACC15] hover:bg-yellow-50 transition gap-1 relative">
                {uploading ? <Loader2 className="animate-spin text-stone-400" /> : <Plus size={24} className="text-stone-300" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>

              {/* Lista de Fotos */}
              {os!.photos?.map((url, idx) => (
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
              {os!.clients?.id && (
                <Link href={`/clientes/${os!.clients.id}`} className="text-xs font-bold text-stone-400 hover:text-[#1A1A1A] transition flex items-center gap-1">
                  Editar
                </Link>
              )}
            </div>
            <div className="mb-6">
              <p className="text-lg font-bold text-[#1A1A1A]">{os!.clients?.nome}</p>
              <p className="text-sm text-stone-500">{os!.clients?.whatsapp || "Sem telefone"}</p>
            </div>

            {/* DADOS DO PAINEL */}
            {(os!.odometro || os!.nivel_combustivel || os!.temperatura_motor || os!.painel_obs) && (
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
                    {os!.odometro && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Gauge size={13} /> Odômetro</span>
                        <span className="font-bold text-[#1A1A1A]">{Number(os!.odometro).toLocaleString('pt-BR')} km</span>
                      </div>
                    )}
                    {os!.nivel_combustivel && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Fuel size={13} /> Combustível</span>
                        <span className="font-bold text-[#1A1A1A] capitalize">{os!.nivel_combustivel}</span>
                      </div>
                    )}
                    {os!.temperatura_motor && (
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-stone-100">
                        <span className="text-stone-500 flex items-center gap-1.5"><Thermometer size={13} /> Temperatura</span>
                        <span className={`font-bold capitalize ${os!.temperatura_motor === 'critica' ? 'text-red-600' :
                          os!.temperatura_motor === 'elevada' ? 'text-yellow-600' : 'text-green-600'
                          }`}>{os!.temperatura_motor}</span>
                      </div>
                    )}
                    {os!.painel_obs && (
                      <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 mt-2">
                        <p className="text-[10px] font-bold text-yellow-600 uppercase mb-1">Observações do Painel</p>
                        <p className="text-xs text-stone-600">{os!.painel_obs}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="border-t border-stone-300 my-4"></div>

            {/* SEÇÃO ITENS GERAIS */}
            <div className="mb-2">
              <h2 className="text-xl font-bold text-[#1A1A1A]">Itens</h2>
            </div>

            {/* SEÇÃO SERVIÇOS */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-sm ml-2">Serviços Executados</h3>
              {os!.status !== 'cancelado' && os!.status !== 'entregue' && (
                <button
                  onClick={() => {
                    setModalAdicionarTipo('servico');
                    setTermoBusca('');
                  }}
                  className="bg-white hover:bg-stone-100 text-[#1A1A1A] p-2 rounded-full shadow-sm transition"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="space-y-3 text-sm mb-6">
              {osServicos!.map((item) => (
                <div key={item.id} className="rounded-xl p-3 border border-stone-100 bg-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-stone-600 font-medium">{item.name}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.quantity}x R$ {(item.unit_price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {os!.status !== 'cancelado' && os!.status !== 'entregue' ? (
                        <button
                          onClick={() => {
                            setItemEditando(item);
                            setNovoValorItem(item.unit_price.toString());
                            setNovaQtdItem(item.quantity.toString());
                            setModalEditarItemAberto(true);
                          }}
                          className="text-right p-2 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
                          title="Clique para editar"
                        >
                          <p className="font-bold text-[#1A1A1A]">
                            {formatCurrency((item.unit_price || 0) * item.quantity)}
                          </p>
                        </button>
                      ) : (
                        <div className="text-right p-2">
                          <p className="font-bold text-[#1A1A1A]">
                            {formatCurrency((item.unit_price || 0) * item.quantity)}
                          </p>
                        </div>
                      )}

                      {os!.status !== 'cancelado' && os!.status !== 'entregue' && (
                        <button
                          onClick={() => handleRemoverItem(item)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                          title="Remover Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {osServicos!.length === 0 && (
                <p className="text-xs text-stone-400 italic text-center py-2">Nenhum serviço adicionado.</p>
              )}
            </div>

            <div className="border-t border-stone-300 my-4"></div>

            {/* SEÇÃO PEÇAS */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[#1A1A1A] text-sm ml-2">Peças / Insumos</h3>
              {os!.status !== 'cancelado' && os!.status !== 'entregue' && (
                <button
                  onClick={() => {
                    setModalAdicionarTipo('peca');
                    setTermoBusca('');
                  }}
                  className="bg-white hover:bg-stone-100 text-[#1A1A1A] p-2 rounded-full shadow-sm transition"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="space-y-3 text-sm">
              {osPecas.map((item) => (
                <div key={item.id} className={`rounded-xl p-3 border bg-white ${item.peca_cliente ? 'bg-yellow-50 border-yellow-200' : 'border-stone-100'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`text-stone-600 font-medium ${item.peca_cliente ? 'line-through opacity-60' : ''}`}>{item.name}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.quantity}x R$ {(item.unit_price || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {os!.status !== 'cancelado' && os!.status !== 'entregue' ? (
                        <button
                          onClick={() => {
                            setItemEditando(item);
                            setNovoValorItem(item.unit_price.toString());
                            setNovaQtdItem(item.quantity.toString());
                            setModalEditarItemAberto(true);
                          }}
                          className="text-right p-2 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
                          title="Clique para editar"
                        >
                          <p className={`font-bold text-[#1A1A1A] ${item.peca_cliente ? 'text-stone-400 line-through' : ''}`}>
                            {formatCurrency((item.unit_price || 0) * item.quantity)}
                          </p>
                        </button>
                      ) : (
                        <div className="text-right p-2">
                          <p className={`font-bold text-[#1A1A1A] ${item.peca_cliente ? 'text-stone-400 line-through' : ''}`}>
                            {formatCurrency((item.unit_price || 0) * item.quantity)}
                          </p>
                        </div>
                      )}

                      {os!.status !== 'cancelado' && os!.status !== 'entregue' && (
                        <>
                          <button
                            onClick={() => handleTogglePecaCliente(item)}
                            disabled={updating}
                            className={`p-1.5 rounded-lg transition border ${item.peca_cliente
                              ? 'bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A]'
                              : 'bg-white text-stone-400 border-stone-200 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-200'
                              }`}
                            title={item.peca_cliente ? 'Peça trazida pelo cliente (desmarcar)' : 'Marcar como peça trazida pelo cliente'}
                          >
                            <UserCheck size={16} />
                          </button>

                          <button
                            onClick={() => handleRemoverItem(item)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                            title="Remover Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {item.peca_cliente && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold bg-[#1A1A1A] text-[#FACC15] px-2 py-0.5 rounded-full">
                      <UserCheck size={10} /> PEÇA DO CLIENTE
                    </span>
                  )}
                </div>
              ))}

              {osPecas.length === 0 && (
                <p className="text-xs text-stone-400 italic text-center py-2">Nenhuma peça adicionada.</p>
              )}

              <div className="border-t border-stone-300 my-2 pt-4 flex justify-between text-lg">
                <span className="font-bold text-[#1A1A1A]">Total Geral</span>
                <span className="font-bold text-[#1A1A1A]">{formatCurrency(os!.total)}</span>
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
                      const fileName = `${os!.id}/scanner_${Date.now()}.pdf`;
                      const { error: upErr } = await supabase.storage.from('os-images').upload(fileName, file);
                      if (upErr) throw upErr;
                      const { data: urlData } = supabase.storage.from('os-images').getPublicUrl(fileName);
                      await supabase.from('work_orders').update({ scanner_pdf: urlData.publicUrl }).eq('id', os!.id);
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

                {os!.scanner_pdf && (
                  <div className="mt-3 flex items-center gap-2">
                    <a
                      href={os!.scanner_pdf}
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
                          await supabase.from('work_orders').update({ scanner_pdf: null }).eq('id', os!.id);
                          setOs({ ...os, scanner_pdf: null } as WorkOrderFull);
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

              {/* === DIAGNÓSTICO OBD-II === */}
              <div className="border-t border-stone-200 mt-4 pt-4">
                <button
                  onClick={() => setDtcAberto(!dtcAberto)}
                  className="w-full flex items-center justify-between mb-3 hover:opacity-80 transition"
                >
                  <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                    <Search size={16} /> Diagnóstico OBD-II
                  </h3>
                  <div className="flex items-center gap-2">
                    {dtcsSalvos!.length > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {dtcsSalvos!.length}
                      </span>
                    )}
                    {dtcAberto ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
                  </div>
                </button>

                {dtcAberto && (
                  <div className="space-y-3 animate-in slide-in-from-top-2">
                    {/* Campo de Busca */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={dtcBusca}
                          onChange={(e) => handleBuscarDtc(e.target.value)}
                          placeholder="Digite o código (ex: P0420)"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-white focus:outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] transition font-mono uppercase"
                        />
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                      </div>
                      <button
                        onClick={handleAdicionarDtc}
                        disabled={!dtcResultado || salvandoDtc}
                        className="px-3 py-2.5 bg-[#1A1A1A] text-[#FACC15] rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {salvandoDtc ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      </button>
                    </div>

                    {/* Resultado da Busca */}
                    {buscandoDtc && (
                      <div className="flex items-center gap-2 text-xs text-stone-400 py-2">
                        <Loader2 size={12} className="animate-spin" /> Buscando...
                      </div>
                    )}

                    {dtcResultado && !buscandoDtc && (
                      <div className={`rounded-xl p-3 border ${dtcResultado.source === 'error' ? 'bg-red-50 border-red-200' :
                        dtcResultado.source === 'ia' ? 'bg-purple-50 border-purple-200' :
                          'bg-blue-50 border-blue-200'
                        }`}>
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold font-mono ${dtcResultado.source === 'error' ? 'text-red-700' :
                            dtcResultado.source === 'ia' ? 'text-purple-700' : 'text-blue-700'
                            }`}>{dtcResultado.code}</p>
                          {dtcResultado.source === 'ia' && (
                            <span className="text-[9px] font-bold bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">🤖 IA</span>
                          )}
                          {dtcResultado.source === 'error' && (
                            <span className="text-[9px] font-bold bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> ERRO</span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 ${dtcResultado.source === 'error' ? 'text-red-600' :
                          dtcResultado.source === 'ia' ? 'text-purple-600' : 'text-blue-600'
                          }`}>{dtcResultado.description_pt}</p>
                      </div>
                    )}

                    {dtcBusca.length >= 5 && !dtcResultado && !buscandoDtc && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-500" />
                        <p className="text-xs text-yellow-700">Código não encontrado no banco nem pela IA.</p>
                      </div>
                    )}

                    {/* Lista de Códigos Salvos */}
                    {dtcsSalvos!.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold text-stone-400 uppercase">Códigos Registrados</p>
                        {dtcsSalvos!.map((dtc) => (
                          <div key={dtc.id} className="flex items-start justify-between gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-red-700 font-mono">{dtc.code}</p>
                              <p className="text-[11px] text-red-600 mt-0.5 leading-tight">{dtc.description_pt}</p>
                            </div>
                            <button
                              onClick={() => handleRemoverDtc(dtc.id)}
                              className="p-1.5 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                              title="Remover código"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {dtcsSalvos!.length === 0 && (
                      <p className="text-xs text-stone-400 italic text-center py-1">Nenhum código registrado.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-stone-400 mb-2">Criado em: {new Date(os!.created_at).toLocaleDateString()}</p>
            {os!.status !== 'cancelado' && os!.status !== 'entregue' && (
              <button
                onClick={handleCancelarOS}
                className="text-red-400 text-xs font-bold hover:underline"
              >
                Cancelar Ordem de Serviço
              </button>
            )}
            {os!.status === 'cancelado' && <p className="text-red-500 font-bold text-sm">ESTA ORDEM FOI CANCELADA</p>}
          </div>
        </div>

        {/* REMOVIDO: 4. AGENDAMENTOS (AGORA É BOTÃO NO HEADER) */}

      </div>

      {/* MODAL NOVO AGENDAMENTO DA OS */}
      {modalAgendamentoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#1A1A1A]">Novo Agendamento</h2>
              <button onClick={() => setModalAgendamentoAberto(false)} className="text-stone-400 hover:text-red-500 transition"><X /></button>
            </div>

            <p className="text-xs text-stone-500">
              Este agendamento será vinculado ao veículo <strong className="text-[#1A1A1A]">{os!.vehicles?.modelo}</strong> da OS <strong className="text-[#1A1A1A]">#{os!.id.toString().slice(0, 4)}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">DATA</label>
                <input
                  type="date"
                  value={formAgendamento.data}
                  onChange={e => setFormAgendamento({ ...formAgendamento, data: e.target.value })}
                  className="w-full bg-stone-50 rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#1A1A1A] font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">HORA</label>
                <input
                  type="time"
                  value={formAgendamento.hora}
                  onChange={e => setFormAgendamento({ ...formAgendamento, hora: e.target.value })}
                  className="w-full bg-stone-50 rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#1A1A1A] font-bold text-sm"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">DURAÇÃO</label>
              <select
                value={formAgendamento.duracao}
                onChange={e => setFormAgendamento({ ...formAgendamento, duracao: Number(e.target.value) })}
                className="w-full bg-stone-50 rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#1A1A1A] font-bold text-sm"
              >
                <option value={30}>30 min</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
                <option value={240}>Meio Dia (4h)</option>
                <option value={480}>Dia Todo (8h)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-stone-400 ml-1 mb-1 block">DESCRIÇÃO (Opcional)</label>
              <textarea
                value={formAgendamento.desc}
                onChange={e => setFormAgendamento({ ...formAgendamento, desc: e.target.value })}
                placeholder="Ex: Instalar farol que estava aguardando chegar"
                rows={2}
                className="w-full bg-stone-50 rounded-xl py-3 px-4 border border-stone-200 outline-none focus:border-[#1A1A1A] text-sm resize-none"
              />
            </div>

            <button
              onClick={handleSalvarAgendamento}
              disabled={salvandoAgendamento}
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-black transition disabled:opacity-50 mt-2"
            >
              {salvandoAgendamento ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Confirmar Agendamento
            </button>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR ITEM ESPECIALIZADO */}
      {modalAdicionarTipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl space-y-4 h-[500px] flex flex-col">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Adicionar {modalAdicionarTipo === 'servico' ? 'Serviço' : 'Peça'}</h2>
              <button onClick={() => setModalAdicionarTipo(null)} className="text-stone-400 hover:text-[#1A1A1A] transition">
                <X />
              </button>
            </div>

            <div className="relative">
              <input
                autoFocus
                placeholder={`Buscar ${modalAdicionarTipo === 'servico' ? 'serviço...' : 'peça...'}`}
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full bg-[#F8F7F2] p-4 pl-10 rounded-2xl border-2 border-stone-300 focus:border-[#FACC15] outline-none text-sm text-[#1A1A1A] placeholder:text-stone-400 font-medium transition"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            </div>

            <div className="flex-1 overflow-auto space-y-2 pb-4">
              {adicionandoItem && (
                <div className="text-center py-4 text-stone-400 flex flex-col items-center">
                  <Loader2 className="animate-spin mb-2" /> Salvando...
                </div>
              )}

              {!adicionandoItem && modalAdicionarTipo === "peca" &&
                listaProdutos
                  .filter((p) => p.nome.toLowerCase().includes(termoBusca.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAdicionarItem(p, "peca")}
                      className="w-full flex justify-between p-3 bg-white border border-stone-100 hover:border-[#FACC15] shadow-sm hover:shadow-md rounded-xl text-left transition"
                    >
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{p.nome}</p>
                        <p className="text-xs text-stone-400">Estoque: {p.estoque_atual}</p>
                      </div>
                      <span className="font-bold text-[#1A1A1A]">R$ {p.preco_venda?.toFixed(2)}</span>
                    </button>
                  ))}

              {!adicionandoItem && modalAdicionarTipo === "servico" &&
                listaServicos
                  .filter((s) => s.nome.toLowerCase().includes(termoBusca.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleAdicionarItem(s, "servico")}
                      className="w-full flex justify-between p-3 bg-white border border-stone-100 hover:border-[#FACC15] shadow-sm hover:shadow-md rounded-xl text-left transition"
                    >
                      <div>
                        <p className="font-bold text-[#1A1A1A]">{s.nome}</p>
                      </div>
                      <span className="font-bold text-[#1A1A1A]">R$ {(s.price || 0).toFixed(2)}</span>
                    </button>
                  ))}

              {!adicionandoItem && (
                <div className="mt-4 border-t border-stone-200 pt-4 flex flex-col items-center">
                  <p className="text-xs text-stone-500 mb-2">Não encontrou o que procurava?</p>
                  <button
                    onClick={() => {
                      setNomeNovoItem(termoBusca);
                      setModalCadastroRapidoTipo(modalAdicionarTipo);
                      setModalAdicionarTipo(null);
                    }}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    Cadastrar {modalAdicionarTipo === 'servico' ? 'Novo Serviço' : 'Nova Peça'} <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO RÁPIDO */}
      {modalCadastroRapidoTipo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg text-[#1A1A1A]">
                Nova {modalCadastroRapidoTipo === 'peca' ? 'Peça' : 'Serviço'}
              </h2>
              <button
                onClick={() => {
                  setModalAdicionarTipo(modalCadastroRapidoTipo); // Volta para a tela anterior
                  setModalCadastroRapidoTipo(null);
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
                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">NOME DA {modalCadastroRapidoTipo === 'peca' ? 'PEÇA' : 'SERVIÇO'}</label>
                <input
                  autoFocus
                  type="text"
                  value={nomeNovoItem}
                  onChange={(e) => setNomeNovoItem(e.target.value)}
                  placeholder={`Ex: ${modalCadastroRapidoTipo === 'peca' ? 'Filtro de Ar' : 'Alinhamento 3D'}`}
                  className="w-full bg-[#F8F7F2] p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none font-bold text-[#1A1A1A]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCadastroRapido();
                  }}
                />
              </div>

              <button
                onClick={handleCadastroRapido}
                disabled={salvandoNovoItem || !nomeNovoItem.trim()}
                className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 hover:bg-black transition disabled:opacity-50"
              >
                {salvandoNovoItem ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {salvandoNovoItem ? "Salvando..." : "Salvar e Continuar"}
              </button>
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
      {modalMetadados && os!.aprovacao_timestamp && (
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
                  {new Date(os!.aprovacao_timestamp).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' })}
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Endereço IP</p>
                <p className="text-sm font-mono font-bold text-[#1A1A1A]">{os!.aprovacao_ip || 'Não disponível'}</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Dispositivo</p>
                <p className="text-xs text-[#1A1A1A] break-all">{os!.aprovacao_dispositivo || 'Não disponível'}</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-stone-500 uppercase mb-1">Hash do Orçamento</p>
                <p className="text-[10px] font-mono text-stone-600 break-all">{os!.aprovacao_versao_hash || 'Não disponível'}</p>
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

      {/* MODAL EDITAR ITEM */}
      {modalEditarItemAberto && itemEditando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg text-[#1A1A1A]">Editar Item</h2>
              <button onClick={() => { setModalEditarItemAberto(false); setItemEditando(null); }}>
                <X size={20} className="text-stone-400" />
              </button>
            </div>

            <div>
              <p className="font-bold text-sm text-[#1A1A1A]">{itemEditando.name}</p>
              <p className="text-xs text-stone-500 uppercase">{itemEditando.tipo}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-1">QUANTIDADE</label>
                <div className="flex items-center justify-between bg-[#F8F7F2] rounded-2xl p-2 border-2 border-stone-300">
                  <button
                    onClick={() => setItemEditando(prev => prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : prev)}
                    className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-[#1A1A1A] hover:bg-stone-50"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="font-bold text-2xl">{itemEditando.quantity}</span>
                  <button
                    onClick={() => setItemEditando(prev => prev ? { ...prev, quantity: prev.quantity + 1 } : prev)}
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
                  value={itemEditando.unit_price}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setItemEditando(prev => prev ? { ...prev, unit_price: isNaN(val) ? 0 : val } : prev);
                  }}
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl text-center text-[#1A1A1A] font-bold outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>

              <div className="bg-stone-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-stone-400 font-bold">TOTAL DO ITEM</p>
                <p className="text-xl font-bold text-[#1A1A1A]">{formatCurrency((itemEditando.unit_price || 0) * itemEditando.quantity)}</p>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!os) return;
                setUpdating(true);
                try {
                  const novoTotalPrice = itemEditando.unit_price * itemEditando.quantity;
                  await supabase
                    .from('work_order_items')
                    .update({ unit_price: itemEditando.unit_price, quantity: itemEditando.quantity, total_price: novoTotalPrice })
                    .eq('id', itemEditando.id);

                  const itensAtualizados = os!.work_order_items.map(i =>
                    i.id === itemEditando.id ? { ...i, unit_price: itemEditando.unit_price, quantity: itemEditando.quantity, total_price: novoTotalPrice } : i
                  );
                  const novoTotalOS = itensAtualizados!.reduce((acc, i) =>
                    i.peca_cliente ? acc : acc + i.total_price, 0
                  );
                  await supabase.from('work_orders').update({ total: novoTotalOS }).eq('id', os!.id);

                  fetchOS();
                  setModalEditarItemAberto(false);
                  setItemEditando(null);
                } catch (error: any) {
                  alert('Erro ao atualizar item: ' + error.message);
                } finally {
                  setUpdating(false);
                }
              }}
              disabled={updating}
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-xl shadow-md hover:scale-105 transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Alterações
            </button>
          </div>
        </div>
      )}

    </div>
  );
}