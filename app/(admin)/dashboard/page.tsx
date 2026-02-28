"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, Wrench, AlertCircle, Calendar,
  MoreHorizontal, ArrowUpRight, CheckCircle, Car, Loader2, Clock
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";

export default function Dashboard() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth();
  const isOwner = profile?.cargo === 'owner';

  // Estados para dados reais
  const [loadingData, setLoadingData] = useState(true);
  const [kpis, setKpis] = useState({
    faturamento: 0,
    produtividade: 0,
    filaEspera: 0,
    prioridade: 0,
    chart: [] // Chart data
  });
  const [recentOS, setRecentOS] = useState<any[]>([]);
  // NOVO: Estado para a agenda
  const [entregas, setEntregas] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.organization_id) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      const orgId = profile?.organization_id;

      // Datas do Mês Atual (para o Big Number)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Datas do Ano (para o Gráfico)
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const endOfYear = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

      // 1. Buscar transações (Agora buscamos do ANO todo para o gráfico)
      const { data: transacoes } = await supabase
        .from('transactions')
        .select('amount, date')
        .eq('organization_id', orgId)
        .eq('type', 'income')
        .gte('date', startOfYear)
        .lte('date', endOfYear);

      // Calcular Faturamento do Mês Atual (Big Number)
      const totalFaturamento = transacoes?.filter(t => t.date >= startOfMonth && t.date <= endOfMonth)
        .reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      // Montar Gráfico MENSAL (Jan - Dez)
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const dadosMensais = Array(12).fill(0);

      transacoes?.forEach(t => {
        const [ano, mes, dia] = t.date.split("-").map(Number);
        if (mes >= 1 && mes <= 12) {
          dadosMensais[mes - 1] += Number(t.amount);
        }
      });

      // Normalizar para 100% altura + formatar valores
      const maxVal = Math.max(...dadosMensais, 1);
      const chartData = dadosMensais.map((val, idx) => ({
        label: meses[idx],
        valStr: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val),
        rawVal: val,
        height: Math.max(10, Math.round((val / maxVal) * 100)) // Min 10%
      }));

      // 2. Contagem de OS
      const { data: osData } = await supabase
        .from('work_orders')
        .select('status, total, updated_at');

      const finalizados = osData?.filter(os =>
        (os.status === 'entregue' || os.status === 'pronto') &&
        os.updated_at >= startOfMonth && os.updated_at <= endOfMonth
      ).length || 0;

      const naFila = osData?.filter(os => ['orcamento', 'aprovado', 'aguardando_peca', 'em_servico'].includes(os.status)).length || 0;
      const prioridades = osData?.filter(os => os.status === 'aguardando_peca').length || 0;

      setKpis({
        faturamento: totalFaturamento,
        produtividade: finalizados,
        filaEspera: naFila,
        prioridade: prioridades,
        chart: chartData
      } as any);

      // 3. Últimas OS (Lista)
      const { data: ultimas } = await supabase
        .from('work_orders')
        .select(`
          id, 
          status, 
          total, 
          clients (nome), 
          vehicles (modelo)
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentOS(ultimas || []);

      // 4. NOVO: Busca Agenda (Hoje e Atrasados)
      const hojeStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const { data: agendaData } = await supabase
        .from('work_orders')
        .select(`
            id,
            previsao_entrega,
            clients (nome),
            vehicles (modelo, placa)
        `)
        .eq('organization_id', orgId)
        .not('previsao_entrega', 'is', null) // Tem que ter data
        .neq('status', 'entregue') // Não pode estar finalizado
        .neq('status', 'cancelado') // Nem cancelado
        .lte('previsao_entrega', hojeStr) // Data menor ou igual a hoje
        .order('previsao_entrega', { ascending: true }); // Mais antigos primeiro (prioridade)

      setEntregas(agendaData || []);

    } catch (error) {
      console.error("Erro dashboard:", error);
    } finally {
      setLoadingData(false);
    }
  };

  if (authLoading) return null;

  const role = profile?.cargo || "employee";
  const userName = profile?.nome || "Colaborador";
  const usa_caixa = profile?.usa_caixa !== false;
  const showFinancials = isOwner && usa_caixa;

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      orcamento: "Orçamento", aprovado: "Aprovado", aguardando_peca: "Peça??",
      em_servico: "Em Serviço", pronto: "Pronto", entregue: "Entregue"
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === 'em_servico') return "bg-yellow-100 text-yellow-700";
    if (status === 'aguardando_peca') return "bg-red-100 text-red-700";
    if (status === 'pronto') return "bg-green-100 text-green-700";
    return "bg-stone-100 text-stone-500";
  };

  return (
    <div className="space-y-6">

      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">
            Olá, <span className="text-stone-400">{userName.split(' ')[0]}</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {showFinancials ? 'Resumo financeiro e operacional.' : 'Bom trabalho hoje!'}
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/os/nova">
            <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition">
              <Wrench size={18} /> Nova OS
            </button>
          </Link>
        </div>
      </div>

      {/* 2. BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* BLOCO A (CAMALEÃO) */}
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 shadow-sm border-2 border-stone-300 relative overflow-hidden">

          {showFinancials ? (
            // === VISÃO DO DONO (DINHEIRO) ===
            <>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-stone-500 text-sm font-medium mb-1">Faturamento Total</p>
                  <h2 className="text-4xl font-bold text-[#1A1A1A]">
                    {loadingData ? <Loader2 className="animate-spin" /> : formatMoney(kpis.faturamento)}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <TrendingUp size={12} /> Real
                    </span>
                    <span className="text-stone-400 text-xs">baseado em transações</span>
                  </div>
                </div>
                <button className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <div className="mt-8 flex items-end gap-2 h-40 opacity-100 overflow-x-auto pb-2">
                {kpis.chart.map((item: any, i: number) => {
                  const isCurrentMonth = i === new Date().getMonth();
                  return (
                    <div key={i} className="flex-1 min-w-[30px] h-full flex flex-col justify-end items-center group relative">
                      {/* VALOR (Sempre visível) */}
                      <span className="text-[10px] font-bold text-stone-600 mb-1">
                        {item.rawVal > 0 ? item.valStr.split(/\s/)[1] : ''}
                      </span>

                      {/* BARRA */}
                      <div
                        className={`w-full rounded-t-md transition-all ${isCurrentMonth ? 'bg-[#FACC15]' : 'bg-stone-300'}`}
                        style={{ height: `${item.height}%` }}
                      ></div>

                      {/* LABEL (MES) */}
                      <span className={`text-[10px] mt-1 font-bold uppercase ${isCurrentMonth ? 'text-black' : 'text-stone-400'}`}>
                        {item.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            // === VISÃO DO FUNCIONÁRIO (PRODUTIVIDADE) ===
            <>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-stone-500 text-sm font-medium mb-1">Veículos Entregues</p>
                  <h2 className="text-4xl font-bold text-[#1A1A1A]">
                    {loadingData ? "..." : kpis.produtividade}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle size={12} /> Finalizados (Geral)
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-full text-stone-400">
                  <Car size={24} />
                </div>
              </div>
              <div className="mt-10">
                <div className="flex justify-between text-xs font-bold text-stone-400 mb-2">
                  <span>Meta da Oficina</span>
                  <span> -- </span>
                </div>
                <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[60%] rounded-full"></div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* BLOCO B: Status Rápido */}
        <div className="space-y-6">

          <div className="bg-[#1A1A1A] rounded-[32px] p-6 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-[-50%] right-[-20%] w-32 h-32 bg-[#FACC15] rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition"></div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl w-fit">
                <Wrench className="text-[#FACC15]" size={24} />
              </div>
              <ArrowUpRight className="text-stone-500" />
            </div>
            <h3 className="text-3xl font-bold">{loadingData ? "..." : kpis.filaEspera} OS's</h3>
            <p className="text-stone-400 text-sm">Em aberto</p>
          </div>

          <div className="bg-white rounded-[32px] p-6 border-2 border-stone-300 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-bold uppercase tracking-wider">Aguardando Peça</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{loadingData ? "..." : kpis.prioridade}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full text-red-500">
              <AlertCircle size={24} />
            </div>
          </div>

        </div>

        {/* BLOCO C: Agenda (ATUALIZADO E FUNCIONAL) */}
        <div className="bg-white rounded-[32px] p-8 border-2 border-stone-300 shadow-sm flex flex-col h-full max-h-[350px]">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Entregas Hoje</h3>
            <Calendar size={18} className="text-stone-400" />
          </div>

          <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1">
            {loadingData ? (
              <div className="text-center py-4 text-stone-400"><Loader2 className="animate-spin mx-auto" /></div>
            ) : entregas.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-sm">
                <p>Nenhuma entrega pendente para hoje.</p>
              </div>
            ) : (
              entregas.map(item => {
                const hoje = new Date().toISOString().split('T')[0];
                const atrasado = item.previsao_entrega < hoje;

                return (
                  <Link href={`/os/detalhes/${item.id}`} key={item.id} className="block group">
                    <div className="flex items-center justify-between p-3 bg-white rounded-2xl hover:bg-stone-100 transition border-2 border-stone-200 hover:border-stone-300 shadow-sm">
                      <div>
                        <p className="font-bold text-[#1A1A1A] text-sm">{item.vehicles?.modelo}</p>
                        <p className="text-[10px] text-stone-500">{item.clients?.nome}</p>
                      </div>
                      <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${atrasado ? 'bg-red-100 text-red-600' : 'bg-[#FACC15] text-[#1A1A1A]'}`}>
                        {atrasado ? 'ATRASADO' : 'HOJE'}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* BLOCO D: Lista Recente */}
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 border-2 border-stone-300 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Últimas Ordens de Serviço</h3>
            <Link href="/os" className="text-sm font-bold text-[#FACC15] hover:text-yellow-600">Ver todas</Link>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-200 text-[#1A1A1A] text-[10px] uppercase font-black tracking-wider border-b-2 border-stone-300">
                <th className="py-3 font-medium">Veículo</th>
                <th className="py-3 font-medium">Cliente</th>
                <th className="py-3 font-medium">Status</th>
                {isOwner && <th className="py-3 font-medium text-right">Valor</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {loadingData ? (
                <tr><td colSpan={4} className="py-4 text-center text-stone-400">Carregando...</td></tr>
              ) : recentOS.length === 0 ? (
                <tr><td colSpan={4} className="py-4 text-center text-stone-400">Nenhuma OS encontrada.</td></tr>
              ) : (
                recentOS.map((os) => (
                  <tr key={os.id} className="border-b border-stone-300 last:border-0 hover:bg-stone-100 transition cursor-default">
                    <td className="py-4 font-bold text-[#1A1A1A]">{os.vehicles?.modelo || "Veículo não identificado"}</td>
                    <td className="py-4 text-stone-500">{os.clients?.nome || "Consumidor"}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(os.status)}`}>
                        {getStatusLabel(os.status)}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="py-4 text-right font-bold text-[#1A1A1A]">
                        {formatMoney(os.total)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}