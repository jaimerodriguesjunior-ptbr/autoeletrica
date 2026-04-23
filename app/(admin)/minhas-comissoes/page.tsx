"use client";

import { useState, useEffect, useCallback } from "react";
import { Award, Loader2, CheckCircle, Clock, DollarSign, Wrench } from "lucide-react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";

type CommissionRow = {
  id: string;
  work_order_id: number;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  work_orders: { clients: { nome: string } | null } | null;
  work_order_items: { name: string } | null;
};

export default function MinhasComissoesPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [comissoes, setComissoes] = useState<CommissionRow[]>([]);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fetchComissoes = useCallback(async () => {
    if (!profile?.id || !profile?.organization_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .select(`
          id, work_order_id, amount, status, paid_at, created_at,
          work_orders ( clients ( nome ) ),
          work_order_items ( name )
        `)
        .eq("organization_id", profile.organization_id)
        .eq("employee_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComissoes((data || []) as unknown as CommissionRow[]);
    } catch (err) {
      console.error("Erro ao buscar comissões:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, profile]);

  useEffect(() => {
    fetchComissoes();
  }, [fetchComissoes]);

  const totalPendente = comissoes
    .filter((c) => c.status === "pending")
    .reduce((acc, c) => acc + c.amount, 0);

  const totalPago = comissoes
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + c.amount, 0);

  const pendentes = comissoes.filter((c) => c.status === "pending");
  const pagas = comissoes.filter((c) => c.status === "paid");

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-black text-[#1A1A1A]">Minhas Comissões</h1>
        <p className="text-stone-500 text-sm mt-1">
          Olá, {profile?.nome?.split(" ")[0]}! Acompanhe seus ganhos por serviço.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-[#FACC15]" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">A receber</span>
          </div>
          <p className="text-2xl font-black text-[#FACC15]">{formatCurrency(totalPendente)}</p>
          <p className="text-xs text-white/40 mt-1">{pendentes.length} serviço{pendentes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Já recebido</span>
          </div>
          <p className="text-2xl font-black text-[#1A1A1A]">{formatCurrency(totalPago)}</p>
          <p className="text-xs text-stone-400 mt-1">{pagas.length} serviço{pagas.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-stone-300" />
        </div>
      ) : comissoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Award size={48} className="text-stone-200 mb-4" />
          <p className="text-stone-400 font-medium">Nenhuma comissão ainda</p>
          <p className="text-stone-300 text-sm">Seus ganhos por serviço aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendentes.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 px-1">A receber</p>
          )}
          {pendentes.map((c) => (
            <ComissaoCard key={c.id} c={c} formatCurrency={formatCurrency} />
          ))}

          {pagas.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 px-1 pt-2">Já recebido</p>
          )}
          {pagas.map((c) => (
            <ComissaoCard key={c.id} c={c} formatCurrency={formatCurrency} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComissaoCard({
  c,
  formatCurrency,
}: {
  c: CommissionRow;
  formatCurrency: (v: number) => string;
}) {
  const isPending = c.status === "pending";
  const clienteNome = c.work_orders?.clients?.nome || "Cliente";
  const servicoNome = c.work_order_items?.name || "Serviço";
  const data = new Date(c.created_at).toLocaleDateString("pt-BR");

  return (
    <div className={`bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-4 ${isPending ? "border-stone-100" : "border-stone-50 opacity-70"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPending ? "bg-[#FACC15]/20" : "bg-green-50"}`}>
        <Wrench size={18} className={isPending ? "text-[#1A1A1A]" : "text-green-500"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#1A1A1A] text-sm truncate">{servicoNome}</p>
        <p className="text-xs text-stone-400 truncate">{clienteNome} · OS #{c.work_order_id}</p>
        <p className="text-[10px] text-stone-300 mt-0.5">{data}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-black text-base ${isPending ? "text-[#1A1A1A]" : "text-green-600"}`}>
          {formatCurrency(c.amount)}
        </p>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isPending ? "bg-[#FACC15]/20 text-[#92720a]" : "bg-green-50 text-green-600"}`}>
          {isPending ? "pendente" : "pago"}
        </span>
      </div>
    </div>
  );
}
