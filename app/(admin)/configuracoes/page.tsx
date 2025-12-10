"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import { 
  Users, Plus, Ban, Save, X, Loader2, Key, Unlock, 
  Building2, MapPin, Phone, FileText
} from "lucide-react";

// Tipos
type Profile = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
};

type CompanySettings = {
  id?: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email_contato: string;
};

export default function Configuracoes() {
  const supabase = createClient();
  const { profile } = useAuth();

  // Controle de Abas
  const [activeTab, setActiveTab] = useState<'team' | 'company'>('team');

  // Estados Gerais
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- ESTADOS EQUIPE ---
  const [users, setUsers] = useState<Profile[]>([]);
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  
  // Forms Equipe
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newCargo, setNewCargo] = useState("employee");
  const [resetPass, setResetPass] = useState("");

  // --- ESTADOS EMPRESA ---
  const [company, setCompany] = useState<CompanySettings>({
    nome_fantasia: "", razao_social: "", cnpj: "", endereco: "", telefone: "", email_contato: ""
  });

  // CARGA INICIAL
  useEffect(() => {
    fetchUsers();
    fetchCompany();
  }, []);

  // --- FUNÇÕES DE BUSCA ---
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchCompany = async () => {
    const { data } = await supabase.from('company_settings').select('*').limit(1).single();
    if (data) setCompany(data);
  };

  // --- AÇÕES DE EQUIPE ---
  const handleCreateUser = async () => {
    if (!newNome || !newEmail || !newPass) return alert("Preencha tudo.");
    
    if (!profile?.organization_id) return alert("Erro: Organização não identificada.");

    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: 'create', 
            email: newEmail, 
            password: newPass, 
            nome: newNome, 
            cargo: newCargo,
            organization_id: profile.organization_id 
        })
      });
      if (!res.ok) throw new Error("Erro ao criar.");
      alert("Sucesso!"); setModalNovoOpen(false); fetchUsers();
    } catch (e) { alert("Erro ao criar usuário."); } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !resetPass) return;
    setSaving(true);
    try {
      await fetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_password', user_id: selectedUser.id, password: resetPass })
      });
      alert("Senha alterada!"); setModalSenhaOpen(false); setResetPass("");
    } catch (e) { alert("Erro."); } finally { setSaving(false); }
  };

  const handleToggleStatus = async (user: Profile) => {
    if (!confirm(`Alterar acesso de ${user.nome}?`)) return;
    await supabase.from('profiles').update({ ativo: !user.ativo }).eq('id', user.id);
    fetchUsers();
  };

  // --- AÇÕES DE EMPRESA ---
  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert(company);

      if (error) throw error;
      alert("Dados da oficina atualizados com sucesso!");
    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      
      <h1 className="text-3xl font-bold text-[#1A1A1A]">Configurações</h1>

      {/* --- NAVEGAÇÃO DE ABAS --- */}
      <div className="flex gap-4 border-b border-stone-200">
        <button 
          onClick={() => setActiveTab('team')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 transition ${activeTab === 'team' ? 'text-[#FACC15] border-b-2 border-[#FACC15]' : 'text-stone-400 hover:text-stone-600'}`}
        >
          <Users size={18} /> Gestão de Equipe
        </button>
        <button 
          onClick={() => setActiveTab('company')}
          className={`pb-3 px-4 font-bold text-sm flex items-center gap-2 transition ${activeTab === 'company' ? 'text-[#FACC15] border-b-2 border-[#FACC15]' : 'text-stone-400 hover:text-stone-600'}`}
        >
          <Building2 size={18} /> Dados da Oficina
        </button>
      </div>

      {/* =================================================================================
          CONTEÚDO DA ABA: EQUIPE
         ================================================================================= */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex justify-end mb-4">
                <button onClick={() => setModalNovoOpen(true)} className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105">
                    <Plus size={20} /> Novo Funcionário
                </button>
            </div>

            <div className="bg-white rounded-[32px] border border-stone-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FACC15]"/></div>
                ) : (
                    <table className="w-full text-left">
                    <thead className="bg-[#F8F7F2] text-stone-500 text-xs uppercase font-bold">
                        <tr>
                        <th className="px-3 md:px-6 py-4">Nome / Email</th>
                        <th className="px-3 md:px-6 py-4">Cargo</th>
                        <th className="px-3 md:px-6 py-4 text-center">Status</th>
                        <th className="px-3 md:px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {users.map((u) => (
                        <tr key={u.id} className="border-b border-stone-50 hover:bg-[#F9F8F4] transition group">
                            <td className="px-3 md:px-6 py-4">
                                <p className="font-bold text-[#1A1A1A]">{u.nome}</p>
                                <p className="text-stone-400 text-xs">{u.email}</p>
                            </td>
                            <td className="px-3 md:px-6 py-4">
                                {u.cargo === 'owner' ? <span className="text-[#FACC15] font-bold text-[10px] border border-[#FACC15] px-2 py-1 rounded">GERENTE</span> : <span className="bg-stone-100 text-stone-500 px-2 py-1 rounded text-[10px]">COLABORADOR</span>}
                            </td>
                            <td className="px-3 md:px-6 py-4 text-center">
                                {u.ativo ? <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">ATIVO</span> : <span className="text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded">BLOQUEADO</span>}
                            </td>
                            <td className="px-3 md:px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => { setSelectedUser(u); setModalSenhaOpen(true); }} 
                                        className="p-2 bg-stone-100 hover:bg-[#FACC15] hover:text-[#1A1A1A] rounded-xl transition shadow-sm" 
                                        title="Alterar Senha"
                                    >
                                        <Key size={16} />
                                    </button>
                                    
                                    {u.id !== profile?.id && (
                                        <button 
                                            onClick={() => handleToggleStatus(u)} 
                                            className={`p-2 rounded-xl transition shadow-sm ${u.ativo ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                            title={u.ativo ? "Bloquear Acesso" : "Liberar Acesso"}
                                        >
                                            {u.ativo ? <Ban size={16} /> : <Unlock size={16} />}
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                )}
                </div>
            </div>
        </div>
      )}

      {/* =================================================================================
          CONTEÚDO DA ABA: DADOS DA OFICINA
      ================================================================================= */}
      {activeTab === 'company' && (
        <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl">
            <div className="flex flex-col gap-6">
                <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">NOME FANTASIA</label>
                    <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text" 
                            value={company.nome_fantasia || ''} 
                            onChange={e => setCompany({...company, nome_fantasia: e.target.value})}
                            className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 focus:ring-[#FACC15]" 
                            placeholder="Ex: Auto Center Silva" 
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CNPJ</label>
                    <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text" 
                            value={company.cnpj || ''} 
                            onChange={e => setCompany({...company, cnpj: e.target.value})}
                            className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]" 
                            placeholder="00.000.000/0001-00" 
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">TELEFONE / WHATSAPP</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text" 
                            value={company.telefone || ''} 
                            onChange={e => setCompany({...company, telefone: e.target.value})}
                            className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]" 
                            placeholder="(00) 99999-9999" 
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">ENDEREÇO COMPLETO</label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                            type="text" 
                            value={company.endereco || ''} 
                            onChange={e => setCompany({...company, endereco: e.target.value})}
                            className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]" 
                            placeholder="Rua, Número, Bairro, Cidade - UF" 
                        />
                    </div>
                </div>

                <div className="mt-4 pt-6 border-t border-stone-100 flex justify-end">
                    <button 
                        onClick={handleSaveCompany} 
                        disabled={saving}
                        className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition hover:scale-105 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="animate-spin" /> : <Save />} 
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- MODAIS --- */}
      {modalNovoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Novo Funcionário</h2><button onClick={()=>setModalNovoOpen(false)}><X/></button></div>
                <input value={newNome} onChange={e=>setNewNome(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 p-3 rounded-xl"/>
                <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-100 p-3 rounded-xl"/>
                <input value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Senha" type="password" className="w-full bg-gray-100 p-3 rounded-xl"/>
                <select value={newCargo} onChange={e=>setNewCargo(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl"><option value="employee">Colaborador</option><option value="owner">Gerente</option></select>
                <button onClick={handleCreateUser} disabled={saving} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">{saving ? "Salvando..." : "Criar"}</button>
            </div>
        </div>
      )}
      
      {modalSenhaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
                 <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Nova Senha</h2><button onClick={()=>setModalSenhaOpen(false)}><X/></button></div>
                 <p className="text-sm text-gray-500">Alterando senha de <strong>{selectedUser?.nome}</strong></p>
                 <input value={resetPass} onChange={e=>setResetPass(e.target.value)} placeholder="Nova Senha" className="w-full bg-gray-100 p-3 rounded-xl"/>
                 <button onClick={handleChangePassword} disabled={saving || !resetPass} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">Salvar</button>
            </div>
        </div>
      )}

    </div>
  );
}