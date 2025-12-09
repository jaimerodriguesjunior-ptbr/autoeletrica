"use client";

import { useState, useEffect } from "react";
import { 
  ArrowUpRight, ArrowDownRight, Wallet, 
  Wrench, ShoppingCart, Zap, AlertCircle, X, Save, Loader2
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
};

export default function Financeiro() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth(); // Importante: pegar authLoading

  const [extrato, setExtrato] = useState<ExtratoItem[]>([]);
  const [resumo, setResumo] = useState({ receita: 0, despesa: 0, lucro: 0 });
  
  // CORREÇÃO: O loading da página só começa true se o auth já não tiver terminado
  const [loading, setLoading] = useState(true);

  // Estados de UI
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [modalReceitaAberto, setModalReceitaAberto] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados dos Formulários
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    // Se o Auth ainda está carregando, esperamos.
    if (authLoading) return;

    // Se o Auth terminou e temos perfil com org, buscamos dados.
    if (profile?.organization_id) {
      fetchFinanceiro();
    } else {
      // Se o Auth terminou mas não tem perfil/org, paramos o loading da tela.
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
        categoria: t.category || 'Geral'
      }));

      const listaOS: ExtratoItem[] = (osData || []).map((os: any) => ({
        id: `os-${os.id}`,
        descricao: `OS #${os.id} - ${os.clients?.nome || 'Cliente'}`,
        valor: Number(os.total),
        tipo: 'entrada',
        data: os.updated_at ? os.updated_at.split('T')[0] : new Date().toISOString(),
        icone: Wrench,
        categoria: 'Serviços'
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

  const handleSalvarTransacao = async (tipo: 'income' | 'expense') => {
    if (!desc || !valor) return alert("Preencha os campos!");
    setSaving(true);

    try {
      const { error } = await supabase.from('transactions').insert({
        organization_id: profile?.organization_id,
        description: desc,
        amount: Number(valor),
        type: tipo,
        category: cat || (tipo === 'income' ? 'Outras Receitas' : 'Operacional'),
        date: new Date().toISOString().split('T')[0],
        status: 'paid'
      });

      if (error) throw error;

      alert("Salvo!");
      setModalDespesaAberto(false);
      setModalReceitaAberto(false);
      setDesc(""); setValor(""); setCat("");
      fetchFinanceiro();

    } catch (error: any) {
      alert("Erro: " + error.message);
    } finally {
      setSaving(false);
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
                <div key={item.id} className="flex items-center justify-between p-4 bg-[#F8F7F2] rounded-2xl hover:bg-stone-100 transition">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.tipo === 'entrada' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <item.icone size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-[#1A1A1A] text-sm">{item.descricao}</p>
                      <p className="text-xs text-stone-400">{item.categoria} • {new Date(item.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${item.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                    {item.tipo === 'entrada' ? '+' : '-'} {formatMoney(item.valor)}
                  </span>
                </div>
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
               <button onClick={() => setModalReceitaAberto(true)} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2">
                  <ArrowUpRight size={20}/> Entrada Avulsa
               </button>
               <button onClick={() => setModalDespesaAberto(true)} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2">
                  <ArrowDownRight size={20}/> Registrar Despesa
               </button>
             </div>
          </div>
        </div>
      </div>

      {modalDespesaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-500 flex items-center gap-2"><ArrowDownRight /> Nova Despesa</h2>
              <button onClick={() => setModalDespesaAberto(false)}><X /></button>
            </div>
            <div className="space-y-4">
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

      {modalReceitaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2"><ArrowUpRight /> Nova Receita Extra</h2>
              <button onClick={() => setModalReceitaAberto(false)}><X /></button>
            </div>
            <div className="space-y-4">
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
    </div>
  );
}