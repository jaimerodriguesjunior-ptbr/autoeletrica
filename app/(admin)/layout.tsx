"use client";

import { useEffect, useState } from "react";
// Usamos botões nativos e tags <img> para evitar erros no ambiente de preview
import { 
  Wrench, Users, LayoutDashboard, Package, FileText, LogOut, 
  ChevronLeft, ChevronRight, Sparkles 
} from "lucide-react";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [role, setRole] = useState("admin");
  const [userName, setUserName] = useState("Usuário");
  const [collapsed, setCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Recupera dados
      const savedRole = localStorage.getItem("userRole");
      const savedName = localStorage.getItem("userName");

      // 2. Validação de Segurança para o Cargo
      // Se o cargo salvo for válido, usa ele. Se for inválido/vazio, força "owner" para não sumir o menu.
      if (savedRole && ["admin", "employee", "owner"].includes(savedRole)) {
        setRole(savedRole);
      } else {
        console.warn("Cargo inválido ou não encontrado no storage. Assumindo 'owner'.", savedRole);
        setRole("owner"); // Fallback seguro
      }

      if (savedName && savedName !== "undefined") {
        setUserName(savedName);
      }
      
      setCurrentPath(window.location.pathname);
    }
  }, []);

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ["admin", "employee", "owner"] },
    { name: "Assistente IA", icon: Sparkles, href: "/ia", roles: ["admin", "owner"] },
    { name: "Serviços (OS)", icon: Wrench, href: "/os", roles: ["admin", "employee", "owner"] },
    { name: "Clientes", icon: Users, href: "/clientes", roles: ["admin", "employee", "owner"] },
    { name: "Estoque", icon: Package, href: "/estoque", roles: ["admin", "employee", "owner"] },
    { name: "Financeiro", icon: FileText, href: "/financeiro", roles: ["admin", "owner"] },
  ];

  const handleNavigation = (href: string) => {
    window.location.href = href;
  };

  return (
    <div className="flex h-screen flex-col md:flex-row overflow-hidden bg-[linear-gradient(to_bottom_right,#F0EFEA,#E3DFC8)] relative">
      
      {/* GLOW DE FUNDO */}
      <div className="hidden md:block fixed top-[-20%] left-[-10%] w-[500px] h-[800px] bg-yellow-400/20 rounded-full blur-[150px] pointer-events-none z-0"></div>

      {/* === MENU LATERAL (DESKTOP) === */}
      <aside 
        className={`${collapsed ? 'w-24' : 'w-72'} hidden md:flex flex-col p-4 h-full z-10 relative transition-all duration-300 ease-in-out`}
      >
        <div className="bg-white/40 backdrop-blur-xl h-full rounded-[32px] flex flex-col shadow-lg border border-white/50 relative group">
          
          {/* BOTÃO DE RECOLHER */}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-10 bg-white text-[#1A1A1A] p-1.5 rounded-full shadow-md border border-stone-100 hover:scale-110 transition z-50"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* === ÁREA DO LOGO CENTRALIZADA === */}
          <div className={`py-8 px-4 transition-all duration-300 flex flex-col items-center justify-center`}>
            
            {/* Imagem do Logo */}
            <div className={`relative transition-all duration-300 flex justify-center ${collapsed ? 'w-10 h-10' : 'w-24 h-24'}`}>
               <img
                 src="/logo.svg"
                 alt="Logo"
                 className="object-contain w-full h-full"
                 onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full bg-[#FACC15] rounded-full flex items-center justify-center text-[10px] font-bold text-[#1A1A1A] shadow-sm border-2 border-white">AP</div>';
                 }}
               />
            </div>

            {/* Texto "Centro Automotivo" */}
            <div className={`text-center mt-3 transition-all duration-300 overflow-hidden ${collapsed ? 'h-0 opacity-0 w-0' : 'h-auto opacity-100 w-auto'}`}>
              <h2 className="font-bold text-[#1A1A1A] text-sm uppercase tracking-widest leading-tight">
                Centro<br/>Automotivo
              </h2>
            </div>

          </div>
          
          {/* LINKS DE NAVEGAÇÃO */}
          <nav className="flex-1 px-4 space-y-2 mt-2">
            {menuItems.map((item) => {
              if (!item.roles.includes(role)) return null;
              
              const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
              
              return (
                <button 
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  title={collapsed ? item.name : ""}
                  className={`w-full flex items-center gap-3 p-4 rounded-full transition-all duration-300 ${
                    isActive 
                      ? "bg-[#1A1A1A] text-white shadow-md" 
                      : "text-stone-600 hover:bg-white/50"
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <item.icon size={20} className="min-w-[20px]" /> 
                  <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* PERFIL DO USUÁRIO */}
          <div className="p-4 mt-auto">
            <div className={`bg-white/60 backdrop-blur-md p-3 rounded-3xl flex items-center gap-3 border border-white/40 transition-all ${collapsed ? 'justify-center' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[#1A1A1A] shadow-sm ${role === 'owner' || role === 'admin' ? 'bg-[#FACC15]' : 'bg-blue-200'} shrink-0`}>
                {userName.substring(0,2).toUpperCase()}
              </div>
              
              <div className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                <p className="text-sm font-bold truncate">{userName}</p>
                <p className="text-[10px] text-stone-500 capitalize">
                  {role === 'owner' ? 'Proprietário' : (role === 'admin' ? 'Admin' : 'Funcionário')}
                </p>
              </div>
              
              {!collapsed && (
                <button onClick={() => handleNavigation("/")} className="text-stone-400 hover:text-red-500 transition" title="Sair">
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* === ÁREA DE CONTEÚDO PRINCIPAL === */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6 relative z-0">
          <div className="fixed top-[10%] right-[-10%] w-[600px] h-[600px] bg-yellow-300/20 rounded-full blur-[130px] -z-10 pointer-events-none"></div>
          {children}
      </main>

      {/* === MENU MOBILE === */}
      <nav className="fixed bottom-6 left-6 right-6 bg-[#1A1A1A]/90 backdrop-blur-md text-white md:hidden flex justify-around items-center p-4 rounded-full shadow-2xl z-50 border border-white/10">
        {menuItems.map((item) => {
          if (!item.roles.includes(role)) return null;
          const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href));
          
          return ( 
            <button 
                key={item.href} 
                onClick={() => handleNavigation(item.href)} 
                className={`p-2 rounded-full transition ${isActive ? "bg-white/20 text-[#FACC15]" : "text-stone-400"}`}
            >
                <item.icon size={24} />
            </button>
          );
        })}
      </nav>

    </div>
  );
}