"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle, Clock, Wrench, Car, Camera,
  MessageCircle, ChevronDown, ChevronUp, ShieldCheck,
  Package, AlertCircle, Loader2, X, AlertTriangle, Download, FileText
} from "lucide-react";
// eslint-disable-next-line @next/next/no-img-element

function ConteudoPortal() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [os, setOs] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.svg");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState<string>("");

  // Controle visual
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null);
  const [drawerAberto, setDrawerAberto] = useState(false);

  useEffect(() => {
    if (token) {
      fetchOS();
    } else {
      setErro("Link inválido ou expirado.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchOS = async () => {
    try {
      const res = await fetch(`/api/portal/os?token=${encodeURIComponent(token!)}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Erro ao buscar OS.');

      setOs(json.os);

      if (json.logoUrl) {
        setLogoUrl(json.logoUrl);
      }
      if (json.telefone) {
        setTelefoneEmpresa(json.telefone.replace(/\D/g, ''));
      }
    } catch (error: any) {
      setErro("Não foi possível carregar os dados. Verifique o link.");
    } finally {
      setLoading(false);
    }
  };

  // Verifica se há peça do cliente antes de aprovar
  const handleCliqueAprovar = () => {
    if (!os) return;
    const temPecaCliente = os.work_order_items?.some((item: any) => item.peca_cliente);
    if (temPecaCliente) {
      setDrawerAberto(true);
    } else {
      handleAprovar();
    }
  };

  const handleAprovar = async () => {
    if (!os) return;
    setAtualizando(true);
    setDrawerAberto(false);
    try {
      // Capturar metadados
      const aprovacao_dispositivo = navigator.userAgent;

      // Buscar IP público
      let aprovacao_ip = "desconhecido";
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        aprovacao_ip = ipData.ip;
      } catch { /* silencioso */ }

      // Hash da versão do orçamento (itens + valores)
      const versaoStr = (os.work_order_items || []).map((i: any) => `${i.name}:${i.total_price}:${i.peca_cliente}`).join('|');
      const encoder = new TextEncoder();
      const data = encoder.encode(versaoStr + ':' + os.total);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const aprovacao_versao_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch('/api/portal/aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          aprovacao_ip,
          aprovacao_dispositivo,
          aprovacao_versao_hash
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao aprovar.');

      setOs({ ...os, status: 'aprovado' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      alert("Orçamento aprovado com sucesso!");

    } catch (error) {
      alert("Erro ao aprovar. Tente novamente.");
    } finally {
      setAtualizando(false);
    }
  };

  const handleContato = () => {
    if (!telefoneEmpresa) return alert('Telefone da oficina não configurado.');
    window.open(`https://wa.me/55${telefoneEmpresa}?text=Olá, estou vendo a OS #${os?.id}`, '_blank');
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

    if (step < currentStep) return "bg-green-500 text-white border-green-500";

    if (step === currentStep) {
      if (status === 'orcamento') return "bg-[#FACC15] text-[#1A1A1A] border-[#FACC15] animate-pulse";
      if (status === 'aguardando_peca') return "bg-orange-500 text-white border-orange-500 animate-pulse";
      if (status === 'em_servico') return "bg-blue-500 text-white border-blue-500 animate-pulse";
      if (status === 'pronto') return "bg-green-600 text-white border-green-600 animate-bounce";
      return "bg-green-500 text-white border-green-500";
    }

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

  const nomeVeiculo = os.vehicles?.modelo;
  const placaVeiculo = os.vehicles?.placa;

  return (
    <div className="min-h-screen bg-[#F8F7F2] pb-52 relative">

      {/* 1. CABEÇALHO */}
      <header className="bg-white py-4 px-6 shadow-md border-b-2 border-stone-300 sticky top-0 z-50">
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center justify-center pr-5">
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
          </div>
          <div className="w-px h-8 bg-stone-400"></div>
          <div className="pl-5 flex items-center">
            <h1 className="text-xs font-extrabold text-[#1A1A1A] uppercase tracking-wider">
              PORTAL DO CLIENTE
            </h1>
          </div>
        </div>
      </header>

      {/* 2. CARD VEÍCULO + TIMELINE */}
      <div className="px-4 pt-4 max-w-xl mx-auto">
        <div className="bg-white rounded-[24px] p-4 shadow-sm border-2 border-stone-300">

          {/* VEÍCULO - Compacto */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center shrink-0 border border-stone-300">
              <Car size={20} className="text-[#1A1A1A]" />
            </div>
            <div className="text-left min-w-0">
              <h2 className="text-base font-extrabold text-[#1A1A1A] leading-tight truncate">
                {nomeVeiculo || "Veículo não identificado"}
              </h2>
              <p className="text-stone-500 font-mono text-xs uppercase">
                {placaVeiculo || "---"}
              </p>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="relative px-1">
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-stone-200 -z-10"></div>
            <div className="flex justify-between items-start">
              <div className="flex flex-col items-center gap-1.5 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(1)}`}>
                  <CheckCircle size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Diag.</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(2)}`}>
                  <Clock size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Aprov.</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(3)}`}>
                  <Package size={12} />
                </div>
                <span className={`text-[8px] font-bold leading-tight ${os.status === 'aguardando_peca' ? 'text-orange-600' : 'text-stone-500'}`}>
                  Peças
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5 w-12">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all z-10 ${getStatusColor(4)}`}>
                  <Wrench size={12} />
                </div>
                <span className="text-[8px] font-bold text-stone-500 leading-tight">Serviço</span>
              </div>

              <div className="flex flex-col items-center gap-1.5 w-12">
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
        <div className="px-4 pt-3 max-w-xl mx-auto animate-in zoom-in duration-300">
          <div className="bg-orange-50 text-orange-800 p-5 rounded-[24px] text-center border-2 border-orange-200 shadow-sm">
            <Package size={36} className="mx-auto mb-2 text-orange-400" />
            <h3 className="text-lg font-bold">Aguardando Peças</h3>
            <p className="text-xs mt-1 opacity-80">
              Já encomendamos as peças necessárias. Assim que chegarem, iniciamos o serviço.
            </p>
          </div>
        </div>
      )}

      {os.status === "aprovado" && (
        <div className="px-4 pt-3 max-w-xl mx-auto animate-in zoom-in">
          <div className="bg-green-600 text-white p-5 rounded-[24px] text-center shadow-lg border-2 border-green-700">
            <ShieldCheck size={36} className="mx-auto mb-2" />
            <h3 className="text-lg font-bold">Aprovado!</h3>
            <p className="text-xs opacity-90">Verificando estoque e fila...</p>
          </div>
        </div>
      )}

      {os.status === "em_servico" && (
        <div className="px-4 pt-3 max-w-xl mx-auto animate-in zoom-in">
          <div className="bg-blue-600 text-white p-5 rounded-[24px] text-center shadow-lg border-2 border-blue-700">
            <Wrench size={36} className="mx-auto mb-2" />
            <h3 className="text-lg font-bold">Mãos à obra!</h3>
            <p className="text-xs opacity-90">O mecânico está trabalhando no seu carro agora.</p>
          </div>
        </div>
      )}

      {(os.status === "pronto" || os.status === "entregue") && (
        <div className="px-4 pt-3 max-w-xl mx-auto animate-in zoom-in">
          <div className="bg-[#1A1A1A] text-[#FACC15] p-5 rounded-[24px] text-center shadow-lg border-2 border-stone-700">
            <CheckCircle size={36} className="mx-auto mb-2" />
            <h3 className="text-lg font-bold">Pode vir buscar!</h3>
            <p className="text-xs opacity-90">Seu veículo está pronto.</p>
          </div>
        </div>
      )}

      {/* 3. FINANCEIRO (ANTES das fotos) */}
      <div className="px-4 pt-3 max-w-xl mx-auto">
        <div className="bg-white rounded-[24px] shadow-sm border-2 border-stone-300 overflow-hidden">
          <button onClick={() => setDetalhesAbertos(!detalhesAbertos)} className="w-full p-5 flex items-center justify-between hover:bg-stone-50 transition">
            <div>
              <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">Valor Total</p>
              <p className="text-2xl font-extrabold text-[#1A1A1A]">R$ {Number(os.total).toFixed(2)}</p>
            </div>
            {detalhesAbertos ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
          </button>

          {detalhesAbertos && (
            <div className="px-5 pb-5 bg-stone-50 border-t-2 border-stone-300 pt-4 space-y-3 animate-in slide-in-from-top-2">
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

      {/* 4. GALERIA DE FOTOS */}
      <div className="px-4 pt-3 pb-4 max-w-xl mx-auto">
        <h3 className="font-extrabold text-[#1A1A1A] ml-1 mb-3 flex items-center gap-2 text-sm">
          <Camera size={16} /> Fotos e Evidências
        </h3>

        {Array.isArray(os.photos) && os.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {os.photos.map((url: string, idx: number) => (
              <div
                key={idx}
                className="relative aspect-square bg-stone-200 rounded-[20px] overflow-hidden shadow-sm border-2 border-stone-300 cursor-pointer group hover:scale-[1.02] transition-transform"
                onClick={() => setFotoExpandida(url)}
              >
                <img
                  src={url}
                  alt={`Evidência ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[20px] p-6 text-center border-2 border-dashed border-stone-300">
            <Camera size={28} className="mx-auto text-stone-300 mb-2" />
            <p className="text-xs text-stone-400 font-medium">Nenhuma foto disponível.</p>
          </div>
        )}
      </div>

      {/* RELATÓRIO DE SCANNER */}
      {os.scanner_pdf && (
        <div className="px-4 pt-3 max-w-xl mx-auto">
          <a
            href={os.scanner_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-white rounded-[20px] shadow-sm border-2 border-stone-300 hover:border-blue-400 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-[#1A1A1A]">Relatório de Scanner</p>
              <p className="text-[10px] text-stone-400">Toque para baixar o PDF</p>
            </div>
            <Download size={18} className="text-stone-400" />
          </a>
        </div>
      )}

      {/* BARRA FIXA INFERIOR */}
      {os.status === "orcamento" ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-stone-300 flex flex-col gap-2 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] z-50 rounded-t-[24px] max-w-xl mx-auto">
          <button
            onClick={handleCliqueAprovar}
            disabled={atualizando}
            className="w-full bg-[#1A1A1A] text-[#FACC15] font-extrabold py-3.5 rounded-2xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {atualizando ? <Loader2 className="animate-spin" /> : <CheckCircle size={20} />}
            {atualizando ? "Processando..." : "APROVAR ORÇAMENTO"}
          </button>
          <button
            onClick={handleContato}
            className="w-full bg-white text-[#1A1A1A] border-2 border-stone-300 font-bold py-2.5 rounded-2xl hover:bg-stone-50 transition flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> Tenho uma dúvida
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-stone-300 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] z-50 rounded-t-[24px] max-w-xl mx-auto">
          <button
            onClick={handleContato}
            className="w-full bg-green-50 text-green-700 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 border-2 border-green-200"
          >
            <MessageCircle size={18} /> Falar com a Oficina
          </button>
        </div>
      )}

      {/* DRAWER DE CONFIRMAÇÃO - Peça do Cliente */}
      {drawerAberto && (
        <div className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setDrawerAberto(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] p-6 max-w-xl mx-auto shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-300 rounded-full mx-auto mb-5"></div>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1A1A1A] text-base">Confirmação de Aprovação</h3>
                <p className="text-xs text-stone-500 mt-0.5">Leia com atenção antes de aprovar</p>
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-5">
              <p className="text-sm text-[#1A1A1A] leading-relaxed">
                Você está aprovando o valor de{' '}
                <strong className="text-lg">R$ {Number(os.total).toFixed(2)}</strong>.
              </p>
              <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                Os itens que você forneceu <strong>não têm garantia da oficina</strong> (CDC art. 40). A garantia se aplica apenas às peças e serviços fornecidos pela oficina.
              </p>
            </div>

            <p className="text-[10px] text-stone-400 text-center mb-4">
              Ao clicar em &quot;SIM&quot;, você concorda com os termos acima.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDrawerAberto(false)}
                className="flex-1 bg-stone-100 text-stone-600 font-bold py-3.5 rounded-2xl border-2 border-stone-300 hover:bg-stone-200 transition"
              >
                VOLTAR
              </button>
              <button
                onClick={handleAprovar}
                disabled={atualizando}
                className="flex-1 bg-[#1A1A1A] text-[#FACC15] font-extrabold py-3.5 rounded-2xl shadow-lg hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {atualizando ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                SIM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FOTO EXPANDIDA */}
      {fotoExpandida && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setFotoExpandida(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2">
            <X size={32} />
          </button>
          <img
            src={fotoExpandida}
            alt="Foto Expandida"
            className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

    </div>
  );
}

export default function TelaCliente() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#F8F7F2]"></div>}>
      <ConteudoPortal />
    </Suspense>
  );
}