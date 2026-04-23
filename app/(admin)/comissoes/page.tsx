"use client";

import { useState, useEffect, useCallback } from "react";
import { Award, Loader2, CheckCircle, Filter, DollarSign, User, Calendar } from "lucide-react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";

type CommissionRow = {
  id: string;
  work_order_id: number;
  work_order_item_id: string;
  employee_id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  profiles: { nome: string } | null;
  work_orders: { clients: { nome: string } | null } | null;
  work_order_items: { name: string } | null;
};

type FuncionarioResumo = {
  id: string;
  nome: string;
  total_pendente: number;
  total_pago: number;
  count_pendente: number;
};

export default function ComissoesPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [comissoes, setComissoes] = useState<CommissionRow[]>([]);
  const [resumoFuncionarios, setResumoFuncionarios] = useState<FuncionarioResumo[]>([]);
  const [updating, setUpdating] = useState(false);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<'all' | 'pending' | 'paid'>('pending');
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>('all');
  const [filtroPeriodo, setFiltroPeriodo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fetchComissoes = useCallback(async () => {
    if (!profile?.organization_id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('commissions')
        .select(`
          *,
          profiles ( nome ),
          work_orders ( clients ( nome ) ),
          work_order_items ( name )
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'all') {
        query = query.eq('status', filtroStatus);
      }

      if (filtroFuncionario !== 'all') {
        query = query.eq('employee_id', filtroFuncionario);
      }

      // Filtro de período (mês/ano)
      if (filtroPeriodo) {
        const [year, month] = filtroPeriodo.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        const endDateStr = `${year}-${month}-${String(endDate.getDate()).padStart(2, '0')}`;
        query = query.gte('created_at', startDate).lte('created_at', endDateStr + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;
      setComissoes((data || []) as unknown as CommissionRow[]);

      // Resumo por funcionário
      const resumo: Record<string, FuncionarioResumo> = {};
      (data as CommissionRow[]).forEach((c) => {
        const empId = c.employee_id;
        if (!resumo[empId]) {
          resumo[empId] = {
            id: empId,
            nome: c.profiles?.nome || 'Desconhecido',
            total_pendente: 0,
            total_pago: 0,
            count_pendente: 0,
          };
        }
        if (c.status === 'pending') {
          resumo[empId].total_pendente += c.amount;
          resumo[empId].count_pendente++;
        } else {
          resumo[empId].total_pago += c.amount;
        }
      });
      setResumoFuncionarios(Object.values(resumo).sort((a, b) => b.total_pendente - a.total_pendente));
    } catch (err) {
      console.error('Erro ao buscar comissões:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, profile, filtroStatus, filtroFuncionario, filtroPeriodo]);

  useEffect(() => {
    fetchComissoes();
  }, [fetchComissoes]);

  // Buscar funcionários para o filtro
  const [listaFuncionarios, setListaFuncionarios] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    if (!profile?.organization_id) return;
    supabase
      .from('profiles')
      .select('id, nome')
      .eq('organization_id', profile.organization_id)
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => { if (data) setListaFuncionarios(data); });
  }, [supabase, profile]);

  const handleMarcarPago = async (employeeId: string) => {
    if (!profile?.organization_id) return;
    if (!confirm('Confirma o pagamento de TODAS as comissões pendentes deste funcionário neste período?')) return;

    setUpdating(true);
    try {
      // Busca IDs pendentes desse funcionário no período
      const pendentes = comissoes.filter(c => c.employee_id === employeeId && c.status === 'pending');
      const ids = pendentes.map(c => c.id);

      if (ids.length === 0) return;

      const { error } = await supabase
        .from('commissions')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;

      alert(`${ids.length} comissão(ões) marcada(s) como paga(s)!`);
      fetchComissoes();
    } catch (err: any) {
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center shadow-lg">
          <Award size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Gestão de Comissões</h1>
          <p className="text-stone-500 text-sm">Controle de comissões por funcionário</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-[24px] p-4 shadow-sm border border-stone-100 flex flex-wrap gap-3 items-center">
        <Filter size={18} className="text-stone-400" />

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="bg-[#F8F7F2] rounded-xl py-2.5 px-4 font-bold text-sm outline-none border-2 border-stone-300 focus:border-[#FACC15]"
        >
          <option value="all">Todas</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagas</option>
        </select>

        <select
          value={filtroFuncionario}
          onChange={(e) => setFiltroFuncionario(e.target.value)}
          className="bg-[#F8F7F2] rounded-xl py-2.5 px-4 font-bold text-sm outline-none border-2 border-stone-300 focus:border-[#FACC15]"
        >
          <option value="all">Todos Funcionários</option>
          {listaFuncionarios.map(f => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>

        <input
          type="month"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
          className="bg-[#F8F7F2] rounded-xl py-2.5 px-4 font-bold text-sm outline-none border-2 border-stone-300 focus:border-[#FACC15]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#FACC15]" size={40} />
        </div>
      ) : (
        <>
          {/* CARDS DE RESUMO POR FUNCIONÁRIO */}
          {resumoFuncionarios.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resumoFuncionarios.map(func => (
                <div key={func.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-stone-100 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A1A1A] to-[#3A3A3A] text-white flex items-center justify-center font-bold text-sm shadow-inner">
                      {func.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1A1A1A] truncate">{func.nome}</p>
                      <p className="text-[10px] text-stone-400 font-bold uppercase">
                        {func.count_pendente} comissão(ões) pendente(s)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-200">
                      <p className="text-[10px] font-bold text-yellow-600 uppercase">A Pagar</p>
                      <p className="text-lg font-bold text-yellow-700">{formatCurrency(func.total_pendente)}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
                      <p className="text-[10px] font-bold text-green-600 uppercase">Já Pago</p>
                      <p className="text-lg font-bold text-green-700">{formatCurrency(func.total_pago)}</p>
                    </div>
                  </div>

                  {func.count_pendente > 0 && (
                    <button
                      onClick={() => handleMarcarPago(func.id)}
                      disabled={updating}
                      className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3 rounded-xl shadow-md hover:scale-[1.02] transition flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {updating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Marcar Todas como Pagas
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* LISTA DETALHADA */}
          <div className="bg-white rounded-[24px] shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100">
              <h2 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                <DollarSign size={18} className="text-[#FACC15]" />
                Detalhamento ({comissoes.length} registros)
              </h2>
            </div>

            {comissoes.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-stone-400 text-sm">Nenhuma comissão encontrada para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8F7F2] text-stone-500 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-4 py-3">Funcionário</th>
                      <th className="px-4 py-3">OS</th>
                      <th className="px-4 py-3">Serviço</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comissoes.map(c => (
                      <tr key={c.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition">
                        <td className="px-4 py-3 font-bold text-[#1A1A1A]">
                          {c.profiles?.nome || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <a href={`/os/detalhes/${c.work_order_id}`} className="text-blue-600 hover:underline font-bold">
                            #{c.work_order_id}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-stone-600">
                          {c.work_order_items?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {(c.work_orders as any)?.clients?.nome || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#1A1A1A]">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.status === 'paid' ? (
                            <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">PAGO</span>
                          ) : (
                            <span className="text-yellow-600 font-bold text-xs bg-yellow-50 px-2 py-1 rounded">PENDENTE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs">
                          {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
