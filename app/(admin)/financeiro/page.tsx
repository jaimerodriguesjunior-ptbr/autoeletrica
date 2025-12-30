"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpRight, ArrowDownRight, Wallet,
  Wrench, ShoppingCart, Zap, X, Save, Loader2, Trash2, Calendar,
  CheckCircle2, Clock, Filter
} from "lucide-react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";

type Transaction = {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  status: string; // 'paid' ou 'pending'
};

type ExtratoItem = {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  data: string;
  icone: any;
  categoria: string;
  origem: 'manual' | 'os';
  status: 'paid' | 'pending';
};

export default function Financeiro() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth();

  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- FILTROS ---
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'paid' | 'pending'>('todos');

  // Estados de UI (Modais)
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [modalReceitaAberto, setModalReceitaAberto] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);

  // Estados dos Formulários
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState("");
  const [dataMovimentacao, setDataMovimentacao] = useState(new Date().toISOString().split('T')[0]);
  const [efetivado, setEfetivado] = useState(true);

  // Estados de Edição
  const [itemParaEditar, setItemParaEditar] = useState<ExtratoItem | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editData, setEditData] = useState("");
  const [editEfetivado, setEditEfetivado] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.organization_id) {
      fetchFinanceiro();
    } else {
      setLoading(false);
    }
  }, [profile, authLoading]);

  // Atualiza checkbox "Efetivado" conforme a data
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0];
    if (dataMovimentacao > hoje) {
      setEfetivado(false);
    } else {
      setEfetivado(true);
    }
  }, [dataMovimentacao]);

  const fetchFinanceiro = async () => {
    setLoading(true);
    try {
      // 1. Transações
      const { data: transacoes, error: errTrans } = await supabase
        .from('transactions')
        .select('*')
        .eq('organization_id', profile?.organization_id)
        .order('date', { ascending: false });

      if (errTrans) throw errTrans;

      // 3. Unificar (Agora só transações)
      const listaTransacoes: ExtratoItem[] = (transacoes || []).map((t: Transaction) => ({
        id: t.id,
        descricao: t.description,
        valor: Number(t.amount),
        tipo: t.type === 'income' ? 'entrada' : 'saida',
        data: t.date,
        icone: t.type === 'income' ? ArrowUpRight : ShoppingCart,
        categoria: t.category || 'Geral',
        origem: 'manual',
        status: (t.status === 'pending') ? 'pending' : 'paid'
      }));

      const tudo = [...listaTransacoes].sort((a, b) =>
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setExtrato(tudo);

    } catch (error) {
      console.error("Erro Financeiro:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE FILTRAGEM ---
  const extratoFiltrado = extrato.filter(item => {
    // Filtro Mês/Ano
    if (filtroMes && !item.data.startsWith(filtroMes)) return false;

    // Filtro Tipo
    if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false;

    // Filtro Status
    if (filtroStatus !== 'todos' && item.status !== filtroStatus) return false;

    return true;
  });

  // --- CÁLCULO DOS TOTAIS (Baseado no Filtro) ---
  const resumoFiltrado = {
    receita: extratoFiltrado.filter(i => i.tipo === 'entrada' && i.status === 'paid').reduce((acc, i) => acc + i.valor, 0),
    despesa: extratoFiltrado.filter(i => i.tipo === 'saida' && i.status === 'paid').reduce((acc, i) => acc + i.valor, 0),
    aPagar: extratoFiltrado.filter(i => i.tipo === 'saida' && i.status === 'pending').reduce((acc, i) => acc + i.valor, 0),
    aReceber: extratoFiltrado.filter(i => i.tipo === 'entrada' && i.status === 'pending').reduce((acc, i) => acc + i.valor, 0),
  };
  const lucroFiltrado = resumoFiltrado.receita - resumoFiltrado.despesa;

  // --- Abertura de Modais ---
  const abrirModalDespesa = () => {
    setDesc(""); setValor(""); setCat(""); setDataMovimentacao(new Date().toISOString().split('T')[0]); setModalDespesaAberto(true);
  };

  const abrirModalReceita = () => {
    setDesc(""); setValor(""); setCat(""); setDataMovimentacao(new Date().toISOString().split('T')[0]); setModalReceitaAberto(true);
  };

  const handleSalvarTransacao = async (tipo: 'income' | 'expense') => {
    if (!desc || !valor || !dataMovimentacao) return alert("Preencha os campos!");
    setSaving(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        organization_id: profile?.organization_id,
        description: desc,
        amount: Number(valor),
        type: tipo,
        category: cat || (tipo === 'income' ? 'Outras Receitas' : 'Operacional'),
        date: dataMovimentacao,
        status: efetivado ? 'paid' : 'pending'
      });
      if (error) throw error;
      setModalDespesaAberto(false); setModalReceitaAberto(false); fetchFinanceiro();
    } catch (error: any) { alert("Erro: " + error.message); } finally { setSaving(false); }
  };

  const abrirModalEdicao = (item: ExtratoItem) => {
    if (item.origem === 'os') { alert("Este item vem de uma OS. Edite pela tela de OS."); return; }
    setItemParaEditar(item); setEditDesc(item.descricao); setEditValor(item.valor.toString()); setEditCat(item.categoria); setEditData(item.data); setEditEfetivado(item.status === 'paid'); setModalEdicaoAberto(true);
  };

  const handleUpdateTransacao = async () => {
    if (!itemParaEditar || !editDesc || !editValor || !editData) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('transactions').update({
        description: editDesc, amount: Number(editValor), category: editCat, date: editData, status: editEfetivado ? 'paid' : 'pending'
      }).eq('id', itemParaEditar.id);
      if (error) throw error;
      setModalEdicaoAberto(false); fetchFinanceiro();
    } catch (error: any) { alert("Erro: " + error.message); } finally { setSaving(false); }
  };

  const handleDeleteTransacao = async () => {
    if (!itemParaEditar || !confirm("Apagar este lançamento?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', itemParaEditar.id);
      if (error) throw error;
      setModalEdicaoAberto(false); fetchFinanceiro();
    } catch (error: any) { alert("Erro: " + error.message); } finally { setDeleting(false); }
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Financeiro</h1>
          <p className="text-stone-500 text-sm mt-1">Fluxo de caixa e Previsões</p>
        </div>
      </div>

      {/* PAINEL DE CONTROLE (FILTROS) */}
      <div className="bg-white p-4 rounded-[24px] shadow-sm border border-stone-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-stone-500 text-sm font-bold">
          <Filter size={18} /> <span className="hidden md:inline">Filtros:</span>
        </div>

        {/* Filtro Mês */}
        <input
          type="month"
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="bg-[#F8F7F2] px-4 py-2 rounded-xl text-sm font-bold text-[#1A1A1A] outline-none border border-transparent focus:border-[#FACC15]"
        />

        {/* Filtro Status */}
        <div className="flex bg-[#F8F7F2] p-1 rounded-xl">
          {['todos', 'paid', 'pending'].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${filtroStatus === s ? 'bg-white shadow text-[#1A1A1A]' : 'text-stone-400'}`}
            >
              {s === 'todos' ? 'Tudo' : s === 'paid' ? 'Realizado' : 'Pendente'}
            </button>
          ))}
        </div>

        {/* Filtro Tipo */}
        <div className="flex bg-[#F8F7F2] p-1 rounded-xl">
          {['todos', 'entrada', 'saida'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${filtroTipo === t ? 'bg-white shadow text-[#1A1A1A]' : 'text-stone-400'}`}
            >
              {t === 'todos' ? 'Tudo' : t === 'entrada' ? 'Entradas' : 'Saídas'}
            </button>
          ))}
        </div>
      </div>

      {/* BENTO GRID (Resumo Dinâmico) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 text-green-700 rounded-xl"><ArrowUpRight size={20} /></div>
                <span className="text-xs font-bold text-stone-400 uppercase">Receita (Pago)</span>
              </div>
              {resumoFiltrado.aReceber > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg">A Receber: {formatMoney(resumoFiltrado.aReceber)}</span>}
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">{loading ? "..." : formatMoney(resumoFiltrado.receita)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ArrowDownRight size={20} /></div>
                <span className="text-xs font-bold text-stone-400 uppercase">Despesa (Pago)</span>
              </div>
              {resumoFiltrado.aPagar > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg">A Pagar: {formatMoney(resumoFiltrado.aPagar)}</span>}
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">{loading ? "..." : formatMoney(resumoFiltrado.despesa)}</h3>
          </div>
        </div>

        <div className="bg-[#1A1A1A] p-6 rounded-[32px] shadow-lg relative overflow-hidden text-white">
          <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-xl text-[#FACC15]"><Wallet size={20} /></div>
              <span className="text-xs font-bold text-white/50 uppercase">Resultado do Período</span>
            </div>
            <h3 className="text-4xl font-bold text-[#FACC15]">{loading ? "..." : formatMoney(lucroFiltrado)}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Extrato Detalhado</h3>
            <span className="text-xs text-stone-400 italic">
              {extratoFiltrado.length} registros
            </span>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="text-center py-10 text-stone-400 flex flex-col items-center">
                <Loader2 className="animate-spin mb-2" /> Carregando...
              </div>
            ) : extratoFiltrado.length === 0 ? (
              <p className="text-center py-10 text-stone-400">Nenhum registro encontrado para este filtro.</p>
            ) : (
              extratoFiltrado.map((item) => (
                <button
                  key={item.id}
                  onClick={() => abrirModalEdicao(item)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition text-left group border ${item.status === 'pending' ? 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100' : 'bg-[#F8F7F2] border-transparent hover:bg-stone-200'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.status === 'pending' ? 'bg-yellow-200 text-yellow-700' : (item.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600')}`}>
                      {item.status === 'pending' ? <Clock size={18} /> : <item.icone size={18} />}
                    </div>
                    <div>
                      <p className="font-bold text-[#1A1A1A] text-sm group-hover:underline decoration-stone-400">
                        {item.descricao}
                        {item.status === 'pending' && <span className="ml-2 text-[10px] bg-yellow-200 text-yellow-800 px-1 rounded uppercase font-bold">Agendado</span>}
                      </p>
                      <p className="text-xs text-stone-400">{item.categoria} • {new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} {item.origem === 'os' && <span className="ml-2 bg-stone-200 px-1 rounded text-[10px]">OS</span>}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${item.status === 'pending' ? 'text-yellow-600' : (item.tipo === 'entrada' ? 'text-green-600' : 'text-red-500')}`}>
                    {item.tipo === 'entrada' ? '+' : '-'} {formatMoney(item.valor)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-stone-100 rounded-[32px] p-6 border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-stone-600 text-xs uppercase flex items-center gap-2">
                <Zap size={14} /> Ações Rápidas
              </h4>
            </div>
            <div className="space-y-3">
              <button onClick={abrirModalReceita} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2">
                <ArrowUpRight size={20} /> Entrada Avulsa
              </button>
              <button onClick={abrirModalDespesa} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2">
                <ArrowDownRight size={20} /> Registrar Despesa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAIS (MANTIDOS IGUAIS) */}
      {modalDespesaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-500 flex items-center gap-2"><ArrowDownRight /> Nova Despesa</h2>
              <button onClick={() => setModalDespesaAberto(false)}><X /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1"><Calendar size={12} /> DATA</label>
                  <input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => setEfetivado(!efetivado)} className={`w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${efetivado ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-stone-400 border-stone-200'}`}>
                    {efetivado ? <CheckCircle2 size={18} /> : <Clock size={18} />} {efetivado ? "Já foi Paga" : "Agendar"}
                  </button>
                </div>
              </div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none" placeholder="Ex: Conta de Luz" /></div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label><input type="number" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" placeholder="0.00" /></div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2">CATEGORIA</label>
                <select value={cat} onChange={e => setCat(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none">
                  <option value="">Selecione...</option><option value="Operacional">Operacional</option><option value="Administrativo">Administrativo</option><option value="Pessoal">Pessoal</option>
                </select>
              </div>
            </div>
            <button onClick={() => handleSalvarTransacao('expense')} disabled={saving} className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 hover:bg-red-600 transition">{saving ? <Loader2 className="animate-spin" /> : <Save />} Confirmar {efetivado ? "Saída" : "Agendamento"}</button>
          </div>
        </div>
      )}

      {modalReceitaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-green-600 flex items-center gap-2"><ArrowUpRight /> Nova Receita Extra</h2><button onClick={() => setModalReceitaAberto(false)}><X /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1"><Calendar size={12} /> DATA</label><input type="date" value={dataMovimentacao} onChange={e => setDataMovimentacao(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" /></div>
                <div className="flex items-end">
                  <button onClick={() => setEfetivado(!efetivado)} className={`w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${efetivado ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-stone-400 border-stone-200'}`}>
                    {efetivado ? <CheckCircle2 size={18} /> : <Clock size={18} />} {efetivado ? "Recebido" : "A Receber"}
                  </button>
                </div>
              </div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none" placeholder="Ex: Venda de Sucata" /></div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label><input type="number" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" placeholder="0.00" /></div>
            </div>
            <button onClick={() => handleSalvarTransacao('income')} disabled={saving} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 hover:bg-green-700 transition">{saving ? <Loader2 className="animate-spin" /> : <Save />} Confirmar {efetivado ? "Entrada" : "Agendamento"}</button>
          </div>
        </div>
      )}

      {modalEdicaoAberto && itemParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">Editar Lançamento</h2><button onClick={() => setModalEdicaoAberto(false)}><X /></button></div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1"><Calendar size={12} /> DATA</label><input type="date" value={editData} onChange={e => setEditData(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" /></div>
                <div className="flex items-end">
                  <button onClick={() => setEditEfetivado(!editEfetivado)} className={`w-full p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${editEfetivado ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-stone-400 border-stone-200'}`}>
                    {editEfetivado ? <CheckCircle2 size={18} /> : <Clock size={18} />} {editEfetivado ? "Pago/Recebido" : "Pendente"}
                  </button>
                </div>
              </div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label><input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium" /></div>
              <div><label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label><input type="number" value={editValor} onChange={e => setEditValor(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" /></div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2">CATEGORIA</label>
                <select value={editCat} onChange={e => setEditCat(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none">
                  <option value="Geral">Geral</option><option value="Operacional">Operacional</option><option value="Administrativo">Administrativo</option><option value="Pessoal">Pessoal</option><option value="Outras Receitas">Outras Receitas</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleDeleteTransacao} disabled={deleting} className="p-4 bg-red-100 text-red-500 rounded-2xl hover:bg-red-200 transition disabled:opacity-50">{deleting ? <Loader2 className="animate-spin" /> : <Trash2 size={24} />}</button>
              <button onClick={handleUpdateTransacao} disabled={saving} className="flex-1 bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl flex justify-center gap-2 hover:scale-105 transition">{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}