"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../../src/contexts/AuthContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile
  const [isCollapsed, setIsCollapsed] = useState(false); // Desktop
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  const allMenuItems = [
    { name: "Dashboard", category: "Visão Geral", icon: LayoutDashboard, path: "/dashboard", restricted: false },

    { name: "Atendimento", category: "Atendimento", icon: Wrench, path: "/atendimento", restricted: false },
    { name: "Clientes", category: "Atendimento", icon: Users, path: "/clientes", restricted: false },

    { name: "Estoque e Serviços", category: "Gestão Corporativa", icon: Package, path: "/estoque", restricted: false },
    { name: "Caixa", category: "Gestão Corporativa", icon: Wallet, path: "/financeiro", restricted: true },
    { name: "Notas Fiscais", category: "Gestão Corporativa", icon: FileText, path: "/fiscal", restricted: true },

    { name: "IA", category: "Visão Geral", icon: Sparkles, path: "/ia", restricted: true },
  ];

  const isOwner = profile?.cargo === 'owner';
  const usa_fiscal = profile?.usa_fiscal !== false;
  const usa_caixa = profile?.usa_caixa !== false;

  const logoSrc = profile?.logo_url || '/logo.svg';

  // Filtra módulos e permissões
  const menuItems = allMenuItems.filter(item => {
    if (item.path === "/fiscal" && !usa_fiscal) return false;
    if (item.path === "/financeiro" && !usa_caixa) return false;
    if (isOwner) return true;
    return !item.restricted;
  });

  // Menu filtrado (apenas para a barra inferior mobile)
  const bottomMenuItems = menuItems.filter(item =>
    ["/atendimento", "/clientes", "/estoque"].includes(item.path)
  );

  if (loading || !user) return <div className="min-h-screen bg-[#E7E5E4]"></div>;

  return (
    <div className="min-h-screen bg-[#E7E5E4] flex">
      {/* OVERLAY MOBILE */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white/80 backdrop-blur-2xl border-r border-[#1A1A1A]/5 shadow-[8px_0_32px_rgba(0,0,0,0.03)]
          transform transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "w-24" : "w-[280px]"}
        `}
      >
        {/* HEADER DA SIDEBAR */}
        <div className={`
          p-6 flex items-start justify-between transition-all relative shrink-0
          ${isCollapsed ? 'mb-2' : ''}
        `}>
          <div className={`flex flex-col items-center transition-all duration-300 mx-auto ${isCollapsed ? 'w-full' : 'w-full'}`}>
            <div className={`
              flex items-center justify-center bg-gradient-to-br from-black via-[#1A1A1A] to-stone-600 rounded-2xl shadow-xl border border-white/10 overflow-hidden
              transition-all duration-300
              ${isCollapsed ? 'w-12 h-12 mb-0 p-2.5' : 'w-full aspect-[5/3] max-h-36 mb-4 p-3'}
            `}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt={profile?.nome_fantasia || "Logo"}
                className="w-full h-full object-contain filter drop-shadow-md"
                onError={(e) => { e.currentTarget.src = '/logo.svg'; }}
              />
            </div>
            {!isCollapsed && (
              <span className="text-[11px] font-extrabold text-[#1A1A1A]/60 uppercase tracking-[0.2em] text-center animate-in fade-in duration-500">
                {profile?.nome_fantasia || "Centro Automotivo"}
              </span>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-stone-400 hover:bg-black/5 rounded-full absolute right-4 top-6 transition">
            <X size={20} />
          </button>
        </div>

        {/* NAVEGAÇÃO */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-6 px-4">
          <nav className="space-y-1.5 flex flex-col items-center lg:items-stretch">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center relative py-3 rounded-2xl transition-all duration-300
                    ${isCollapsed ? 'justify-center w-12 h-12 px-0 mx-auto' : 'px-4 gap-3'}
                    ${isActive
                      ? "bg-[#1A1A1A] text-white shadow-xl shadow-[#1A1A1A]/20 font-bold translate-x-1 lg:translate-x-0 lg:scale-[1.02]"
                      : "text-stone-500 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] font-medium"
                    }
                  `}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon size={20} className={`transition-transform duration-300 ${isActive ? "text-[#FACC15]" : "group-hover:scale-110"}`} />
                  {!isCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* FOOTER DA SIDEBAR */}
        <div className="p-4 mt-auto border-t border-[#1A1A1A]/5 bg-white/50 backdrop-blur-md shrink-0">

          {/* BOTÃO COLAPSAR DESKTOP */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              hidden lg:flex items-center py-2 mb-4 text-[#1A1A1A]/40 hover:text-[#1A1A1A] transition-colors w-full
              ${isCollapsed ? 'justify-center' : 'justify-end pr-2'}
            `}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>

          {/* CONFIGURAÇÕES */}
          {isOwner && (
            <Link href="/configuracoes" onClick={() => setSidebarOpen(false)} title={isCollapsed ? "Configurações" : undefined}>
              <div className={`
                flex items-center gap-3 py-3 mb-4 rounded-2xl text-stone-500 hover:bg-[#1A1A1A]/5 hover:text-[#1A1A1A] font-medium transition-all cursor-pointer
                ${isCollapsed ? 'justify-center px-0 w-12 h-12 mx-auto' : 'px-4'}
              `}>
                <Settings size={20} />
                {!isCollapsed && <span>Configurações</span>}
              </div>
            </Link>
          )}

          {/* PERFIL DO USUÁRIO */}
          <div className={`
            bg-white rounded-2xl p-2.5 mb-2 flex items-center shadow-sm border border-stone-100 transition-all
            ${isCollapsed ? 'justify-center bg-transparent border-transparent shadow-none' : 'gap-3'}
          `}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A1A1A] to-[#3A3A3A] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
              {user?.email?.substring(0, 2).toUpperCase() || "US"}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-bold text-[#1A1A1A] truncate">
                  {profile?.nome || "Usuário"}
                </p>
                <p className="text-[10px] uppercase font-bold text-[#FACC15] tracking-widest drop-shadow-sm">
                  {profile?.cargo === 'owner' ? '👑 GERENTE' : '🔧 COLABORADOR'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={signOut}
            title={isCollapsed ? "Sair do Sistema" : undefined}
            className={`
              w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl text-red-500 hover:bg-red-50 hover:shadow-sm font-bold transition-all
              ${isCollapsed ? 'px-0 w-12 h-12 mx-auto' : 'px-4'}
            `}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 bg-[#F8F7F2]/95 backdrop-blur-md px-6 py-4 lg:hidden flex justify-between items-center shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 bg-white rounded-xl shadow-sm border border-stone-200 text-[#1A1A1A] hover:bg-stone-50 transition"
          >
            <Menu size={24} />
          </button>
          <span className="font-extrabold text-[#1A1A1A] tracking-wider uppercase text-sm">Oficina Pro</span>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 lg:pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </main>

      {/* MENU INFERIOR (Mobile) */}
      <nav
        className={`
          fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-stone-100 p-2 z-50 lg:hidden 
          justify-around items-center pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.06)]
          ${sidebarOpen ? "hidden" : "flex"} 
        `}
      >
        {bottomMenuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex flex-col items-center gap-1.5 p-2 w-full"
            >
              <div className={`
                p-2.5 rounded-2xl transition-all duration-300
                ${isActive ? "bg-[#1A1A1A] text-[#FACC15] shadow-lg -translate-y-1" : "text-stone-400 hover:bg-stone-50"}
              `}>
                <item.icon size={22} className={isActive ? "scale-110 transition-transform" : ""} />
              </div>
              <span className={`text-[10px] font-bold transition-colors ${isActive ? "text-[#1A1A1A]" : "text-stone-400"}`}>
                {item.name === "Estoque e Serviços" ? "Estoque e Serviços" : item.name}
              </span>
            </Link>
          )
        })}
      </nav>

    </div>
  );
}