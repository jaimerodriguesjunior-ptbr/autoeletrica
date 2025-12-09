"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  CheckCircle, Clock, Wrench, Car, Camera, 
  MessageCircle, ChevronDown, ChevronUp, ShieldCheck, 
  Package, AlertCircle, Loader2 
} from "lucide-react";
import { createClient } from "../../src/lib/supabase";

// Componente Interno para usar o useSearchParams com segurança
function ConteudoPortal() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [os, setOs] = useState<any>(null);
  
  // Controle visual
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOS();
    } else {
      setErro("Link inválido ou expirado.");
      setLoading(false);
    }
  }, [token]);

  const fetchOS = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicles ( modelo, placa, cor ),
          clients ( nome, whatsapp ),
          work_order_items ( name, total_price )
        `)
        .eq('public_token', token)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Ordem de Serviço não encontrada.");

      setOs(data);
    } catch (error: any) {
      console.error(error);
      setErro("Não foi possível carregar os dados. Verifique o link.");
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async () => {
    if (!os) return;
    setAtualizando(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'aprovado' })
        .eq('id', os.id);

      if (error) throw error;

      // Atualiza localmente para feedback instantâneo
      setOs({ ...os, status: 'aprovado' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert("Orçamento aprovado com sucesso! Iniciaremos o trabalho em breve.");

    } catch (error) {
      alert("Erro ao aprovar. Tente novamente ou contate a oficina.");
    } finally {
      setAtualizando(false);
    }
  };

  const handleContato = () => {
    // Tenta usar o número da oficina (fixo por enquanto ou poderia vir de organization)
    // Se não tiver, usa um genérico
    window.open(`https://wa.me/5545999999999?text=Olá, estou vendo a OS #${os?.id}`, '_blank');
  };

  const getStatusColor = (step: number) => {
    if (!os) return "";
    const status = os.status;
    let currentStep = 1;

    if (status === 'orcamento') currentStep = 2;
    if (status === 'aprovado') currentStep = 3;
    if (status === 'aguardando_peca') currentStep = 3;
    if (status === 'em_servico') currentStep = 4;
    if (status === 'pronto' || status === 'entregue') currentStep = 5;

    // Passado
    if (step < currentStep) return "bg-green-500 text-white border-green-500";
    
    // Presente
    if (step === currentStep) {
        if (status === 'orcamento') return "bg-[#FACC15] text-[#1A1A1A] border-[#FACC15] animate-pulse";
        if (status === 'aguardando_peca') return "bg-orange-500 text-white border-orange-500 animate-pulse";
        if (status === 'em_servico') return "bg-blue-500 text-white border-blue-500 animate-pulse";
        if (status === 'pronto') return "bg-green-600 text-white border-green-600 animate-bounce";
        return "bg-green-500 text-white border-green-500"; 
    }
    
    // Futuro
    return "bg-white text-stone-300 border-stone-200";
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F2]">
      <div className="flex flex-col items-center gap-2 text-stone-400">
        <Loader2 className="animate-spin text-[#FACC15]" size={40} />
        <p className="text-sm">Buscando informações...</p>
      </div>
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7F2] p-6 text-center">
      <div className="bg-white p-8 rounded-[32px] shadow-sm">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-[#1A1A1A]">Link Inválido</h3>
        <p className="text-stone-500 mt-2">{erro}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F7F2] pb-64 relative">
      
      {/* CABEÇALHO NOVO (Logo + Portal) */}
      <div className="bg-white p-4 shadow-sm border-b border-stone-100 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center">
          <div className="w-16 h-12 relative">
             {/* Certifique-se que o logo.svg existe em public/ */}
             <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[8px] font-bold text-stone-400 uppercase tracking-[0.2em] leading-tight text-center">
            Centro<br/>Automotivo
          </span>
        </div>
        <div className="h-8 w-px bg-stone-200"></div>
        <h1 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide">
          Portal do Cliente
        </h1>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 text-center">
          <div className="inline-block p-4 bg-[#F8F7F2] rounded-full mb-4">
            <Car size={32} className="text-[#1A1A1A]" />
          </div>
          
          <h2 className="text-2xl font-bold text-[#1A1A1A]">
            {os.vehicles?.modelo || "Veículo"}
          </h2>
          <p className="text-stone-500 font-mono text-sm mb-6">
            {os.vehicles?.placa || "---"}
          </p>

          <div className="relative px-1">
            <div className="absolute left-4 right-4 top-4 h-1 bg-stone-100 -z-10"></div>
            
            {/* TIMELINE DE 5 PASSOS */}
            <div className="flex justify-between items-start">
              {/* 1. Diagnóstico */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(1)}`}>
                    <CheckCircle size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Diag.</span>
              </div>

              {/* 2. Aprovação */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(2)}`}>
                    <Clock size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Aprov.</span>
              </div>

              {/* 3. Peças */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(3)}`}>
                  <Package size={12} />
                </div>
                <span className={`text-[8px] font-bold leading-tight ${os.status === 'aguardando_peca' ? 'text-orange-600' : 'text-stone-500'}`}>
                  {os.status === 'aguardando_peca' ? 'Aguard. Peça' : 'Peças'}
                </span>
              </div>

              {/* 4. Serviço */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(4)}`}>
                    <Wrench size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Serviço</span>
              </div>

              {/* 5. Pronto */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(5)}`}>
                    <CheckCircle size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Pronto</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AVISOS DE STATUS */}
      {os.status === "aguardando_peca" && (
        <div className="px-6 pb-6 animate-in zoom-in duration-300">
          <div className="bg-orange-50 text-orange-800 p-6 rounded-[32px] text-center border border-orange-100">
            <Package size={48} className="mx-auto mb-2 text-orange-400" />
            <h3 className="text-xl font-bold">Aguardando Peças</h3>
            <p className="text-sm mt-1 opacity-80">
              Já encomendamos as peças necessárias. Assim que chegarem, iniciamos o serviço.
            </p>
          </div>
        </div>
      )}

      {os.status === "aprovado" && (
        <div className="px-6 pb-6 animate-in zoom-in">
            <div className="bg-green-600 text-white p-6 rounded-[32px] text-center shadow-lg">
                <ShieldCheck size={48} className="mx-auto mb-2" />
                <h3 className="text-xl font-bold">Aprovado!</h3>
                <p className="text-sm opacity-90">Verificando estoque e fila...</p>
            </div>
        </div>
      )}
      
      {os.status === "em_servico" && (
        <div className="px-6 pb-6 animate-in zoom-in">
            <div className="bg-blue-600 text-white p-6 rounded-[32px] text-center shadow-lg">
                <Wrench size={48} className="mx-auto mb-2" />
                <h3 className="text-xl font-bold">Mãos à obra!</h3>
                <p className="text-sm opacity-90">O mecânico está trabalhando no seu carro agora.</p>
            </div>
        </div>
      )}

      {(os.status === "pronto" || os.status === "entregue") && (
        <div className="px-6 pb-6 animate-in zoom-in">
            <div className="bg-[#1A1A1A] text-[#FACC15] p-6 rounded-[32px] text-center shadow-lg">
                <CheckCircle size={48} className="mx-auto mb-2" />
                <h3 className="text-xl font-bold">Pode vir buscar!</h3>
                <p className="text-sm opacity-90">Seu veículo está pronto.</p>
            </div>
        </div>
      )}

      {/* GALERIA (MANTIDA PLACEHOLDER POR ENQUANTO) */}
      <div className="px-6 mb-6">
        <h3 className="font-bold text-[#1A1A1A] ml-2 mb-3 flex items-center gap-2">
            <Camera size={18} /> Fotos e Evidências
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide">
            {[1, 2].map((i) => (
                <div key={i} className="flex-none w-64 h-48 bg-stone-200 rounded-[24px] relative overflow-hidden snap-center shadow-sm border border-stone-100 flex items-center justify-center">
                    <p className="text-stone-400 text-xs font-bold">Foto {i} (Em breve)</p>
                </div>
            ))}
        </div>
      </div>
      
      {/* FINANCEIRO */}
      <div className="px-6">
        <div className="bg-white rounded-[32px] shadow-sm border border-stone-100 overflow-hidden">
            <button onClick={() => setDetalhesAbertos(!detalhesAbertos)} className="w-full p-6 flex items-center justify-between hover:bg-stone-50 transition">
                <div>
                    <p className="text-xs font-bold text-stone-400 uppercase">Valor Total</p>
                    <p className="text-3xl font-bold text-[#1A1A1A]">R$ {Number(os.total).toFixed(2)}</p>
                </div>
                {detalhesAbertos ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
            </button>
            
            {detalhesAbertos && (
                <div className="px-6 pb-6 bg-stone-50/50 border-t border-stone-100 pt-4 space-y-3 animate-in slide-in-from-top-2">
                    {os.work_order_items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                            <span className="text-stone-600">{item.name}</span>
                            <span className="font-bold text-[#1A1A1A]">R$ {Number(item.total_price).toFixed(2)}</span>
                        </div>
                    ))}
                    {(!os.work_order_items || os.work_order_items.length === 0) && <p className="text-xs text-stone-400 text-center">Itens não detalhados.</p>}
                    <div className="border-t border-stone-200 my-2"></div>
                    <p className="text-xs text-center text-stone-400">Orçamento válido por 7 dias.</p>
                </div>
            )}
        </div>
      </div>

      {/* BARRA FIXA INFERIOR */}
      {os.status === "orcamento" ? (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-stone-100 flex flex-col gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-[32px]">
          <button 
            onClick={handleAprovar} 
            disabled={atualizando}
            className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {atualizando ? <Loader2 className="animate-spin"/> : <CheckCircle size={20} />} 
            {atualizando ? "Processando..." : "APROVAR ORÇAMENTO"}
          </button>
          <button 
            onClick={handleContato} 
            className="w-full bg-white text-[#1A1A1A] border border-stone-200 font-bold py-3 rounded-2xl hover:bg-stone-50 transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={20} /> Tenho uma dúvida
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-stone-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-[32px]">
          <button 
            onClick={handleContato} 
            className="w-full bg-green-50 text-green-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
          >
            <MessageCircle size={20} /> Falar com a Oficina
          </button>
        </div>
      )}
    </div>
  );
}

// Wrapper Principal com Suspense
export default function TelaCliente() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#F8F7F2]"></div>}>
      <ConteudoPortal />
    </Suspense>
  );
}