"use client";

import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Wrench, 
  AlertCircle, 
  Calendar, 
  MoreHorizontal,
  ArrowUpRight,
  CheckCircle,
  Car
} from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("Usuário");

  // Verifica quem está logado ao carregar a tela
  useEffect(() => {
    const savedRole = localStorage.getItem("userRole");
    const savedName = localStorage.getItem("userName");
    setRole(savedRole || "employee"); // Por segurança, padrão é funcionário
    setUserName(savedName || "Colaborador");
  }, []);

  // Evita piscar a tela enquanto carrega
  if (!role) return null;

  return (
    <div className="space-y-6">
      
      {/* 1. CABEÇALHO (Boas Vindas Personalizada) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">
            Olá, <span className="text-stone-400">{userName.split(' ')[0]}</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {role === 'admin' ? 'Resumo financeiro e operacional.' : 'Bom trabalho hoje!'}
          </p>
        </div>
        
        <div className="flex gap-2">
          {role === 'admin' && (
            <button className="bg-white hover:bg-stone-50 text-[#1A1A1A] px-6 py-3 rounded-full font-bold text-sm shadow-sm transition">
              Ver Relatórios
            </button>
          )}
          <Link href="/os/nova">
            <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition">
              <Wrench size={18} /> Nova OS
            </button>
          </Link>
        </div>
      </div>

      {/* 2. BENTO GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* BLOCO A (O CAMALEÃO): Muda conforme o cargo */}
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 shadow-sm border border-stone-100 relative overflow-hidden">
          
          {role === 'admin' ? (
            // === VISÃO DO DONO (DINHEIRO) ===
            <>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-stone-500 text-sm font-medium mb-1">Faturamento Mensal</p>
                  <h2 className="text-4xl font-bold text-[#1A1A1A]">R$ 12.450,00</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <TrendingUp size={12} /> +15%
                    </span>
                    <span className="text-stone-400 text-xs">vs. mês passado</span>
                  </div>
                </div>
                <button className="p-2 hover:bg-stone-50 rounded-full transition text-stone-400">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              {/* Gráfico Decorativo */}
              <div className="mt-8 flex items-end gap-3 h-24 opacity-80">
                {[40, 65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t-xl transition-all hover:opacity-80 ${i === 5 ? 'bg-[#FACC15]' : 'bg-stone-100'}`} style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </>
          ) : (
            // === VISÃO DO FUNCIONÁRIO (PRODUTIVIDADE) ===
            <>
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-stone-500 text-sm font-medium mb-1">Minha Produtividade</p>
                  <h2 className="text-4xl font-bold text-[#1A1A1A]">12 Veículos</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle size={12} /> Finalizados este mês
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-full text-stone-400">
                  <Car size={24} />
                </div>
              </div>
              {/* Barra de Metas Decorativa */}
              <div className="mt-10">
                <div className="flex justify-between text-xs font-bold text-stone-400 mb-2">
                  <span>Meta Mensal</span>
                  <span>80%</span>
                </div>
                <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[80%] rounded-full"></div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* BLOCO B: Status Rápido (Igual para todos ou levemente adaptado) */}
        <div className="space-y-6">
          
          <div className="bg-[#1A1A1A] rounded-[32px] p-6 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-[-50%] right-[-20%] w-32 h-32 bg-[#FACC15] rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition"></div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/10 rounded-2xl w-fit">
                <Wrench className="text-[#FACC15]" size={24} />
              </div>
              <ArrowUpRight className="text-stone-500" />
            </div>
            <h3 className="text-3xl font-bold">8 Veículos</h3>
            <p className="text-stone-400 text-sm">Fila de espera agora</p>
          </div>

          <div className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-stone-500 text-xs font-bold uppercase tracking-wider">Prioridade</p>
              <p className="text-2xl font-bold text-red-500 mt-1">2 Carros</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full text-red-500">
              <AlertCircle size={24} />
            </div>
          </div>

        </div>

        {/* BLOCO C: Agenda (Igual para todos) */}
        <div className="bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Entregas Hoje</h3>
            <Calendar size={18} className="text-stone-400" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 hover:bg-[#F8F7F2] rounded-2xl transition cursor-pointer group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xs group-hover:bg-white group-hover:shadow-sm transition">14:00</div>
              <div><p className="font-bold text-[#1A1A1A] text-sm">Honda Civic (João)</p><p className="text-xs text-stone-500">Troca de Alternador</p></div>
              <div className="ml-auto w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-center gap-4 p-3 hover:bg-[#F8F7F2] rounded-2xl transition cursor-pointer group">
               <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-bold text-xs group-hover:bg-white group-hover:shadow-sm transition">16:30</div>
              <div><p className="font-bold text-[#1A1A1A] text-sm">Fiat Strada (Empresa X)</p><p className="text-xs text-stone-500">Revisão Elétrica</p></div>
              <div className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></div>
            </div>
          </div>
          
          <button className="w-full mt-6 py-3 text-sm font-bold text-stone-400 hover:text-[#1A1A1A] transition border-t border-stone-100">Ver agenda completa</button>
        </div>

        {/* BLOCO D: Lista Recente */}
        <div className="md:col-span-2 bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm">
           <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Últimas Ordens de Serviço</h3>
            <button className="text-sm font-bold text-[#FACC15] hover:text-yellow-600">Ver todas</button>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-stone-400 text-xs border-b border-stone-100">
                <th className="py-3 font-medium">Veículo</th>
                <th className="py-3 font-medium">Cliente</th>
                <th className="py-3 font-medium">Status</th>
                {/* Oculta Valor se for funcionário */}
                {role === 'admin' && <th className="py-3 font-medium text-right">Valor</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-stone-50 last:border-0 hover:bg-[#F8F7F2] transition">
                <td className="py-4 font-bold text-[#1A1A1A]">Gol G5 Prata</td>
                <td className="py-4 text-stone-500">Maria Silva</td>
                <td className="py-4"><span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Em Serviço</span></td>
                {role === 'admin' && <td className="py-4 text-right font-bold text-[#1A1A1A]">R$ 450,00</td>}
              </tr>
              <tr className="border-b border-stone-50 last:border-0 hover:bg-[#F8F7F2] transition">
                <td className="py-4 font-bold text-[#1A1A1A]">S-10 Executive</td>
                <td className="py-4 text-stone-500">Agropecuária Boi Gordo</td>
                <td className="py-4"><span className="bg-stone-100 text-stone-500 px-3 py-1 rounded-full text-xs font-bold">Aguardando Peça</span></td>
                {role === 'admin' && <td className="py-4 text-right font-bold text-[#1A1A1A]">R$ 1.200,00</td>}
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}