import { createClient } from "@/src/utils/supabase/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const logs: string[] = [];
    try {
        const { searchParams } = new URL(request.url);
        const webhookUrl = searchParams.get('url');

        const baseUrl = webhookUrl || process.env.NEXT_PUBLIC_APP_URL || "https://autoeletrica-app.vercel.app";
        const finalWebhookUrl = `${baseUrl}/api/webhooks/nuvemfiscal`;

        // URL de Produção da Nuvem Fiscal
        const API_URL = process.env.NUVEMFISCAL_URL || "https://api.nuvemfiscal.com.br";

        logs.push(`[Setup] Iniciando deploy em PRODUÇÃO... URL: ${finalWebhookUrl}`);
        logs.push(`[Setup] API Nuvem Fiscal: ${API_URL}`);

        const supabase = createClient();

        // 1. Pegar dados da empresa
        const { data: company, error } = await supabase
            .from("company_settings")
            .select("*")
            .single();

        if (error || !company) {
            logs.push("Erro: Empresa não encontrada no banco.");
            return NextResponse.json({ success: false, logs }, { status: 404 });
        }

        const cnpj = company.cnpj.replace(/\D/g, "");
        let token;
        try {
            token = await getNuvemFiscalToken('production');
            logs.push("Token obtido com sucesso.");
        } catch (e: any) {
            logs.push(`Erro ao obter token: ${e.message}`);
            return NextResponse.json({ success: false, logs }, { status: 500 });
        }

        // 2. Cadastrar Empresa
        try {
            logs.push("Cadastrando empresa...");
            const empresaPayload = {
                cpf_cnpj: cnpj,
                nome_razao_social: company.razao_social, // Corrigido para nome_razao_social
                nome_fantasia: company.nome_fantasia,
                inscricao_estadual: company.inscricao_estadual?.replace(/\D/g, ""),
                inscricao_municipal: "324743",
                endereco: {
                    logradouro: company.logradouro,
                    numero: company.numero,
                    complemento: company.complemento,
                    bairro: company.bairro,
                    codigo_municipio: company.codigo_municipio_ibge,
                    cidade: company.cidade,
                    uf: company.uf,
                    cep: company.cep?.replace(/\D/g, ""),
                    pais: "BRASIL"
                },
                // regime_tributario removido
                email: company.email || "financeiro@autoeletrica.com.br"
            };

            const resEmpresa = await fetch(`${API_URL}/empresas`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(empresaPayload)
            });

            let empresaBody: any = {};
            try { empresaBody = await resEmpresa.json(); } catch (e) { }

            if (!resEmpresa.ok) {
                logs.push(`Empresa: ${resEmpresa.status} - ${empresaBody.error?.message || JSON.stringify(empresaBody)}`);
            } else {
                logs.push("Empresa cadastrada com sucesso!");
            }
        } catch (e: any) {
            logs.push(`Erro fatal ao cadastrar empresa: ${e.message}`);
        }

        // 3. Configurar NFS-e
        try {
            logs.push("Configurando NFS-e...");
            const nfsePayload = {
                ambiente: "producao",
                rps: { lote: 1, serie: "1", numero: 1 },
                prefeitura: {
                    login: cnpj,
                    senha: "Deusebom10@"
                }
            };

            const resNfse = await fetch(`${API_URL}/empresas/${cnpj}/nfse`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(nfsePayload)
            });

            if (!resNfse.ok && resNfse.status === 404) {
                logs.push("PUT falhou (404), tentando POST...");
                const resNfsePost = await fetch(`${API_URL}/empresas/${cnpj}/nfse`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(nfsePayload)
                });

                let bodyPost: any = {};
                try { bodyPost = await resNfsePost.json(); } catch (e) { }

                if (!resNfsePost.ok) {
                    logs.push(`Erro config NFS-e (POST): ${bodyPost.error?.message || resNfsePost.status}`);
                } else {
                    logs.push("Configuração NFS-e criada (POST)!");
                }
            } else if (!resNfse.ok) {
                let bodyPut: any = {};
                try { bodyPut = await resNfse.json(); } catch (e) { }
                logs.push(`Erro config NFS-e (PUT): ${bodyPut.error?.message || resNfse.status}`);
            } else {
                logs.push("Configuração NFS-e atualizada (PUT)!");
            }
        } catch (e: any) {
            logs.push(`Erro fatal ao configurar NFS-e: ${e.message}`);
        }

        // 4. Cadastrar Webhook
        // Se falhar, loga mas não quebra
        try {
            logs.push(`Cadastrando Webhook: ${finalWebhookUrl}`);
            const webhookPayload = {
                url: finalWebhookUrl,
                eventos: [
                    "nfe.autorizada", "nfe.cancelada", "nfe.erro",
                    "nfce.autorizada", "nfce.cancelada", "nfce.erro",
                    "nfse.autorizada", "nfse.cancelada", "nfse.erro", "nfse.processando"
                ],
                descricao: "Auto Eletrica Prod Webhook"
            };

            // Tentativa 1: /v2/conta/webhooks
            let resWebhook = await fetch(`https://api.nuvemfiscal.com.br/v2/conta/webhooks`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(webhookPayload)
            });

            // Tentativa 2: /webhooks (se conta falhar com 404)
            if (resWebhook.status === 404) {
                logs.push("Webhook em /v2/conta/webhooks falhou (404), tentando /webhooks...");
                resWebhook = await fetch(`${API_URL}/webhooks`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                    body: JSON.stringify(webhookPayload)
                });
            }

            let webhookBody: any = {};
            try { webhookBody = await resWebhook.json(); } catch (e) { }

            if (!resWebhook.ok) {
                logs.push(`Erro Webhook: ${webhookBody.error?.message || resWebhook.status}`);
            } else {
                logs.push(`Webhook criado! ID: ${webhookBody.id}`);
            }
        } catch (e: any) {
            logs.push(`Erro fatal ao criar webhook: ${e.message}`);
        }

        return NextResponse.json({ success: true, logs });

    } catch (error: any) {
        logs.push(`Erro interno global: ${error.message}`);
        return NextResponse.json({ success: false, logs }, { status: 500 });
    }
}
