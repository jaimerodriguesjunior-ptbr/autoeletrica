"use client";

import { useState } from "react";
// CORREÇÃO: Adicionei Wrench, ShoppingCart, Zap, etc na lista de imports
import { 
  DollarSign, TrendingUp, TrendingDown, Calendar, 
  ArrowUpRight, ArrowDownRight, Wallet, PieChart, MoreHorizontal,
  Wrench, ShoppingCart, Zap, AlertCircle, Plus, X, Tag, CreditCard, Save
} from "lucide-react";

export default function Financeiro() {
  const mesAtual = "Novembro 2023";

  // ESTADOS DOS MODAIS
  const [modalDespesaAberto, setModalDespesaAberto] = useState(false);
  const [modalReceitaAberto, setModalReceitaAberto] = useState(false);

  // ESTADOS DE FORMULÁRIO (Simplificados para o Mockup)
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");

  const handleSalvar = () => {
    // Aqui viria a lógica do Supabase
    alert("Lançamento salvo com sucesso!");
    setModalDespesaAberto(false);
    setModalReceitaAberto(false);
    setValor("");
    setDescricao("");
  };

  return (
    <div className="space-y-6 pb-32">
      
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Financeiro</h1>
          <p className="text-stone-500 text-sm mt-1">Fluxo de caixa e DRE Gerencial</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-full border border-stone-200 shadow-sm">
          <button className="px-4 py-2 rounded-full bg-[#1A1A1A] text-[#FACC15] text-xs font-bold shadow-md">Este Mês</button>
          <button className="px-4 py-2 rounded-full text-stone-500 text-xs font-bold hover:bg-stone-50 transition">Mês Passado</button>
          <button className="px-4 py-2 rounded-full text-stone-500 text-xs font-bold hover:bg-stone-50 transition">Personalizar</button>
        </div>
      </div>

      {/* 2. OS TRÊS GRANDES NÚMEROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Receita */}
        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-[60px] -z-0 transition group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-green-100 text-green-700 rounded-xl"><ArrowUpRight size={20}/></div>
              <span className="text-xs font-bold text-stone-400 uppercase">Receita Bruta</span>
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">R$ 28.450</h3>
            <p className="text-xs text-green-600 mt-1 font-bold">+12% vs. mês anterior</p>
          </div>
        </div>

        {/* Despesas */}
        <div className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-[60px] -z-0 transition group-hover:scale-110"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-100 text-red-700 rounded-xl"><ArrowDownRight size={20}/></div>
              <span className="text-xs font-bold text-stone-400 uppercase">Despesas Totais</span>
            </div>
            <h3 className="text-3xl font-bold text-[#1A1A1A]">R$ 12.100</h3>
            <p className="text-xs text-stone-400 mt-1">Inclui compras e custos fixos</p>
          </div>
        </div>

        {/* Lucro Real */}
        <div className="bg-[#1A1A1A] p-6 rounded-[32px] shadow-lg relative overflow-hidden text-white">
          <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-[#FACC15] rounded-full blur-[60px] opacity-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-xl text-[#FACC15]"><Wallet size={20}/></div>
              <span className="text-xs font-bold text-white/50 uppercase">Lucro Líquido Real</span>
            </div>
            <h3 className="text-4xl font-bold text-[#FACC15]">R$ 16.350</h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="bg-[#FACC15] text-[#1A1A1A] text-[10px] font-bold px-2 py-0.5 rounded-md">57% Margem</span>
              <p className="text-[10px] text-white/50">Disponível em caixa</p>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 3. EXTRATO DE MOVIMENTAÇÕES */}
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Últimas Movimentações</h3>
            <button className="text-sm font-bold text-[#FACC15] hover:text-yellow-600">Ver extrato completo</button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#F8F7F2] rounded-2xl hover:bg-stone-100 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <Wrench size={18} />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-sm">Recebimento OS #1054</p>
                  <p className="text-xs text-stone-400">Cliente: João da Silva • Pix</p>
                </div>
              </div>
              <span className="font-bold text-green-600">+ R$ 450,00</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F8F7F2] rounded-2xl hover:bg-stone-100 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-sm">Compra de Peças (Distribuidora X)</p>
                  <p className="text-xs text-stone-400">Estoque • Boleto</p>
                </div>
              </div>
              <span className="font-bold text-red-500">- R$ 1.200,00</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#F8F7F2] rounded-2xl hover:bg-stone-100 transition">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Zap size={18} />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-sm">Conta de Luz (Celesc)</p>
                  <p className="text-xs text-stone-400">Administrativo • Débito</p>
                </div>
              </div>
              <span className="font-bold text-red-500">- R$ 350,00</span>
            </div>
          </div>
        </div>

        {/* 4. CONTAS A PAGAR / RECEBER */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm relative">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-stone-500 text-xs uppercase flex items-center gap-2">
                <Calendar size={14} /> A Receber (Hoje)
              </h4>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full">2 pendentes</span>
            </div>
            <p className="text-2xl font-bold text-[#1A1A1A]">R$ 850,00</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs p-2 bg-[#F8F7F2] rounded-lg">
                <span className="text-stone-600">Maria (OS #1020)</span>
                <span className="font-bold">R$ 300,00</span>
              </div>
              <div className="flex justify-between text-xs p-2 bg-[#F8F7F2] rounded-lg">
                <span className="text-stone-600">Pedro (OS #1025)</span>
                <span className="font-bold">R$ 550,00</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm">
             <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-stone-500 text-xs uppercase flex items-center gap-2">
                <AlertCircle size={14} className="text-red-500" /> A Pagar (Hoje)
              </h4>
            </div>
            <p className="text-2xl font-bold text-[#1A1A1A]">R$ 1.500,00</p>
            <button className="w-full mt-4 py-3 bg-stone-50 text-stone-500 font-bold text-xs rounded-xl hover:bg-[#1A1A1A] hover:text-white transition">
              Ver contas a pagar
            </button>
          </div>
        </div>
      </div>

      {/* 5. AÇÕES RÁPIDAS */}
      <div className="fixed bottom-24 md:bottom-6 right-6 left-6 md:left-auto md:w-auto flex gap-3 z-40 justify-end">
        <button 
          onClick={() => setModalDespesaAberto(true)}
          className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-full shadow-lg shadow-red-200 flex items-center gap-2 transition hover:scale-105"
        >
          <ArrowDownRight size={20} /> Pagar Conta
        </button>
        <button 
          onClick={() => setModalReceitaAberto(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-full shadow-lg shadow-green-200 flex items-center gap-2 transition hover:scale-105"
        >
          <ArrowUpRight size={20} /> Nova Receita
        </button>
      </div>


      {/* ================= MODAL DE DESPESA ================= */}
      {modalDespesaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                <ArrowDownRight size={24} /> Nova Despesa
              </h2>
              <button onClick={() => setModalDespesaAberto(false)} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label>
                <input type="text" autoFocus placeholder="Ex: Conta de Luz, Almoço..." className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-red-500" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label>
                <input type="number" placeholder="0,00" className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">CATEGORIA</label>
                  <select className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none appearance-none">
                    <option>Operacional</option>
                    <option>Administrativo</option>
                    <option>Pessoal (Sangria)</option>
                    <option>Impostos</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-400 ml-2">VENCIMENTO</label>
                  <input type="date" className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none" />
                </div>
              </div>

              <div className="flex gap-2 p-2 bg-[#F8F7F2] rounded-2xl">
                <button className="flex-1 py-2 bg-white rounded-xl shadow-sm text-xs font-bold text-[#1A1A1A] border border-stone-200">Pago Agora</button>
                <button className="flex-1 py-2 text-xs font-bold text-stone-400 hover:text-[#1A1A1A]">Agendar</button>
              </div>
            </div>

            <button onClick={handleSalvar} className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-200 hover:bg-red-600 transition flex items-center justify-center gap-2">
              <Save size={20} /> Confirmar Saída
            </button>
          </div>
        </div>
      )}


      {/* ================= MODAL DE RECEITA ================= */}
      {modalReceitaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2">
                <ArrowUpRight size={24} /> Nova Receita Extra
              </h2>
              <button onClick={() => setModalReceitaAberto(false)} className="p-2 bg-stone-100 rounded-full hover:bg-stone-200"><X size={20} /></button>
            </div>

            <div className="p-4 bg-green-50 rounded-2xl text-xs text-green-800 mb-4 border border-green-100 flex gap-2">
              <AlertCircle size={16} />
              <p>Use apenas para entradas fora das Ordens de Serviço (ex: venda de sucata, aporte).</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">DESCRIÇÃO</label>
                <input type="text" autoFocus placeholder="Ex: Venda de Sucata de Bateria" className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">VALOR (R$)</label>
                <input type="number" placeholder="0,00" className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-2xl font-bold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">ORIGEM</label>
                <select className="w-full bg-[#F8F7F2] rounded-2xl p-4 text-[#1A1A1A] outline-none appearance-none">
                  <option>Venda de Balcão</option>
                  <option>Aporte de Capital (Dono)</option>
                  <option>Outras Receitas</option>
                </select>
              </div>
            </div>

            <button onClick={handleSalvar} className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-200 hover:bg-green-700 transition flex items-center justify-center gap-2">
              <Save size={20} /> Confirmar Entrada
            </button>
          </div>
        </div>
      )}

    </div>
  );
}