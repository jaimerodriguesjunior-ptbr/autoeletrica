"use client";

import { useState } from "react";
import { Loader2, X, Calendar as CalendarIcon, Clock } from "lucide-react";
import { createClient } from "../../../../src/lib/supabase";

interface RescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId: string;
    currentStartTime: string; // ISO String
    onSuccess: () => void;
}

export function RescheduleModal({ isOpen, onClose, appointmentId, currentStartTime, onSuccess }: RescheduleModalProps) {
    const supabase = createClient();

    // Inicializar os campos com a data/hora atual do agendamento
    const currentDateObj = new Date(currentStartTime);

    // Ajustar fuso horário local
    const tzOffset = currentDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(currentDateObj.getTime() - tzOffset)).toISOString().slice(0, 16);

    const [date, setDate] = useState(localISOTime.split("T")[0]);
    const [time, setTime] = useState(localISOTime.split("T")[1].substring(0, 5));

    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!date || !time) {
            alert("Preencha data e hora.");
            return;
        }

        setSaving(true);
        try {
            // Combina data e hora selecionadas
            // Ex: "2024-03-01T14:30:00"
            // Importante: No Supabase salvamos TIMESTAMPTZ, mas o JS Date parsea strings ISO locais se não houver 'Z'
            const newStartString = `${date}T${time}:00`;
            const newDateObj = new Date(newStartString);

            if (isNaN(newDateObj.getTime())) {
                throw new Error("Data inválida.");
            }

            const { error } = await supabase
                .from("appointments")
                .update({
                    start_time: newDateObj.toISOString(),
                    status: 'agendado'
                })
                .eq("id", appointmentId);

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error("Erro ao reagendar:", err);
            alert("Erro ao reagendar: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-[#1A1A1A]">Reagendar</h2>
                        <p className="text-xs text-stone-500 mt-0.5">Escolha a nova data e hora</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                        <X size={20} className="text-stone-500" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* DATA */}
                    <div>
                        <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">NOVA DATA</label>
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15] font-medium text-[#1A1A1A]"
                            />
                        </div>
                    </div>

                    {/* HORA */}
                    <div>
                        <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">NOVO HORÁRIO</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                            <input
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                className="w-full bg-[#F8F7F2] rounded-xl py-3 pl-10 pr-4 outline-none border-2 border-stone-300 focus:border-[#FACC15] font-medium text-[#1A1A1A]"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 px-4 bg-[#1A1A1A] text-[#FACC15] font-extrabold rounded-xl hover:bg-black transition text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-70"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        {saving ? "Salvando..." : "Salvar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
