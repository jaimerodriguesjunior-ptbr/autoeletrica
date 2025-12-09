"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Wrench, 
  Users, 
  Package, 
  LogOut, 
  Menu, 
  X, 
  Wallet,
  Sparkles,
  Settings // <--- ADICIONE ESTE ÍCONE AQUI NA LISTA 
} from "lucide-react";
import { useAuth } from "../../src/contexts/AuthContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { signOut, user, profile, loading } = useAuth();

  const allMenuItems = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard", restricted: false },
    { name: "IA", icon: Sparkles, path: "/ia", restricted: true },
    { name: "OS", icon: Wrench, path: "/os", restricted: false },
    { name: "Clientes", icon: Users, path: "/clientes", restricted: false },
    // ALTERAÇÃO AQUI: Nome atualizado
    { name: "Estoque e Serviços", icon: Package, path: "/estoque", restricted: false },
    { name: "Caixa", icon: Wallet, path: "/financeiro", restricted: true },
  ];

  const isOwner = profile?.cargo === 'owner';
  
  const menuItems = allMenuItems.filter(item => {
    if (isOwner) return true;
    return !item.restricted;
  });

  if (loading) return <div className="min-h-screen bg-[#F8F7F2]"></div>;

  return (
    <div className="min-h-screen bg-[#F8F7F2] flex">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-white border-r border-stone-200
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        <div className="p-8 flex items-start justify-between"> 
          <div className="flex flex-col items-center w-full pr-6">
            <div className="w-32 h-32 mb-2 relative"> 
               <img src="/logo.svg" alt="NHT Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em] text-center">
              Centro Automotivo
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-stone-400 absolute right-4 top-8">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setSidebarOpen(false)}
              >
                <div className={`
                  flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-200
                  ${isActive 
                    ? "bg-[#1A1A1A] text-white shadow-lg shadow-stone-200 font-bold" 
                    : "text-stone-500 hover:bg-stone-50 font-medium"}
                `}>
                  <item.icon size={20} className={isActive ? "text-[#FACC15]" : ""} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

<div className="p-4 mt-auto border-t border-stone-100">
          
          {/* --- NOVO: BOTÃO DE CONFIGURAÇÕES (VISÍVEL APENAS PARA DONO) --- */}
          {isOwner && (
            <Link href="/configuracoes" onClick={() => setSidebarOpen(false)}>
              <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl text-stone-500 hover:bg-stone-50 font-medium transition-colors cursor-pointer hover:text-[#1A1A1A]">
                <Settings size={20} />
                <span>Configurações</span>
              </div>
            </Link>
          )}

          {/* PERFIL DO USUÁRIO */}
          <div className="bg-stone-50 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FACC15] text-[#1A1A1A] flex items-center justify-center font-bold text-sm">
              {user?.email?.substring(0, 2).toUpperCase() || "US"}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-[#1A1A1A] truncate">
                {profile?.nome || "Usuário"}
              </p>
              <p className="text-[10px] uppercase font-bold text-[#FACC15] tracking-wider">
                {profile?.cargo === 'owner' ? '👑 GERENTE' : '🔧 COLABORADOR'}
              </p>
            </div>
          </div>

          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 font-bold transition-colors"
          >
            <LogOut size={20} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 bg-[#F8F7F2]/95 backdrop-blur-md px-6 py-4 lg:hidden flex justify-between items-center">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-white rounded-xl shadow-sm border border-stone-200 text-[#1A1A1A]"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-[#1A1A1A]">AutoPro</span>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 lg:pb-24">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 p-2 z-50 lg:hidden flex justify-around items-center pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className="flex flex-col items-center gap-1 p-2 w-full"
            >
              <div className={`
                p-2 rounded-xl transition-all duration-200
                ${isActive ? "bg-[#1A1A1A] text-[#FACC15]" : "text-stone-400"}
              `}>
                <item.icon size={22} />
              </div>
              <span className={`text-[10px] font-bold ${isActive ? "text-[#1A1A1A]" : "text-stone-300"}`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>

    </div>
  );
}