"use server";

import { createClient } from "@/src/utils/supabase/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

type CompanyData = {
    cpf_cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    inscricao_estadual: string;
    inscricao_municipal: string;
    regime_tributario: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio_ibge: string;
    cidade: string;
    uf: string;
    cep: string;
    email_contato: string;
    telefone: string;
    csc_token_production?: string;
    csc_id_production?: string;
    csc_token_homologation?: string;
    csc_id_homologation?: string;
    nfse_login?: string;
    nfse_password?: string;
    usa_fiscal?: boolean;
    usa_caixa?: boolean;
    logo_url?: string;
};

export async function registerCompanyInNuvemFiscal(data: CompanyData) {
    const supabase = createClient();

    try {
        // 1. Validar login e organzação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Usuário não autenticado.");

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile?.organization_id) throw new Error("Organização não encontrada para o usuário.");

        let { data: existingCompany } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", profile.organization_id)
            .limit(1)
            .single();

        if (!existingCompany && data.cpf_cnpj) {
            const { data: existingByCnpj } = await supabase
                .from("company_settings")
                .select("*")
                .eq("cnpj", data.cpf_cnpj)
                .is("organization_id", null)
                .limit(1)
                .single();

            if (existingByCnpj) existingCompany = existingByCnpj;
        }

        const companyId = existingCompany?.id;

        const isPlaceholder = (val?: string) => val && (val.includes("(Token") || val.includes("(Senha"));

        const realTokenProduction = !isPlaceholder(data.csc_token_production) ? data.csc_token_production : existingCompany?.csc_token_production;
        const realTokenHomologation = !isPlaceholder(data.csc_token_homologation) ? data.csc_token_homologation : existingCompany?.csc_token_homologation;
        const realNfsePassword = !isPlaceholder(data.nfse_password) ? data.nfse_password : existingCompany?.nfse_password;

        const upsertData: any = {
            id: companyId,
            organization_id: profile.organization_id,
            cnpj: data.cpf_cnpj,
            cpf_cnpj: data.cpf_cnpj,
            razao_social: data.razao_social,
            nome_fantasia: data.nome_fantasia,
            inscricao_estadual: data.inscricao_estadual,
            inscricao_municipal: data.inscricao_municipal,
            regime_tributario: data.regime_tributario,
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            codigo_municipio_ibge: data.codigo_municipio_ibge,
            cidade: data.cidade,
            uf: data.uf,
            cep: data.cep,
            email_contato: data.email_contato,
            telefone: data.telefone,
            csc_id_production: data.csc_id_production,
            csc_id_homologation: data.csc_id_homologation,
            nfse_login: data.nfse_login,
            usa_fiscal: data.usa_fiscal !== undefined ? data.usa_fiscal : true,
            usa_caixa: data.usa_caixa !== undefined ? data.usa_caixa : true,
            logo_url: data.logo_url
        };

        if (!isPlaceholder(data.csc_token_production)) upsertData.csc_token_production = data.csc_token_production;
        if (!isPlaceholder(data.csc_token_homologation)) upsertData.csc_token_homologation = data.csc_token_homologation;
        if (!isPlaceholder(data.nfse_password)) upsertData.nfse_password = data.nfse_password;

        const { error: dbError } = await supabase
            .from("company_settings")
            .upsert(upsertData);

        if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);

        // --- FUNÇÃO AUXILIAR PARA CONFIGURAR EM UM AMBIENTE ---
        const configureEnvironment = async (env: 'production' | 'homologation') => {
            try {
                const token = await getNuvemFiscalToken(env);
                const baseUrl = env === 'production'
                    ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
                    : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

                console.log(`[NuvemFiscal] Configurando ambiente: ${env.toUpperCase()} em ${baseUrl}`);

                // A. Registrar/Atualizar Empresa
                const nfPayload = {
                    cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ""),
                    nome_razao_social: data.razao_social,
                    nome_fantasia: data.nome_fantasia,
                    email: data.email_contato,
                    inscricao_estadual: data.inscricao_estadual,
                    inscricao_municipal: data.inscricao_municipal,
                    endereco: {
                        logradouro: data.logradouro,
                        numero: data.numero,
                        complemento: data.complemento,
                        bairro: data.bairro,
                        codigo_municipio: data.codigo_municipio_ibge,
                        cidade: data.cidade,
                        uf: data.uf,
                        cep: data.cep.replace(/\D/g, ""),
                        pais: "BRASIL"
                    },
                    regime_tributario: Number(data.regime_tributario) || 1
                };

                const resEmpresa = await fetch(`${baseUrl}/empresas`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(nfPayload)
                });

                if (!resEmpresa.ok) {
                    if (resEmpresa.status === 409 || resEmpresa.status === 400) { // 409 Conflict ou 400 com code EmpresaAlreadyExists
                        console.log(`[NuvemFiscal] Empresa já existe em ${env}, atualizando...`);
                        await fetch(`${baseUrl}/empresas/${nfPayload.cpf_cnpj}`, {
                            method: "PUT",
                            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                            body: JSON.stringify(nfPayload)
                        });
                    } else {
                        const errTxt = await resEmpresa.text();
                        console.error(`[NuvemFiscal] Erro ao criar empresa em ${env}:`, errTxt);
                        // Não lançar erro fatal para não bloquear o outro ambiente
                    }
                }

                // B. Configurar NFC-e
                // Em Produção usa dados de produção, em Homologação usa dados de homologação
                const cscId = env === 'production' ? data.csc_id_production : data.csc_id_homologation;
                const cscToken = env === 'production' ? realTokenProduction : realTokenHomologation;

                if (cscId && cscToken) {
                    console.log(`[NuvemFiscal] Configurando NFC-e em ${env}...`);
                    const nfcePayload = {
                        ambiente: env === 'production' ? "producao" : "homologacao", // SEFAZ Environment
                        sefaz: { id_csc: Number(cscId), csc: cscToken }
                    };

                    const resNfce = await fetch(`${baseUrl}/empresas/${nfPayload.cpf_cnpj}/nfce`, {
                        method: "PUT",
                        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify(nfcePayload)
                    });

                    if (!resNfce.ok) console.error(`[NuvemFiscal] Erro NFC-e ${env}:`, await resNfce.text());
                }

                // C. Configurar NFS-e
                if (data.nfse_login && realNfsePassword) {
                    console.log(`[NuvemFiscal] Configurando NFS-e em ${env}...`);
                    const nfsePayload = {
                        ambiente: env === 'production' ? "producao" : "homologacao",
                        prefeitura: {
                            login: data.nfse_login, // Usa o login informado (pode ser IM ou CNPJ)
                            senha: realNfsePassword
                        },
                        rps: { lote: 1, serie: "1", numero: 1 }
                    };
                    const resNfse = await fetch(`${baseUrl}/empresas/${nfPayload.cpf_cnpj}/nfse`, {
                        method: "PUT",
                        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                        body: JSON.stringify(nfsePayload)
                    });
                    if (!resNfse.ok) {
                        // Tenta POST se PUT falhar (404)
                        if (resNfse.status === 404) {
                            await fetch(`${baseUrl}/empresas/${nfPayload.cpf_cnpj}/nfse`, {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                                body: JSON.stringify(nfsePayload)
                            });
                        } else {
                            console.error(`[NuvemFiscal] Erro NFS-e ${env}:`, await resNfse.text());
                        }
                    }
                }

            } catch (e: any) {
                console.error(`[NuvemFiscal] Erro fatal no ambiente ${env}:`, e.message);
            }
        };

        // 3. Executar configurações na Nuvem Fiscal APENAS se tiver CNPJ
        if (data.cpf_cnpj) {
            await Promise.all([
                configureEnvironment('production'),
                configureEnvironment('homologation')
            ]);
            return { success: true, message: "Empresa salva e configurada na Nuvem Fiscal!" };
        }

        return { success: true, message: "Dados da oficina salvos com sucesso (Módulo Fiscal desativado)!" };

    } catch (error: any) {
        console.error("Erro em registerCompanyInNuvemFiscal:", error);
        return { success: false, error: error.message };
    }
}

export async function getCompanySettings() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) return null;

    const { data: company } = await supabase
        .from("company_settings")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .single();

    if (!company) return null;

    // Mascarar tokens para segurança (Write-Only)
    if (company.csc_token_production) {
        company.csc_token_production = "(Token de Produção Configurado)";
    }
    if (company.csc_token_homologation) {
        company.csc_token_homologation = "(Token de Homologação Configurado)";
    }
    // Mascarar senha da prefeitura também por segurança
    if (company.nfse_password) {
        company.nfse_password = "(Senha Configurada)";
    }

    return company;
}

export async function toggleCompanyModule(module: 'usa_fiscal' | 'usa_caixa', value: boolean) {
    const supabase = createClient();

    // Validar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado." };

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) return { success: false, error: "Organização não encontrada." };

    const { createAdminClient } = await import('@/src/utils/supabase/admin');
    const supabaseAdmin = createAdminClient();

    // Atualiza usando permissão de admin (ignora RLS)
    const { error: updateError } = await supabaseAdmin
        .from("company_settings")
        .update({ [module]: value })
        .eq('organization_id', profile.organization_id);

    if (updateError) {
        console.error("Erro no toggle (Admin):", updateError);
        return { success: false, error: updateError.message };
    }

    return { success: true };
}
