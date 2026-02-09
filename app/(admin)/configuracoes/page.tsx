"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  Users, Plus, Ban, Save, X, Loader2, Key, Unlock,
  Building2, MapPin, Phone, FileText, Hash
} from "lucide-react";
import { registerCompanyInNuvemFiscal, getCompanySettings } from "@/src/actions/fiscal";

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
  inscricao_estadual: string;
  inscricao_municipal: string;
  regime_tributario: string;
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
  csc_token_production?: string;
  csc_id_production?: string;
  csc_token_homologation?: string;
  csc_id_homologation?: string;
  nfse_login?: string;
  nfse_password?: string;
  endereco?: string; // Mantido para compatibilidade visual se necessário
  created_at?: string;
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
    nome_fantasia: "", razao_social: "", cnpj: "",
    inscricao_estadual: "", inscricao_municipal: "", regime_tributario: "1",
    logradouro: "", numero: "", complemento: "", bairro: "",
    codigo_municipio_ibge: "", cidade: "", uf: "", cep: "",
    telefone: "", email_contato: "",
    csc_token_production: "", csc_id_production: "",
    csc_token_homologation: "", csc_id_homologation: "",
    nfse_login: "", nfse_password: ""
  });
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");

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
      // Mapear para o formato esperado pela Server Action
      const result = await registerCompanyInNuvemFiscal({
        cpf_cnpj: company.cnpj,
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        inscricao_estadual: company.inscricao_estadual,
        inscricao_municipal: company.inscricao_municipal,
        regime_tributario: company.regime_tributario,
        logradouro: company.logradouro,
        numero: company.numero,
        complemento: company.complemento,
        bairro: company.bairro,
        codigo_municipio_ibge: company.codigo_municipio_ibge,
        cidade: company.cidade,
        uf: company.uf,
        cep: company.cep,
        email_contato: company.email_contato,
        telefone: company.telefone,
        csc_token_production: company.csc_token_production,
        csc_id_production: company.csc_id_production,
        csc_token_homologation: company.csc_token_homologation,
        csc_id_homologation: company.csc_id_homologation,
        nfse_login: company.nfse_login,
        nfse_password: company.nfse_password
      });

      if (!result.success) throw new Error(result.error);

      alert(result.message);
      fetchCompany(); // Recarregar dados
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

      const res = await fetch("/api/fiscal/certificado", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Erro no upload");
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
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#FACC15]" /></div>
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
                  onChange={e => setCompany({ ...company, nome_fantasia: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Ex: Auto Center Silva"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">INSCRIÇÃO ESTADUAL</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="text"
                    value={company.inscricao_estadual || ''}
                    onChange={e => setCompany({ ...company, inscricao_estadual: e.target.value })}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="IM (Sem pontos)"
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
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="contato@empresa.com.br"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Rua, Av..."
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">NÚMERO</label>
                <input
                  type="text"
                  value={company.numero || ''}
                  onChange={e => setCompany({ ...company, numero: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Bairro"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">COMPLEMENTO</label>
                <input
                  type="text"
                  value={company.complemento || ''}
                  onChange={e => setCompany({ ...company, complemento: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                  placeholder="Cidade"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">UF</label>
                <input
                  type="text"
                  value={company.uf || ''}
                  onChange={e => setCompany({ ...company, uf: e.target.value })}
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                  className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
                      placeholder="ID Produção"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CÓDIGO CSC (TOKEN)</label>
                    <input
                      type="password"
                      value={company.csc_token_production || ''}
                      onChange={e => setCompany({ ...company, csc_token_production: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
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
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
                      placeholder="ID Homologação"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">CÓDIGO CSC (TOKEN)</label>
                    <input
                      type="password"
                      value={company.csc_token_homologation || ''}
                      onChange={e => setCompany({ ...company, csc_token_homologation: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
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
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
                      placeholder="Login Prefeitura"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 ml-2 mb-1 block">SENHA</label>
                    <input
                      type="password"
                      value={company.nfse_password || ''}
                      onChange={e => setCompany({ ...company, nfse_password: e.target.value })}
                      className="w-full bg-white rounded-xl py-2 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15] border border-stone-200"
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
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
                  />
                </div>
                <div className="flex gap-4 items-center">
                  <input
                    type="password"
                    value={certPassword}
                    onChange={e => setCertPassword(e.target.value)}
                    placeholder="Senha do Certificado"
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 px-4 font-medium outline-none focus:ring-2 focus:ring-[#FACC15]"
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

      {/* --- MODAIS --- */}
      {modalNovoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Novo Funcionário</h2><button onClick={() => setModalNovoOpen(false)}><X /></button></div>
            <input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome" className="w-full bg-gray-100 p-3 rounded-xl" />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" className="w-full bg-gray-100 p-3 rounded-xl" />
            <input value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Senha" type="password" className="w-full bg-gray-100 p-3 rounded-xl" />
            <select value={newCargo} onChange={e => setNewCargo(e.target.value)} className="w-full bg-gray-100 p-3 rounded-xl"><option value="employee">Colaborador</option><option value="owner">Gerente</option></select>
            <button onClick={handleCreateUser} disabled={saving} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">{saving ? "Salvando..." : "Criar"}</button>
          </div>
        </div>
      )}

      {modalSenhaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Nova Senha</h2><button onClick={() => setModalSenhaOpen(false)}><X /></button></div>
            <p className="text-sm text-gray-500">Alterando senha de <strong>{selectedUser?.nome}</strong></p>
            <input value={resetPass} onChange={e => setResetPass(e.target.value)} placeholder="Nova Senha" className="w-full bg-gray-100 p-3 rounded-xl" />
            <button onClick={handleChangePassword} disabled={saving || !resetPass} className="w-full bg-black text-yellow-400 p-3 rounded-xl font-bold">Salvar</button>
          </div>
        </div>
      )}

    </div>
  );
}