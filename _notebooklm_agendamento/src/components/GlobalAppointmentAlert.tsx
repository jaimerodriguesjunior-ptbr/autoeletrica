"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, AlertTriangle, AlertCircle, Calendar, ArrowRight, Loader2, ChevronLeft, ChevronRight, Check, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RescheduleModal } from "../../app/(admin)/agendamentos/_components/RescheduleModal";

type Apto = {
    id: string;
    start_time: string;
    duration_minutes: number;
    type: string;
    status: string;
    description: string;
    token: string;
    clients: { nome: string; whatsapp: string } | null;
    vehicles: { modelo: string; placa: string } | null;
    work_order_id: number | null;
};

export function GlobalAppointmentAlert() {
    const [agendamentos, setAgendamentos] = useState<Apto[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSnoozing, setIsSnoozing] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [rescheduleData, setRescheduleData] = useState<{ id: string, start_time: string } | null>(null);
    const router = useRouter();

    const fetchAlertas = useCallback(async () => {
        try {
            const res = await fetch("/api/agendamentos/alertas");
            if (!res.ok) {
                console.error("[GlobalAlert] Erro na API", res.status);
                return;
            }
            const data = await res.json();
            console.log("[GlobalAlert] Resposta da API:", data);

            // Ordenar por horário
            const sorted = (data || []).sort((a: Apto, b: Apto) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
            );

            setAgendamentos(sorted);
            if (currentIndex >= sorted.length) {
                setCurrentIndex(Math.max(0, sorted.length - 1));
            }
        } catch (e) {
            console.error("Falha ao buscar alertas", e);
        }
    }, [currentIndex]);

    // Polling a cada 1 minuto
    useEffect(() => {
        fetchAlertas();
        const interval = setInterval(fetchAlertas, 60000);
        return () => clearInterval(interval);
    }, [fetchAlertas]);

    if (agendamentos.length === 0) return null;

    const currentApt = agendamentos[currentIndex];
    if (!currentApt) return null;

    // Calculo do estado de tempo
    const aptTime = new Date(currentApt.start_time);
    const now = new Date();
    const diffMinutos = Math.round((now.getTime() - aptTime.getTime()) / 60000); // positivo = atrasado, negativo = adiantado

    let alertType: "proximo" | "exato" | "atrasado" = "proximo";
    if (diffMinutos > 15) alertType = "atrasado";
    else if (diffMinutos >= 0) alertType = "exato";

    const nextApt = () => setCurrentIndex((p) => Math.min(agendamentos.length - 1, p + 1));
    const prevApt = () => setCurrentIndex((p) => Math.max(0, p - 1));

    const adiarAlerta = async (minutos: number) => {
        setIsSnoozing(true);
        try {
            await fetch("/api/agendamentos/alertas/adiar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appointment_id: currentApt.id, minutos }),
            });
            // Recarrega lista imediatamente (o atual deve sumir por causa do filtro no backend)
            await fetchAlertas();
        } catch (e) {
            alert("Erro ao adiar alerta");
        } finally {
            setIsSnoozing(false);
        }
    };

    const naoCompareceu = async () => {
        if (!confirm("Marcar cliente como não compareceu?")) return;
        setIsFinishing(true);
        try {
            // Importa supabase config via API route manual e atualiza
            const res = await fetch(`/api/agendamentos/${currentApt.id}/status`, {
                method: 'PATCH',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: 'nao_compareceu' })
            });
            if (res.ok) fetchAlertas();
        } catch (e) {
            alert("Erro");
        } finally {
            setIsFinishing(false);
        }
    };

    const isProximo = alertType === "proximo";
    const isAtrasado = alertType === "atrasado";

    const nomeCliente = currentApt.clients?.nome || (currentApt.description && currentApt.description.match(/Nome:\s*([A-Za-zÀ-ÿ\s]+)/i)?.[1]) || "Cliente";

    return (
        <div className={`relative w-full text-white shadow-md border-b flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-4 md:py-3 transition-colors duration-300 gap-4 md:gap-0
      ${isProximo ? 'bg-blue-600 border-blue-700' : isAtrasado ? 'bg-red-600 border-red-700' : 'bg-[#FACC15] text-[#1A1A1A] border-yellow-500'}
    `}>

            {/* Esquerda: Status Text + Info */}
            <div className="flex items-start md:items-center gap-3 md:gap-4 w-full md:w-auto">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isProximo ? 'bg-blue-500' : isAtrasado ? 'bg-red-500' : 'bg-yellow-400'}`}>
                    {isProximo ? <Clock size={20} className={isProximo ? "text-white" : "text-[#1A1A1A]"} /> :
                        isAtrasado ? <AlertTriangle size={20} className="text-white" /> :
                            <AlertCircle size={20} className="text-[#1A1A1A]" />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1 md:mb-0">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isProximo ? "text-blue-200" : isAtrasado ? "text-red-200" : "text-yellow-800"}`}>
                            {isProximo ? `Previsto em ${Math.abs(diffMinutos)} min` :
                                isAtrasado ? `ATRASADO (${diffMinutos}m)` : "Na Loja"}
                        </p>
                        <p className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${isProximo ? "bg-blue-700 text-blue-100" : isAtrasado ? "bg-red-700 text-red-100" : "bg-yellow-500 text-yellow-900"}`}>
                            {aptTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    <h3 className="font-extrabold text-base leading-tight mt-0.5 truncate pr-2">
                        {nomeCliente}
                        {currentApt.vehicles && <span className="font-normal opacity-80 ml-2">({currentApt.vehicles.modelo})</span>}
                    </h3>

                    <p className="text-sm opacity-90 truncate max-w-full md:max-w-[400px]">
                        {currentApt.description || currentApt.type.replace('_', ' ')}
                    </p>
                </div>
            </div>

            {/* Direita: Ações */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
                {/* Carrossel Controller */}
                {agendamentos.length > 1 && (
                    <div className={`flex items-center border rounded-lg overflow-hidden mr-0 md:mr-2 w-full md:w-auto justify-between md:justify-start mb-2 md:mb-0
            ${isProximo ? 'border-blue-500 bg-blue-700/50' : isAtrasado ? 'border-red-500 bg-red-700/50' : 'border-yellow-600 bg-yellow-500/50'}
          `}>
                        <button disabled={currentIndex === 0} onClick={prevApt} className="p-2 md:p-1 hover:bg-black/10 disabled:opacity-30"><ChevronLeft size={16} /></button>
                        <span className="text-xs font-bold px-4 md:px-2 whitespace-nowrap">{currentIndex + 1} de {agendamentos.length}</span>
                        <button disabled={currentIndex === agendamentos.length - 1} onClick={nextApt} className="p-2 md:p-1 hover:bg-black/10 disabled:opacity-30"><ChevronRight size={16} /></button>
                    </div>
                )}

                {/* Botoes de Controle */}
                <div className="flex flex-1 md:flex-none gap-2">
                    <button
                        onClick={() => adiarAlerta(15)}
                        disabled={isSnoozing}
                        className={`flex-1 md:flex-none px-3 py-2.5 md:py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-opacity hover:opacity-80
                   ${isAtrasado ? 'bg-red-700 text-white' : isProximo ? 'bg-blue-700 text-white' : 'bg-yellow-600 text-yellow-50'}
                 `}
                    >
                        {isSnoozing ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
                        Avisar +15m
                    </button>

                    {isAtrasado && (
                        <button
                            onClick={() => setRescheduleData({ id: currentApt.id, start_time: currentApt.start_time })}
                            className="flex-1 md:flex-none px-3 py-2.5 md:py-2 bg-black/20 text-white rounded-xl text-xs font-bold hover:bg-black/30 transition-colors relative z-50 cursor-pointer text-center"
                        >
                            Reagendar
                        </button>
                    )}
                </div>

                {!currentApt.work_order_id && (
                    <Link
                        href={`/atendimento/nova-os?appointment_token=${currentApt.token}`}
                        className={`w-full md:w-auto px-4 py-2.5 md:py-2 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm hover:-translate-y-0.5 transition-transform mt-1 md:mt-0
                 ${isProximo || isAtrasado ? 'bg-white text-[#1A1A1A]' : 'bg-[#1A1A1A] text-[#FACC15]'}
               `}
                    >
                        <Check size={16} /> ABRIR OS
                    </Link>
                )}

                {currentApt.work_order_id && (
                    <Link
                        href={`/os/detalhes/${currentApt.work_order_id}`}
                        className={`w-full md:w-auto px-4 py-2.5 md:py-2 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm hover:-translate-y-0.5 transition-transform mt-1 md:mt-0
                 ${isProximo || isAtrasado ? 'bg-white text-[#1A1A1A]' : 'bg-[#1A1A1A] text-[#FACC15]'}
               `}
                    >
                        <Eye size={16} /> VER OS
                    </Link>
                )}
            </div>

            {rescheduleData && (
                <RescheduleModal
                    isOpen={!!rescheduleData}
                    onClose={() => setRescheduleData(null)}
                    appointmentId={rescheduleData.id}
                    currentStartTime={rescheduleData.start_time}
                    onSuccess={() => {
                        setRescheduleData(null);
                        fetchAlertas();
                        setTimeout(() => window.location.reload(), 300);
                    }}
                />
            )}
        </div>
    );
}
