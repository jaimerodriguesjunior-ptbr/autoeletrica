"use client";

import { useState, useEffect } from "react";
import { 
  ArrowUpRight, ArrowDownRight, Wallet, 
  Wrench, ShoppingCart, Zap, X, Save, Loader2, Trash2, Calendar
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
};

export default function Financeiro() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth();

  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);
  const [resumo, setResumo] = useState({ receita: 0, despesa: 0, lucro: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Estados de UI (Modais)
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [modalReceitaAberto, setModalReceitaAberto] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);

  // Estados dos Formulários
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState("");
  // NOVO: Estado para data (inicia com hoje)
  const [dataMovimentacao, setDataMovimentacao] = useState(new Date().toISOString().split('T')[0]);

  // Estados de Edição
  const [itemParaEditar, setItemParaEditar] = useState<ExtratoItem | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editData, setEditData] = useState(""); // NOVO

  useEffect(() => {
    if (authLoading) return;
    if (profile?.organization_id) {
      fetchFinanceiro();
    } else {
      setLoading(false);
    }
  }, [profile, authLoading]);

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

      // 2. Receitas de OS (Status Entregue)
      const { data: osData, error: errOS } = await supabase
        .from('work_orders')
        .select('id, total, updated_at, clients(nome)')
        .eq('organization_id', profile?.organization_id)
        .eq('status', 'entregue');

      if (errOS) throw errOS;

      // 3. Unificar
      const listaTransacoes: ExtratoItem[] = (transacoes || []).map((t: Transaction) => ({
        id: t.id,
        descricao: t.description,
        valor: Number(t.amount),
        tipo: t.type === 'income' ? 'entrada' : 'saida',
        data: t.date,
        icone: t.type === 'income' ? ArrowUpRight : ShoppingCart,
        categoria: t.category || 'Geral',
        origem: 'manual'
      }));

      const listaOS: ExtratoItem[] = (osData || []).map((os: any) => ({
        id: `os-${os.id}`,
        descricao: `OS #${os.id} - ${os.clients?.nome || 'Cliente'}`,
        valor: Number(os.total),
        tipo: 'entrada',
        data: os.updated_at ? os.updated_at.split('T')[0] : new Date().toISOString(),
        icone: Wrench,
        categoria: 'Serviços',
        origem: 'os'
      }));

      const tudo = [...listaTransacoes, ...listaOS].sort((a, b) => 
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );

      setExtrato(tudo);

      // 4. Totais
      const rec = tudo.filter(i => i.tipo === 'entrada').reduce((acc, i) => acc + i.valor, 0);
      const desp = tudo.filter(i => i.tipo === 'saida').reduce((acc, i) => acc + i.valor, 0);
      
      setResumo({ receita: rec, despesa: desp, lucro: rec - desp });

    } catch (error) {
      console.error("Erro Financeiro:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalDespesa = () => {
    setDesc("");
    setValor("");
    setCat("");
    setDataMovimentacao(new Date().toISOString().split('T')[0]); // Reseta para hoje
    setModalDespesaAberto(true);
  };

  const abrirModalReceita = () => {
    setDesc("");
    setValor("");
    setCat("");
    setDataMovimentacao(new Date().toISOString().split('T')[0]); // Reseta para hoje
    setModalReceitaAberto(true);
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
        date: dataMovimentacao, // USA A DATA SELECIONADA
        status: 'paid'
      });

      if (error) throw error;

      setModalDespesaAberto(false);
      setModalReceitaAberto(false);
      fetchFinanceiro();

    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- FUNÇÕES DE EDIÇÃO ---

  const abrirModalEdicao = (item: ExtratoItem) => {
    if (item.origem === 'os') {
      alert("Este lançamento vem de uma Ordem de Serviço.\nPara alterar o valor, edite a OS correspondente.");
      return;
    }
    setItemParaEditar(item);
    setEditDesc(item.descricao);
    setEditValor(item.valor.toString());
    setEditCat(item.categoria);
    setEditData(item.data); // Preenche a data existente
    setModalEdicaoAberto(true);
  };

  const handleUpdateTransacao = async () => {
    if (!itemParaEditar || !editDesc || !editValor || !editData) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          description: editDesc,
          amount: Number(editValor),
          category: editCat,
          date: editData // Atualiza a data
        })
        .eq('id', itemParaEditar.id);

      if (error) throw error;

      setModalEdicaoAberto(false);
      fetchFinanceiro();
    } catch (error: any) {
      alert("Erro ao atualizar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransacao = async () => {
    if (!itemParaEditar) return;
    if (!confirm("Tem certeza que deseja apagar este lançamento?")) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', itemParaEditar.id);

      if (error) throw error;

      setModalEdicaoAberto(false);
      fetchFinanceiro();
    } catch (error: any) {
      alert("Erro ao excluir: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Financeiro</h1>
          <p className="text-stone-500 text-sm mt-1">Fluxo de caixa consolidado</p>
        </div>
      </div>

      {/* BENTO GRID (Resumo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 text-green-700 rounded-xl"><ArrowUpRight size={20}/></div>
              <span className="text-xs font-bold text-stone-400 uppercase">Receita Total</span>
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">{loading ? "..." : formatMoney(resumo.receita)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ArrowDownRight size={20}/></div>
              <span className="text-xs font-bold text-stone-400 uppercase">Despesas</span>
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">{loading ? "..." : formatMoney(resumo.despesa)}</h3>
          </div>
        </div>

        <div className="bg-[#1A1A1A] p-6 rounded-[32px] shadow-lg relative overflow-hidden text-white">
          <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-xl text-[#FACC15]"><Wallet size={20}/></div>
              <span className="text-xs font-bold text-white/50 uppercase">Lucro Líquido</span>
            </div>
            <h3 className="text-4xl font-bold text-[#FACC15]">{loading ? "..." : formatMoney(resumo.lucro)}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Extrato</h3>
            <span className="text-xs text-stone-400 italic">Toque no item para editar</span>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
               <div className="text-center py-10 text-stone-400 flex flex-col items-center">
                 <Loader2 className="animate-spin mb-2" /> Carregando...
               </div>
            ) : extrato.length === 0 ? (
               <p className="text-center py-10 text-stone-400">Nenhuma movimentação registrada.</p>
            ) : (
              extrato.map((item) => (
                <button 
                  key={item.id} 
                  onClick={() => abrirModalEdicao(item)}
                  className="w-full flex items-center justify-between p-4 bg-[#F8F7F2] rounded-2xl hover:bg-stone-200 transition text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <item.icone size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1A1A1A] text-sm group-hover:underline decoration-stone-400">{item.descricao}</p>
                      <p className="text-xs text-stone-400">{item.categoria} • {new Date(item.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} {item.origem === 'os' && <span className="ml-2 bg-stone-200 px-1 rounded text-[10px]">OS</span>}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${item.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
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
                  <ArrowUpRight size={20}/> Entrada Avulsa
               </button>
               <button onClick={abrirModalDespesa} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2">
                  <ArrowDownRight size={20}/> Registrar Despesa
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* MODAL NOVA DESPESA */}
      {modalDespesaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-500 flex items-center gap-2"><ArrowDownRight /> Nova Despesa</h2>
              <button onClick={() => setModalDespesaAberto(false)}><X /></button>
            </div>
            <div className="space-y-4">
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Calendar size={12}/> DATA
                </label>
                <input 
                    type="date" 
                    value={dataMovimentacao} 
                    onChange={e=>setDataMovimentacao(e.target.value)} 
                    className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" 
                />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label>
                <input type="text" value={desc} onChange={e=>setDesc(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none" placeholder="Ex: Conta de Luz" />
               </div>
               <div>
                 <label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label>
                <input type="number" value={valor} onChange={e=>setValor(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" placeholder="0.00" />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">CATEGORIA</label>
                <select value={cat} onChange={e=>setCat(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none">
                    <option value="">Selecione...</option>
                    <option value="Operacional">Operacional</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Pessoal">Pessoal</option>
                </select>
               </div>
            </div>
            <button onClick={() => handleSalvarTransacao('expense')} disabled={saving} className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
              {saving ? <Loader2 className="animate-spin"/> : <Save />} Confirmar Saída
            </button>
          </div>
        </div>
      )}

      {/* MODAL NOVA RECEITA */}
      {modalReceitaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
             <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2"><ArrowUpRight /> Nova Receita Extra</h2>
              <button onClick={() => setModalReceitaAberto(false)}><X /></button>
            </div>
             <div className="space-y-4">
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Calendar size={12}/> DATA
                </label>
                <input 
                    type="date" 
                    value={dataMovimentacao} 
                    onChange={e=>setDataMovimentacao(e.target.value)} 
                    className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" 
                />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label>
                <input type="text" value={desc} onChange={e=>setDesc(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none" placeholder="Ex: Venda de Sucata" />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label>
                <input type="number" value={valor} onChange={e=>setValor(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" placeholder="0.00" />
               </div>
            </div>
            <button onClick={() => handleSalvarTransacao('income')} disabled={saving} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
              {saving ? <Loader2 className="animate-spin"/> : <Save />} Confirmar Entrada
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {modalEdicaoAberto && itemParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                Editar Lançamento
              </h2>
              <button onClick={() => setModalEdicaoAberto(false)}><X /></button>
            </div>

            <div className="space-y-4">
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2 flex items-center gap-1">
                    <Calendar size={12}/> DATA
                </label>
                <input 
                    type="date" 
                    value={editData} 
                    onChange={e=>setEditData(e.target.value)} 
                    className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-bold text-[#1A1A1A]" 
                />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label>
                <input 
                  type="text" 
                  value={editDesc} 
                  onChange={e=>setEditDesc(e.target.value)} 
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none font-medium" 
                />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label>
                <input 
                  type="number" 
                  value={editValor} 
                  onChange={e=>setEditValor(e.target.value)} 
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold outline-none" 
                />
               </div>
               <div>
                <label className="text-xs font-bold text-stone-400 ml-2">CATEGORIA</label>
                <select value={editCat} onChange={e=>setEditCat(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 outline-none">
                    <option value="Geral">Geral</option>
                    <option value="Operacional">Operacional</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Pessoal">Pessoal</option>
                    <option value="Outras Receitas">Outras Receitas</option>
                </select>
               </div>
            </div>

            <div className="flex gap-3 pt-2">
               <button 
                onClick={handleDeleteTransacao} 
                disabled={deleting}
                className="p-4 bg-red-100 text-red-500 rounded-2xl hover:bg-red-200 transition disabled:opacity-50"
               >
                {deleting ? <Loader2 className="animate-spin"/> : <Trash2 size={24} />}
              </button>
              
               <button 
                onClick={handleUpdateTransacao} 
                disabled={saving} 
                className="flex-1 bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl flex justify-center gap-2 hover:scale-105 transition"
              >
                {saving ? <Loader2 className="animate-spin"/> : <Save />} Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}