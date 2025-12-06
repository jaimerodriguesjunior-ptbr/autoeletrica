"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle, Clock, Wrench, Package, 
  CheckSquare, MessageCircle, User, Car, Loader2, DollarSign
} from "lucide-react";
import { createClient } from "../../../../../src/lib/supabase";
import { useAuth } from "../../../../../src/contexts/AuthContext";

// Tipos baseados no banco real
type WorkOrderItem = {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  tipo: string;
};

type WorkOrderFull = {
  id: string | number; // Aceita número ou texto
  status: string;
  description: string;
  total: number;
  created_at: string;
  clients: {
    nome: string;
    whatsapp: string | null;
  } | null;
  vehicles: {
    modelo: string;
    placa: string;
    fabricante: string | null;
  } | null;
  work_order_items: WorkOrderItem[];
};

export default function DetalhesOS() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState<WorkOrderFull | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchOS = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          clients ( nome, whatsapp ),
          vehicles ( modelo, placa, fabricante ),
          work_order_items ( id, name, unit_price, quantity, total_price, tipo )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setOs(data as unknown as WorkOrderFull);
    } catch (error) {
      console.error("Erro ao buscar detalhes:", error);
      alert("Ordem de serviço não encontrada.");
      router.push("/os");
    } finally {
      setLoading(false);
    }
  }, [id, supabase, router]);

  useEffect(() => {
    if (id) fetchOS();
  }, [fetchOS, id]);

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

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const getStatusColor = (stepStatus: string) => {
    if (!os) return "";
    const currentStatus = os.status;
    const flow = ['orcamento', 'aprovado', 'aguardando_peca', 'em_servico', 'pronto', 'entregue'];
    const currentIndex = flow.indexOf(currentStatus);
    const stepIndex = flow.indexOf(stepStatus);

    if (currentStatus === stepStatus) return "bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A] shadow-lg scale-105";
    if (currentIndex > stepIndex) return "bg-green-100 text-green-700 border-green-200 opacity-60";
    return "bg-white text-stone-400 border-stone-100";
  };

  const handleWhatsapp = () => {
    if (os?.clients?.whatsapp) {
      const number = os.clients.whatsapp.replace(/\D/g, '');
      const osId = String(os.id); // Garante que é string
      window.open(`https://wa.me/55${number}?text=Olá ${os.clients.nome}, sobre a OS #${osId} do ${os.vehicles?.modelo}...`, '_blank');
    } else {
      alert("Cliente sem WhatsApp cadastrado.");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#FACC15]" size={40}/></div>;
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
              {/* CORREÇÃO AQUI: String(os.id) para converter número em texto antes de cortar */}
              <h1 className="text-2xl font-bold text-[#1A1A1A]">OS #{String(os.id).slice(0, 4).toUpperCase()}</h1>
              <span className="bg-stone-100 text-stone-600 text-xs font-bold px-2 py-1 rounded-md uppercase border border-stone-200">
                {os.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-stone-500 text-xs flex items-center gap-2 mt-1">
              <Car size={12}/> {os.vehicles?.modelo} <span className="text-stone-300">|</span> <span className="font-mono">{os.vehicles?.placa}</span>
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleWhatsapp}
          className="bg-green-100 text-green-700 px-4 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-200 transition"
        >
          <MessageCircle size={18} /> Falar com Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 2. CONTROLE DE FLUXO (ESQUERDA) */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-stone-100">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-6 flex items-center gap-2">
              <Clock size={20} /> Linha do Tempo
            </h2>

            <div className="space-y-4 relative">
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-stone-100 -z-10"></div>

              {/* CARD: ORÇAMENTO */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('orcamento')}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><DollarSign size={20}/></div>
                  <div><p className="font-bold text-sm">Orçamento Criado</p><p className="text-xs opacity-80">Aguardando aprovação</p></div>
                </div>
                {os.status === 'orcamento' && (
                  <button onClick={() => handleStatusChange('aprovado')} disabled={updating} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2">
                    {updating ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14} />} Aprovar
                  </button>
                )}
              </div>

              {/* CARD: APROVADO / AGUARDANDO PEÇA */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${getStatusColor('aguardando_peca')}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Package size={20}/></div>
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
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><Wrench size={20}/></div>
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
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"><CheckCircle size={20}/></div>
                  <div><p className="font-bold text-sm">Pronto p/ Entrega</p><p className="text-xs opacity-80">Veículo testado e liberado</p></div>
                </div>
                {os.status === 'pronto' && (
                  <button onClick={() => handleStatusChange('entregue')} disabled={updating} className="bg-[#1A1A1A] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:opacity-90 transition flex items-center gap-2">
                    Entregar & Fechar
                  </button>
                )}
              </div>

            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
            <h3 className="font-bold text-[#1A1A1A] mb-2 text-sm flex items-center gap-2">
              <MessageCircle size={16} /> Relato / Defeito
            </h3>
            <p className="text-stone-600 text-sm bg-[#F8F7F2] p-4 rounded-2xl border border-stone-100">
              {os.description || "Nenhuma descrição informada."}
            </p>
          </div>

        </div>

        {/* 3. RESUMO (DIREITA) */}
        <div className="space-y-6">
          <div className="bg-[#F8F7F2] rounded-[32px] p-6 border border-stone-200 h-fit">
            <h3 className="font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <User size={16} /> Cliente
            </h3>
            <div className="mb-6">
              <p className="text-lg font-bold text-[#1A1A1A]">{os.clients?.nome}</p>
              <p className="text-sm text-stone-500">{os.clients?.whatsapp || "Sem telefone"}</p>
            </div>

            <div className="border-t border-stone-300 my-4"></div>

            <h3 className="font-bold text-[#1A1A1A] mb-4">Resumo dos Itens</h3>
            <div className="space-y-3 text-sm">
              
              {os.work_order_items?.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-stone-600 font-medium">{item.name}</p>
                    <p className="text-[10px] text-stone-400">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                  </div>
                  <span className="font-bold text-[#1A1A1A]">{formatCurrency(item.total_price)}</span>
                </div>
              ))}

              {(!os.work_order_items || os.work_order_items.length === 0) && (
                <p className="text-xs text-stone-400 italic">Nenhum item adicionado.</p>
              )}

              <div className="border-t border-stone-300 my-2 pt-4 flex justify-between text-lg">
                <span className="font-bold text-[#1A1A1A]">Total</span>
                <span className="font-bold text-[#1A1A1A]">{formatCurrency(os.total)}</span>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-stone-400 mb-2">Criado em: {new Date(os.created_at).toLocaleDateString()}</p>
            <button className="text-red-400 text-xs font-bold hover:underline">Cancelar Ordem de Serviço</button>
          </div>
        </div>

      </div>
    </div>
  );
}