"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
    CalendarDays, Plus, Clock, Car, User, Wrench, X, Loader2,
    ChevronLeft, ChevronRight, Search, AlertCircle, CheckCircle, XCircle, Eye, MessageCircle, FileText
} from "lucide-react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import Link from "next/link";
import MonthCalendarPopover from "./_components/MonthCalendarPopover";
import { RescheduleModal } from "./_components/RescheduleModal";

type Appointment = {
    id: string;
    organization_id: string;
    client_id: string | null;
    vehicle_id: string | null;
    work_order_id: number | null;
    type: string;
    status: string;
    description: string | null;
    start_time: string;
    duration_minutes: number;
    token: string;
    clients?: { nome: string; whatsapp: string } | null;
    vehicles?: { modelo: string; placa: string } | null;
};

export default function AgendamentosPage() {
    const supabase = createClient();
    const { profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [capacity, setCapacity] = useState(3);

    const [formDesc, setFormDesc] = useState("");
    const [formDate, setFormDate] = useState("");
    const [formTime, setFormTime] = useState("09:00");
    const [formDuration, setFormDuration] = useState(60);
    const [formType, setFormType] = useState("avaliacao");
    const [rescheduleData, setRescheduleData] = useState<{ id: string, start_time: string } | null>(null);

    // Campos avulsos para cliente não cadastrado
    const [formCarroAvulso, setFormCarroAvulso] = useState("");
    const [formWaAvulso, setFormWaAvulso] = useState("");

    // Busca de cliente
    const [clientSearch, setClientSearch] = useState("");
    const [clientResults, setClientResults] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [clientVehicles, setClientVehicles] = useState<any[]>([]);

    // Busca de OS (para tipo "ja_tem_os")
    const [osSearch, setOsSearch] = useState("");
    const [osResults, setOsResults] = useState<any[]>([]);
    const [selectedOS, setSelectedOS] = useState<any>(null);

    const heatmapScrollRef = useRef<HTMLDivElement>(null);

    const isToday = selectedDate.toDateString() === new Date().toDateString();

    useEffect(() => {
        if (profile?.organization_id) {
            fetchAppointments();
            fetchCapacity();
        }
    }, [profile, selectedDate]);

    const fetchCapacity = async () => {
        const { data } = await supabase
            .from("company_settings")
            .select("scheduling_capacity")
            .eq("organization_id", profile!.organization_id)
            .single();
        if (data?.scheduling_capacity) setCapacity(data.scheduling_capacity);
    };

    const fetchAppointments = async () => {
        setLoading(true);
        const dayStr = selectedDate.toISOString().split("T")[0];
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];

        const { data } = await supabase
            .from("appointments")
            .select(`
        *,
        clients (nome, whatsapp),
        vehicles (modelo, placa)
      `)
            .eq("organization_id", profile!.organization_id)
            .gte("start_time", dayStr)
            .lt("start_time", nextDayStr)
            .neq("status", "cancelado")
            .order("start_time", { ascending: true });

        setAppointments(data || []);
        setLoading(false);
    };

    // Busca clientes ao digitar
    useEffect(() => {
        if (clientSearch.length < 2) { setClientResults([]); return; }
        const timer = setTimeout(async () => {
            if (!profile?.organization_id) return;
            const { data } = await supabase
                .from("clients")
                .select("id, nome, whatsapp")
                .eq("organization_id", profile.organization_id)
                .ilike("nome", `%${clientSearch}%`)
                .limit(5);
            setClientResults(data || []);
        }, 300);
        return () => clearTimeout(timer);
    }, [clientSearch, profile]);

    const handleSelectClient = (client: any) => {
        setSelectedClient(client);
        setClientSearch(client.nome);
        setClientResults([]);
    };

    // Busca OS ao digitar (para "Já tem OS")
    useEffect(() => {
        if (formType !== "ja_tem_os") return;
        if (osSearch.length < 1) { setOsResults([]); return; }
        const timer = setTimeout(async () => {
            if (!profile?.organization_id) return;
            // Busca as OS recentes não canceladas e filtra client-side
            const { data } = await supabase
                .from("work_orders")
                .select("id, status, description, clients(id, nome, whatsapp), vehicles(id, modelo, placa)")
                .eq("organization_id", profile.organization_id)
                .neq("status", "cancelado")
                .order("created_at", { ascending: false })
                .limit(50);

            if (!data) { setOsResults([]); return; }

            const termo = osSearch.toLowerCase();
            const filtered = data.filter(os => {
                const idStr = String(os.id).toLowerCase();
                const clienteNome = (os.clients as any)?.nome?.toLowerCase() || "";
                const placa = (os.vehicles as any)?.placa?.toLowerCase() || "";
                const desc = os.description?.toLowerCase() || "";
                return idStr.includes(termo) || clienteNome.includes(termo) || placa.includes(termo) || desc.includes(termo);
            }).slice(0, 6);

            setOsResults(filtered);
        }, 300);
        return () => clearTimeout(timer);
    }, [osSearch, formType, profile]);

    const handleSelectOS = (os: any) => {
        setSelectedOS(os);
        setOsSearch(`OS #${String(os.id).slice(0, 4).toUpperCase()}`);
        setOsResults([]);
    };

    // HEATMAP: calcular ocupação por hora
    const heatmapData = useMemo(() => {
        const hours: { hour: number; count: number }[] = [];
        for (let h = 7; h <= 18; h++) {
            let count = 0;
            appointments.forEach(a => {
                const start = new Date(a.start_time);
                const startH = start.getHours();
                const endH = startH + Math.ceil((a.duration_minutes || 60) / 60);
                if (h >= startH && h < endH) count++;
            });
            hours.push({ hour: h, count });
        }
        return hours;
    }, [appointments]);

    const getHeatColor = (count: number) => {
        if (count === 0) return "bg-green-100 text-green-700 border-green-200";
        const ratio = count / capacity;
        if (ratio <= 0.5) return "bg-green-200 text-green-800 border-green-300";
        if (ratio <= 0.9) return "bg-yellow-200 text-yellow-800 border-yellow-300";
        return "bg-red-200 text-red-800 border-red-300";
    };

    // Auto-scroll para o horário atual se for o dia de hoje
    useEffect(() => {
        if (!heatmapScrollRef.current || !isToday || heatmapData.length === 0) return;

        const currentHour = new Date().getHours();

        // Timeout pequeno para dar tempo de renderizar a lista
        const timeoutId = setTimeout(() => {
            const targetElement = heatmapScrollRef.current?.querySelector(`[data-hour="${currentHour}"]`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [heatmapData, isToday]);

    const handleSave = async () => {
        if (!formDate || !formTime) return alert("Informe data e horário.");

        // Validação específica por tipo
        if (formType === "ja_tem_os" && !selectedOS) {
            return alert("Selecione uma Ordem de Serviço.");
        }
        if (formType === "avaliacao" && !selectedClient && !clientSearch.trim() && !formDesc.trim()) {
            return alert("Preencha pelo menos o nome do cliente ou uma descrição do serviço.");
        }

        setSaving(true);
        try {
            // Corrige o timezone do form para não pular de dia
            const [ano, ms, dia] = formDate.split("-").map(Number);
            const [hora, min] = formTime.split(":").map(Number);

            const startTime = new Date(ano, ms - 1, dia, hora, min, 0);

            if (startTime < new Date()) {
                setSaving(false);
                return alert("Não é possível agendar para um horário no passado.");
            }

            let finalDesc = formDesc;
            let clientId = selectedClient?.id || null;
            let vehicleId = selectedVehicle?.id || null;
            let workOrderId = null;

            if (formType === "ja_tem_os" && selectedOS) {
                // Pega tudo da OS
                clientId = selectedOS.clients?.id || null;
                vehicleId = selectedOS.vehicles?.id || null;
                workOrderId = selectedOS.id;
                if (!finalDesc) {
                    finalDesc = selectedOS.description || `OS #${String(selectedOS.id).slice(0, 4).toUpperCase()}`;
                }
            } else {
                // Agrupa os dados extras na descrição
                const blocosExtras = [];
                if (formCarroAvulso) blocosExtras.push(`Veículo: ${formCarroAvulso}`);
                if (!selectedClient && formWaAvulso) blocosExtras.push(`WhatsApp: ${formWaAvulso}`);
                if (!selectedClient && clientSearch.trim()) blocosExtras.push(`Nome: ${clientSearch.trim()}`);

                if (blocosExtras.length > 0) {
                    finalDesc = finalDesc
                        ? `${finalDesc}\n---\n${blocosExtras.join(" | ")}`
                        : blocosExtras.join(" | ");
                }
            }

            const { error } = await supabase.from("appointments").insert({
                organization_id: profile!.organization_id,
                client_id: clientId,
                vehicle_id: vehicleId,
                work_order_id: workOrderId,
                type: formType,
                description: finalDesc || null,
                start_time: startTime.toISOString(),
                duration_minutes: formDuration,
            });

            if (error) throw error;

            // Auto-scale: verificar se a quantidade nesse slot é maior que o recorde
            const startHour = parseInt(formTime.split(":")[0]);
            const slotsOcupados = appointments.filter(a => {
                const h = new Date(a.start_time).getHours();
                return h === startHour;
            }).length + 1; // +1 pelo que acabou de ser criado

            if (slotsOcupados > capacity) {
                await supabase
                    .from("company_settings")
                    .update({ scheduling_capacity: slotsOcupados })
                    .eq("organization_id", profile!.organization_id);
                setCapacity(slotsOcupados);
            }

            // Reset form
            setFormDesc(""); setFormType("avaliacao"); setFormDuration(60);
            setFormCarroAvulso(""); setFormWaAvulso("");
            setSelectedClient(null); setSelectedVehicle(null);
            setClientSearch(""); setClientVehicles([]);
            setOsSearch(""); setOsResults([]); setSelectedOS(null);
            setModalOpen(false);
            fetchAppointments();
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        await supabase.from("appointments").update({ status: newStatus }).eq("id", id);
        fetchAppointments();
    };

    const changeDay = (delta: number) => {
        const nd = new Date(selectedDate);
        nd.setDate(nd.getDate() + delta);
        setSelectedDate(nd);
    };

    const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;

    const getTypeLabel = (t: string) => {
        if (t === "avaliacao") return "Avaliação";
        if (t === "ja_tem_os") return "Já tem OS";
        return "Geral";
    };

    const getTypeColor = (t: string) => {
        if (t === "avaliacao") return "bg-blue-100 text-blue-700";
        if (t === "ja_tem_os") return "bg-orange-100 text-orange-700";
        return "bg-stone-100 text-stone-600";
    };

    const getStatusIcon = (s: string) => {
        if (s === "confirmado") return <CheckCircle size={16} className="text-green-500" />;
        if (s === "concluido") return <CheckCircle size={16} className="text-green-500" />;
        if (s === "nao_compareceu") return <XCircle size={16} className="text-red-500" />;
        if (s === "em_atendimento") return <Wrench size={16} className="text-blue-500" />;
        return <Clock size={16} className="text-yellow-500" />;
    };

    const handleWhatsapp = (a: Appointment) => {
        let number = a.clients?.whatsapp?.replace(/\D/g, "") || "";

        // Fallback: extrair número da descrição
        if (!number && a.description) {
            const match = a.description.match(/WhatsApp:\s*(\d+)/i);
            if (match) number = match[1];
        }

        if (!number) {
            alert("Este agendamento não possui um WhatsApp.");
            return;
        }

        const dataFormatada = new Date(a.start_time).toLocaleDateString("pt-BR");
        const horaFormatada = new Date(a.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/acompanhar?token=${a.token}`;

        const nome = a.clients?.nome || 'Cliente';

        const text = `Olá ${nome}, tudo bem?\n\n` +
            `Seu agendamento de *${getTypeLabel(a.type)}* está marcado para o dia *${dataFormatada}* às *${horaFormatada}*.\n\n` +
            `Você pode confirmar sua presença e acompanhar tudo pelo link abaixo:\n\n${link}`;

        window.open(`https://wa.me/55${number}?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
        <div className="space-y-6 pb-32">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-[#1A1A1A]">Agenda</h1>
                    <p className="text-stone-500 text-sm mt-1">Gerencie avaliações, retornos e compromissos.</p>
                </div>
                <button
                    onClick={() => {
                        setFormDate(selectedDate.toISOString().split("T")[0]);
                        setModalOpen(true);
                    }}
                    className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105"
                >
                    <Plus size={20} /> Novo Agendamento
                </button>
            </div>

            {/* NAVEGAÇÃO DE DIAS */}
            <div className="flex items-center justify-center gap-4 bg-white rounded-[32px] shadow-sm px-4 py-3 border border-stone-200">
                <button onClick={() => changeDay(-1)} className="p-2 bg-white rounded-full shadow-sm border border-stone-200 hover:bg-stone-50 transition">
                    <ChevronLeft size={20} />
                </button>

                <div className="flex flex-col items-center">
                    <MonthCalendarPopover
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        organizationId={profile?.organization_id || ""}
                        capacity={capacity}
                    />
                </div>

                <button onClick={() => changeDay(1)} className="p-2 bg-white rounded-full shadow-sm border border-stone-200 hover:bg-stone-50 transition">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* HEATMAP */}
            <div className="bg-white rounded-[24px] p-6 border-2 border-stone-300 shadow-sm">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Ocupação por Horário</h3>
                <div ref={heatmapScrollRef} className="flex gap-1.5 overflow-x-auto pb-2 scroll-smooth hide-scrollbar">
                    {heatmapData.map(slot => (
                        <div
                            key={slot.hour}
                            data-hour={slot.hour}
                            className={`flex-1 min-w-[50px] rounded-xl p-2 text-center border transition ${getHeatColor(slot.count)} ${isToday && slot.hour === new Date().getHours() ? 'ring-2 ring-[#1A1A1A] ring-offset-1' : ''}`}
                        >
                            <p className="text-[10px] font-bold opacity-70">{formatHour(slot.hour)}</p>
                            <p className="text-lg font-extrabold">{slot.count}</p>
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-stone-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-300"></span> Tranquilo</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300"></span> Movimentado</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-300"></span> Lotado</span>
                </div>
            </div>

            {/* LISTA DE AGENDAMENTOS */}
            <div className="bg-white rounded-[24px] p-6 border-2 border-stone-300 shadow-sm">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">
                    Agendamentos ({appointments.length})
                </h3>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FACC15]" size={32} /></div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-10 text-stone-400">
                        <CalendarDays size={40} className="mx-auto mb-2 opacity-40" />
                        <p className="font-medium">Nenhum agendamento para este dia.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {appointments.map(a => {
                            const startTime = new Date(a.start_time);
                            return (
                                <div key={a.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 p-4 md:p-3 bg-[#F8F7F2] rounded-2xl border border-stone-200 hover:border-stone-300 transition group">

                                    {/* HORÁRIO */}
                                    <div className="flex items-center md:flex-col justify-between md:justify-center w-full md:w-auto md:min-w-[70px] border-b md:border-b-0 pb-3 md:pb-0 border-stone-200 md:text-center text-left">
                                        <p className="text-lg md:text-xl font-extrabold text-[#1A1A1A]">
                                            {startTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                        <p className="text-[10px] text-stone-400 font-bold md:mt-0">{a.duration_minutes}min</p>
                                    </div>

                                    <div className="hidden md:block w-px h-10 bg-stone-300"></div>

                                    {/* INFO */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${getTypeColor(a.type)}`}>
                                                {getTypeLabel(a.type)}
                                            </span>
                                            {a.work_order_id && (
                                                <Link href={`/os/detalhes/${a.work_order_id}`} className="text-[10px] font-bold text-blue-500 underline">
                                                    OS vinculada
                                                </Link>
                                            )}
                                        </div>
                                        <p className="font-bold text-[#1A1A1A] text-sm md:truncate whitespace-normal md:whitespace-nowrap leading-snug">
                                            {a.clients?.nome
                                                ? `${a.clients.nome}${a.description ? ` - ${a.description}` : ''}`
                                                : a.description || 'Sem descrição'}
                                        </p>
                                        {a.vehicles && (
                                            <p className="text-xs text-stone-500 mt-0.5">{a.vehicles.modelo} • {a.vehicles.placa}</p>
                                        )}
                                    </div>

                                    {/* Ícones de Status e Ações */}
                                    <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-stone-200/50">
                                        {/* Ícone de Confirmação */}
                                        {a.status === 'confirmado' && (
                                            <div title="Presença confirmada pelo cliente" className="p-2 bg-green-50 text-green-600 rounded-xl">
                                                <CheckCircle size={16} />
                                            </div>
                                        )}

                                        {/* WhatsApp */}
                                        {(a.clients?.whatsapp || (a.description && /WhatsApp:\s*\d+/i.test(a.description))) && (
                                            <button
                                                onClick={() => handleWhatsapp(a)}
                                                title="Enviar WhatsApp"
                                                className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition"
                                            >
                                                <MessageCircle size={16} />
                                            </button>
                                        )}

                                        {/* Nova OS (quando não tem OS vinculada) */}
                                        {!a.work_order_id && (
                                            <Link
                                                href={`/atendimento/nova-os?${[
                                                    a.client_id ? `client_id=${a.client_id}` : '',
                                                    a.vehicle_id ? `vehicle_id=${a.vehicle_id}` : '',
                                                    a.token ? `appointment_token=${a.token}` : ''
                                                ].filter(Boolean).join('&')}`}
                                                title="Abrir Nova OS"
                                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"
                                            >
                                                <FileText size={16} />
                                            </Link>
                                        )}

                                        {/* Reagendar */}
                                        {a.status !== "cancelado" && a.status !== "concluido" && (
                                            <button
                                                onClick={() => setRescheduleData({ id: a.id, start_time: a.start_time })}
                                                title="Reagendar"
                                                className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition"
                                            >
                                                <Clock size={16} />
                                            </button>
                                        )}

                                        {/* Cancelar */}
                                        {a.status !== "cancelado" && a.status !== "concluido" && (
                                            <button
                                                onClick={() => {
                                                    if (confirm("Deseja cancelar este agendamento?")) {
                                                        handleStatusChange(a.id, "cancelado");
                                                    }
                                                }}
                                                title="Cancelar Agendamento"
                                                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        )}

                                        {/* Concluir Avaliação (Baixa manual) */}
                                        {a.status !== "cancelado" && a.status !== "concluido" && !a.work_order_id && (
                                            <button
                                                onClick={() => {
                                                    if (confirm("Deseja dar baixa neste agendamento como 'Concluído' sem abrir OS?")) {
                                                        handleStatusChange(a.id, "concluido");
                                                    }
                                                }}
                                                title="Marcar como Concluído (Sem OS)"
                                                className="p-2 bg-stone-800 text-[#FACC15] rounded-xl hover:bg-black transition"
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL NOVO AGENDAMENTO */}
            {
                modalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-[#1A1A1A]">Novo Agendamento</h2>
                                <button onClick={() => setModalOpen(false)}><X /></button>
                            </div>

                            {/* TIPO */}
                            <div>
                                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">TIPO</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: "avaliacao", label: "Avaliação" },
                                        { value: "ja_tem_os", label: "Já tem OS" },
                                    ].map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setFormType(t.value)}
                                            className={`flex-1 py-2 rounded-xl font-bold text-sm border-2 transition ${formType === t.value ? "bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A]" : "bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-300"}`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* === CAMPOS CONDICIONAIS POR TIPO === */}

                            {formType === "avaliacao" && (
                                <>
                                    {/* CLIENTE */}
                                    <div className="relative">
                                        <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">CLIENTE (opcional)</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                            <input
                                                type="text"
                                                value={clientSearch}
                                                onChange={e => {
                                                    setClientSearch(e.target.value);
                                                    setSelectedClient(null);
                                                    setSelectedVehicle(null);
                                                    setClientVehicles([]);
                                                }}
                                                placeholder="Buscar cliente (ou apenas digite o nome)..."
                                                className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15]"
                                            />
                                        </div>
                                        {clientResults.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-stone-200 max-h-40 overflow-y-auto">
                                                {clientResults.map(c => (
                                                    <button key={c.id} onClick={() => handleSelectClient(c)} className="w-full text-left px-4 py-2 hover:bg-stone-50 text-sm font-medium text-[#1A1A1A]">
                                                        {c.nome}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* VEÍCULO (sempre visível, texto livre) */}
                                    <div>
                                        <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">VEÍCULO (opcional)</label>
                                        <div className="relative">
                                            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                            <input
                                                type="text"
                                                value={formCarroAvulso}
                                                onChange={e => setFormCarroAvulso(e.target.value)}
                                                placeholder="Ex: Gol Prata ABC-1234"
                                                className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15]"
                                            />
                                        </div>
                                    </div>

                                    {/* WHATSAPP (só quando não selecionou cliente cadastrado) */}
                                    {!selectedClient && (
                                        <div>
                                            <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">WHATSAPP (opcional)</label>
                                            <div className="relative">
                                                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                                <input
                                                    type="text"
                                                    value={formWaAvulso}
                                                    onChange={e => setFormWaAvulso(e.target.value)}
                                                    placeholder="(DD) 9..."
                                                    className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {formType === "ja_tem_os" && (
                                <>
                                    {/* BUSCA DE OS */}
                                    <div className="relative">
                                        <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">BUSCAR ORDEM DE SERVIÇO</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                            <input
                                                type="text"
                                                value={osSearch}
                                                onChange={e => { setOsSearch(e.target.value); setSelectedOS(null); }}
                                                placeholder="Digite o número da OS ou descrição..."
                                                className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15]"
                                            />
                                        </div>
                                        {osResults.length > 0 && !selectedOS && (
                                            <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-stone-200 max-h-48 overflow-y-auto">
                                                {osResults.map(os => (
                                                    <button
                                                        key={os.id}
                                                        onClick={() => handleSelectOS(os)}
                                                        className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-100 last:border-0"
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-sm text-[#1A1A1A]">OS #{String(os.id).slice(0, 4).toUpperCase()}</span>
                                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-500">{os.status?.replace('_', ' ')}</span>
                                                        </div>
                                                        <p className="text-xs text-stone-500 mt-0.5">
                                                            {os.clients?.nome || 'Sem cliente'} {os.vehicles ? `• ${os.vehicles.modelo} (${os.vehicles.placa})` : ''}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* RESUMO DA OS SELECIONADA */}
                                    {selectedOS && (
                                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-sm text-blue-800">OS #{String(selectedOS.id).slice(0, 4).toUpperCase()}</span>
                                                <button onClick={() => { setSelectedOS(null); setOsSearch(""); }} className="text-xs text-red-500 font-bold hover:underline">Trocar</button>
                                            </div>
                                            {selectedOS.clients?.nome && <p className="text-xs text-blue-700"><User size={12} className="inline mr-1" />{selectedOS.clients.nome}</p>}
                                            {selectedOS.vehicles && <p className="text-xs text-blue-700"><Car size={12} className="inline mr-1" />{selectedOS.vehicles.modelo} • {selectedOS.vehicles.placa}</p>}
                                            {selectedOS.description && <p className="text-xs text-stone-500 mt-1 truncate">{selectedOS.description}</p>}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* DATA + HORA */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">DATA</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full bg-[#F8F7F2] rounded-xl py-3 px-4 outline-none border-2 border-stone-300 focus:border-[#FACC15] font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">HORÁRIO</label>
                                    <input
                                        type="time"
                                        value={formTime}
                                        onChange={e => setFormTime(e.target.value)}
                                        className="w-full bg-[#F8F7F2] rounded-xl py-3 px-4 outline-none border-2 border-stone-300 focus:border-[#FACC15] font-bold"
                                    />
                                </div>
                            </div>

                            {/* DURAÇÃO */}
                            <div>
                                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">DURAÇÃO ESTIMADA</label>
                                <div className="flex gap-2">
                                    {[15, 30, 60, 120, 240, 480].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setFormDuration(d)}
                                            className={`flex-1 py-2 rounded-xl font-bold text-xs border-2 transition ${formDuration === d ? "bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A]" : "bg-stone-50 text-stone-500 border-stone-200"}`}
                                        >
                                            {d < 60 ? `${d}min` : d === 240 ? "Meio Dia" : d === 480 ? "Dia Todo" : `${d / 60}h`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* DESCRIÇÃO */}
                            <div>
                                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">DESCRIÇÃO (opcional)</label>
                                <textarea
                                    value={formDesc}
                                    onChange={e => setFormDesc(e.target.value)}
                                    placeholder="Ex: Trocar lâmpada farol esquerdo"
                                    rows={2}
                                    className="w-full bg-[#F8F7F2] rounded-xl py-3 px-4 outline-none border-2 border-stone-300 focus:border-[#FACC15] resize-none"
                                />
                            </div>

                            {/* SALVAR */}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full bg-[#1A1A1A] hover:bg-black text-[#FACC15] py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <CalendarDays size={20} />}
                                {saving ? "Salvando..." : "Agendar"}
                            </button>
                        </div>
                    </div>
                )
            }

            {/* MODAL REAGENDAMENTO ENCAPSULADO */}
            {rescheduleData && (
                <RescheduleModal
                    isOpen={!!rescheduleData}
                    onClose={() => setRescheduleData(null)}
                    appointmentId={rescheduleData.id}
                    currentStartTime={rescheduleData.start_time}
                    onSuccess={() => {
                        setRescheduleData(null);
                        fetchAppointments();
                        setTimeout(() => window.location.reload(), 300);
                    }}
                />
            )}
        </div >
    );
}
