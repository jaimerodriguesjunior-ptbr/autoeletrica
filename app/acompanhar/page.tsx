"use client";

import { useState } from "react";
import { CheckCircle, Clock, Wrench, Car, Camera, MessageCircle, ChevronDown, ChevronUp, ShieldCheck, Package, AlertCircle } from "lucide-react";

export default function TelaCliente() {
  // Novo status intermediário: 'aguardando_peca'
  const [status, setStatus] = useState<"orcamento" | "aprovado" | "aguardando_peca" | "em_servico" | "pronto">("orcamento");
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const os = { id: "#1054", veiculo: "VW Gol G5", placa: "ABC-1234", cliente: "João da Silva", total: 200.00, itens: [{ nome: "Mão de Obra", valor: 150.00 }, { nome: "Lâmpada H4", valor: 50.00 }] };

  const handleAprovar = () => {
    setStatus("aprovado");
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Simulação: Vai para "Aguardando Peça" primeiro
    setTimeout(() => setStatus("aguardando_peca"), 1500);
  };

  const handleDuvida = () => { window.open(`https://wa.me/5545999999999?text=Ola`, '_blank'); };
  const handleContatoGeral = () => { window.open(`https://wa.me/5545999999999?text=Ola`, '_blank'); };

  // Controle de cores da Timeline de 5 passos
  const getStatusColor = (step: number) => {
    let currentStep = 1;
    if (status === 'orcamento') currentStep = 2;       // Esperando aprovar
    if (status === 'aprovado') currentStep = 3;        // Aprovou, verificando peças
    if (status === 'aguardando_peca') currentStep = 3; // Parado na peça
    if (status === 'em_servico') currentStep = 4;      // Peça chegou, serviço rodando
    if (status === 'pronto') currentStep = 5;          // Fim

    // Passado (Verde)
    if (step < currentStep) return "bg-green-500 text-white border-green-500";
    
    // Presente (Piscando)
    if (step === currentStep) {
        if (status === 'orcamento') return "bg-[#FACC15] text-[#1A1A1A] border-[#FACC15] animate-pulse";
        if (status === 'aguardando_peca') return "bg-orange-500 text-white border-orange-500 animate-pulse"; // Peça Amarela/Laranja
        if (status === 'em_servico') return "bg-blue-500 text-white border-blue-500 animate-pulse";
        if (status === 'pronto') return "bg-green-600 text-white border-green-600 animate-bounce";
        return "bg-green-500 text-white border-green-500"; // Caso transitório 'aprovado'
    }
    
    // Futuro (Cinza)
    return "bg-white text-stone-300 border-stone-200";
  };

  return (
    <div className="min-h-screen bg-[#F8F7F2] pb-64 relative">
      
      {/* BOTÕES DE DEBUG PARA TESTAR TUDO */}
      <div className="fixed top-0 right-0 z-50 flex gap-1 p-1 opacity-40 hover:opacity-100 bg-black/10">
        <button onClick={() => setStatus('orcamento')} className="text-[10px] bg-white px-2">1. Orc</button>
        <button onClick={() => setStatus('aguardando_peca')} className="text-[10px] bg-white px-2">2. S/ Peca</button>
        <button onClick={() => setStatus('em_servico')} className="text-[10px] bg-white px-2">3. Servico</button>
        <button onClick={() => setStatus('pronto')} className="text-[10px] bg-white px-2">4. Pronto</button>
      </div>

      <div className="bg-white p-4 text-center shadow-sm border-b border-stone-100">
        <h1 className="text-xl font-bold text-[#1A1A1A]">Auto<span className="text-[#FACC15]">Pro</span></h1>
        <p className="text-[10px] text-stone-400 uppercase tracking-widest">Portal do Cliente</p>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 text-center">
          <div className="inline-block p-4 bg-[#F8F7F2] rounded-full mb-4"><Car size={32} className="text-[#1A1A1A]" /></div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{os.veiculo}</h2>
          <p className="text-stone-500 font-mono text-sm mb-6">{os.placa}</p>

          <div className="relative px-1">
            <div className="absolute left-4 right-4 top-4 h-1 bg-stone-100 -z-10"></div>
            
            {/* TIMELINE DE 5 PASSOS AGORA */}
            <div className="flex justify-between items-start">
              
              {/* 1. Diagnóstico */}
              <div className="flex flex-col items-center gap-2 w-12"><div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(1)}`}><CheckCircle size={12} /></div><span className="text-[8px] font-bold text-stone-500 leading-tight">Diag.</span></div>

              {/* 2. Aprovação */}
              <div className="flex flex-col items-center gap-2 w-12"><div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(2)}`}><Clock size={12} /></div><span className="text-[8px] font-bold text-stone-500 leading-tight">Aprov.</span></div>

              {/* 3. PEÇAS (NOVO) */}
              <div className="flex flex-col items-center gap-2 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(3)}`}>
                  <Package size={12} />
                </div>
                <span className={`text-[8px] font-bold leading-tight ${status === 'aguardando_peca' ? 'text-orange-600' : 'text-stone-500'}`}>
                  {status === 'aguardando_peca' ? 'Aguard. Peça' : 'Peças'}
                </span>
              </div>

              {/* 4. Serviço */}
              <div className="flex flex-col items-center gap-2 w-12"><div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(4)}`}><Wrench size={12} /></div><span className="text-[8px] font-bold text-stone-500 leading-tight">Serviço</span></div>

              {/* 5. Pronto */}
              <div className="flex flex-col items-center gap-2 w-12"><div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(5)}`}><CheckCircle size={12} /></div><span className="text-[8px] font-bold text-stone-500 leading-tight">Pronto</span></div>

            </div>
          </div>
        </div>
      </div>

      {/* AVISO ESPECIAL DE PEÇA */}
      {status === "aguardando_peca" && (
        <div className="px-6 pb-6 animate-in zoom-in duration-300">
          <div className="bg-orange-50 text-orange-800 p-6 rounded-[32px] text-center border border-orange-100">
            <Package size={48} className="mx-auto mb-2 text-orange-400" />
            <h3 className="text-xl font-bold">Aguardando Peças</h3>
            <p className="text-sm mt-1 opacity-80">Já encomendamos as peças necessárias. Assim que chegarem, iniciamos o serviço.</p>
          </div>
        </div>
      )}

      {status === "aprovado" && (<div className="px-6 pb-6 animate-in zoom-in"><div className="bg-green-600 text-white p-6 rounded-[32px] text-center shadow-lg"><ShieldCheck size={48} className="mx-auto mb-2" /><h3 className="text-xl font-bold">Aprovado!</h3><p className="text-sm opacity-90">Verificando estoque...</p></div></div>)}
      
      {status === "em_servico" && (<div className="px-6 pb-6 animate-in zoom-in"><div className="bg-blue-600 text-white p-6 rounded-[32px] text-center shadow-lg"><Wrench size={48} className="mx-auto mb-2" /><h3 className="text-xl font-bold">Mãos à obra!</h3><p className="text-sm opacity-90">O mecânico está trabalhando no seu carro agora.</p></div></div>)}

      {status === "pronto" && (<div className="px-6 pb-6 animate-in zoom-in"><div className="bg-[#1A1A1A] text-[#FACC15] p-6 rounded-[32px] text-center shadow-lg"><CheckCircle size={48} className="mx-auto mb-2" /><h3 className="text-xl font-bold">Pode vir buscar!</h3><p className="text-sm opacity-90">Seu veículo está pronto.</p></div></div>)}

      {/* GALERIA E FINANCEIRO IGUAIS AO ANTERIOR... */}
      <div className="px-6 mb-6"><h3 className="font-bold text-[#1A1A1A] ml-2 mb-3 flex items-center gap-2"><Camera size={18} /> Fotos e Evidências</h3><div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-hide">{[1, 2].map((i) => (<div key={i} className="flex-none w-64 h-48 bg-stone-200 rounded-[24px] relative overflow-hidden snap-center shadow-sm border border-stone-100"><div className="absolute inset-0 flex items-center justify-center text-stone-400 font-bold text-xs">Foto {i}</div></div>))}</div></div>
      <div className="px-6"><div className="bg-white rounded-[32px] shadow-sm border border-stone-100 overflow-hidden"><button onClick={() => setDetalhesAbertos(!detalhesAbertos)} className="w-full p-6 flex items-center justify-between hover:bg-stone-50 transition"><div><p className="text-xs font-bold text-stone-400 uppercase">Valor Total</p><p className="text-3xl font-bold text-[#1A1A1A]">R$ {os.total.toFixed(2)}</p></div>{detalhesAbertos ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}</button>{detalhesAbertos && (<div className="px-6 pb-6 bg-stone-50/50 border-t border-stone-100 pt-4 space-y-3 animate-in slide-in-from-top-2">{os.itens.map((item, idx) => (<div key={idx} className="flex justify-between text-sm"><span className="text-stone-600">{item.nome}</span><span className="font-bold text-[#1A1A1A]">R$ {item.valor.toFixed(2)}</span></div>))}<div className="border-t border-stone-200 my-2"></div><p className="text-xs text-center text-stone-400">Orçamento válido por 7 dias.</p></div>)}</div></div>

      {status === "orcamento" && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-stone-100 flex flex-col gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-[32px]">
          <button onClick={handleAprovar} className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2"><CheckCircle size={20} /> APROVAR ORÇAMENTO</button>
          <button onClick={handleDuvida} className="w-full bg-white text-[#1A1A1A] border border-stone-200 font-bold py-3 rounded-2xl hover:bg-stone-50 transition flex items-center justify-center gap-2"><MessageCircle size={20} /> Tenho uma dúvida</button>
        </div>
      )}
      {status !== "orcamento" && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-stone-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 rounded-t-[32px]">
          <button onClick={handleContatoGeral} className="w-full bg-green-50 text-green-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2"><MessageCircle size={20} /> Falar com a Oficina</button>
        </div>
      )}
    </div>
  );
}