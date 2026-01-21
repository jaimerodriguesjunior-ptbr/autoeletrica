"use server";

import { createClient } from "@/src/lib/supabase";
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
};

export async function registerCompanyInNuvemFiscal(data: CompanyData) {
    const supabase = createClient();

    try {
        // 1. Validar dados básicos
        if (!data.cpf_cnpj || !data.razao_social || !data.logradouro || !data.codigo_municipio_ibge) {
            throw new Error("Dados obrigatórios faltando (CNPJ, Razão Social, Endereço, IBGE).");
        }

        // 2. Atualizar no Supabase
        const { error: dbError } = await supabase
            .from("company_settings")
            .upsert({
                // Mapear campos para o banco
                cnpj: data.cpf_cnpj, // Mantendo compatibilidade com campo antigo se houver
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
                // Concatenar endereço completo para compatibilidade visual antiga
                endereco: `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.cidade}/${data.uf}`
            });

        if (dbError) throw new Error(`Erro ao salvar no banco: ${dbError.message}`);

        // 3. Autenticar na Nuvem Fiscal
        const token = await getNuvemFiscalToken();

        // 4. Montar payload Nuvem Fiscal
        const nfPayload = {
            cpf_cnpj: data.cpf_cnpj.replace(/\D/g, ""), // Apenas números
            name: data.razao_social,
            nome_fantasia: data.nome_fantasia,
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
            regime_tributario: parseInt(data.regime_tributario || "1") // 1 = Simples Nacional
        };

        // 5. Enviar para Nuvem Fiscal
        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(nfPayload)
        });

        if (!response.ok) {
            // Se já existe, tentamos atualizar (PUT)
            if (response.status === 409) { // Conflict
                const updateResponse = await fetch(`${process.env.NUVEMFISCAL_URL}/empresas/${nfPayload.cpf_cnpj}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(nfPayload)
                });
                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json();
                    throw new Error(`Erro ao atualizar empresa na Nuvem Fiscal: ${JSON.stringify(errorData)}`);
                }
                return { success: true, message: "Empresa atualizada na Nuvem Fiscal com sucesso!" };
            }

            const errorData = await response.json();
            throw new Error(`Erro na Nuvem Fiscal: ${JSON.stringify(errorData)}`);
        }

        return { success: true, message: "Empresa registrada na Nuvem Fiscal com sucesso!" };

    } catch (error: any) {
        console.error("Erro em registerCompanyInNuvemFiscal:", error);
        return { success: false, error: error.message };
    }
}
