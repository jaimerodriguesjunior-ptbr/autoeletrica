"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { createClient } from "../../../../src/lib/supabase";

type MonthCalendarPopoverProps = {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    organizationId: string;
    capacity: number; // para basear o limite de lotação de cores (ex: 3 vagas)
};

export default function MonthCalendarPopover({
    selectedDate,
    onDateSelect,
    organizationId,
    capacity
}: MonthCalendarPopoverProps) {
    const supabase = createClient();
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // Reseta a view para a data selecionada sempre que abrir
    useEffect(() => {
        if (isOpen) {
            setViewDate(new Date(selectedDate));
        }
    }, [isOpen, selectedDate]);

    // Busca contagem quando a view muda de mês
    useEffect(() => {
        if (!isOpen || !organizationId) return;

        const fetchMonthCounts = async () => {
            setLoading(true);
            try {
                // Pegar do primeiro ao ultimo dia do mes
                const year = viewDate.getFullYear();
                const month = viewDate.getMonth();
                const primeiroDia = new Date(year, month, 1);
                const ultimoDia = new Date(year, month + 1, 0, 23, 59, 59);

                // Como start_time pode pular dia por causa de Timezone UTC no banco VS Timezone Local NodeJS,
                // vamos buscar um range um dia pra tras e um pra frente por segurança de fuso e tratar no JS.
                const startIso = new Date(primeiroDia.getTime() - 24 * 60 * 60 * 1000).toISOString();
                const endIso = new Date(ultimoDia.getTime() + 24 * 60 * 60 * 1000).toISOString();

                const { data, error } = await supabase
                    .from("appointments")
                    .select("start_time")
                    .eq("organization_id", organizationId)
                    .neq("status", "cancelado")
                    .gte("start_time", startIso)
                    .lte("start_time", endIso);

                if (error) throw error;

                const newCounts: Record<string, number> = {};
                (data || []).forEach(apt => {
                    const dt = new Date(apt.start_time);
                    // Como só queremos saber "quantos" tem num dia exato BRT:
                    const isoLocalStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    newCounts[isoLocalStr] = (newCounts[isoLocalStr] || 0) + 1;
                });

                setCounts(newCounts);
            } catch (error) {
                console.error("Erro ao buscar contagens do mês:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMonthCounts();
    }, [isOpen, viewDate.getMonth(), viewDate.getFullYear(), organizationId]);

    // Calendario Utils
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0(Dom) a 6(Sab)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    const handlePrevMonth = (e: React.MouseEvent) => { e.stopPropagation(); setViewDate(new Date(year, month - 1, 1)); };
    const handleNextMonth = (e: React.MouseEvent) => { e.stopPropagation(); setViewDate(new Date(year, month + 1, 1)); };

    // Grade de Dias
    const daysArray = [];
    for (let i = 0; i < firstDayOfMonth; i++) daysArray.push(null); // padding inical
    for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

    // Formata a data atual do view para exibir o texto do trigger principal
    const formattedSelectedDate = selectedDate.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long"
    }).replace("-feira", "");

    // É o dia de 'Hoje' para o trigger?
    const isToday = new Date().toDateString() === selectedDate.toDateString();

    const getHeatmapColor = (count: number) => {
        if (!count || count === 0) return "bg-stone-50 text-stone-300"; // vazio
        // A lógica do admin é vaga (capacity * slots). Pegaremos uma cor mais ou menos
        // com base no threshold imaginado para o dia. (Aproximadamente capacity * 8h uteis)
        const vMax = capacity * 8;
        const ratio = count / (vMax || 24);

        if (ratio <= 0.3) return "bg-green-100 text-green-700 font-bold border border-green-200";
        if (ratio <= 0.6) return "bg-yellow-100 text-yellow-700 font-bold border border-yellow-200";
        return "bg-red-100 text-red-700 font-bold border border-red-200";
    };

    return (
        <div className="relative z-10" ref={popoverRef}>
            {/* Trigger (Texto central clickavel) */}
            <div className="flex flex-col items-center justify-center">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex flex-col items-center justify-center gap-1 group px-4 py-2 hover:bg-stone-100 rounded-xl transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[22px] font-extrabold text-[#1A1A1A] capitalize tracking-tight flex items-center gap-2">
                            {formattedSelectedDate}
                            <CalendarIcon size={20} className="text-stone-400 group-hover:text-stone-700 transition-colors" />
                        </span>
                    </div>
                    {isToday && (
                        <span className="bg-[#1A1A1A] text-[#FACC15] text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full">
                            Hoje
                        </span>
                    )}
                </button>
            </div>

            {/* Popover */}
            {isOpen && (
                <div className="absolute z-[9999] top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white border border-stone-200 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-4 animate-in fade-in zoom-in-95 duration-200 origin-top">
                    {/* Header: Troca de Mês */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500">
                            <ChevronLeft size={20} />
                        </button>
                        <h3 className="font-extrabold text-[#1A1A1A] text-lg capitalize flex items-center gap-2">
                            {monthNames[month]} {year}
                            {loading && <Loader2 size={16} className="animate-spin text-stone-400" />}
                        </h3>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500">
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {weekDays.map(wd => (
                            <div key={wd} className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                {wd}
                            </div>
                        ))}
                    </div>

                    {/* Grade de Dias */}
                    <div className="grid grid-cols-7 gap-1">
                        {daysArray.map((dia, idx) => {
                            if (!dia) return <div key={`empty-${idx}`} className="h-10" />;

                            const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                            const isSelected = selectedDate.getDate() === dia && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                            const isHoje = new Date().getDate() === dia && new Date().getMonth() === month && new Date().getFullYear() === year;
                            const count = counts[dStr] || 0;
                            const heatColor = getHeatmapColor(count);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        onDateSelect(new Date(year, month, dia));
                                        setIsOpen(false);
                                    }}
                                    className={`relative h-11 rounded-lg flex flex-col items-center justify-center transition-all border
                    ${isSelected ? 'ring-2 ring-offset-1 ring-[#1A1A1A] border-[#1A1A1A] !!bg-[#FACC15]' : 'border-transparent hover:border-stone-300'}
                  `}
                                >
                                    <span className={`text-sm font-bold ${isHoje && !isSelected ? 'text-blue-600' : 'text-[#1A1A1A]'}`}>
                                        {dia}
                                    </span>

                                    {/* Indicador de "Lotação" / Agendamentos */}
                                    {count > 0 && (
                                        <div className={`absolute bottom-1 w-5 h-3.5 rounded flex items-center justify-center text-[9px] ${heatColor}`}>
                                            {count}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legenda */}
                    <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-center gap-4 text-[10px] font-bold text-stone-400">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-green-200"></div>Tranquilo</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-yellow-200"></div>Médio</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-200"></div>Cheio</div>
                    </div>
                </div>
            )}
        </div>
    );
}
