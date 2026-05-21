"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  Users, Plus, Ban, Save, X, Loader2, Key, Unlock,
  Building2, MapPin, Phone, FileText, Hash, Settings, Pencil
} from "lucide-react";
import { getCompanySettings, toggleCompanyModule } from "@/src/actions/fiscal";

// Tipos
type Profile = {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  comissao_percentual?: number;
  celular?: string;
  ativo: boolean;
};

type CompanySettings = {
  id?: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: string;
  nfe_serie?: number;
  cnae?: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigo_municipio_ibge: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  email_contato: string;
  email_contador?: string;
  csc_token_production?: string;
  csc_id_production?: string;
  csc_token_homologation?: string;
  csc_id_homologation?: string;
  nfse_login?: string;
  nfse_password?: string;
  endereco?: string; // Mantido para compatibilidade visual se necessário
  created_at?: string;
  usa_fiscal?: boolean;
  usa_caixa?: boolean;
  usa_agendamento?: boolean;
  usa_comissao?: boolean;
  logo_url?: string;
  logo_impressos_url?: string;
  aplicar_markup_importacao?: boolean;
  markup_valor_importacao?: number;
  fin_mostrar_portal?: boolean;
  fin_cartao_com_juros?: boolean;
  fin_taxa_juros_mes?: number;
  fin_chave_pix?: string;
  fin_cidade_pix?: string;
  manager_pin?: string;
};

export default function Configuracoes() {
  const supabase = createClient();
  const { profile, updateProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Controle de Abas
  const [activeTab, setActiveTab] = useState<'company' | 'modules' | 'team'>('company');
  const [initialQueryApplied, setInitialQueryApplied] = useState(false);

  // Estados Gerais
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- ESTADOS EQUIPE ---
  const [users, setUsers] = useState<Profile[]>([]);
  const [modalNovoOpen, setModalNovoOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [modalSenhaOpen, setModalSenhaOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Forms Equipe — Novo
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newCargo, setNewCargo] = useState("employee");
  const [newComissao, setNewComissao] = useState(0);
  const [newCelular, setNewCelular] = useState("");
  const [resetPass, setResetPass] = useState("");

  // Forms Equipe — Editar
  const [editNome, setEditNome] = useState("");
  const [editCargo, setEditCargo] = useState("employee");
  const [editComissao, setEditComissao] = useState(0);
  const [editCelular, setEditCelular] = useState("");

  // --- ESTADOS EMPRESA ---
  const [company, setCompany] = useState<CompanySettings>({
    nome_fantasia: "", razao_social: "", cnpj: "",
    inscricao_estadual: "", inscricao_municipal: "", regime_tributario: "1",
    nfe_serie: 1,
    cnae: "4520007",
    logradouro: "", numero: "", complemento: "", bairro: "",
    codigo_municipio_ibge: "", cidade: "", uf: "", cep: "",
    telefone: "", email_contato: "", email_contador: "",
    csc_token_production: "", csc_id_production: "",
    csc_token_homologation: "", csc_id_homologation: "",
    nfse_login: "", nfse_password: "", usa_fiscal: true, usa_caixa: true, usa_agendamento: true, usa_comissao: false,
    logo_url: "",
    logo_impressos_url: "",
    aplicar_markup_importacao: false,
    markup_valor_importacao: 2.0,
    fin_mostrar_portal: false,
    fin_cartao_com_juros: false,
    fin_taxa_juros_mes: 0,
    fin_chave_pix: "",
    fin_cidade_pix: "",
    manager_pin: ""
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

  // CARGA INICIAL
  useEffect(() => {
    fetchUsers();
    fetchCompany();
  }, []);

  // Permite deep-link para abrir aba/modal específicos:
  // /configuracoes?tab=team&open=new-user
  useEffect(() => {
    if (initialQueryApplied) return;

    const rawTab = searchParams.get("tab")?.toLowerCase();
    let tabFromQuery: 'company' | 'modules' | 'team' | null = null;
    if (rawTab === "company" || rawTab === "modules" || rawTab === "team") {
      tabFromQuery = rawTab;
    }
    if (tabFromQuery) {
      setActiveTab(tabFromQuery);
    }

    const rawOpen = searchParams.get("open")?.toLowerCase();
    if (rawOpen === "new-user" || rawOpen === "novo-funcionario" || rawOpen === "add-user") {
      setActiveTab("team");
      setModalNovoOpen(true);
    }

    setInitialQueryApplied(true);
  }, [initialQueryApplied, searchParams]);

  // AUTO-PREENCHIMENTO ENDEREÇO (Legado)
  useEffect(() => {
    // Apenas monta se pelo menos uma parte existir
    const parts = [
      company.logradouro,
      company.numero,
      company.bairro,
      company.cidade,
      company.uf,
      company.cep
    ].filter(p => typeof p === 'string' && p.trim() !== "");

    // Na ordem: Logradouro, número, bairro, cidade, estado e cep
    const novoEndereco = parts.join(', ');

    // Somente atualiza se houver diferença, evitando loop
    if (company.endereco !== novoEndereco && (parts.length > 0 || company.endereco)) {
      setCompany(prev => ({ ...prev, endereco: novoEndereco }));
    }
  }, [
    company.logradouro,
    company.numero,
    company.bairro,
    company.cidade,
    company.uf,
    company.cep
  ]);

  // --- FUNÇÕES DE BUSCA ---
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('nome');
    if (data) setUsers(data);
    setLoading(false);
  };

  const fetchCompany = async () => {
    const data = await getCompanySettings();
    if (data) {
      setCompany(data);
    }
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
          comissao_percentual: newComissao,
          celular: newCelular,
          organization_id: profile.organization_id
        })
      });
      if (!res.ok) throw new Error("Erro ao criar.");
      alert("Sucesso!"); setModalNovoOpen(false); fetchUsers();
      setNewNome(""); setNewEmail(""); setNewPass(""); setNewCargo("employee"); setNewComissao(0); setNewCelular("");
    } catch (e) { alert("Erro ao criar usuário."); } finally { setSaving(false); }
  };

  const openEditModal = (u: Profile) => {
    setSelectedUser(u);
    setEditNome(u.nome);
    setEditCargo(u.cargo);
    setEditComissao(u.comissao_percentual || 0);
    setEditCelular(u.celular || "");
    setModalEditOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          user_id: selectedUser.id,
          nome: editNome,
          cargo: editCargo,
          comissao_percentual: editComissao,
          celular: editCelular
        })
      });
      if (!res.ok) throw new Error("Erro ao atualizar.");
      setModalEditOpen(false);
      fetchUsers();
    } catch (e) { alert("Erro ao atualizar colaborador."); } finally { setSaving(false); }
  };

  const handleUpdateComissao = async (user: Profile, novaComissao: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          user_id: user.id,
          comissao_percentual: novaComissao
        })
      });
      if (!res.ok) throw new Error("Erro ao atualizar.");
      fetchUsers();
    } catch (e) { alert("Erro ao atualizar comissão."); } finally { setSaving(false); }
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

  const handleToggleModule = async (module: 'usa_fiscal' | 'usa_caixa' | 'usa_agendamento' | 'usa_comissao', value: boolean) => {
    setCompany(prev => ({ ...prev, [module]: value }));
    updateProfile({ [module]: value }); // Atualiza o Profile global p/ o Sidebar reagir na hora
    if (!profile?.organization_id) return;
    try {
      const res = await toggleCompanyModule(module, value);
      if (!res.success) throw new Error(res.error);
      // Atualiza os server components (como o layout e menus) em plano de fundo sem fechar a aba atual
      router.refresh();
    } catch (err: any) {
      alert("Erro ao salvar configuração: " + err.message);
      // Reverter alteração otimista
      setCompany(prev => ({ ...prev, [module]: !value }));
      updateProfile({ [module]: !value });
    }
  };

  // --- AÇÕES DE EMPRESA ---
  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      const payload = {
        organization_id: profile?.organization_id || undefined,
        cpf_cnpj: company.cnpj,
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        inscricao_estadual: company.inscricao_estadual,
        inscricao_municipal: company.inscricao_municipal,
        regime_tributario: company.regime_tributario,
        nfe_serie: Number(company.nfe_serie || 1),
        cnae: company.cnae,
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento,
        bairro: company.bairro,
        codigo_municipio_ibge: company.codigo_municipio_ibge,
        cidade: company.cidade,
        uf: company.uf,
        cep: company.cep,
        email_contato: company.email_contato,
        email_contador: company.email_contador,
        telefone: company.telefone,
        csc_token_production: company.csc_token_production,
        csc_id_production: company.csc_id_production,
        csc_token_homologation: company.csc_token_homologation,
        csc_id_homologation: company.csc_id_homologation,
        nfse_login: company.nfse_login,
        nfse_password: company.nfse_password,
        usa_fiscal: company.usa_fiscal !== undefined ? company.usa_fiscal : true,
        usa_caixa: company.usa_caixa !== undefined ? company.usa_caixa : true,
        logo_url: company.logo_url,
        logo_impressos_url: company.logo_impressos_url,
        endereco: company.endereco,
        aplicar_markup_importacao: company.aplicar_markup_importacao ?? false,
        markup_valor_importacao: company.markup_valor_importacao ?? 2.0,
        fin_mostrar_portal: company.fin_mostrar_portal ?? false,
        fin_cartao_com_juros: company.fin_cartao_com_juros ?? false,
        fin_taxa_juros_mes: company.fin_taxa_juros_mes ?? 0,
        fin_chave_pix: company.fin_chave_pix,
        fin_cidade_pix: company.fin_cidade_pix,
        manager_pin: company.manager_pin
      };

      const response = await fetch("/api/fiscal/company-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      alert(result.message);
      fetchCompany(); // Recarregar dados
      updateProfile({ logo_url: company.logo_url }); // Atualiza sidebar
    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };
  const handleUploadCert = async () => {
    if (!certFile || !company.cnpj || !certPassword) return alert("Preencha CNPJ, selecione o arquivo e digite a senha.");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", certFile);
      formData.append("cnpj", company.cnpj);
      formData.append("password", certPassword);
      formData.append("environment", "production");

      const res = await fetch("/api/fiscal/certificado", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details?.error?.message || err.details?.message || "Erro no upload");
      }
      alert("Certificado enviado com sucesso!");
      setCertFile(null);
      setCertPassword("");
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-32">

      <h1 className="text-3xl font-bold text-[#1A1A1A]">Configurações</h1>

      {/* --- NAVEGAÇÃO DE ABAS --- */}
      <div className="flex bg-stone-200 p-1.5 rounded-2xl border-2 border-stone-300 shadow-inner gap-1">
        <button
          onClick={() => setActiveTab('company')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${activeTab === 'company' ? 'bg-white text-[#1A1A1A] shadow-md border-stone-300' : 'text-stone-500 hover:text-[#1A1A1A] border-transparent'}`}
        >
          <Building2 size={18} /> Dados da Oficina
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${activeTab === 'modules' ? 'bg-white text-[#1A1A1A] shadow-md border-stone-300' : 'text-stone-500 hover:text-[#1A1A1A] border-transparent'}`}
        >
          <Settings size={18} /> Opções de Uso
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border-2 ${activeTab === 'team' ? 'bg-white text-[#1A1A1A] shadow-md border-stone-300' : 'text-stone-500 hover:text-[#1A1A1A] border-transparent'}`}
        >
          <Users size={18} /> Gestão de Equipe
        </button>
      </div>

      {/* =================================================================================
          CONTEÚDO DA ABA: EQUIPE
         ================================================================================= */}
      {activeTab === 'team' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
          <div className="flex justify-end mb-4">
            <button onClick={() => setModalNovoOpen(true)} className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105">
              <Plus size={20} /> Novo Colaborador
            </button>
          </div>

          <div className="bg-white rounded-[32px] border-2 border-stone-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FACC15]" /></div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-[#F8F7F2] text-stone-500 text-xs uppercase font-bold">
                    <tr>
                      <th className="px-3 md:px-6 py-4">Nome / Email</th>
                      <th className="px-3 md:px-6 py-4">Cargo</th>
                      <th className="px-3 md:px-6 py-4 text-center">Comissão</th>
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
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              defaultValue={u.comissao_percentual || 0}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== (u.comissao_percentual || 0)) {
                                  handleUpdateComissao(u, val);
                                }
                              }}
                              className="w-16 bg-stone-50 border border-stone-200 rounded px-2 py-1 text-center font-bold text-[#1A1A1A] outline-none focus:border-[#FACC15] transition"
                            />
                            <span className="text-stone-400 text-xs font-bold">%</span>
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 text-center">
                          {u.ativo ? <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">ATIVO</span> : <span className="text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded">BLOQUEADO</span>}
                        </td>
                        <td className="px-3 md:px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const phone = (u.celular || '').replace(/\D/g, '');
                                if (!phone) { alert("Cadastre o celular do colaborador primeiro."); return; }
                                const fullPhone = phone.length > 11 ? phone : `55${phone}`;
                                const loginUrl = `${window.location.origin}/?email=${encodeURIComponent(u.email)}`;
                                const msg = `Olá ${u.nome.split(' ')[0]}! Acesse o sistema pelo link abaixo e informe sua senha:\n${loginUrl}`;
                                window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                              }}
                              className="p-2 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white rounded-xl transition shadow-sm"
                              title="Enviar link via WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </button>

                            <button
                              onClick={() => openEditModal(u)}
                              className="p-2 bg-stone-100 hover:bg-[#FACC15] hover:text-[#1A1A1A] rounded-xl transition shadow-sm"
                              title="Editar Colaborador"
                            >
                              <Pencil size={16} />
                            </button>

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
                  onChange={e => setCompany({ ...company, nome_fantasia: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-bold outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Ex: Auto Center Silva"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">URL DA LOGO (Menu lateral)</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={company.logo_url || ''}
                  onChange={e => setCompany({ ...company, logo_url: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Ex: /logos/logorally.png"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">URL DA LOGO (Impressos e Portal)</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={company.logo_impressos_url || ''}
                  onChange={e => setCompany({ ...company, logo_impressos_url: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Ex: /logos/logo-impressos.png"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">RAZÃO SOCIAL</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={company.razao_social || ''}
                  onChange={e => setCompany({ ...company, razao_social: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Razão Social Ltda"
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
                  onChange={e => setCompany({ ...company, cnpj: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">INSCRIÇÃO ESTADUAL</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={company.inscricao_estadual || ''}
                    onChange={e => setCompany({ ...company, inscricao_estadual: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="IE (Sem pontos)"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">INSCRIÇÃO MUNICIPAL</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={company.inscricao_municipal || ''}
                    onChange={e => setCompany({ ...company, inscricao_municipal: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="IM (Sem pontos)"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">SERIE PADRAO DA NF-E</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={company.nfe_serie || 1}
                    onChange={e => setCompany({ ...company, nfe_serie: Math.max(1, Number(e.target.value || 1)) })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="1"
                  />
                </div>
                <p className="mt-1 ml-2 text-[11px] font-medium text-stone-400">
                  Altere somente com orientacao do contador ou ao migrar de outro emissor.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CNAE (NFS-e)</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={company.cnae || ''}
                    onChange={e => setCompany({ ...company, cnae: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="Ex: 4520007"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">TELEFONE / WHATSAPP</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={company.telefone || ''}
                    onChange={e => setCompany({ ...company, telefone: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="(00) 99999-9999"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">EMAIL DE CONTATO</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="email"
                    value={company.email_contato || ''}
                    onChange={e => setCompany({ ...company, email_contato: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="contato@empresa.com.br"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">EMAIL DO CONTADOR</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="email"
                    value={company.email_contador || ''}
                    onChange={e => setCompany({ ...company, email_contador: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="contador@escritorio.com.br"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">ENDEREÇO (CEP)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={company.cep || ''}
                  onChange={e => setCompany({ ...company, cep: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">LOGRADOURO</label>
                <input
                  type="text"
                  value={company.logradouro || ''}
                  onChange={e => setCompany({ ...company, logradouro: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Rua, Av..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">NÚMERO</label>
                <input
                  type="text"
                  value={company.numero || ''}
                  onChange={e => setCompany({ ...company, numero: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">BAIRRO</label>
                <input
                  type="text"
                  value={company.bairro || ''}
                  onChange={e => setCompany({ ...company, bairro: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Bairro"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">COMPLEMENTO</label>
                <input
                  type="text"
                  value={company.complemento || ''}
                  onChange={e => setCompany({ ...company, complemento: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Apto, Bloco..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CIDADE</label>
                <input
                  type="text"
                  value={company.cidade || ''}
                  onChange={e => setCompany({ ...company, cidade: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Cidade"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">UF</label>
                <input
                  type="text"
                  value={company.uf || ''}
                  onChange={e => setCompany({ ...company, uf: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CÓD. IBGE</label>
                <input
                  type="text"
                  value={company.codigo_municipio_ibge || ''}
                  onChange={e => setCompany({ ...company, codigo_municipio_ibge: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="3550308"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-stone-100">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-4 flex items-center gap-2"><Key size={18} /> CREDENCIAIS DE EMISSÃO (CSC)</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PRODUÇÃO */}
                <div className="space-y-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <p className="text-xs font-bold text-green-600 mb-2">AMBIENTE DE PRODUÇÃO</p>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">ID DO CSC (Ex: 000001)</label>
                    <input
                      type="text"
                      value={company.csc_id_production || ''}
                      onChange={e => setCompany({ ...company, csc_id_production: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="ID Produção"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CÓDIGO CSC (TOKEN)</label>
                    <input
                      type="password"
                      value={company.csc_token_production || ''}
                      onChange={e => setCompany({ ...company, csc_token_production: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="Token Produção"
                    />
                  </div>
                </div>

                {/* HOMOLOGAÇÃO */}
                <div className="space-y-4 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <p className="text-xs font-bold text-yellow-600 mb-2">AMBIENTE DE HOMOLOGAÇÃO (TESTES)</p>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">ID DO CSC (Ex: 000001)</label>
                    <input
                      type="text"
                      value={company.csc_id_homologation || ''}
                      onChange={e => setCompany({ ...company, csc_id_homologation: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="ID Homologação"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CÓDIGO CSC (TOKEN)</label>
                    <input
                      type="password"
                      value={company.csc_token_homologation || ''}
                      onChange={e => setCompany({ ...company, csc_token_homologation: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="Token Homologação"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-stone-100">
              <h3 className="text-sm font-bold text-[#1A1A1A] mb-4 flex items-center gap-2"><FileText size={18} /> CREDENCIAIS DE SERVIÇO (NFS-e)</h3>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                <p className="text-xs font-bold text-stone-500 mb-2">DADOS DA PREFEITURA</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">LOGIN / USUÁRIO</label>
                    <input
                      type="text"
                      value={company.nfse_login || ''}
                      onChange={e => setCompany({ ...company, nfse_login: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="Login Prefeitura"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">SENHA</label>
                    <input
                      type="password"
                      value={company.nfse_password || ''}
                      onChange={e => setCompany({ ...company, nfse_password: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border-2 border-stone-300 focus:border-[#FACC15]"
                      placeholder="Senha Prefeitura"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">ENDEREÇO COMPLETO (Visualização Antiga)</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  value={company.endereco || ''}
                  readOnly
                  className="w-full bg-stone-100 rounded-2xl py-3 pl-12 pr-4 font-medium outline-none text-stone-500 cursor-not-allowed"
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

            <div className="pt-6 border-t border-stone-100 mt-6">
              <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CERTIFICADO DIGITAL (.pfx)</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-4 items-center">
                  <input
                    type="file"
                    accept=".pfx"
                    onChange={e => setCertFile(e.target.files?.[0] || null)}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
                <div className="flex gap-4 items-center">
                  <input
                    type="password"
                    value={certPassword}
                    onChange={e => setCertPassword(e.target.value)}
                    placeholder="Senha do Certificado"
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                  />
                  <button
                    onClick={handleUploadCert}
                    disabled={saving || !certFile || !certPassword}
                    className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition hover:scale-105 disabled:opacity-50 whitespace-nowrap"
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    Enviar Certificado
                  </button>
                </div>
              </div>
              <p className="text-xs text-stone-400 mt-2">O certificado é necessário para emissão de notas. Envie após salvar os dados da empresa.</p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================================
          CONTEÚDO DA ABA: OPÇÕES DE USO
      ================================================================================= */}
      {activeTab === 'modules' && (
        <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">Módulos Opcionais</h2>
            <p className="text-sm text-stone-500">Habilite ou desabilite recursos do sistema. Isso altera os menus e ferramentas para os colaboradores.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">

            {/* Toggle Uso Fiscal */}
            <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
              <div>
                <p className="font-bold text-[#1A1A1A]">Módulo Fiscal</p>
                <p className="text-sm text-stone-500">Libera emissão de Notas Fiscais, configurações de RPS e Painel Fiscal.</p>
              </div>
              <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${(company.usa_fiscal ?? true) ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${(company.usa_fiscal ?? true) ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={company.usa_fiscal ?? true}
                onChange={(e) => handleToggleModule('usa_fiscal', e.target.checked)}
              />
            </label>

            {/* Toggle Uso do Caixa */}
            <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
              <div>
                <p className="font-bold text-[#1A1A1A]">Módulo de Caixa</p>
                <p className="text-sm text-stone-500">Traz o controle de PDV, painel financeiro, fluxo de recebimentos e métricas de faturamento para os gerentes.</p>
              </div>
              <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${(company.usa_caixa ?? true) ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${(company.usa_caixa ?? true) ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={company.usa_caixa ?? true}
                onChange={(e) => handleToggleModule('usa_caixa', e.target.checked)}
              />
            </label>

            {/* Toggle Uso do Agendamento */}
            <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
              <div>
                <p className="font-bold text-[#1A1A1A]">Módulo de Agendamento</p>
                <p className="text-sm text-stone-500">Permite agendar avaliações, retornos e serviços. Controla a Agenda no menu e no Dashboard.</p>
              </div>
              <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${(company.usa_agendamento ?? true) ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${(company.usa_agendamento ?? true) ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={company.usa_agendamento ?? true}
                onChange={(e) => handleToggleModule('usa_agendamento', e.target.checked)}
              />
            </label>

            {/* Toggle Módulo de Comissões */}
            <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
              <div>
                <p className="font-bold text-[#1A1A1A]">Módulo de Comissões</p>
                <p className="text-sm text-stone-500">Ativa o controle de comissões por funcionário. Permite atribuir profissionais aos serviços e gerar comissões após o pagamento.</p>
              </div>
              <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${(company.usa_comissao ?? false) ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${(company.usa_comissao ?? false) ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={company.usa_comissao ?? false}
                onChange={(e) => handleToggleModule('usa_comissao', e.target.checked)}
              />
            </label>

          </div>

          {/* --- SEÇÃO: PIN DE GERÊNCIA --- */}
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">PIN de Gerência</h2>
              <p className="text-sm text-stone-500">Código de segurança necessário para reabrir uma OS já finalizada. Compartilhe apenas com responsáveis autorizados.</p>
            </div>
            <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl shadow-sm">
              <label className="text-xs font-bold text-stone-400 ml-2 mb-2 block">PIN DE SEGURANÇA</label>
              <input
                type="text"
                placeholder={company.manager_pin === "(PIN Configurado)" ? "(PIN Configurado)" : "Ex: 1234"}
                value={company.manager_pin === "(PIN Configurado)" ? "" : (company.manager_pin || "")}
                onChange={(e) => setCompany(prev => ({ ...prev, manager_pin: e.target.value }))}
                className="w-full bg-white rounded-2xl py-3 px-4 font-bold text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
              />
              <p className="text-xs text-stone-400 px-2 mt-2">
                {company.manager_pin === "(PIN Configurado)"
                  ? "PIN já configurado. Digite um novo valor apenas se quiser alterá-lo."
                  : "Este PIN será solicitado ao tentar reabrir uma OS já entregue."}
              </p>
            </div>
          </div>

          {/* --- SEÇÃO: PRECIFICAÇÃO --- */}
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">Precificação Automática</h2>
              <p className="text-sm text-stone-500">Configure se o sistema deve aplicar markup automaticamente ao importar notas fiscais ou cadastrar produtos.</p>
            </div>

            <div className="space-y-4">
              {/* Toggle Aplicar Markup */}
              <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
                <div>
                  <p className="font-bold text-[#1A1A1A]">Aplicar Markup na Importação</p>
                  <p className="text-sm text-stone-500">Ao importar uma nota fiscal (XML) ou cadastrar um produto com custo, o preço de venda será calculado automaticamente usando o multiplicador abaixo.</p>
                </div>
                <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${(company.aplicar_markup_importacao ?? false) ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${(company.aplicar_markup_importacao ?? false) ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={company.aplicar_markup_importacao ?? false}
                  onChange={(e) => setCompany(prev => ({ ...prev, aplicar_markup_importacao: e.target.checked }))}
                />
              </label>

              {/* Campo do Multiplicador - visível quando ativo */}
              {(company.aplicar_markup_importacao ?? false) && (
                <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-stone-400 ml-2 mb-2 block">VALOR DO MULTIPLICADOR (MARKUP)</label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 font-bold">×</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={company.markup_valor_importacao ?? 2.0}
                        onChange={(e) => setCompany(prev => ({ ...prev, markup_valor_importacao: parseFloat(e.target.value) || 2.0 }))}
                        className="w-full bg-white rounded-2xl py-3 pl-10 pr-4 font-bold text-lg text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                      />
                    </div>
                    <div className="text-sm text-stone-500">
                      <p>Exemplo: Custo <strong>R$ 10,00</strong> × <strong>{company.markup_valor_importacao ?? 2.0}</strong> = <strong className="text-[#1A1A1A]">R$ {(10 * (company.markup_valor_importacao ?? 2.0)).toFixed(2).replace('.', ',')}</strong></p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- SEÇÃO: PAGAMENTOS --- */}
            <div className="mt-8 pt-6 border-t border-stone-200">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A] mb-1">Pagamentos no Portal</h2>
                <p className="text-sm text-stone-500">Configure as regras de pagamento que os clientes visualizarão no Portal do Cliente (ex: Limite de parcelas, juros).</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group">
                  <div>
                    <p className="font-bold text-[#1A1A1A]">Mostrar formas de pagamento no portal do cliente?</p>
                    <p className="text-sm text-stone-500">Exibe uma tabela com opções de PIX, Dinheiro e Cartão de Crédito.</p>
                  </div>
                  <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${company.fin_mostrar_portal ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${company.fin_mostrar_portal ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={company.fin_mostrar_portal ?? false}
                    onChange={(e) => setCompany(prev => ({ ...prev, fin_mostrar_portal: e.target.checked }))}
                  />
                </label>

                {(company.fin_mostrar_portal ?? false) && (
                  <>
                    <label className="flex items-center justify-between p-5 bg-stone-50 border border-stone-200 rounded-3xl cursor-pointer hover:bg-stone-100 transition shadow-sm group animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <p className="font-bold text-[#1A1A1A]">O parcelamento do cartão gera juros para o seu cliente?</p>
                        <p className="text-sm text-stone-500">Se ativo, será repassada ou adicionada uma taxa mensal (Juros Simples) nas parcelas do cliente.</p>
                      </div>
                      <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${company.fin_cartao_com_juros ? 'bg-green-500' : 'bg-stone-300 group-hover:bg-stone-400'}`}>
                        <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${company.fin_cartao_com_juros ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={company.fin_cartao_com_juros ?? false}
                        onChange={(e) => setCompany(prev => ({ ...prev, fin_cartao_com_juros: e.target.checked }))}
                      />
                    </label>

                    {(company.fin_cartao_com_juros ?? false) && (
                      <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="text-xs font-bold text-stone-400 ml-2 mb-2 block">TAXA DE JUROS DO CARTÃO (%) AO MÊS</label>
                        <div className="flex items-center gap-4">
                          <div className="relative flex-1 max-w-xs">
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 font-bold">%</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={company.fin_taxa_juros_mes ?? 0}
                              onChange={(e) => setCompany(prev => ({ ...prev, fin_taxa_juros_mes: parseFloat(e.target.value) || 0 }))}
                              className="w-full bg-white rounded-2xl py-3 pl-4 pr-10 font-bold text-lg text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                            />
                          </div>
                          <div className="text-sm text-stone-500">
                            <p>Isso afetará os cálculos exibidos no portal.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-5 bg-stone-50 border border-stone-200 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-bold text-stone-400 ml-2 mb-2 block">DADOS PARA RECEBIMENTO PIX</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-stone-500 ml-1 mb-1.5 uppercase">Chave PIX</p>
                          <input
                            type="text"
                            placeholder="CPF, CNPJ, Email ou Chave Aleatória"
                            value={company.fin_chave_pix || ''}
                            onChange={(e) => setCompany(prev => ({ ...prev, fin_chave_pix: e.target.value }))}
                            className="w-full bg-white rounded-2xl py-3 px-4 font-bold text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-stone-500 ml-1 mb-1.5 uppercase">Cidade da Empresa</p>
                          <input
                            type="text"
                            placeholder="Ex: Sao Paulo (Sem acentos)"
                            value={company.fin_cidade_pix || ''}
                            onChange={(e) => setCompany(prev => ({ ...prev, fin_cidade_pix: e.target.value }))}
                            className="w-full bg-white rounded-2xl py-3 px-4 font-bold text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]"
                          />
                          <p className="text-[10px] text-stone-400 px-2 mt-1">Obrigatório para gerar o QR Code (Padrão BCB).</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Botão Salvar Precificação */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveCompany}
                disabled={saving}
                className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition hover:scale-105 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAIS --- */}
      {modalNovoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Novo Colaborador</h2><button onClick={() => setModalNovoOpen(false)}><X /></button></div>
            <input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome completo" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="E-mail" type="email" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <input value={newCelular} onChange={e => setNewCelular(e.target.value)} placeholder="Celular (WhatsApp)" type="tel" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Senha inicial" type="password" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <div className="flex gap-2 items-center bg-gray-100 p-3 rounded-xl border-2 border-stone-300">
              <span className="text-[10px] font-bold text-stone-400 shrink-0 uppercase">Comissão (%)</span>
              <input type="number" value={newComissao} onChange={e => setNewComissao(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none font-bold text-[#1A1A1A] text-right" />
            </div>
            <select value={newCargo} onChange={e => setNewCargo(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"><option value="employee">Colaborador</option><option value="owner">Gerente</option></select>
            <button onClick={handleCreateUser} disabled={saving} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">{saving ? "Salvando..." : "Criar Colaborador"}</button>
          </div>
        </div>
      )}

      {modalEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Editar Colaborador</h2><button onClick={() => setModalEditOpen(false)}><X /></button></div>
            <div className="bg-stone-50 p-3 rounded-xl border-2 border-stone-200">
              <p className="text-[10px] font-bold text-stone-400 uppercase mb-0.5">E-mail</p>
              <p className="text-sm font-bold text-stone-500">{selectedUser.email}</p>
            </div>
            <input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome completo" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <input value={editCelular} onChange={e => setEditCelular(e.target.value)} placeholder="Celular (WhatsApp)" type="tel" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <div className="flex gap-2 items-center bg-gray-100 p-3 rounded-xl border-2 border-stone-300">
              <span className="text-[10px] font-bold text-stone-400 shrink-0 uppercase">Comissão (%)</span>
              <input type="number" value={editComissao} onChange={e => setEditComissao(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none font-bold text-[#1A1A1A] text-right" />
            </div>
            <select value={editCargo} onChange={e => setEditCargo(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none"><option value="employee">Colaborador</option><option value="owner">Gerente</option></select>
            <button onClick={handleEditUser} disabled={saving} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">{saving ? "Salvando..." : "Salvar Alterações"}</button>
          </div>
        </div>
      )}

      {modalSenhaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Nova Senha</h2><button onClick={() => setModalSenhaOpen(false)}><X /></button></div>
            <p className="text-sm text-gray-500">Alterando senha de <strong>{selectedUser?.nome}</strong></p>
            <input value={resetPass} onChange={e => setResetPass(e.target.value)} placeholder="Nova Senha" className="w-full bg-gray-100 p-3 rounded-xl border-2 border-stone-300 focus:border-[#FACC15] outline-none" />
            <button onClick={handleChangePassword} disabled={saving || !resetPass} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">Salvar</button>
          </div>
        </div>
      )}

    </div>
  );
}
