"use server";



import { createClient } from "@/src/utils/supabase/server";

import { cookies } from "next/headers";

import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";



type EmissionPayload = {

    organization_id: string;

    work_order_id?: number;

    cliente: {

        cpf_cnpj: string;

        nome: string;

        email?: string;

        endereco?: any;

    };

    itens: {

        codigo: string;

        descricao: string;

        ncm: string;

        cest?: string;

        cfop: string;

        unidade: string;

        quantidade: number;

        valor_unitario: number;

        valor_total: number;

        codigo_servico?: string;

        aliquota_iss?: number;

    }[];

    valor_total: number;

    meio_pagamento: string; // '01' Dinheiro, '03' Cartão Crédito, etc.

    environment?: 'production' | 'homologation';

};



export async function emitirNFCe(payload: EmissionPayload) {

    const supabase = createClient();

    let invoiceId: number | null = null;



    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[emitirNFCe] User ID:", user?.id, "Auth Error:", authError?.message);



    try {

        // 1. Buscar Token Nuvem Fiscal

        const env = payload.environment || 'production';

        const token = await getNuvemFiscalToken(env);



        // 2. Buscar Configurações da Empresa (Emissor)

        const { data: company } = await supabase

            .from("company_settings")

            .select("*")

            .eq("organization_id", payload.organization_id)

            .single();



        if (!company) {

            console.error("Empresa não encontrada para org:", payload.organization_id);

            throw new Error("Configurações da empresa não encontradas.");

        }



        console.log("[emitirNFCe] Dados da empresa:", JSON.stringify(company, null, 2));



        // Compatibilidade: Verifica cnpj ou cpf_cnpj

        const cnpj = company.cnpj || company.cpf_cnpj;



        if (!cnpj) {

            throw new Error("Dados da empresa incompletos para emissão (CNPJ ausente).");

        }



        // 3. Montar JSON para Nuvem Fiscal (NFC-e)

        // Documentação: https://dev.nuvemfiscal.com.br/docs/api#tag/Nfe/operation/EmitirNfe

        const nfePayload = {

            ambiente: env === 'production' ? 'producao' : 'homologacao',

            infNFe: {

                versao: "4.00",

                ide: {

                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),

                    natOp: "VENDA DE MERCADORIA",

                    mod: 65, // 65 = NFC-e

                    serie: 1,

                    nNF: Math.floor(Math.random() * 100000) + 1, // TODO: Controle sequencial real

                    dhEmi: new Date().toISOString(),

                    tpNF: 1, // 1 = Saída

                    idDest: 1, // 1 = Interna

                    cMunFG: Number(company.codigo_municipio_ibge),

                    tpImp: 4, // 4 = DANFE NFC-e

                    tpEmis: 1, // 1 = Normal

                    tpAmb: env === 'production' ? 1 : 2, // 1 = Produção, 2 = Homologação

                    finNFe: 1, // 1 = Normal

                    indFinal: 1, // 1 = Consumidor Final

                    indPres: 1, // 1 = Presencial

                    procEmi: 0,

                    verProc: "AutoEletrica 1.0"

                },

                emit: {

                    CNPJ: company.cnpj.replace(/\D/g, ""),

                    xNome: company.razao_social,

                    xFant: company.nome_fantasia,

                    enderEmit: {

                        xLgr: company.logradouro,

                        nro: company.numero,

                        xCpl: company.complemento || undefined,

                        xBairro: company.bairro,

                        cMun: Number(company.codigo_municipio_ibge),

                        xMun: company.cidade,

                        UF: company.uf,

                        CEP: company.cep?.replace(/\D/g, ""),

                        cPais: "1058",

                        xPais: "BRASIL"

                    },

                    IE: company.inscricao_estadual?.replace(/\D/g, ""),

                    CRT: Number(company.regime_tributario || "1") // 1 = Simples Nacional

                },

                dest: (() => {
                    const cleanDoc = payload.cliente.cpf_cnpj ? payload.cliente.cpf_cnpj.replace(/\D/g, "") : "";
                    if (!cleanDoc) return undefined;

                    return {
                        CNPJ: cleanDoc.length > 11 ? cleanDoc : undefined,
                        CPF: cleanDoc.length <= 11 ? cleanDoc : undefined,
                        xNome: payload.cliente.nome,
                        indIEDest: 9, // 9 = Não Contribuinte
                        email: payload.cliente.email
                    };
                })(),

                det: payload.itens.map((item, index) => ({

                    nItem: index + 1,

                    prod: {

                        cProd: item.codigo,

                        cEAN: "SEM GTIN",

                        xProd: item.descricao,

                        NCM: item.ncm || "00000000", // Fallback perigoso, ideal validar antes

                        CFOP: item.cfop || "5102",

                        uCom: item.unidade,

                        qCom: item.quantidade,

                        vUnCom: item.valor_unitario,

                        vProd: item.valor_total,

                        cEANTrib: "SEM GTIN",

                        uTrib: item.unidade,

                        qTrib: item.quantidade,

                        vUnTrib: item.valor_unitario,

                        indTot: 1

                    },

                    imposto: {

                        // Simples Nacional básico

                        ICMS: {

                            ICMSSN102: {

                                orig: 0, // 0 = Nacional

                                CSOSN: "102" // Tributada pelo Simples Nacional sem permissão de crédito

                            }

                        },

                        PIS: {

                            PISOutr: {

                                CST: "99",

                                vBC: 0.00,

                                pPIS: 0.00,

                                vPIS: 0.00

                            }

                        },

                        COFINS: {

                            COFINSOutr: {

                                CST: "99",

                                vBC: 0.00,

                                pCOFINS: 0.00,

                                vCOFINS: 0.00

                            }

                        }

                    }

                })),

                total: {

                    ICMSTot: {

                        vBC: 0.00,

                        vICMS: 0.00,

                        vICMSDeson: 0.00,

                        vFCP: 0.00,

                        vBCST: 0.00,

                        vST: 0.00,

                        vFCPST: 0.00,

                        vFCPSTRet: 0.00,

                        vProd: payload.valor_total,

                        vFrete: 0.00,

                        vSeg: 0.00,

                        vDesc: 0.00,

                        vII: 0.00,

                        vIPI: 0.00,

                        vIPIDevol: 0.00,

                        vPIS: 0.00,

                        vCOFINS: 0.00,

                        vOutro: 0.00,

                        vNF: payload.valor_total

                    }

                },

                transp: {

                    modFrete: 9 // 9 = Sem Ocorrência de Transporte

                },

                pag: {
                    detPag: [
                        {
                            tPag: payload.meio_pagamento || "01", // 01 = Dinheiro
                            vPag: payload.valor_total
                        }
                    ]
                },
                infRespTec: {
                    CNPJ: company.cnpj.replace(/\D/g, ""),
                    xContato: company.razao_social ? company.razao_social.substring(0, 60) : "Responsavel Tecnico",
                    email: company.email_contato || "email@exemplo.com",
                    fone: company.telefone ? company.telefone.replace(/\D/g, "") : "0000000000"
                }

            }

        };



        // 4. Salvar Rascunho no Banco (Status: Processing)

        const { data: invoice, error: dbError } = await supabase

            .from("fiscal_invoices")

            .insert({

                organization_id: payload.organization_id,

                work_order_id: payload.work_order_id || null,

                tipo_documento: "NFCe",

                status: "processing",

                environment: env,

                payload_json: nfePayload

            })

            .select()

            .single();



        if (dbError) throw dbError;

        invoiceId = invoice.id;



        // 5. Enviar para Nuvem Fiscal

        console.log("[NuvemFiscal] Enviando NFE Payload:", JSON.stringify(nfePayload, null, 2));



        // CORREÇÃO: Endpoint correto para NFC-e é /nfce (POST)

        const baseUrl = env === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const response = await fetch(`${baseUrl}/nfce`, {

            method: "POST",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            },

            body: JSON.stringify(nfePayload)

        });



        console.log("[NuvemFiscal] Response Status:", response.status);



        const responseText = await response.text();

        console.log("[NuvemFiscal] Response Body:", responseText);



        let result;

        try {

            result = responseText ? JSON.parse(responseText) : {};

        } catch (e) {

            console.error("[NuvemFiscal] Erro ao fazer parse da resposta:", responseText);

            // AUTO-FIX: Atualizar status para erro
            if (invoice && invoice.id) {
                await supabase.from("fiscal_invoices").update({
                    status: "error",
                    error_message: `Resposta inválida da API (Status ${response.status}). Provável timeout.`
                }).eq("id", invoice.id);
            }

            return { success: false, error: `Erro na resposta da Nuvem Fiscal (Status ${response.status}). Verifique os logs.` };

        }



        if (!response.ok) {

            // Erro na API

            await supabase

                .from("fiscal_invoices")

                .update({

                    status: "error",

                    error_message: result.error?.message || JSON.stringify(result)

                })

                .eq("id", invoice.id);



            return { success: false, error: result.error?.message || "Erro na emissão" };

        }



        // 6. Verificar status REAL da resposta da Nuvem Fiscal
        // IMPORTANTE: A API retorna status como "autorizado", "rejeitado" ou "processando"
        const realStatus = result.status;
        console.log("[NuvemFiscal] Status real retornado:", realStatus);

        if (realStatus === 'rejeitado') {
            // REJEITADO pela SEFAZ
            const codigoErro = result.autorizacao?.codigo_status || 'N/A';
            const motivoErro = result.autorizacao?.motivo_status || 'Motivo não informado';

            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: result.numero,
                    serie: result.serie,
                    motivo_rejeicao: `Erro ${codigoErro}: ${motivoErro}`
                })
                .eq("id", invoice.id);

            return {
                success: false,
                error: `NFC-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`,
                invoiceId: invoice.id
            };
        }

        if (realStatus === 'autorizado') {
            // AUTORIZADO pela SEFAZ - sucesso real
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "authorized",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: result.numero,
                    serie: result.serie,
                    xml_url: result.xml_url,
                    pdf_url: result.pdf_url
                })
                .eq("id", invoice.id);

            return { success: true, invoiceId: invoice.id };
        }

        // Status "processando" ou outro - manter como processing
        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: result.numero,
                serie: result.serie
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "Nota em processamento" };



    } catch (error: any) {

        console.error("Erro na emissão:", error);



        if (invoiceId) {

            await supabase

                .from("fiscal_invoices")

                .update({

                    status: "error",

                    error_message: error.message

                })

                .eq("id", invoiceId);

        }



        return { success: false, error: error.message };

    }

}



export async function emitirNFSe(payload: EmissionPayload) {

    const supabase = createClient();

    let invoiceId: number | null = null;



    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[emitirNFSe] User ID:", user?.id);



    try {

        // 1. Buscar Token Nuvem Fiscal

        const env = payload.environment || 'production';

        const token = await getNuvemFiscalToken(env);



        // 2. Buscar Configurações da Empresa

        const { data: company } = await supabase

            .from("company_settings")

            .select("*")

            .eq("organization_id", payload.organization_id)

            .single();



        if (!company || !company.nfse_login) {

            throw new Error("Configurações de NFS-e não encontradas (Login/Senha da Prefeitura).");

        }



        const cnpj = company.cnpj || company.cpf_cnpj;



        // 3. Montar JSON para Nuvem Fiscal (NFS-e - DPS)

        const servicoPrincipal = payload.itens[0]; // Assumindo um serviço principal ou o primeiro para cabeçalho

        if (!servicoPrincipal) throw new Error("Nenhum serviço informado.");



        // Recuperar código de serviço e alíquota do item, ou usar fallback

        // IMPORTANTE: Para IPM Guaíra, cTribMun deve ser o código do serviço (ex: 140102), NÃO o CNAE.

        const codServico = servicoPrincipal.codigo_servico || "140101";

        const codServicoNac = servicoPrincipal.codigo_servico?.replace(/[.-]/g, "") || "140101"; // Formato limpo

        const ibgeMunicipio = company.codigo_municipio_ibge || "4108809"; // 4108809 = Guaíra/PR

        const isGuaira = ibgeMunicipio === "4108809";

        const tomMunicipio = isGuaira ? "7571" : ibgeMunicipio; // TOM de Gua?ra



        const getCodigoNacional = (raw: string) => {

            const digits = raw.replace(/[.-]/g, "");

            if (isGuaira) {

                // Guaíra/IPM: o validador aceita o código completo (sem pontos) como "nacional".

                if (digits.length >= 6) return digits.substring(0, 6); // Ex: 140101

                if (digits.length === 4) return `${digits}01`; // Ex: 14.01 -> 140101 | 14.05 -> 140501

                return digits;

            }

            if (digits.length >= 6) {

                const base = digits.substring(0, 4);

                return `${base.substring(0, 2)}.${base.substring(2, 4)}`; // Ex: 14.01

            }

            if (digits.length >= 4) return `${digits.substring(0, 2)}.${digits.substring(2, 4)}`; // Ex: 14.01

            return digits;

        };



        const getCodigoMunicipal = (raw: string) => {

            const digits = raw.replace(/[.-]/g, "");

            if (digits.length >= 6) return digits.substring(0, 6); // Ex: 140101

            if (digits.length === 4 && ibgeMunicipio === "4108809" && digits === "1401") {

                return "140101"; // Guaíra/IPM: subitem municipal para 14.01 (Testado e Aprovado)

            }

            return digits;

        };

        const normalizeMunicipio = (codigo?: string | number) => {

            if (!codigo) return tomMunicipio;

            const raw = String(codigo).replace(/\D/g, "");

            if (isGuaira && raw === "4108809") return "7571";

            return raw;

        };



        const dpsPayload = {

            ambiente: env === 'production' ? 'producao' : 'homologacao',

            infDPS: {

                dhEmi: new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00',

                dCompet: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }),

                prest: {

                    CNPJ: cnpj.replace(/\D/g, "")

                },

                toma: (() => {
                    const cleanDoc = payload.cliente.cpf_cnpj ? payload.cliente.cpf_cnpj.replace(/\D/g, "") : "";

                    return {
                        CNPJ: cleanDoc.length > 11 ? cleanDoc : undefined,
                        CPF: cleanDoc.length <= 11 ? cleanDoc : undefined,
                        xNome: payload.cliente.nome,
                        end: payload.cliente.endereco ? {
                            xLgr: payload.cliente.endereco.logradouro,
                            nro: payload.cliente.endereco.numero,
                            xBairro: payload.cliente.endereco.bairro,
                            endNac: {
                                cMun: payload.cliente.endereco.codigo_municipio?.replace(/\D/g, "") || "4108809",
                                CEP: payload.cliente.endereco.cep?.replace(/\D/g, "")
                            }
                        } : undefined
                    };
                })(),

                serv: {

                    cServ: {

                        cTribNac: (() => {

                            const formatted = getCodigoNacional(codServicoNac);

                            console.log("DEBUG NFSe: cTribNac Formatado:", formatted);

                            return formatted;

                        })(),

                        cTribMun: (() => {

                            const formatted = getCodigoMunicipal(codServicoNac);

                            return formatted;

                        })(),

                        CNAE: "4520007",

                        cSitTrib: "0",

                        xDescServ: payload.itens.map(i => `${i.descricao} (R$ ${i.valor_total.toFixed(2)})`).join("; ")

                    },

                    locPrest: {

                        cLocPrestacao: ibgeMunicipio // ONDE o serviço foi prestado (Guaíra)

                    }

                },

                valores: {

                    vServPrest: {

                        vServ: payload.valor_total

                    },

                    trib: {

                        tribMun: {

                            tribISSQN: 1, // 1 - Tributável
                            tpRetISSQN: 2, // 2 - Não Retido
                            pAliq: servicoPrincipal.aliquota_iss || 2.01,
                            vISSQN: 0, // Zerado para Simples Nacional / Não Retido
                            cLocIncid: ibgeMunicipio // ONDE o imposto é devido (Guaíra)

                        }

                    }

                }

            }

        };



        // 4. Salvar Rascunho no Banco

        const { data: invoice, error: dbError } = await supabase

            .from("fiscal_invoices")

            .insert({

                organization_id: payload.organization_id,

                work_order_id: payload.work_order_id || null,

                tipo_documento: "NFSe",

                status: "processing",

                environment: env,

                payload_json: dpsPayload

            })

            .select()

            .single();



        if (dbError) throw dbError;

        invoiceId = invoice.id;



        // 5. Enviar para Nuvem Fiscal

        console.log("[NuvemFiscal] Enviando DPS Payload Corrigido:", JSON.stringify(dpsPayload, null, 2));



        const baseUrl = env === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const response = await fetch(`${baseUrl}/nfse/dps`, {

            method: "POST",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            },

            body: JSON.stringify(dpsPayload)

        });



        const responseText = await response.text();

        console.log("[NuvemFiscal] Response Status:", response.status);

        console.log("[NuvemFiscal] Response Body:", responseText);



        let result;

        try {

            result = responseText ? JSON.parse(responseText) : {};

        } catch (e) {

            console.error("[NuvemFiscal] Erro ao fazer parse da resposta:", responseText);

            result = {};

        }



        if (!response.ok) {

            const errorDetails = result.error?.message || JSON.stringify(result);

            console.error("[NuvemFiscal] Erro detalhado:", errorDetails);

            // AUTO-RETRY LOGIC PARA ERRO 00229 (Endereço já cadastrado)
            // "00229: O Tomador do serviço possui cadastro econômico no município. Não é possível inserir um novo endereço.."
            // OBS: Verificando "229", "cadastr" e "endere" (sem sufixo) para evitar problemas de encoding (ex: endereÃ§o)
            const fullErrorString = JSON.stringify(result);
            if (
                fullErrorString.includes("229") ||
                (fullErrorString.includes("cadastr") && (fullErrorString.includes("endere") || fullErrorString.includes("endereco")))
            ) {
                console.log("[NuvemFiscal] Detectado erro 00229. Tentando reenvio sem endereço do tomador...");

                // Remove o endereço do payload original
                if (dpsPayload.infDPS.toma && dpsPayload.infDPS.toma.end) {
                    delete dpsPayload.infDPS.toma.end;

                    console.log("[NuvemFiscal] Reenviando payload modificado (sem endereço)...");

                    // Tenta enviar novamente
                    const retryResponse = await fetch(`${baseUrl}/nfse/dps`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(dpsPayload)
                    });

                    const retryResponseText = await retryResponse.text();
                    console.log("[NuvemFiscal] Retry Response Status:", retryResponse.status);

                    let retryResult;
                    try {
                        retryResult = retryResponseText ? JSON.parse(retryResponseText) : {};
                    } catch (e) {
                        retryResult = {};
                    }

                    if (retryResponse.ok) {
                        // SUCESSO NO RETRY!
                        result = retryResult;
                        // Continua o fluxo normal de sucesso abaixo...
                    } else {
                        // Falhou de novo, retorna o erro original (ou o novo)
                        // Falhou de novo, retorna o erro original (ou o novo)
                        const retryErrorString = JSON.stringify(retryResult);
                        await supabase
                            .from("fiscal_invoices")
                            .update({
                                status: "error",
                                error_message: `Tentativa 1: ${fullErrorString} | Tentativa 2: ${retryErrorString}`
                            })
                            .eq("id", invoice.id);

                        return { success: false, error: `Erro NuvemFiscal (Retry falhou): ${retryErrorString}` };
                    }

                } else {
                    // Log para debug se não achou endereço
                    console.log("[NuvemFiscal] Erro 00229 detectado mas não havia endereço para remover.");

                    // Se não tinha endereço para tirar, falha normal
                    await supabase
                        .from("fiscal_invoices")
                        .update({
                            status: "error",
                            error_message: fullErrorString // Salva JSON completo
                        })
                        .eq("id", invoice.id);

                    return { success: false, error: `Erro NuvemFiscal: ${errorDetails}` };
                }
            } else {
                // Erro normal (não é o 00229)
                await supabase
                    .from("fiscal_invoices")
                    .update({
                        status: "error",
                        error_message: fullErrorString // Salva JSON completo para debug
                    })
                    .eq("id", invoice.id);

                return { success: false, error: `Erro NuvemFiscal: ${errorDetails}` };
            }

        }

        // Se response.ok era true OU se recuperamos no retry:

        // 6. Sucesso
        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing", // NFS-e é assíncrono, fica processando até consultar depois
                nuvemfiscal_uuid: result.id,
                numero: result.numero,
                serie: result.serie,
                // Atualiza o payload no banco para refletir o que funcionou (sem endereço se foi retry)
                payload_json: dpsPayload
            })
            .eq("id", invoice.id);


        // 6.5 Verificação automática de status (poll imediato após 2s)
        // Muitas prefeituras autorizam instantaneamente, então verificamos logo
        setTimeout(async () => {
            try {
                console.log("[NFSe] Verificando status automaticamente após 2s...");
                await consultarNFSe(invoice.id);
            } catch (e) {
                console.error("[NFSe] Erro na verificação automática:", e);
            }
        }, 2000);

        return { success: true, invoiceId: invoice.id };



    } catch (error: any) {

        console.error("Erro na emissão NFS-e:", error);

        if (invoiceId) {

            await supabase

                .from("fiscal_invoices")

                .update({ status: "error", error_message: error.message })

                .eq("id", invoiceId);

        }

        return { success: false, error: error.message };

    }

}



export async function consultarNFSe(invoiceId: string) {

    const supabase = createClient();



    try {

        // 1. Buscar a nota no banco para pegar o ID da NuvemFiscal

        const { data: invoice } = await supabase

            .from("fiscal_invoices")

            .select("*")

            .eq("id", invoiceId)

            .single();



        if (!invoice || !invoice.nuvemfiscal_uuid) {

            return { success: false, error: "Nota não encontrada ou sem ID da NuvemFiscal." };

        }



        // 2. Buscar Token

        const env = (invoice.environment as 'production' | 'homologation') || 'production';

        const token = await getNuvemFiscalToken(env);



        // 3. Consultar na NuvemFiscal

        // Endpoint: GET /nfce/{id} ou /nfse/{id}

        const baseUrl = env === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const response = await fetch(`${baseUrl}/nfse/${invoice.nuvemfiscal_uuid}`, {

            method: "GET",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            }

        });



        let result = await response.json();

        console.log("[Consultar NFS-e] Resultado:", JSON.stringify(result, null, 2));



        if (!response.ok) {

            return { success: false, error: result.error?.message || "Erro ao consultar status." };

        }



        // 4. Atualizar status no banco

        // Mapeamento de status NuvemFiscal -> Nosso Banco

        let novoStatus = invoice.status;

        let errorMessage = null;



        if (result.status === 'autorizado' || result.status === 'autorizada') novoStatus = 'authorized';

        else if (result.status === 'erro' || result.status === 'rejeitado' || result.status === 'negado') {

            novoStatus = 'error';

            // Tenta extrair mensagem detalhada
            if (result.mensagens && Array.isArray(result.mensagens) && result.mensagens.length > 0) {
                errorMessage = result.mensagens.map((m: any) => `${m.codigo}: ${m.descricao}`).join(' | ');
            } else if (result.error) {
                errorMessage = result.error.message || JSON.stringify(result.error);
            } else {
                errorMessage = result.motivo_status || JSON.stringify(result);
            }

            // Log completo para debug
            console.log("[Consultar Check] Error message set to:", errorMessage);

            // AUTO-RETRY LOGIC (ASYNC)
            // Se detectarmos o erro 00229, tentamos reenviar sem o endereço.
            if (errorMessage && (errorMessage.includes("00229") || (errorMessage.includes("cadastro") && errorMessage.includes("endereço") && errorMessage.includes("Tomador")))) {
                console.log("[Consultar Check] Detectado erro 00229. Tentando AUTO-RETRY sem endereço...");

                // 1. Pegar payload original
                let originalPayload = invoice.payload_json;
                // Parse se for string
                if (typeof originalPayload === 'string') {
                    try {
                        originalPayload = JSON.parse(originalPayload);
                    } catch (e) {
                        console.error("[AutoRequest] Erro ao parsear payload_json", e);
                        originalPayload = null;
                    }
                }

                if (originalPayload && originalPayload.infDPS && originalPayload.infDPS.toma && originalPayload.infDPS.toma.end) {
                    // 2. Remover endereço
                    delete originalPayload.infDPS.toma.end;
                    console.log("[Consultar Check] Endereço removido. Reenviando...");

                    // 3. Reenviar (POST /nfse/dps)
                    // Reusando token e baseUrl já definidos acima
                    try {
                        const retryResponse = await fetch(`${baseUrl}/nfse/dps`, {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify(originalPayload)
                        });

                        const retryResult = await retryResponse.json();
                        console.log("[AutoRetry] Resultado:", JSON.stringify(retryResult, null, 2));

                        if (retryResponse.ok) {
                            // SUCESSO! 
                            // Se retornou 'autorizado', ótimo. Se 'processando', também.
                            // Vamos confiar no status retornado.
                            if (retryResult.status === 'autorizado' || retryResult.status === 'autorizada') {
                                novoStatus = 'authorized';
                            } else if (retryResult.status === 'processando') {
                                novoStatus = 'processing';
                            }

                            // Atualiza os dados do resultado (XML, PDF, Number, etc) no objeto 'result' atual para salvar no banco
                            // Nota: O ID da NuvemFiscal mudou! Precisamos atualizar isso no banco também?
                            // Sim, mas a função 'update' lá embaixo usa 'invoiceId'.
                            // O ideal é atualizar o nuvemfiscal_uuid também, mas a função abaixo não está atualizando ele.
                            // Vamos ter que fazer um update extra ou adicionar o campo no update principal.

                            // Hack: Atualiza o 'result' local para que o update lá embaixo use os dados novos
                            result = retryResult;

                            // Importante: Atualizar o nuvemfiscal_uuid no banco pois mudou
                            if (retryResult.id) {
                                await supabase.from("fiscal_invoices").update({ nuvemfiscal_uuid: retryResult.id }).eq("id", invoiceId);
                            }

                            // Limpar mensagem de erro
                            errorMessage = null;

                        } else {
                            // Retry falhou também
                            const retryErr = retryResult.error?.message || JSON.stringify(retryResult);
                            errorMessage = `Erro Original: ${errorMessage} | Retry Falhou: ${retryErr}`;
                        }
                    } catch (retryEx: any) {
                        console.error("[AutoRetry] Exception:", retryEx);
                        errorMessage = `Erro Original: ${errorMessage} | Retry Exception: ${retryEx.message}`;
                    }
                } else {
                    console.log("[Consultar Check] Payload inválido ou sem endereço para remover. Abortando retry.");
                }
            }
        }
        else if (result.status === 'cancelado') novoStatus = 'cancelled';



        await supabase

            .from("fiscal_invoices")
            .update({
                status: novoStatus,
                numero: result.numero,
                serie: result.serie,
                chave_acesso: result.chave || result.codigo_verificacao,
                xml_url: result.xml_url, // Verificar se a API retorna direto ou em objeto aninhado
                pdf_url: result.pdf_url || result.link_url,
                error_message: errorMessage
            })
            .eq("id", invoiceId);



        return { success: true, status: novoStatus, data: result };



    } catch (error: any) {

        console.error("Erro ao consultar NFS-e:", error);

        return { success: false, error: error.message };

    }

}

export async function updateCompanyCredentials(organizationId: string, environment: 'production' | 'homologation' = 'production') {

    const supabase = createClient();



    try {

        // 1. Buscar Configurações

        const { data: company } = await supabase

            .from("company_settings")

            .select("*")

            .eq("organization_id", organizationId)

            .single();



        if (!company || !company.nfse_login || !company.nfse_password) {

            return { success: false, error: "Credenciais não encontradas no banco." };

        }



        const cnpj = (company.cnpj || company.cpf_cnpj).replace(/\D/g, "");

        const token = await getNuvemFiscalToken(environment);



        // 2. Atualizar na NuvemFiscal - Endpoint Específico de NFS-e

        // PUT /empresas/{cpf_cnpj}/nfse

        const payload = {

            ambiente: environment === 'production' ? 'producao' : 'homologacao',

            rps: {

                lote: 1,

                serie: "1",

                numero: 1

            },

            prefeitura: {

                login: cnpj, // Usando CNPJ como login

                senha: company.nfse_password

            }

        };



        console.log("[Update Company] Enviando credenciais NFS-e...", payload);



        const baseUrl = environment === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const response = await fetch(`${baseUrl}/empresas/${cnpj}/nfse`, {

            method: "PUT",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            },

            body: JSON.stringify(payload)

        });



        const result = await response.json();

        console.log("[Update Company] Resultado:", JSON.stringify(result, null, 2));



        if (!response.ok) {

            // Se der 404, pode ser que precise criar a configuração primeiro com POST

            if (response.status === 404) {

                console.log("[Update Company] Tentando POST...");

                const responsePost = await fetch(`${baseUrl}/empresas/${cnpj}/nfse`, {

                    method: "POST",

                    headers: {

                        "Authorization": `Bearer ${token}`,

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify(payload)

                });

                const resultPost = await responsePost.json();

                if (!responsePost.ok) {

                    return { success: false, error: resultPost.error?.message || "Erro ao criar config NFS-e." };

                }

                return { success: true, message: "Configuração NFS-e criada com sucesso!" };

            }

            return { success: false, error: result.error?.message || "Erro ao atualizar config NFS-e." };

        }



        return { success: true, message: "Credenciais NFS-e atualizadas com sucesso!" };



    } catch (error: any) {

        console.error("Erro ao atualizar empresa:", error);

        return { success: false, error: error.message };

    }

}



export async function cancelarNota(invoiceId: string, justificativa: string = "Erro de preenchimento") {

    const supabase = createClient();



    try {

        // 1. Buscar a nota

        const { data: invoice } = await supabase

            .from("fiscal_invoices")

            .select("*")

            .eq("id", invoiceId)

            .single();



        if (!invoice || !invoice.nuvemfiscal_uuid) {

            return { success: false, error: "Nota não encontrada ou sem ID da NuvemFiscal." };

        }



        const env = (invoice.environment as 'production' | 'homologation') || 'production';

        const token = await getNuvemFiscalToken(env);



        // 2. Verificar prazo de cancelamento para NFC-e (30 minutos)

        if (invoice.tipo_documento === 'NFCe') {

            const emissionTime = new Date(invoice.created_at).getTime();

            const now = Date.now();

            const thirtyMinutes = 30 * 60 * 1000;



            if (now - emissionTime > thirtyMinutes) {

                return {

                    success: false,

                    error: "NFC-e não pode ser cancelada: Prazo de 30 minutos expirado."

                };

            }

        }



        // 3. Cancelar na NuvemFiscal

        // Endpoint: POST /nfce/{id}/cancelar ou /nfse/{id}/cancelar

        let endpoint = "";

        let body: any = { justificativa };



        if (invoice.tipo_documento === 'NFCe') {

            endpoint = `/nfce/${invoice.nuvemfiscal_uuid}/cancelar`;

        } else {

            endpoint = `/nfse/${invoice.nuvemfiscal_uuid}/cancelar`;

            body = {

                codigo: "2", // 2 - Erro na emissão

                motivo: justificativa

            };

        }



        console.log(`[Cancelar] Enviando pedido para ${endpoint}...`);



        const baseUrl = env === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const response = await fetch(`${baseUrl}${endpoint}`, {

            method: "POST",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            },

            body: JSON.stringify(body)

        });



        const result = await response.json();

        console.log("[Cancelar] Resultado:", JSON.stringify(result, null, 2));



        if (!response.ok) {

            return { success: false, error: result.error?.message || "Erro ao cancelar nota." };

        }



        // 3. Atualizar Banco

        await supabase

            .from("fiscal_invoices")

            .update({

                status: "cancelled",

                error_message: null // Limpar erro se houver

            })

            .eq("id", invoiceId);



        return { success: true, message: "Nota cancelada com sucesso!" };



    } catch (error: any) {

        console.error("Erro ao cancelar:", error);

        return { success: false, error: error.message };

    }

}

