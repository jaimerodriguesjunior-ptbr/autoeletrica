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

        telefone?: string;

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

        origem?: string;

        csosn?: string;

        cbenef?: string;

        ipi_cst?: string;

        ipi_cenq?: string;

        ipi_base?: number;

        ipi_aliquota?: number;

        ipi_valor?: number;

        pis_cst?: string;

        pis_base?: number;

        pis_aliquota?: number;

        pis_valor?: number;

        cofins_cst?: string;

        cofins_base?: number;

        cofins_aliquota?: number;

        cofins_valor?: number;

        codigo_servico?: string;

        aliquota_iss?: number;

    }[];

    valor_total: number;

    valor_frete?: number;

    valor_seguro?: number;

    valor_desconto?: number;

    valor_outras_despesas?: number;

    meio_pagamento: string; // '01' Dinheiro, '03' Cartão Crédito, etc.

    environment?: 'production' | 'homologation';

    tipo_documento?: "NFCe" | "NFe";

    natureza_operacao?: string;

    tipo_nfe?: 0 | 1;

    finalidade_nfe?: 1 | 2 | 3 | 4;

    ind_pres?: number;

    ind_intermed?: 0 | 1;

    ind_final?: 0 | 1;

    inf_ad_fisco?: string;
    referenced_key?: string;

    intermediador?: {

        cnpj?: string;

        id_cadastro?: string;

    };

    transporte?: {

        nome?: string;

        cpf_cnpj?: string;

        ie?: string;

        endereco?: string;

        municipio?: string;

        uf?: string;

        placa?: string;

        placa_uf?: string;

        rntc?: string;

        volumes?: {

            quantidade?: number;

            especie?: string;

            marca?: string;

            numeracao?: string;

            peso_liquido?: number;

            peso_bruto?: number;

        };

    };

    entrega?: any;

    retirada?: any;

};

function normalizeDocument(value?: string | null) {
    const normalized = value?.replace(/\D/g, "") || "";
    return normalized || null;
}

function isRepeatedDigits(value: string) {
    return /^(\d)\1+$/.test(value);
}

function isValidCpf(value?: string | null) {
    const clean = normalizeDocument(value) || "";
    if (clean.length !== 11 || isRepeatedDigits(clean)) return false;

    const calcCheck = (base: string, factor: number) => {
        let total = 0;
        for (const char of base) {
            total += Number(char) * factor--;
        }
        const rest = (total * 10) % 11;
        return rest === 10 ? 0 : rest;
    };

    const d1 = calcCheck(clean.slice(0, 9), 10);
    const d2 = calcCheck(clean.slice(0, 10), 11);
    return d1 === Number(clean[9]) && d2 === Number(clean[10]);
}

function isValidCnpj(value?: string | null) {
    const clean = normalizeDocument(value) || "";
    if (clean.length !== 14 || isRepeatedDigits(clean)) return false;

    const calcCheck = (base: string, factors: number[]) => {
        let total = 0;
        for (let i = 0; i < base.length; i++) {
            total += Number(base[i]) * factors[i];
        }
        const rest = total % 11;
        return rest < 2 ? 0 : 11 - rest;
    };

    const d1 = calcCheck(clean.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calcCheck(clean.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(clean[12]) && d2 === Number(clean[13]);
}

function isValidBrazilianDocument(value?: string | null) {
    const clean = normalizeDocument(value) || "";
    if (clean.length === 11) return isValidCpf(clean);
    if (clean.length === 14) return isValidCnpj(clean);
    return false;
}

function parseNfseValidationIssues(result: any): string[] {
    const rawErrors = Array.isArray(result?.error?.errors) ? result.error.errors : [];
    const issues: string[] = [];

    for (const item of rawErrors) {
        const field = String(item?.message || item?.path || "").toLowerCase();

        if (field.includes("infdps.toma.cpf")) {
            issues.push("CPF do tomador invalido. Informe um CPF com 11 digitos validos.");
            continue;
        }

        if (field.includes("infdps.toma.cnpj")) {
            issues.push("CNPJ do tomador invalido. Informe um CNPJ com 14 digitos validos.");
            continue;
        }

        if (item?.message) {
            issues.push(String(item.message));
        }
    }

    return [...new Set(issues)];
}

function buildNfseProviderErrorMessage(result: any, fallback?: string) {
    const issues = parseNfseValidationIssues(result);
    if (issues.length) return `Erro de validacao da NFS-e: ${issues.join(" ")}`;

    const providerMessage = result?.error?.message;
    if (typeof providerMessage === "string" && providerMessage.trim()) {
        return providerMessage.trim();
    }

    return fallback || "Erro na emissao da NFS-e.";
}

function toMoneyNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Number(value.toFixed(2));
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return fallback;

        const compact = trimmed.replace(/\s/g, "");
        const normalized = compact.includes(",")
            ? compact.replace(/\./g, "").replace(",", ".") // pt-BR: 1.234,56
            : compact.replace(/,/g, ""); // en-US: 1234.56

        const parsed = Number(normalized);
        if (Number.isFinite(parsed)) return Number(parsed.toFixed(2));
    }

    return fallback;
}

function sanitizeFiscalText(value: unknown, maxLength?: number) {
    if (value === null || value === undefined) return undefined;

    let text = String(value)
        .normalize("NFC")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/[\u00A0\u2000-\u200D\u202F\u205F\u3000]/g, " ")
        .replace(/[‘’‚‛`´]/g, "'")
        .replace(/[“”„‟]/g, "\"")
        .replace(/[–—−]/g, "-")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (typeof maxLength === "number" && maxLength > 0) {
        text = text.slice(0, maxLength).trim();
    }

    return text || undefined;
}

function getSaoPauloDatePartsWithSafety() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(now);

    const year   = parts.find(p => p.type === "year")?.value   || "2026";
    const month  = parts.find(p => p.type === "month")?.value  || "01";
    const day    = parts.find(p => p.type === "day")?.value    || "01";
    const hour   = parts.find(p => p.type === "hour")?.value   || "00";
    const minute = parts.find(p => p.type === "minute")?.value || "00";
    const second = parts.find(p => p.type === "second")?.value || "00";
    const dCompet = `${year}-${month}-${day}`;

    return {
        dhEmi: `${dCompet}T${hour}:${minute}:${second}-03:00`,
        dCompet
    };
}

function buildOutputInvoiceSnapshot(
    payload: EmissionPayload,
    company: any,
    issuedAt: string
) {
    return {
        direction: "output",
        data_emissao: issuedAt,
        valor_total: getNFeValorNota(payload, payload.valor_total),
        emitente_nome: company.razao_social || company.nome_fantasia || null,
        emitente_cnpj: normalizeDocument(company.cnpj || company.cpf_cnpj),
        destinatario_nome: payload.cliente.nome || null,
        destinatario_cnpj: normalizeDocument(payload.cliente.cpf_cnpj),
    };
}

async function tryFetchXmlContent(xmlUrl?: string | null) {
    if (!xmlUrl) return null;

    try {
        const response = await fetch(xmlUrl);
        if (!response.ok) return null;
        return await response.text();
    } catch (error) {
        console.warn("[Fiscal] Nao foi possivel baixar XML automaticamente:", error);
        return null;
    }
}

async function ensureNoActiveInvoiceForWorkOrder(
    supabase: any,
    payload: EmissionPayload,
    tipoDocumento: "NFCe" | "NFSe" | "NFe",
    environment: "production" | "homologation"
) {
    if (!payload.work_order_id) return null;

    let query = supabase
        .from("fiscal_invoices")
        .select("id, status")
        .eq("organization_id", payload.organization_id)
        .eq("work_order_id", payload.work_order_id)
        .eq("direction", "output")
        .eq("environment", environment)
        .in("status", ["draft", "processing", "authorized"])
        .limit(1);

    // Bloqueio apenas por mesmo tipo de documento.
    // NFC-e e NF-e nao se bloqueiam entre si.
    query = query.eq("tipo_documento", tipoDocumento);

    const { data: existingInvoice, error } = await query.maybeSingle();

    if (error) {
        throw new Error(`Nao foi possivel validar duplicidade de ${tipoDocumento}.`);
    }

    if (!existingInvoice) return null;

    return `Ja existe ${tipoDocumento} ${environment === "production" ? "de producao" : "de homologacao"} para esta OS.`;
}

async function ensureNoActiveDevolucaoForEntryInvoice(
    supabase: any,
    organizationId: string,
    entryInvoiceId: string,
    environment: "production" | "homologation"
) {
    if (!entryInvoiceId) return null;

    const { data: existingInvoice, error } = await supabase
        .from("fiscal_invoices")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("direction", "output")
        .eq("tipo_documento", "NFe")
        .eq("environment", environment)
        .in("status", ["draft", "processing", "authorized"])
        .contains("payload_json", { _entry_invoice_id: entryInvoiceId })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error("Nao foi possivel validar duplicidade de devolucao.");
    }

    if (!existingInvoice) return null;

    return `Ja existe NF-e de devolucao ${environment === "production" ? "de producao" : "de homologacao"} ativa para esta nota de entrada.`;
}

function buildAdvancedInfAdic(payload: EmissionPayload, fallbackInfCpl: string) {
    const infCpl = (payload as any).observacao?.trim() || fallbackInfCpl;
    const infAdFisco = payload.inf_ad_fisco?.trim();
    return {
        infCpl,
        ...(infAdFisco ? { infAdFisco } : {}),
    };
}

function buildIntermediador(payload: EmissionPayload) {
    if (payload.ind_intermed !== 1) return undefined;
    const cnpj = normalizeDocument(payload.intermediador?.cnpj);
    const idCadIntTran = payload.intermediador?.id_cadastro?.trim();
    if (!cnpj || !idCadIntTran) return undefined;
    if (!isValidCnpj(cnpj)) {
        throw new Error("CNPJ do intermediador invalido.");
    }
    return { CNPJ: cnpj, idCadIntTran };
}

function buildNFeDetPag(payload: EmissionPayload, valorTotal: number, fallback = "90") {
    const tPag = payload.meio_pagamento || fallback;
    return [{ tPag, vPag: tPag === "90" ? 0 : valorTotal }];
}

function buildNFeSemPagamento() {
    return [{ tPag: "90", vPag: 0 }];
}

function buildNFeTransp(payload: EmissionPayload) {
    const modFrete = Number((payload as any).modFrete || "9");
    const transporte = payload.transporte || {};
    const transportDoc = normalizeDocument(transporte.cpf_cnpj);
    const vol = transporte.volumes;
    const transportName = sanitizeFiscalText(transporte.nome, 60);
    const transportStreet = sanitizeFiscalText(transporte.endereco, 60);
    const transportCity = sanitizeFiscalText(transporte.municipio, 60);

    if (modFrete !== 9 && !isValidBrazilianDocument(transportDoc)) {
        throw new Error("CPF/CNPJ da transportadora invalido.");
    }

    return {
        modFrete,
        ...(modFrete !== 9 && (transportName || transportDoc) ? {
            transporta: {
                CNPJ: transportDoc && transportDoc.length === 14 ? transportDoc : undefined,
                CPF: transportDoc && transportDoc.length === 11 ? transportDoc : undefined,
                xNome: transportName,
                IE: transporte.ie ? String(transporte.ie).replace(/\D/g, "") : undefined,
                xEnder: transportStreet,
                xMun: transportCity,
                UF: transporte.uf || undefined,
            },
        } : {}),
        ...(modFrete !== 9 && transporte.placa ? {
            veicTransp: {
                placa: String(transporte.placa).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
                UF: String(transporte.placa_uf || "").toUpperCase() || undefined,
                RNTC: transporte.rntc || undefined,
            },
        } : {}),
        ...(modFrete !== 9 && vol && (vol.quantidade || vol.especie || vol.marca || vol.numeracao || vol.peso_liquido || vol.peso_bruto) ? {
            vol: [{
                qVol: vol.quantidade,
                esp: vol.especie || undefined,
                marca: vol.marca || undefined,
                nVol: vol.numeracao || undefined,
                pesoL: vol.peso_liquido,
                pesoB: vol.peso_bruto,
            }],
        } : {}),
    };
}

function buildNFeEnderecoAux(address: any) {
    if (!address) return undefined;
    const doc = normalizeDocument(address.cpf_cnpj);
    const codigoMunicipio = String(address.codigo_municipio || address.codigo_municipio_ibge || "").replace(/\D/g, "");
    const uf = String(address.uf || "").toUpperCase();
    const nome = sanitizeFiscalText(address.nome, 60);
    const logradouro = sanitizeFiscalText(address.logradouro, 60);
    const complemento = sanitizeFiscalText(address.complemento, 60);
    const bairro = sanitizeFiscalText(address.bairro, 60);
    const cidade = sanitizeFiscalText(address.cidade, 60);

    if (!doc || !codigoMunicipio || !logradouro || !address.numero || !bairro || !cidade || !uf || !address.cep) {
        return undefined;
    }

    if (!isValidBrazilianDocument(doc)) {
        throw new Error("CPF/CNPJ invalido no endereco auxiliar (entrega/retirada).");
    }

    const ie = String(address.ie || address.inscricao_estadual || "").replace(/\D/g, "");
    return {
        CNPJ: doc.length === 14 ? doc : undefined,
        CPF: doc.length === 11 ? doc : undefined,
        xNome: nome,
        xLgr: logradouro,
        nro: String(address.numero),
        xCpl: complemento,
        xBairro: bairro,
        cMun: Number(codigoMunicipio),
        xMun: cidade,
        UF: uf,
        CEP: String(address.cep).replace(/\D/g, ""),
        cPais: "1058",
        xPais: "BRASIL",
        ...(ie ? { IE: ie } : {}),
    };
}

function buildNFeEntregaRetirada(payload: EmissionPayload) {
    const entrega = buildNFeEnderecoAux(payload.entrega);
    const retirada = buildNFeEnderecoAux(payload.retirada);
    return {
        ...(entrega ? { entrega } : {}),
        ...(retirada ? { retirada } : {}),
    };
}

const IPI_TRIBUTADO_CSTS = new Set(["00", "49", "50", "99"]);
const IPI_NAO_TRIBUTADO_CSTS = new Set(["01", "02", "03", "04", "05", "51", "52", "53", "54", "55"]);

function normalizeTwoDigitTaxCode(value?: string | null) {
    const clean = String(value || "").replace(/\D/g, "");
    if (!clean) return "";
    return clean.padStart(2, "0").slice(-2);
}

function getCompanyCrt(company: { regime_tributario?: string | number | null }) {
    return Number(company.regime_tributario || "1");
}

function assertNFeSimplesNacional(company: { regime_tributario?: string | number | null }) {
    const crt = getCompanyCrt(company);
    if (crt !== 1) {
        throw new Error("Emissao de NF-e por este motor esta liberada apenas para empresas do Simples Nacional (CRT 1). Para Regime Normal, o ICMS precisa de CST e regras proprias.");
    }
}

function getCompanyNFeSerie(company: { nfe_serie?: string | number | null }) {
    const serie = Number(company.nfe_serie || 1);
    return Number.isInteger(serie) && serie > 0 ? serie : 1;
}

function buildNFeItemIpi(item: EmissionPayload["itens"][number]) {
    const ipiValor = toMoneyNumber(item.ipi_valor);
    const ipiBase = toMoneyNumber(item.ipi_base);
    const ipiAliquota = toMoneyNumber(item.ipi_aliquota);
    const shouldSendIpi = Boolean(item.ipi_cst?.trim()) || ipiValor > 0 || ipiBase > 0 || ipiAliquota > 0;

    if (!shouldSendIpi) {
        return undefined;
    }

    const cst = normalizeTwoDigitTaxCode(item.ipi_cst) || "99";
    const cleanCEnq = String(item.ipi_cenq || "").replace(/\D/g, "");
    const cEnq = cleanCEnq ? cleanCEnq.padStart(3, "0").slice(-3) : "999";
    if (IPI_NAO_TRIBUTADO_CSTS.has(cst)) {
        return {
            cEnq,
            IPINT: { CST: cst },
        };
    }

    if (!IPI_TRIBUTADO_CSTS.has(cst)) {
        throw new Error(`CST de IPI invalido ou nao suportado: ${cst}. Use um CST tributado (00, 49, 50, 99) ou nao tributado (01-05, 51-55).`);
    }

    return {
        cEnq,
        IPITrib: {
            CST: cst,
            vBC: ipiBase,
            pIPI: ipiAliquota,
            vIPI: ipiValor,
        },
    };
}

function buildNFeItemImposto(item: EmissionPayload["itens"][number], fallbackCsosn: string) {
    const ipi = buildNFeItemIpi(item);
    const csosn = item.csosn?.trim() || fallbackCsosn;
    const supportedCsosn = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
    if (!supportedCsosn.includes(csosn)) {
        throw new Error(`CSOSN ${csosn || "vazio"} nao suportado para emissao de NF-e.`);
    }
    const origem = Number(item.origem ?? 0);
    const zeroSt = {
        modBCST: 4,
        pMVAST: 0,
        pRedBCST: 0,
        vBCST: 0,
        pICMSST: 0,
        vICMSST: 0,
    };
    const icmsSn =
        csosn === "101"
            ? { ICMSSN101: { orig: origem, CSOSN: csosn, pCredSN: 0, vCredICMSSN: 0 } }
            : csosn === "201"
                ? { ICMSSN201: { orig: origem, CSOSN: csosn, ...zeroSt, pCredSN: 0, vCredICMSSN: 0 } }
                : csosn === "202" || csosn === "203"
                    ? { ICMSSN202: { orig: origem, CSOSN: csosn, ...zeroSt } }
                    : csosn === "500"
                        ? {
                            ICMSSN500: {
                                orig: origem,
                                CSOSN: csosn,
                                vBCSTRet: 0,
                                pST: 0,
                                vICMSSubstituto: 0,
                                vICMSSTRet: 0,
                                vBCFCPSTRet: 0,
                                pFCPSTRet: 0,
                                vFCPSTRet: 0,
                            },
                        }
                        : csosn === "900"
                            ? {
                                ICMSSN900: {
                                    orig: origem,
                                    CSOSN: csosn,
                                    modBC: 3,
                                    vBC: 0,
                                    pRedBC: 0,
                                    pICMS: 0,
                                    vICMS: 0,
                                    ...zeroSt,
                                    pCredSN: 0,
                                    vCredICMSSN: 0,
                                },
                            }
                            : {
                                ICMSSN102: {
                                    orig: origem,
                                    CSOSN: csosn,
                                },
                            };

    return {
        ICMS: icmsSn,
        PIS: {
            PISOutr: {
                CST: item.pis_cst?.trim() || "99",
                vBC: toMoneyNumber(item.pis_base),
                pPIS: toMoneyNumber(item.pis_aliquota),
                vPIS: toMoneyNumber(item.pis_valor),
            },
        },
        COFINS: {
            COFINSOutr: {
                CST: item.cofins_cst?.trim() || "99",
                vBC: toMoneyNumber(item.cofins_base),
                pCOFINS: toMoneyNumber(item.cofins_aliquota),
                vCOFINS: toMoneyNumber(item.cofins_valor),
            },
        },
        ...(ipi ? { IPI: ipi } : {}),
    };
}

function shouldSendRtcHomologationGroup(environment: "production" | "homologation") {
    return environment === "homologation";
}

function buildRtcHomologationItemImposto(environment: "production" | "homologation") {
    if (!shouldSendRtcHomologationGroup(environment)) return {};

    return {
        IBSCBS: {
            CST: "000",
            cClassTrib: "000001",
            gIBSCBS: {
                vBC: 0,
                gIBSUF: {
                    pIBSUF: "0.10",
                    vIBSUF: 0,
                },
                gIBSMun: {
                    pIBSMun: "0",
                    vIBSMun: 0,
                },
                vIBS: 0,
                gCBS: {
                    pCBS: "0.90",
                    vCBS: 0,
                },
            },
        },
    };
}

function buildRtcHomologationTotal(environment: "production" | "homologation") {
    if (!shouldSendRtcHomologationGroup(environment)) return {};

    return {
        IBSCBSTot: {
            vBCIBSCBS: 0,
        },
    };
}

function getNFeValorNota(payload: EmissionPayload, valorProdutos: number) {
    const vIPI = toMoneyNumber(payload.itens.reduce((sum, item) => sum + toMoneyNumber(item.ipi_valor), 0));
    const vFrete = toMoneyNumber(payload.valor_frete);
    const vSeg = toMoneyNumber(payload.valor_seguro);
    const vDesc = toMoneyNumber(payload.valor_desconto);
    const vOutro = toMoneyNumber(payload.valor_outras_despesas);
    return toMoneyNumber(valorProdutos + vFrete + vSeg + vOutro + vIPI - vDesc);
}

function distributeNFeTotalValue(total: number, payload: EmissionPayload, valorProdutos: number) {
    const value = toMoneyNumber(total);
    if (value <= 0 || valorProdutos <= 0 || payload.itens.length === 0) {
        return payload.itens.map(() => 0);
    }

    let allocated = 0;
    return payload.itens.map((item, index) => {
        if (index === payload.itens.length - 1) {
            return toMoneyNumber(value - allocated);
        }

        const itemValue = toMoneyNumber(item.valor_total);
        const share = toMoneyNumber((value * itemValue) / valorProdutos);
        allocated = toMoneyNumber(allocated + share);
        return share;
    });
}

function buildNFeItemTotalAdjustments(payload: EmissionPayload, itemIndex: number, valorProdutos: number) {
    const frete = distributeNFeTotalValue(toMoneyNumber(payload.valor_frete), payload, valorProdutos)[itemIndex] || 0;
    const seguro = distributeNFeTotalValue(toMoneyNumber(payload.valor_seguro), payload, valorProdutos)[itemIndex] || 0;
    const desconto = distributeNFeTotalValue(toMoneyNumber(payload.valor_desconto), payload, valorProdutos)[itemIndex] || 0;
    const outras = distributeNFeTotalValue(toMoneyNumber(payload.valor_outras_despesas), payload, valorProdutos)[itemIndex] || 0;

    return {
        ...(frete > 0 ? { vFrete: frete } : {}),
        ...(seguro > 0 ? { vSeg: seguro } : {}),
        ...(desconto > 0 ? { vDesc: desconto } : {}),
        ...(outras > 0 ? { vOutro: outras } : {}),
    };
}

function buildNFeIcmsTot(payload: EmissionPayload, valorProdutos: number) {
    const vIPI = toMoneyNumber(payload.itens.reduce((sum, item) => sum + toMoneyNumber(item.ipi_valor), 0));
    const vPIS = toMoneyNumber(payload.itens.reduce((sum, item) => sum + toMoneyNumber(item.pis_valor), 0));
    const vCOFINS = toMoneyNumber(payload.itens.reduce((sum, item) => sum + toMoneyNumber(item.cofins_valor), 0));
    const vFrete = toMoneyNumber(payload.valor_frete);
    const vSeg = toMoneyNumber(payload.valor_seguro);
    const vDesc = toMoneyNumber(payload.valor_desconto);
    const vOutro = toMoneyNumber(payload.valor_outras_despesas);

    return {
        vBC: 0, vICMS: 0, vICMSDeson: 0, vFCP: 0,
        vBCST: 0, vST: 0, vFCPST: 0, vFCPSTRet: 0,
        vProd: valorProdutos, vFrete, vSeg, vDesc,
        vII: 0, vIPI, vIPIDevol: 0, vPIS,
        vCOFINS, vOutro, vNF: getNFeValorNota(payload, valorProdutos),
    };
}

function getNFeVendaCFOP(_itemCfop: string | undefined, isSameState: boolean) {
    return isSameState ? "5102" : "6102";
}

function getNFCeVendaDestination(companyUf?: string | null, clienteUf?: string | null) {
    const emitenteUf = String(companyUf || "").trim().toUpperCase();
    const destinatarioUf = String(clienteUf || "").trim().toUpperCase();
    const mesmoEstado = !emitenteUf || !destinatarioUf || emitenteUf === destinatarioUf;

    return {
        mesmoEstado,
        idDest: mesmoEstado ? 1 : 2,
        cfop: mesmoEstado ? "5102" : "6102",
    };
}

function buildNFeDest(cliente: EmissionPayload["cliente"]) {
    const cleanDoc = normalizeDocument(cliente.cpf_cnpj) || "";
    const endereco = cliente.endereco || {};
    const uf = String(endereco.uf || "").trim().toUpperCase();
    const codigoMunicipio = String(endereco.codigo_municipio || endereco.codigo_municipio_ibge || "")
        .replace(/\D/g, "");
    const nome = sanitizeFiscalText(cliente.nome, 60);
    const logradouro = sanitizeFiscalText(endereco.logradouro, 60);
    const complemento = sanitizeFiscalText(endereco.complemento, 60);
    const bairro = sanitizeFiscalText(endereco.bairro, 60);
    const cidade = sanitizeFiscalText(endereco.cidade, 60);

    if (!cleanDoc) {
        throw new Error("Informe CPF/CNPJ do destinatario para emitir NF-e.");
    }

    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        throw new Error("CPF/CNPJ do destinatario invalido para emitir NF-e.");
    }

    if (!isValidBrazilianDocument(cleanDoc)) {
        throw new Error("CPF/CNPJ do destinatario invalido para emitir NF-e.");
    }

    if (!nome) {
        throw new Error("Informe o nome do destinatario para emitir NF-e.");
    }

    if (!logradouro || !endereco.numero || !bairro || !cidade || !uf || !codigoMunicipio || !endereco.cep) {
        throw new Error("Endereco completo do destinatario e obrigatorio para emitir NF-e.");
    }

    const ie = String(cliente.endereco?.inscricao_estadual || cliente.endereco?.ie || "")
        .replace(/\D/g, "");
    const informedIndIeDest = Number(cliente.endereco?.ind_ie_dest);
    const indIEDest = [1, 2, 9].includes(informedIndIeDest)
        ? informedIndIeDest
        : ie ? 1 : 9;

    return {
        CNPJ: cleanDoc.length > 11 ? cleanDoc : undefined,
        CPF: cleanDoc.length <= 11 ? cleanDoc : undefined,
        xNome: nome,
        enderDest: {
            xLgr: logradouro,
            nro: String(endereco.numero),
            xCpl: complemento,
            xBairro: bairro,
            cMun: Number(codigoMunicipio),
            xMun: cidade,
            UF: uf,
            CEP: String(endereco.cep).replace(/\D/g, ""),
            cPais: "1058",
            xPais: "BRASIL",
        },
        indIEDest,
        ...(indIEDest === 1 && ie ? { IE: ie } : {}),
        email: cliente.email || undefined,
    };
}

async function getNextNFeNumber(
    supabase: any,
    organizationId: string,
    environment: "production" | "homologation",
    serie: number
) {
    const { data: nextNumber, error } = await supabase.rpc("get_next_nfe_number", {
        p_org_id: organizationId,
        p_serie: serie,
        p_environment: environment,
    });

    if (error || !nextNumber) {
        console.error("Erro ao obter numeracao NFe:", error);
        throw new Error("Nao foi possivel obter a numeracao sequencial para a NF-e. Execute a migration_nfe_sequence.sql antes de emitir novas NF-e.");
    }

    return Number(nextNumber);
}

function buildNFeInfRespTec(company: any, cnpjEmit: string, environment: "production" | "homologation") {
    const isProduction = environment === "production";
    const rtCnpj = String(
        company.rt_cnpj ||
        company.responsavel_tecnico_cnpj ||
        process.env.NFE_RT_CNPJ ||
        "65667543000102"
    ).replace(/\D/g, "");
    const rtContato = String(
        company.rt_contato ||
        company.responsavel_tecnico_nome ||
        process.env.NFE_RT_CONTATO ||
        "Jaime Rodrigues Jr"
    ).trim();
    const rtEmail = String(
        company.rt_email ||
        process.env.NFE_RT_EMAIL ||
        company.email_contato ||
        "jaimerodriguesjunior@outlook.com"
    ).trim();
    const rtFone = String(
        company.rt_fone ||
        process.env.NFE_RT_FONE ||
        company.telefone ||
        "0000000000"
    ).replace(/\D/g, "");
    const idCSRT = String(
        (isProduction ? company.csrt_id_production : company.csrt_id_homologation) ||
        (isProduction ? process.env.NFE_CSRT_ID_PRODUCTION : process.env.NFE_CSRT_ID_HOMOLOGATION) ||
        (isProduction ? company.csc_id_production : company.csc_id_homologation) ||
        ""
    ).replace(/\D/g, "");
    const CSRT =
        (isProduction ? company.csrt_token_production : company.csrt_token_homologation) ||
        (isProduction ? process.env.NFE_CSRT_TOKEN_PRODUCTION : process.env.NFE_CSRT_TOKEN_HOMOLOGATION) ||
        (isProduction ? company.csc_token_production : company.csc_token_homologation) ||
        "";

    return {
        CNPJ: rtCnpj || cnpjEmit,
        xContato: (rtContato || (company.razao_social ? company.razao_social.substring(0, 60) : "Responsavel Tecnico")).substring(0, 60),
        email: rtEmail || "email@exemplo.com",
        fone: rtFone || "0000000000",
        ...(idCSRT && CSRT ? { idCSRT: Number(idCSRT), CSRT } : {}),
    };
}

export async function emitirNFCe(payload: EmissionPayload) {

    if (payload.tipo_documento === "NFe") {
        return emitirNFeVenda(payload);
    }

    const supabase = createClient();

    let invoiceId: string | null = null;



    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[emitirNFCe] User ID:", user?.id, "Auth Error:", authError?.message);



    try {

        // 1. Buscar Token Nuvem Fiscal

        const env = payload.environment || 'production';

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFCe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);

        const baseUrl = env === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        // 2. Buscar Configurações da Empresa (Emissor - NuvemFiscal)

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



        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configurações fiscais incompletas: informe a Inscrição Estadual (IE) da empresa para emitir NFC-e.");
        }

        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const nfceDestination = getNFCeVendaDestination(company.uf, payload.cliente.endereco?.uf);

        // 2.5 Buscar próxima numeração sequencial
        // Buscamos a série ativa para a organização
        const { data: sequenceData } = await supabase
            .from("nfce_sequences")
            .select("serie")
            .eq("organization_id", payload.organization_id)
            .order("serie", { ascending: false })
            .limit(1)
            .maybeSingle();

        const currentSerie = sequenceData?.serie || 1;

        // Obtém e incrementa o número de forma atômica via RPC
        const { data: nextNumber, error: rpcError } = await supabase.rpc("get_next_nfce_number", {
            p_org_id: payload.organization_id,
            p_serie: currentSerie,
            p_environment: env
        });

        if (rpcError || !nextNumber) {
            console.error("Erro ao obter numeração NFCe:", rpcError);
            throw new Error("Não foi possível obter a numeração sequencial para a NFCe.");
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

                    serie: currentSerie,

                    nNF: nextNumber,

                    dhEmi,

                    tpNF: 1, // 1 = Saída

                    idDest: nfceDestination.idDest, // 1 = Interna, 2 = Interestadual

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

                    CNPJ: cnpj.replace(/\D/g, ""),

                    xNome: sanitizeFiscalText(company.razao_social, 60),

                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),

                    enderEmit: {

                        xLgr: sanitizeFiscalText(company.logradouro, 60),

                        nro: company.numero,

                        xCpl: sanitizeFiscalText(company.complemento, 60),

                        xBairro: sanitizeFiscalText(company.bairro, 60),

                        cMun: Number(company.codigo_municipio_ibge),

                        xMun: sanitizeFiscalText(company.cidade, 60),

                        UF: company.uf,

                        CEP: company.cep?.replace(/\D/g, ""),

                        cPais: "1058",

                        xPais: "BRASIL"

                    },

                    IE: inscricaoEstadual,

                    CRT: Number(company.regime_tributario || "1") // 1 = Simples Nacional

                },

                dest: (() => {
                    const cleanDoc = payload.cliente.cpf_cnpj ? payload.cliente.cpf_cnpj.replace(/\D/g, "") : "";
                    if (!cleanDoc) return undefined;

                    return {
                        CNPJ: cleanDoc.length > 11 ? cleanDoc : undefined,
                        CPF: cleanDoc.length <= 11 ? cleanDoc : undefined,
                        xNome: sanitizeFiscalText(payload.cliente.nome, 60),
                        indIEDest: 9, // 9 = Não Contribuinte
                        email: payload.cliente.email
                    };
                })(),

                det: payload.itens.map((item, index) => ({

                    nItem: index + 1,

                    prod: {

                        cProd: item.codigo,

                        cEAN: "SEM GTIN",

                        xProd: sanitizeFiscalText(item.descricao, 120),

                        NCM: item.ncm || "00000000", // Fallback perigoso, ideal validar antes

                        CFOP: nfceDestination.cfop,

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

                        },

                        ...buildRtcHomologationItemImposto(env)

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

                    },

                    ...buildRtcHomologationTotal(env)

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
                infRespTec: buildNFeInfRespTec(company, cnpj.replace(/\D/g, ""), env)

            }

        };



        // 4. Salvar Rascunho no Banco (Status: Processing)

        const { data: invoice, error: dbError } = await supabase

            .from("fiscal_invoices")

            .insert({

                organization_id: payload.organization_id,

                work_order_id: payload.work_order_id || null,

                ...buildOutputInvoiceSnapshot(payload, company, nfePayload.infNFe.ide.dhEmi),

                tipo_documento: "NFCe",

                status: "processing",

                environment: env,

                payload_json: nfePayload

            })

            .select()

            .single();



        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NFCe ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;



        // 5. Enviar para Nuvem Fiscal

        console.log("[NuvemFiscal] Enviando NFE Payload:", JSON.stringify(nfePayload, null, 2));



        // CORREÇÃO: Endpoint correto para NFC-e é /nfce (POST)

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
            let xmlContent = await tryFetchXmlContent(result.xml_url);
            if (!xmlContent) {
                xmlContent = await tryFetchXmlByUuid(token, baseUrl, "NFCe", result.id);
            }
            const authorizedUpdate: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: result.numero,
                serie: result.serie,
                xml_url: result.xml_url,
                pdf_url: result.pdf_url
            };

            if (xmlContent) {
                authorizedUpdate.xml_content = xmlContent;
            }

            await supabase
                .from("fiscal_invoices")
                .update(authorizedUpdate)
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

export async function emitirNFeVenda(payload: EmissionPayload) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de venda. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "VENDA DE MERCADORIA",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? 1,
                    indPres: payload.ind_pres ?? 1,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: getNFeVendaCFOP(item.cfop, mesmoEstado),
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "102"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeDetPag(payload, getNFeValorNota(payload, valorTotal), "01") },
                infAdic: buildAdvancedInfAdic(payload, "VENDA DE MERCADORIA."),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        console.log("[NFe Venda] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Venda] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe venda:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

async function tryFetchXmlByUuid(
    token: string,
    baseUrl: string,
    tipoDocumento: "NFCe" | "NFe" | "NFSe",
    uuid?: string | null
) {
    if (!uuid) return null;

    try {
        const endpointType = tipoDocumento === "NFCe" ? "nfce"
            : tipoDocumento === "NFe" ? "nfe"
                : "nfse";
        const response = await fetch(`${baseUrl}/${endpointType}/${uuid}/xml`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) return null;
        return await response.text();
    } catch {
        return null;
    }
}

export async function emitirNFeRemessaConserto(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e de remessa para conserto.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de remessa. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const cfopRemessa = mesmoEstado ? "5915" : "6915";
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const observacaoPadrao = "REMESSA DE MERCADORIA/BEM PARA CONSERTO OU REPARO. SEM INCIDENCIA DE COBRANCA.";

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "REMESSA PARA CONSERTO",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? (dest.indIEDest === 9 ? 1 : 0),
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopRemessa,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        console.log("[NFe Remessa Conserto] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Remessa Conserto] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e de remessa em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe remessa para conserto:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeRemessaConsertoAction(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    "use server";
    return emitirNFeRemessaConserto(payload);
}

export async function emitirNFeRemessaGarantia(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e de remessa em garantia.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de remessa. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const cfopRemessa = mesmoEstado ? "5915" : "6915";
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const observacaoPadrao = "REMESSA DE MERCADORIA/BEM EM GARANTIA. SEM INCIDENCIA DE COBRANCA.";

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "REMESSA EM GARANTIA",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? (dest.indIEDest === 9 ? 1 : 0),
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopRemessa,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        console.log("[NFe Remessa Garantia] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Remessa Garantia] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e de remessa em garantia em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe remessa em garantia:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeRemessaGarantiaAction(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    "use server";
    return emitirNFeRemessaGarantia(payload);
}

export async function emitirNFeTransferencia(payload: EmissionPayload & { observacao?: string; modFrete?: string; finalidade_transferencia: "Transferencia entre filiais" | "Transferencia para deposito" | "Retorno de deposito" }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e de transferencia.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de transferencia. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const prefix = mesmoEstado ? "5" : "6";
        const cfopTransferencia = payload.finalidade_transferencia === "Retorno de deposito" ? `${prefix}153` : `${prefix}152`;
        const natOp = payload.finalidade_transferencia === "Transferencia entre filiais"
            ? "TRANSFERENCIA ENTRE FILIAIS"
            : payload.finalidade_transferencia === "Transferencia para deposito"
                ? "TRANSFERENCIA PARA DEPOSITO"
                : "RETORNO DE DEPOSITO";
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const observacaoPadrao = "TRANSFERENCIA DE MERCADORIA SEM COBRANCA. OPERACAO ENTRE ESTABELECIMENTOS.";

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp,
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? 0,
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopTransferencia,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;
        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e de transferencia em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe transferencia:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeTransferenciaAction(payload: EmissionPayload & { observacao?: string; modFrete?: string; finalidade_transferencia: "Transferencia entre filiais" | "Transferencia para deposito" | "Retorno de deposito" }) {
    "use server";
    return emitirNFeTransferencia(payload);
}

export async function emitirNFeBonificacaoDoacao(payload: EmissionPayload & { observacao?: string; modFrete?: string; finalidade_bonus: "Bonificacao" | "Brinde" | "Doacao" }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";
        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) return { success: false, error: duplicateError };

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();
        if (!company) throw new Error("Configuracoes da empresa nao encontradas.");
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");

        if (!payload.itens.length) throw new Error("Adicione ao menos um produto para emitir NF-e.");
        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) throw new Error(`NCM valido e obrigatorio para emitir NF-e. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const prefix = mesmoEstado ? "5" : "6";
        const cfop = `${prefix}910`;
        const finalidadeBonusNormalizada = String(payload.finalidade_bonus || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

        const natOp = finalidadeBonusNormalizada === "bonificacao"
            ? "BONIFICACAO"
            : finalidadeBonusNormalizada === "brinde"
                ? "REMESSA DE BRINDE"
                : "DOACAO";
        const observacaoPadrao = finalidadeBonusNormalizada === "doacao"
            ? "SAIDA EM DOACAO SEM COBRANCA."
            : finalidadeBonusNormalizada === "brinde"
                ? "SAIDA DE BRINDE SEM COBRANCA."
                : "SAIDA EM BONIFICACAO SEM COBRANCA.";

        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp,
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? (dest.indIEDest === 9 ? 1 : 0),
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfop,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();
        if (dbError) throw dbError;
        invoiceId = invoice.id;

        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(nfePayload),
        });
        const responseText = await response.text();
        let result: any;
        try { result = responseText ? JSON.parse(responseText) : {}; } catch { result = {}; }

        if (!response.ok) {
            const providerError = result.error?.message || JSON.stringify(result) || "Erro na emissao";
            await supabase.from("fiscal_invoices").update({ status: "error", error_message: providerError }).eq("id", invoice.id);
            return { success: false, error: providerError, invoiceId: invoice.id };
        }

        if (result.status === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase.from("fiscal_invoices").update({
            status: result.status === "rejeitado" ? "rejected" : "processing",
            nuvemfiscal_uuid: result.id,
            chave_acesso: result.chave,
            numero: String(result.numero || ""),
            serie: String(result.serie || ""),
            error_message: result.status === "rejeitado" ? `Erro ${result.autorizacao?.codigo_status || "N/A"}: ${result.autorizacao?.motivo_status || "Motivo nao informado"}` : null,
        }).eq("id", invoice.id);

        if (result.status === "rejeitado") {
            return { success: false, error: `NF-e Rejeitada: Erro ${result.autorizacao?.codigo_status || "N/A"} - ${result.autorizacao?.motivo_status || "Motivo nao informado"}`, invoiceId: invoice.id };
        }

        return { success: true, invoiceId: invoice.id, message: "NF-e em processamento" };
    } catch (error: any) {
        if (invoiceId) {
            await supabase.from("fiscal_invoices").update({ status: "error", error_message: error.message }).eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeBonificacaoDoacaoAction(payload: EmissionPayload & { observacao?: string; modFrete?: string; finalidade_bonus: "Bonificacao" | "Brinde" | "Doacao" }) {
    "use server";
    return emitirNFeBonificacaoDoacao(payload);
}

export async function emitirNFeAssistida(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "homologation";

        const natOp = String(payload.natureza_operacao || "").trim().toUpperCase();
        if (!natOp) throw new Error("Informe a natureza da operacao para emissao assistida.");
        if (![0, 1].includes(Number(payload.tipo_nfe))) throw new Error("Tipo NF-e invalido para emissao assistida.");
        if (![1, 2, 3, 4].includes(Number(payload.finalidade_nfe))) throw new Error("Finalidade NF-e invalida para emissao assistida.");

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br"
            : process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br";

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) throw new Error("Configuracoes da empresa nao encontradas.");
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) throw new Error("Adicione ao menos um produto para emitir NF-e assistida.");

        const itemInvalido = payload.itens.find((item) => (
            !/^\d{8}$/.test(String(item.ncm || "")) ||
            !/^\d{4}$/.test(String(item.cfop || ""))
        ));
        if (itemInvalido) {
            throw new Error(`NCM e CFOP validos sao obrigatorios. Verifique o item: ${itemInvalido.descricao || itemInvalido.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const cleanReferencedKey = payload.referenced_key ? (normalizeDocument(payload.referenced_key) || "") : "";
        const hasReferencedKey = /^\d{44}$/.test(cleanReferencedKey);
        if (payload.referenced_key && !hasReferencedKey) {
            console.warn("[NFe Assistida] referenced_key ignorada: chave invalida.");
        }

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp,
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: Number(payload.tipo_nfe ?? 1),
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: Number(payload.finalidade_nfe ?? 1),
                    indFinal: payload.ind_final ?? 1,
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                    ...(hasReferencedKey ? { NFref: [{ refNFe: cleanReferencedKey }] } : {}),
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: item.cfop,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, item.csosn || "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeDetPag(payload, getNFeValorNota(payload, valorTotal), "90") },
                infAdic: buildAdvancedInfAdic(payload, natOp),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) throw dbError;
        invoiceId = invoice.id;

        console.log("[NFe Assistida] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase.from("fiscal_invoices").update({ status: "error", error_message: `Resposta invalida da API (${response.status})` }).eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase.from("fiscal_invoices").update({ status: "error", error_message: providerError }).eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        if (result.status === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase.from("fiscal_invoices").update({
                status: "rejected",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                error_message: `Erro ${codigoErro}: ${motivoErro}`,
            }).eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (result.status === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase.from("fiscal_invoices").update({
            status: "processing",
            nuvemfiscal_uuid: result.id,
            chave_acesso: result.chave,
            numero: String(result.numero || ""),
            serie: String(result.serie || ""),
        }).eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e assistida em processamento." };
    } catch (error: any) {
        console.error("[NFe Assistida] Erro:", error);
        if (invoiceId) {
            await supabase.from("fiscal_invoices").update({ status: "error", error_message: error.message }).eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeAssistidaAction(payload: EmissionPayload & { observacao?: string; modFrete?: string }) {
    "use server";
    return emitirNFeAssistida(payload);
}

async function validateReferencedRemessaKind(
    supabase: any,
    organizationId: string,
    environment: "production" | "homologation",
    referencedKey: string,
    expectedKind: "conserto" | "garantia"
) {
    const cleanKey = String(referencedKey || "").replace(/\D/g, "");
    if (cleanKey.length !== 44) {
        throw new Error("A chave de acesso da remessa de origem e invalida.");
    }

    const { data: origin, error } = await supabase
        .from("fiscal_invoices")
        .select("id,numero,payload_json,chave_acesso")
        .eq("organization_id", organizationId)
        .eq("tipo_documento", "NFe")
        .eq("direction", "output")
        .eq("status", "authorized")
        .eq("environment", environment)
        .eq("chave_acesso", cleanKey)
        .maybeSingle();

    if (error) {
        throw new Error(`Falha ao validar remessa de origem: ${error.message}`);
    }

    if (!origin) {
        throw new Error("Remessa de origem nao encontrada neste ambiente. Emita/importe a remessa correta antes do retorno.");
    }

    const natOp = String(origin.payload_json?.infNFe?.ide?.natOp || "").toUpperCase();
    const infCpl = String(origin.payload_json?.infNFe?.infAdic?.infCpl || "").toUpperCase();
    const text = `${natOp} ${infCpl}`;
    const isRemessa = natOp.includes("REMESSA");
    const isGarantia = isRemessa && text.includes("GARANTIA");
    const isConserto = isRemessa && (text.includes("CONSERTO") || text.includes("REPARO")) && !isGarantia;

    if (expectedKind === "conserto" && !isConserto) {
        throw new Error("A NF-e de origem selecionada nao e uma Remessa para conserto. Para Retorno de conserto, selecione uma remessa com natureza de conserto.");
    }

    if (expectedKind === "garantia" && !isGarantia) {
        throw new Error("A NF-e de origem selecionada nao e uma Remessa em garantia. Para Retorno de garantia, selecione uma remessa com natureza de garantia.");
    }

    return {
        originId: origin.id as string,
        cleanKey,
    };
}




export async function emitirNFeRetornoConserto(payload: EmissionPayload & { observacao?: string; modFrete?: string; referenced_key: string }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e de retorno de conserto.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de retorno. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const cfopRetorno = mesmoEstado ? "5916" : "6916";
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const { cleanKey: cleanReferencedKey, originId } = await validateReferencedRemessaKind(
            supabase,
            payload.organization_id,
            env,
            payload.referenced_key,
            "conserto"
        );

        const observacaoPadrao = "RETORNO DE MERCADORIA/BEM RECEBIDO PARA CONSERTO OU REPARO. SEM INCIDENCIA DE COBRANCA.";

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "RETORNO DE CONSERTO",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? (dest.indIEDest === 9 ? 1 : 0),
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                    NFref: [{ refNFe: cleanReferencedKey }],
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopRetorno,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                related_invoice_id: originId,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        console.log("[NFe Retorno Conserto] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Retorno Conserto] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e de retorno de conserto em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe retorno de conserto:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeRetornoConsertoAction(payload: EmissionPayload & { observacao?: string; modFrete?: string; referenced_key: string }) {
    "use server";
    return emitirNFeRetornoConserto(payload);
}

export async function emitirNFeRetornoGarantia(payload: EmissionPayload & { observacao?: string; modFrete?: string; referenced_key: string }) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) {
            throw new Error("Configuracoes da empresa nao encontradas.");
        }
        assertNFeSimplesNacional(company);

        const cnpjEmit = normalizeDocument(company.cnpj || company.cpf_cnpj);
        if (!cnpjEmit) {
            throw new Error("Dados da empresa incompletos para emissao (CNPJ ausente).");
        }

        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            throw new Error("Configuracoes fiscais incompletas: informe a Inscricao Estadual (IE) da empresa para emitir NF-e.");
        }

        if (!payload.itens.length) {
            throw new Error("Adicione ao menos um produto para emitir NF-e de retorno em garantia.");
        }

        const itemSemNcm = payload.itens.find(item => !/^\d{8}$/.test(String(item.ncm || "")) || item.ncm === "00000000");
        if (itemSemNcm) {
            throw new Error(`NCM valido e obrigatorio para emitir NF-e de retorno. Verifique o produto: ${itemSemNcm.descricao || itemSemNcm.codigo}.`);
        }

        const dest = buildNFeDest(payload.cliente);
        const destinatarioUF = String(payload.cliente.endereco?.uf || "").trim().toUpperCase();
        const emitenteUF = String(company.uf || "").trim().toUpperCase();
        const mesmoEstado = !destinatarioUF || destinatarioUF === emitenteUF;
        const cfopRetorno = mesmoEstado ? "5916" : "6916";
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();
        const valorTotal = toMoneyNumber(payload.valor_total);
        const { cleanKey: cleanReferencedKey, originId } = await validateReferencedRemessaKind(
            supabase,
            payload.organization_id,
            env,
            payload.referenced_key,
            "garantia"
        );

        const observacaoPadrao = "RETORNO DE MERCADORIA/BEM REMETIDO EM GARANTIA. SEM INCIDENCIA DE COBRANCA.";

        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "RETORNO DE GARANTIA",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 1,
                    indFinal: payload.ind_final ?? (dest.indIEDest === 9 ? 1 : 0),
                    indPres: payload.ind_pres ?? 9,
                    indIntermed: payload.ind_intermed ?? 0,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                    NFref: [{ refNFe: cleanReferencedKey }],
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest,
                ...buildNFeEntregaRetirada(payload),
                det: payload.itens.map((item, index) => ({
                    nItem: index + 1,
                    prod: {
                        cProd: item.codigo || String(index + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopRetorno,
                        cBenef: item.cbenef?.trim() || undefined,
                        uCom: item.unidade || "UN",
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: toMoneyNumber(item.valor_total),
                        ...buildNFeItemTotalAdjustments(payload, index, valorTotal),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade || "UN",
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: buildNFeItemImposto(item, "400"),
                })),
                total: {
                    ICMSTot: buildNFeIcmsTot(payload, valorTotal),
                },
                transp: buildNFeTransp(payload),
                pag: { detPag: buildNFeSemPagamento() },
                infAdic: buildAdvancedInfAdic(payload, observacaoPadrao),
                ...(buildIntermediador(payload) ? { infIntermed: buildIntermediador(payload) } : {}),
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                work_order_id: payload.work_order_id || null,
                related_invoice_id: originId,
                ...buildOutputInvoiceSnapshot(payload, company, dhEmi),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: nfePayload,
            })
            .select()
            .single();

        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Ja existe NF-e ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;

        console.log("[NFe Retorno Garantia] Enviando para /nfe, numero:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Retorno Garantia] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta invalida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta invalida da API (${response.status})`, invoiceId: invoice.id };
        }

        if (!response.ok) {
            const providerError = result.error?.message
                ? `${result.error.message}${result.error.details ? ` - ${JSON.stringify(result.error.details)}` : ""}`
                : JSON.stringify(result);
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: providerError })
                .eq("id", invoice.id);
            return { success: false, error: providerError || "Erro na emissao", invoiceId: invoice.id };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo nao informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return { success: false, error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`, invoiceId: invoice.id };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);

        return { success: true, invoiceId: invoice.id, message: "NF-e de retorno em garantia em processamento" };
    } catch (error: any) {
        console.error("Erro na emissao NFe retorno em garantia:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}

export async function emitirNFeRetornoGarantiaAction(payload: EmissionPayload & { observacao?: string; modFrete?: string; referenced_key: string }) {
    "use server";
    return emitirNFeRetornoGarantia(payload);
}



export async function emitirNFSe(payload: EmissionPayload) {

    const supabase = createClient();

    let invoiceId: string | null = null;



    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[emitirNFSe] User ID:", user?.id);



    try {

        // 1. Buscar Token Nuvem Fiscal

        const env = payload.environment || 'production';

        const duplicateError = await ensureNoActiveInvoiceForWorkOrder(supabase, payload, "NFSe", env);
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);

        const baseUrl = env === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        // 2. Buscar Configurações da Empresa

        const { data: company } = await supabase

            .from("company_settings")

            .select("*")

            .eq("organization_id", payload.organization_id)

            .single();



        if (!company) {

            throw new Error("Configurações da empresa não encontradas.");

        }



        const cnpj = company.cnpj || company.cpf_cnpj;
        const inscricaoMunicipal = String(company.inscricao_municipal || company.nfse_login || "")
            .replace(/\D/g, "")
            .trim();

        // Keep NFSe RPS sequence aligned with last authorized number in our database.
        try {
            const { data: issuedNfse } = await supabase
                .from("fiscal_invoices")
                .select("numero, id")
                .eq("organization_id", payload.organization_id)
                .eq("tipo_documento", "NFSe")
                .eq("environment", env)
                .not("numero", "is", null)
                .order("id", { ascending: false })
                .limit(400);

            const lastIssuedNumber = (issuedNfse || []).reduce((max, row: any) => {
                const parsed = parseInt(String(row?.numero || ""), 10);
                if (!Number.isFinite(parsed)) return max;
                return parsed > max ? parsed : max;
            }, 0);

            const expectedNextRps = lastIssuedNumber > 0 ? lastIssuedNumber + 1 : 1;
            const cnpjLimpo = String(cnpj || "").replace(/\D/g, "");

            if (cnpjLimpo) {
                const configRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (configRes.ok) {
                    const nfseConfig = await configRes.json();
                    const currentRpsNumber = Number(nfseConfig?.rps?.numero || 0);

                    if (Number.isFinite(currentRpsNumber) && currentRpsNumber < expectedNextRps) {
                        const updateRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                            method: "PUT",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                rps: {
                                    ...(nfseConfig?.rps || {}),
                                    numero: expectedNextRps
                                }
                            })
                        });

                        if (updateRes.ok) {
                            console.log(`[NFSe][RPS Sync] RPS adjusted from ${currentRpsNumber} to ${expectedNextRps}.`);
                        } else {
                            console.warn("[NFSe][RPS Sync] Failed to update RPS:", await updateRes.text());
                        }
                    } else {
                        console.log(`[NFSe][RPS Sync] RPS already aligned: current=${currentRpsNumber} expected=${expectedNextRps}.`);
                    }
                } else {
                    console.warn("[NFSe][RPS Sync] Failed to read NFSe config:", await configRes.text());
                }
            }
        } catch (rpsSyncError: any) {
            console.warn("[NFSe][RPS Sync] Pre-sync failed, continuing emission:", rpsSyncError?.message || rpsSyncError);
        }



        // 3. Montar JSON para Nuvem Fiscal (NFS-e - DPS)

        const servicoPrincipal = payload.itens[0]; // Assumindo um serviço principal ou o primeiro para cabeçalho

        if (!servicoPrincipal) throw new Error("Nenhum serviço informado.");

        const clienteDoc = normalizeDocument(payload.cliente.cpf_cnpj) || "";
        if (!clienteDoc) {
            throw new Error("Informe o CPF/CNPJ do tomador para emitir a NFS-e.");
        }
        if (clienteDoc.length !== 11 && clienteDoc.length !== 14) {
            throw new Error("CPF/CNPJ do tomador invalido. Informe 11 digitos para CPF ou 14 para CNPJ.");
        }
        if (!isValidBrazilianDocument(clienteDoc)) {
            throw new Error(
                clienteDoc.length === 11
                    ? "CPF do tomador invalido. Verifique se o cliente informou um CPF completo e valido."
                    : "CNPJ do tomador invalido. Verifique se o cliente informou um CNPJ completo e valido."
            );
        }



        // Recuperar código de serviço e alíquota do item, ou usar fallback

        // IMPORTANTE: Para IPM Guaíra, cTribMun deve ser o código do serviço (ex: 140102), NÃO o CNAE.

        const codServico = servicoPrincipal.codigo_servico || "140101";

        const codServicoNac = servicoPrincipal.codigo_servico?.replace(/[.-]/g, "") || "140101"; // Formato limpo
        const cnaeFormatado = String((company as any).cnae || "4520007").replace(/\D/g, "").slice(0, 7) || "4520007";

        const ibgeMunicipio = String(company.codigo_municipio_ibge || "4108809").replace(/\D/g, "") || "4108809";
        const isGuaira = ibgeMunicipio === "4108809";
        const isToledo = ibgeMunicipio === "4127700";
        const nfseFlow = isToledo ? "toledo_nuvem" : "nuvemfiscal_padrao";
        console.log(`[emitirNFSe] Fluxo selecionado: ${nfseFlow} (IBGE ${ibgeMunicipio})`);
        console.log("[emitirNFSe] Prestador IM enviada:", inscricaoMunicipal || "(vazia)");
        if (!isToledo && !company.nfse_login) {
            throw new Error("Configurações de NFS-e não encontradas (Login/Senha da Prefeitura).");
        }

        if (isToledo && env === 'production' && !inscricaoMunicipal) {
            throw new Error("Toledo/Produção: inscrição municipal do prestador não encontrada no cadastro da empresa.");
        }

        if (isToledo && env === 'production' && !String(company.nfse_password || "").trim()) {
            console.log("[emitirNFSe] Toledo/Produção sem senha NFS-e: continuando com login/IM apenas.");
        }

        if (isToledo && inscricaoMunicipal) {
            const cnpjLimpo = cnpj.replace(/\D/g, "");
            const enderecoCep = String(company.cep || "").replace(/\D/g, "");
            const empresaPayload = {
                cpf_cnpj: cnpjLimpo,
                nome_razao_social: company.razao_social || company.nome_fantasia || cnpjLimpo,
                nome_fantasia: company.nome_fantasia || company.razao_social || cnpjLimpo,
                email: company.email_contato || undefined,
                inscricao_estadual: company.inscricao_estadual || undefined,
                inscricao_municipal: inscricaoMunicipal,
                endereco: {
                    logradouro: company.logradouro || undefined,
                    numero: company.numero || undefined,
                    complemento: company.complemento || undefined,
                    bairro: company.bairro || undefined,
                    codigo_municipio: String(company.codigo_municipio_ibge || ibgeMunicipio).replace(/\D/g, ""),
                    cidade: company.cidade || undefined,
                    uf: company.uf || undefined,
                    cep: enderecoCep || undefined,
                    pais: "BRASIL"
                },
                regime_tributario: Number(company.regime_tributario) || 1
            };

            try {
                const syncPut = await fetch(`${baseUrl}/empresas/${cnpjLimpo}`, {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(empresaPayload)
                });

                if (!syncPut.ok && syncPut.status === 404) {
                    const syncPost = await fetch(`${baseUrl}/empresas`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(empresaPayload)
                    });

                    if (!syncPost.ok) {
                        const postTxt = await syncPost.text();
                        console.warn("[emitirNFSe] Sync empresa Toledo (POST) falhou:", syncPost.status, postTxt);
                    } else {
                        console.log("[emitirNFSe] Sync empresa Toledo (POST) ok");
                    }
                } else if (!syncPut.ok) {
                    const putTxt = await syncPut.text();
                    console.warn("[emitirNFSe] Sync empresa Toledo (PUT) falhou:", syncPut.status, putTxt);
                } else {
                    console.log("[emitirNFSe] Sync empresa Toledo (PUT) ok");
                }
            } catch (syncErr: any) {
                console.warn("[emitirNFSe] Sync empresa Toledo ignorado:", syncErr?.message || syncErr);
            }

            // NFS-e config (login/senha/rps) não é mais sincronizada automaticamente aqui
            // para evitar reset de lote/numeração em produção.
        }

        const tomMunicipio = ibgeMunicipio; // Nuvem Fiscal exige cMun no padrão IBGE (7 dígitos)



        const getCodigoNacional = (raw: string) => {

            const digits = raw.replace(/[.-]/g, "");

            if (isToledo) {
                if (digits.length >= 4) {
                    return `${digits.substring(0, 2)}.${digits.substring(2, 4)}`; // Ex: 14.01
                }
                return "14.01";
            }

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

            if (isToledo) {
                if (digits.length >= 9) {
                    const base = digits.substring(0, 9);
                    return `${base.substring(0, 2)}.${base.substring(2, 4)}.${base.substring(4, 6)}.${base.substring(6, 9)}`; // Ex: 14.01.01.000
                }
                if (digits.length === 6) {
                    return `${digits.substring(0, 2)}.${digits.substring(2, 4)}.${digits.substring(4, 6)}.000`; // Ex: 14.01.01.000
                }
                if (digits.length === 4) {
                    return `${digits.substring(0, 2)}.${digits.substring(2, 4)}.01.000`; // Ex: 14.01.01.000
                }
                return "14.01.01.000";
            }

            if (digits.length >= 6) return digits.substring(0, 6); // Ex: 140101

            if (digits.length === 4 && ibgeMunicipio === "4108809" && digits === "1401") {
                return "140101"; // Guaíra/IPM: subitem municipal para 14.01 (Testado e Aprovado)
            }

            return digits;

        };

        const normalizeMunicipio = (codigo?: string | number) => {

            if (!codigo) return tomMunicipio;

            const raw = String(codigo).replace(/\D/g, "");

            return raw || tomMunicipio;

        };



        const totalServicosCalculado = Number(
            payload.itens
                .reduce((acc, item) => acc + toMoneyNumber(item.valor_total, 0), 0)
                .toFixed(2)
        );
        const totalServicosPayload = toMoneyNumber(payload.valor_total, totalServicosCalculado);
        const totalServicosFinal = Number(
            (totalServicosCalculado > 0 ? totalServicosCalculado : totalServicosPayload).toFixed(2)
        );
        console.log("[emitirNFSe] Totais serviço", {
            itens: totalServicosCalculado,
            payload: totalServicosPayload,
            final: totalServicosFinal
        });

        const { dhEmi, dCompet } = getSaoPauloDatePartsWithSafety();

        const dpsPayload = {

            ambiente: env === 'production' ? 'producao' : 'homologacao',

            infDPS: {

                dhEmi,

                dCompet,

                prest: {

                    CNPJ: cnpj.replace(/\D/g, "")

                },

                toma: (() => {
                    const cleanDoc = clienteDoc;
                    const clientPhone = payload.cliente.telefone?.replace(/\D/g, "") || "";
                    const companyPhone = company?.telefone?.replace(/\D/g, "") || "";
                    const phoneToSend = clientPhone || companyPhone;
                    const clientEmail = payload.cliente.email?.trim();

                    const addressRaw = payload.cliente.endereco || {};
                    const logradouro = addressRaw.logradouro || addressRaw.rua || "";
                    const bairro = addressRaw.bairro || "";
                    const numero = addressRaw.numero || "";
                    const cepRaw = addressRaw.cep || "";
                    
                    let cleanCep = cepRaw.replace(/\D/g, "");
                    if (cleanCep.length !== 8) {
                        cleanCep = company?.cep?.replace(/\D/g, "") || "85980000"; // Fallback
                    }

                    const finalLogradouro = logradouro.trim() || "Nao Informado";
                    const finalBairro = bairro.trim() || "Centro";
                    const finalNumero = numero.trim() || "SN";

                    const blockEnd = {
                        xLgr: finalLogradouro,
                        nro: finalNumero,
                        xBairro: finalBairro,
                        endNac: {
                            cMun: normalizeMunicipio(addressRaw.codigo_municipio),
                            CEP: cleanCep
                        }
                    };

                    return {
                        CNPJ: cleanDoc.length > 11 ? cleanDoc : undefined,
                        CPF: cleanDoc.length <= 11 ? cleanDoc : undefined,
                        xNome: sanitizeFiscalText(payload.cliente.nome, 60),
                        email: clientEmail || undefined,
                        fone: phoneToSend || undefined,
                        end: blockEnd
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

                        CNAE: cnaeFormatado,

                        cSitTrib: "0",

                        xDescServ: payload.itens.map(i => {
                            const itemTotal = toMoneyNumber(i.valor_total, 0);
                            // Remove valor duplicado se já existir na descrição e limpa espaços extras
                            const cleanDesc = i.descricao.replace(/(\s*\(R\$\s*[\d.,]+\))+\s*$/, "").trimEnd();
                            return `${cleanDesc} (R$ ${itemTotal.toFixed(2)})`;
                        }).join("; ")

                    },

                    locPrest: {
                        cLocPrestacao: ibgeMunicipio // ONDE o serviço foi prestado (Guaíra)
                    }

                },

                valores: {

                    vServPrest: {

                        vServ: totalServicosFinal

                    },

                    trib: {

                        tribMun: {
                            tribISSQN: 1, // 1 - Tributável
                            tpRetISSQN: 1, // 1 - Não Retido
                            pAliq: servicoPrincipal.aliquota_iss || (isToledo ? 3.0 : 2.01),
                            vISSQN: isToledo ? undefined : 0, // Em Toledo deixamos a Nuvem calcular automaticamente
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

                ...buildOutputInvoiceSnapshot(payload, company, dpsPayload.infDPS.dhEmi),

                tipo_documento: "NFSe",

                status: "processing",

                environment: env,

                payload_json: dpsPayload

            })

            .select()

            .single();



        if (dbError) {
            if (dbError.code === "23505") {
                return { success: false, error: "Já existe NFSe ativa para esta OS neste ambiente." };
            }
            throw dbError;
        }

        invoiceId = invoice.id;



        // 5. Enviar para Nuvem Fiscal

        console.log("[NuvemFiscal] Enviando DPS Payload Corrigido:", JSON.stringify(dpsPayload, null, 2));



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

        const debugMini = `[DEBUG NFSe vServ=${totalServicosFinal} itens=${payload.itens.map(i => toMoneyNumber(i.valor_total, 0).toFixed(2)).join("+")} cTribNac=${dpsPayload.infDPS.serv.cServ.cTribNac} cTribMun=${dpsPayload.infDPS.serv.cServ.cTribMun}]`;

        if (!response.ok) {
            const errorDetails = buildNfseProviderErrorMessage(result, JSON.stringify(result));

            console.error("[NuvemFiscal] Erro detalhado:", errorDetails);

            const fullErrorString = JSON.stringify(result);
            const normalizedError = `${errorDetails} ${fullErrorString}`.toLowerCase();
            const isToledoCredentialIssue =
                (normalizedError.includes("1824") && normalizedError.includes("nrinscricaomunicipal")) ||
                normalizedError.includes("8003");

            if (isToledo && env === 'production' && isToledoCredentialIssue) {
                await supabase
                    .from("fiscal_invoices")
                    .update({
                        status: "error",
                        error_message: fullErrorString
                    })
                    .eq("id", invoice.id);

                return {
                    success: false,
                    error:
                        `Erro NuvemFiscal: ${errorDetails}\n` +
                        "Diagnóstico Toledo Produção: verifique na Nuvem Fiscal (ambiente Produção) o cadastro da empresa, configuração NFS-e (login/IM), prestador ativo e a numeração de lote/RPS sem reutilização." +
                        ` ${debugMini}`
                };
            }

            let isRecovered = false;

            // AUTO-RETRY LOGIC PARA ERRO 00209 (RPS já utilizado / Identificador de arquivo duplicado)
            if (
                fullErrorString.includes("00209") ||
                normalizedError.includes("identificador de arquivo")
            ) {
                console.log("[NuvemFiscal] Detectado erro 00209 (RPS duplicado). Tentando auto-recuperar incrementando a sequência do RPS...");
                try {
                    const cnpjLimpo = cnpj.replace(/\D/g, "");
                    const configRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });

                    if (configRes.ok) {
                        const config = await configRes.json();
                        if (config.rps && typeof config.rps.numero === 'number') {
                            const newNumber = config.rps.numero + 1;
                            console.log(`[NuvemFiscal] RPS atual é ${config.rps.numero}. Atualizando para ${newNumber}...`);
                            
                            const updateRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                                method: "PUT",
                                headers: {
                                    "Authorization": `Bearer ${token}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ rps: { ...config.rps, numero: newNumber } })
                            });

                            if (updateRes.ok) {
                                console.log("[NuvemFiscal] RPS incrementado com sucesso! Reenviando DPS...");
                                
                                const retryResponse = await fetch(`${baseUrl}/nfse/dps`, {
                                    method: "POST",
                                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify(dpsPayload)
                                });

                                const retryResponseText = await retryResponse.text();
                                let retryResult;
                                try { retryResult = retryResponseText ? JSON.parse(retryResponseText) : {}; } catch (e) { retryResult = {}; }

                                if (retryResponse.ok) {
                                    result = retryResult;
                                    isRecovered = true;
                                    console.log("[NuvemFiscal] Auto-recovery do RPS funcionou!");
                                } else {
                                    const retryErrorString = JSON.stringify(retryResult);
                                    await supabase.from("fiscal_invoices").update({
                                        status: "error",
                                        error_message: `Falha no auto-recovery RPS. Tentativa 1: ${fullErrorString} | Tentativa 2: ${retryErrorString}`
                                    }).eq("id", invoice.id);
                                    return { success: false, error: `Erro NuvemFiscal (Recovery de RPS falhou): ${retryErrorString} ${debugMini}` };
                                }
                            } else {
                                console.warn("[NuvemFiscal] Falha ao atualizar config na API:", await updateRes.text());
                            }
                        } else {
                            console.warn("[NuvemFiscal] Configuração de RPS não retornou a sequência esperada.");
                        }
                    } else {
                        console.warn("[NuvemFiscal] Falha ao buscar config NFSe:", await configRes.text());
                    }
                } catch (e: any) {
                    console.error("[NuvemFiscal] Erro durante auto-recovery 00209:", e);
                }

                if (!isRecovered) {
                    await supabase.from("fiscal_invoices").update({
                        status: "error",
                        error_message: fullErrorString
                    }).eq("id", invoice.id);
                    return { success: false, error: `Erro NuvemFiscal: O RPS já foi utilizado (Erro 209). O sistema tentou corrigir automaticamente mas falhou. Vá ao site da Nuvem Fiscal e atualize o Próximo Número do RPS manualmente. ${debugMini}` };
                }
            }

            // AUTO-RETRY LOGIC PARA ERRO 00229 (Endereço já cadastrado)
            else if (
                !isRecovered && (
                    fullErrorString.includes("229") ||
                    (fullErrorString.includes("cadastr") && (fullErrorString.includes("endere") || fullErrorString.includes("endereco")))
                )
            ) {
                console.log("[NuvemFiscal] Detectado erro 00229. Tentando reenvio sem endereço do tomador...");

                if (dpsPayload.infDPS.toma && dpsPayload.infDPS.toma.end) {
                    (dpsPayload.infDPS.toma as any).end = undefined;

                    console.log("[NuvemFiscal] Reenviando payload modificado (sem endereço)...");

                    const retryResponse = await fetch(`${baseUrl}/nfse/dps`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(dpsPayload)
                    });

                    const retryResponseText = await retryResponse.text();
                    let retryResult;
                    try { retryResult = retryResponseText ? JSON.parse(retryResponseText) : {}; } catch (e) { retryResult = {}; }

                    if (retryResponse.ok) {
                        result = retryResult;
                        isRecovered = true;
                    } else {
                        const retryErrorString = JSON.stringify(retryResult);
                        await supabase.from("fiscal_invoices").update({
                            status: "error",
                            error_message: `Tentativa 1: ${fullErrorString} | Tentativa 2: ${retryErrorString}`
                        }).eq("id", invoice.id);
                        return { success: false, error: `Erro NuvemFiscal (Retry falhou): ${retryErrorString} ${debugMini}` };
                    }
                } else {
                    console.log("[NuvemFiscal] Erro 00229 detectado mas não havia endereço para remover.");
                    await supabase.from("fiscal_invoices").update({
                        status: "error",
                        error_message: fullErrorString
                    }).eq("id", invoice.id);
                    return { success: false, error: `Erro NuvemFiscal: ${errorDetails} ${debugMini}` };
                }
            }

            else if (!isRecovered) {
                // Erro normal genérico
                await supabase.from("fiscal_invoices").update({
                    status: "error",
                    error_message: fullErrorString
                }).eq("id", invoice.id);
                return { success: false, error: `Erro NuvemFiscal: ${errorDetails} ${debugMini}` };
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



        if (!invoice) {
            return { success: false, error: "Nota nao encontrada." };
        }

        if (!invoice.nuvemfiscal_uuid) {
            if (invoice.status === "authorized" && invoice.xml_url && !invoice.xml_content) {
                const xmlContent = await tryFetchXmlContent(invoice.xml_url);
                if (xmlContent) {
                    await supabase
                        .from("fiscal_invoices")
                        .update({ xml_content: xmlContent })
                        .eq("id", invoiceId);
                    return { success: true, status: "authorized", data: { xml_salvo: true } };
                }
            }

            return { success: false, error: "Nota nao encontrada ou sem ID da NuvemFiscal." };
        }



        // 2. Buscar Token

        const env = (invoice.environment as 'production' | 'homologation') || 'production';

        const token = await getNuvemFiscalToken(env);



        // 3. Consultar na NuvemFiscal
        // Usa o endpoint conforme o tipo do documento.

        const baseUrl = env === 'production'

            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")

            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");



        const endpoint = invoice.tipo_documento === "NFCe" ? "nfce"
            : invoice.tipo_documento === "NFe" ? "nfe"
            : "nfse";
        const response = await fetch(`${baseUrl}/${endpoint}/${invoice.nuvemfiscal_uuid}`, {

            method: "GET",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json"

            }

        });



        let result = await response.json();

        console.log(`[Consultar ${invoice.tipo_documento}] Resultado:`, JSON.stringify(result, null, 2));



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



        const updatePayload: Record<string, any> = {
            status: novoStatus,
            numero: result.numero || invoice.numero,
            serie: result.serie || invoice.serie,
            chave_acesso: result.chave || result.codigo_verificacao || invoice.chave_acesso,
            xml_url: result.xml_url || invoice.xml_url,
            pdf_url: result.pdf_url || result.link_url || invoice.pdf_url,
            error_message: errorMessage
        };

        // Salva XML localmente para o ZIP do contador, mesmo quando a API nao retorna xml_url.
        if (
            novoStatus === 'authorized' &&
            !invoice.xml_content &&
            (invoice.tipo_documento === "NFCe" || invoice.tipo_documento === "NFe" || invoice.tipo_documento === "NFSe")
        ) {
            let xmlContent: string | null = null;

            if (updatePayload.xml_url) {
                try {
                    const xmlResponse = await fetch(updatePayload.xml_url);
                    if (xmlResponse.ok) {
                        xmlContent = await xmlResponse.text();
                    }
                } catch (xmlErr) {
                    console.warn(`[${invoice.tipo_documento}] Nao foi possivel baixar XML via xml_url.`, xmlErr);
                }
            }

            if (!xmlContent) {
                xmlContent = await tryFetchXmlByUuid(token, baseUrl, invoice.tipo_documento, invoice.nuvemfiscal_uuid);
            }

            if (xmlContent) {
                updatePayload.xml_content = xmlContent;
                console.log(`[${invoice.tipo_documento}] XML salvo localmente para nota ${result.numero || invoiceId}`);
            }
        }

        // After authorization, force next RPS in Nuvem Fiscal to avoid sequence rollback.
        if (novoStatus === "authorized" && result.numero) {
            try {
                const issuedNumber = parseInt(String(result.numero), 10);
                if (Number.isFinite(issuedNumber)) {
                    const { data: company } = await supabase
                        .from("company_settings")
                        .select("cnpj, cpf_cnpj")
                        .eq("organization_id", invoice.organization_id)
                        .single();

                    const cnpjLimpo = String(company?.cnpj || company?.cpf_cnpj || "").replace(/\D/g, "");
                    if (cnpjLimpo) {
                        const configRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                            method: "GET",
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "Content-Type": "application/json"
                            }
                        });

                        if (configRes.ok) {
                            const nfseConfig = await configRes.json();
                            const currentRps = Number(nfseConfig?.rps?.numero || 0);
                            const expectedNext = issuedNumber + 1;

                            if (!Number.isFinite(currentRps) || currentRps < expectedNext) {
                                const updateRes = await fetch(`${baseUrl}/empresas/${cnpjLimpo}/nfse`, {
                                    method: "PUT",
                                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify({
                                        rps: {
                                            ...(nfseConfig?.rps || {}),
                                            numero: expectedNext
                                        }
                                    })
                                });

                                if (!updateRes.ok) {
                                    console.warn("[NFSe][RPS Post-Auth Sync] Failed to update RPS:", await updateRes.text());
                                } else {
                                    console.log(`[NFSe][RPS Post-Auth Sync] RPS moved to ${expectedNext}.`);
                                }
                            }
                        } else {
                            console.warn("[NFSe][RPS Post-Auth Sync] Failed to read NFSe config:", await configRes.text());
                        }
                    }
                }
            } catch (syncErr: any) {
                console.warn("[NFSe][RPS Post-Auth Sync] Non-blocking sync error:", syncErr?.message || syncErr);
            }
        }

        await supabase
            .from("fiscal_invoices")
            .update(updatePayload)
            .eq("id", invoiceId);



        return { success: true, status: novoStatus, data: result };



    } catch (error: any) {

        console.error("Erro ao consultar NFS-e:", error);

        return { success: false, error: error.message };

    }

}

type FiscalInutilizationModel = "NFCe" | "NFe";

export async function inutilizarNumeracaoFiscal(params: {
    organizationId: string;
    model: FiscalInutilizationModel;
    year: number;
    serie: number;
    numeroInicial: number;
    numeroFinal: number;
    justificativa: string;
    environment?: "production" | "homologation";
}) {
    const supabase = createClient();
    const env = params.environment || "production";

    try {
        if (!params.justificativa || params.justificativa.trim().length < 15) {
            return { success: false, error: "Justificativa deve ter ao menos 15 caracteres." };
        }
        if (params.numeroInicial <= 0 || params.numeroFinal <= 0 || params.numeroFinal < params.numeroInicial) {
            return { success: false, error: "Faixa de numeracao invalida." };
        }

        const { data: company, error: companyError } = await supabase
            .from("company_settings")
            .select("cnpj, cpf_cnpj")
            .eq("organization_id", params.organizationId)
            .single();

        if (companyError || !company) {
            return { success: false, error: "Empresa nao encontrada para inutilizacao." };
        }

        const cnpj = String(company.cnpj || company.cpf_cnpj || "").replace(/\D/g, "");
        if (!cnpj) {
            return { success: false, error: "CNPJ da empresa nao encontrado." };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl = env === "production"
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const payload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            cnpj,
            ano: params.year % 100,
            serie: params.serie,
            numero_inicial: params.numeroInicial,
            numero_final: params.numeroFinal,
            justificativa: params.justificativa.trim(),
        };

        const endpoint = params.model === "NFe" ? "nfe" : "nfce";
        const response = await fetch(`${baseUrl}/${endpoint}/inutilizacoes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            return {
                success: false,
                error: result?.error?.message || "Erro ao solicitar inutilizacao.",
                details: result,
            };
        }

        try {
            const protocol = result?.numero_protocolo || result?.autorizacao?.numero_protocolo || null;
            const externalId = result?.id || result?.autorizacao?.id || null;
            const status = result?.status || result?.autorizacao?.status || null;

            await supabase
                .from("fiscal_inutilizations")
                .upsert({
                    organization_id: params.organizationId,
                    environment: env,
                    model: params.model,
                    year: params.year,
                    serie: params.serie,
                    numero_inicial: params.numeroInicial,
                    numero_final: params.numeroFinal,
                    justificativa: params.justificativa.trim(),
                    protocol,
                    external_id: externalId,
                    status,
                    response_json: result,
                }, { onConflict: "external_id" });
        } catch (persistErr) {
            console.warn("[Fiscal] Nao foi possivel salvar historico de inutilizacao.", persistErr);
        }

        return { success: true, data: result };
    } catch (error: any) {
        console.error(`Erro ao inutilizar numeracao ${params.model}:`, error);
        return { success: false, error: error.message || "Erro inesperado na inutilizacao." };
    }
}

export async function inutilizarNumeracaoNFCe(params: Omit<Parameters<typeof inutilizarNumeracaoFiscal>[0], "model">) {
    return inutilizarNumeracaoFiscal({ ...params, model: "NFCe" });
}

export async function inutilizarNumeracaoNFe(params: Omit<Parameters<typeof inutilizarNumeracaoFiscal>[0], "model">) {
    return inutilizarNumeracaoFiscal({ ...params, model: "NFe" });
}

export async function listarInutilizacoesFiscais(params: {
    organizationId: string;
    model?: FiscalInutilizationModel;
    year: number;
    environment?: "production" | "homologation";
}) {
    const supabase = createClient();
    const env = params.environment || "production";

    try {
        let query = supabase
            .from("fiscal_inutilizations")
            .select("id, environment, model, year, serie, numero_inicial, numero_final, justificativa, protocol, external_id, status, response_json, created_at")
            .eq("organization_id", params.organizationId)
            .eq("environment", env)
            .eq("year", params.year);

        if (params.model) {
            query = query.eq("model", params.model);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) return { success: false, error: error.message, data: [] };
        return { success: true, data: data || [] };
    } catch (error: any) {
        return { success: false, error: error.message || "Erro ao listar inutilizacoes.", data: [] };
    }
}

export async function listarInutilizacoesNFCe(params: Omit<Parameters<typeof listarInutilizacoesFiscais>[0], "model">) {
    return listarInutilizacoesFiscais({ ...params, model: "NFCe" });
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



        if (!company) {

            return { success: false, error: "Credenciais não encontradas no banco." };

        }



        const cnpj = (company.cnpj || company.cpf_cnpj).replace(/\D/g, "");

        const token = await getNuvemFiscalToken(environment);



        // 2. Atualizar na NuvemFiscal - Endpoint Específico de NFS-e

        // PUT /empresas/{cpf_cnpj}/nfse

        const payload = {

            ambiente: environment === 'production' ? 'producao' : 'homologacao',

            prefeitura: {
                login: company.nfse_login || cnpj,

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
            return { success: false, error: "Nota nao encontrada ou sem ID da NuvemFiscal." };
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

        // Endpoint: POST /nfce/{id}/cancelar, /nfe/{id}/cancelar ou /nfse/{id}/cancelar

        let endpoint = "";

        let body: any = { justificativa };



        if (invoice.tipo_documento === 'NFCe') {

            endpoint = `/nfce/${invoice.nuvemfiscal_uuid}/cancelar`;

        } else if (invoice.tipo_documento === 'NFe') {

            endpoint = `/nfe/${invoice.nuvemfiscal_uuid}/cancelar`;

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



// ============================================================
// NF-e de Devolução (modelo 55, finNFe=4)
// ============================================================

type DevolucaoPayload = {
    organization_id: string;
    entry_invoice_id: string;
    itens: {
        codigo: string;
        descricao: string;
        ncm: string;
        unidade: string;
        quantidade: number;
        valor_unitario: number;
        valor_total: number;
    }[];
    valor_total: number;
    environment?: "production" | "homologation";
};

export async function emitirNFeDevolucao(payload: DevolucaoPayload) {
    const supabase = createClient();
    let invoiceId: string | null = null;

    try {
        const env = payload.environment || "production";
        const duplicateError = await ensureNoActiveDevolucaoForEntryInvoice(
            supabase,
            payload.organization_id,
            payload.entry_invoice_id,
            env
        );
        if (duplicateError) {
            return { success: false, error: duplicateError };
        }

        const token = await getNuvemFiscalToken(env);
        const baseUrl =
            env === "production"
                ? process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br"
                : process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br";

        // 1. Carregar nota de entrada referenciada
        const { data: entryInvoice } = await supabase
            .from("fiscal_invoices")
            .select("*")
            .eq("id", payload.entry_invoice_id)
            .eq("direction", "entry")
            .single();

        if (!entryInvoice) {
            return { success: false, error: "Nota de entrada não encontrada." };
        }

        // Tenta recuperar chave_acesso do XML se não estiver no banco ou estiver corrompida
        const isValidChave = (v: string) => /^[0-9]{44}$/.test(v);
        let chaveAcesso = entryInvoice.chave_acesso || "";
        if (!isValidChave(chaveAcesso) && entryInvoice.xml_content) {
            try {
                const { XMLParser } = await import("fast-xml-parser");
                const parser = new XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: "@_",
                    parseTagValue: false,    // mantém chNFe como string (44 dígitos não viram float)
                    parseAttributeValue: false,
                });
                const xml = parser.parse(entryInvoice.xml_content);
                // Preferência: chNFe do protNFe (mais confiável)
                chaveAcesso = String(xml.nfeProc?.protNFe?.infProt?.chNFe || "").trim();
                // Fallback: Id do infNFe (atributo XML)
                if (!chaveAcesso) {
                    const nfeProc = xml.nfeProc || xml.NFe;
                    const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
                    const idAttr = infNFe?.["@_Id"] || infNFe?.Id || "";
                    chaveAcesso = String(idAttr).replace(/^NFe/, "");
                }
                // Salva no banco para não precisar parsear novamente
                if (chaveAcesso) {
                    await supabase
                        .from("fiscal_invoices")
                        .update({ chave_acesso: chaveAcesso })
                        .eq("id", payload.entry_invoice_id);
                    console.log("[NFe Devolução] chave_acesso recuperada do XML e salva:", chaveAcesso);
                }
            } catch (e) {
                console.warn("[NFe Devolução] Falha ao extrair chave do XML:", e);
            }
        }

        if (!chaveAcesso) {
            return { success: false, error: "Chave de acesso não encontrada na nota de entrada. Verifique se o XML foi importado corretamente." };
        }

        // 2. Configurações da empresa emitente
        const { data: company } = await supabase
            .from("company_settings")
            .select("*")
            .eq("organization_id", payload.organization_id)
            .single();

        if (!company) return { success: false, error: "Configurações da empresa não encontradas." };

        assertNFeSimplesNacional(company);

        const cnpjEmit = (company.cnpj || company.cpf_cnpj || "").replace(/\D/g, "");
        if (!cnpjEmit) return { success: false, error: "CNPJ da empresa ausente." };
        const inscricaoEstadual = String(company.inscricao_estadual || "").replace(/\D/g, "");
        if (!inscricaoEstadual) {
            return { success: false, error: "Configurações fiscais incompletas: informe a Inscrição Estadual (IE) da empresa para emitir NF-e." };
        }

        // 3. Parsear endereço, IE e ICMS por item do XML do fornecedor
        let fornecedorEnd: any = null;
        let fornecedorIE: string | undefined;
        let fornecedorUF = "SP";
        // cProd → ICMS original (usado para replicar destaque na devolução)
        const itemIcmsMap = new Map<string, { vBC: number; pICMS: number; modBC: number; vProd: number }>();

        if (entryInvoice.xml_content) {
            try {
                const { XMLParser } = await import("fast-xml-parser");
                const parser = new XMLParser({ ignoreAttributes: false });
                const xml = parser.parse(entryInvoice.xml_content);
                const nfeProc = xml.nfeProc || xml.NFe;
                const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;
                const enderEmit = infNFe?.emit?.enderEmit;
                if (enderEmit) {
                    fornecedorUF = enderEmit.UF || "SP";
                    fornecedorEnd = {
                        xLgr: enderEmit.xLgr,
                        nro: String(enderEmit.nro),
                        xCpl: enderEmit.xCpl || undefined,
                        xBairro: enderEmit.xBairro,
                        cMun: Number(enderEmit.cMun),
                        xMun: enderEmit.xMun,
                        UF: enderEmit.UF,
                        CEP: String(enderEmit.CEP).replace(/\D/g, ""),
                        cPais: "1058",
                        xPais: "BRASIL",
                    };
                }
                const ie = infNFe?.emit?.IE;
                if (ie && String(ie) !== "ISENTO") {
                    fornecedorIE = String(ie).replace(/\D/g, "");
                }
                // Extrair ICMS por item para replicar destaque na devolução (CSOSN 900)
                let dets = infNFe?.det;
                if (dets && !Array.isArray(dets)) dets = [dets];
                for (const det of (dets || [])) {
                    const cProd = String(det.prod?.cProd || "");
                    const vProd = Number(det.prod?.vProd || 0);
                    if (!cProd || !vProd) continue;
                    const icmsGroup = det?.imposto?.ICMS;
                    if (!icmsGroup) continue;
                    const icmsValues = Object.values(icmsGroup)[0] as any;
                    const vICMS = Number(icmsValues?.vICMS || 0);
                    if (vICMS <= 0) continue;
                    itemIcmsMap.set(cProd, {
                        vBC: Number(icmsValues?.vBC || vProd),
                        pICMS: Number(icmsValues?.pICMS || 0),
                        modBC: Number(icmsValues?.modBC ?? 3),
                        vProd,
                    });
                }
            } catch (e) {
                console.warn("[NFe Devolução] Falha ao parsear XML:", e);
            }
        }

        // 4. CFOP: interna (5202) ou interestadual (6202)
        const mesmoEstado = company.uf === fornecedorUF;
        const cfopDevolucao = mesmoEstado ? "5202" : "6202";

        // 5. Próximo número de NF-e de devolução (série 1) — filtrado por ambiente
        const nfeSerie = getCompanyNFeSerie(company);
        const nfeNumber = await getNextNFeNumber(supabase, payload.organization_id, env, nfeSerie);
        const { dhEmi } = getSaoPauloDatePartsWithSafety();

        // 6. Precomputar itens com ICMS proporcional à quantidade devolvida
        // Se o fornecedor destacou ICMS na nota original, a devolução deve espelhar (CSOSN 900)
        const detItemsComputed = payload.itens.map((item, idx) => {
            const originalIcms = itemIcmsMap.get(item.codigo || "");
            const itemVProd = toMoneyNumber(item.valor_total);
            let icmsImposto: any;
            let vBC_item = 0;
            let vICMS_item = 0;

            if (originalIcms && originalIcms.vProd > 0) {
                // BC da devolução = só o valor da mercadoria (sem frete/outros da nota original)
                vBC_item = itemVProd;
                const pICMS = originalIcms.pICMS;
                vICMS_item = toMoneyNumber(vBC_item * pICMS / 100);
                icmsImposto = {
                    ICMSSN900: { orig: 0, CSOSN: "900", modBC: 3, vBC: vBC_item, pICMS, vICMS: vICMS_item },
                };
            } else {
                icmsImposto = { ICMSSN102: { orig: 0, CSOSN: "102" } };
            }

            return {
                det: {
                    nItem: idx + 1,
                    prod: {
                        cProd: item.codigo || String(idx + 1),
                        cEAN: "SEM GTIN",
                        xProd: sanitizeFiscalText(item.descricao, 120),
                        NCM: item.ncm || "00000000",
                        CFOP: cfopDevolucao,
                        uCom: item.unidade,
                        qCom: item.quantidade,
                        vUnCom: toMoneyNumber(item.valor_unitario),
                        vProd: itemVProd,
                        ...buildNFeItemTotalAdjustments(payload as any, idx, toMoneyNumber(payload.valor_total)),
                        cEANTrib: "SEM GTIN",
                        uTrib: item.unidade,
                        qTrib: item.quantidade,
                        vUnTrib: toMoneyNumber(item.valor_unitario),
                        indTot: 1,
                    },
                    imposto: {
                        ICMS: icmsImposto,
                        PIS: { PISOutr: { CST: "99", vBC: 0, pPIS: 0, vPIS: 0 } },
                        COFINS: { COFINSOutr: { CST: "99", vBC: 0, pCOFINS: 0, vCOFINS: 0 } },
                    },
                },
                vBC: vBC_item,
                vICMS: vICMS_item,
            };
        });

        const totalVBC = toMoneyNumber(detItemsComputed.reduce((s, d) => s + d.vBC, 0));
        const totalVICMS = toMoneyNumber(detItemsComputed.reduce((s, d) => s + d.vICMS, 0));

        // 7. Montar payload NF-e
        const nfePayload = {
            ambiente: env === "production" ? "producao" : "homologacao",
            infNFe: {
                versao: "4.00",
                ide: {
                    cUF: Number(company.codigo_municipio_ibge?.substring(0, 2)),
                    natOp: "DEVOLUCAO DE MERCADORIA",
                    mod: 55,
                    serie: nfeSerie,
                    nNF: nfeNumber,
                    dhEmi,
                    tpNF: 1,
                    idDest: mesmoEstado ? 1 : 2,
                    cMunFG: Number(company.codigo_municipio_ibge),
                    tpImp: 1,
                    tpEmis: 1,
                    tpAmb: env === "production" ? 1 : 2,
                    finNFe: 4,
                    indFinal: 0,
                    indPres: 9,
                    procEmi: 0,
                    verProc: "AutoEletrica 1.0",
                    NFref: [{ refNFe: chaveAcesso }],
                },
                emit: {
                    CNPJ: cnpjEmit,
                    xNome: sanitizeFiscalText(company.razao_social, 60),
                    xFant: sanitizeFiscalText(company.nome_fantasia, 60),
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
                        xPais: "BRASIL",
                    },
                    IE: inscricaoEstadual,
                    CRT: Number(company.regime_tributario || "1"),
                },
                dest: {
                    CNPJ: (entryInvoice.emitente_cnpj || "").replace(/\D/g, ""),
                    xNome: sanitizeFiscalText(entryInvoice.emitente_nome, 60),
                    ...(fornecedorEnd ? { enderDest: fornecedorEnd } : {}),
                    indIEDest: fornecedorIE ? 1 : 9,
                    ...(fornecedorIE ? { IE: fornecedorIE } : {}),
                },
                det: detItemsComputed.map((d) => d.det),
                total: {
                    ICMSTot: {
                        vBC: totalVBC, vICMS: totalVICMS, vICMSDeson: 0, vFCP: 0,
                        vBCST: 0, vST: 0, vFCPST: 0, vFCPSTRet: 0,
                        vProd: toMoneyNumber(payload.valor_total),
                        vFrete: 0, vSeg: 0, vDesc: 0, vII: 0,
                        vIPI: 0, vIPIDevol: 0, vPIS: 0, vCOFINS: 0,
                        vOutro: 0, vNF: toMoneyNumber(payload.valor_total),
                    },
                },
                transp: { modFrete: 9 },
                pag: { detPag: [{ tPag: "90", vPag: 0 }] },
                infRespTec: buildNFeInfRespTec(company, cnpjEmit, env),
            },
        };

        // 7. Salvar rascunho no banco
        const { data: invoice, error: dbError } = await supabase
            .from("fiscal_invoices")
            .insert({
                organization_id: payload.organization_id,
                direction: "output",
                data_emissao: dhEmi,
                valor_total: toMoneyNumber(payload.valor_total),
                emitente_nome: company.razao_social || company.nome_fantasia || null,
                emitente_cnpj: cnpjEmit,
                destinatario_nome: entryInvoice.emitente_nome,
                destinatario_cnpj: (entryInvoice.emitente_cnpj || "").replace(/\D/g, ""),
                tipo_documento: "NFe",
                status: "processing",
                environment: env,
                payload_json: { ...nfePayload, _entry_invoice_id: payload.entry_invoice_id },
            })
            .select()
            .single();

        if (dbError) throw dbError;
        invoiceId = invoice.id;

        // 8. Enviar para NuvemFiscal
        console.log("[NFe Devolução] Enviando para /nfe, número:", nfeNumber);
        const response = await fetch(`${baseUrl}/nfe`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(nfePayload),
        });

        const responseText = await response.text();
        console.log("[NFe Devolução] Status:", response.status, responseText.substring(0, 500));

        let result: any;
        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: `Resposta inválida da API (${response.status})` })
                .eq("id", invoice.id);
            return { success: false, error: `Resposta inválida da API (${response.status})` };
        }

        if (!response.ok) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: result.error?.message || JSON.stringify(result) })
                .eq("id", invoice.id);
            return { success: false, error: result.error?.message || "Erro na emissão" };
        }

        const realStatus = result.status;

        if (realStatus === "rejeitado") {
            const codigoErro = result.autorizacao?.codigo_status || "N/A";
            const motivoErro = result.autorizacao?.motivo_status || "Motivo não informado";
            await supabase
                .from("fiscal_invoices")
                .update({
                    status: "rejected",
                    nuvemfiscal_uuid: result.id,
                    chave_acesso: result.chave,
                    numero: String(result.numero || ""),
                    serie: String(result.serie || ""),
                    error_message: `Erro ${codigoErro}: ${motivoErro}`,
                })
                .eq("id", invoice.id);
            return {
                success: false,
                error: `NF-e Rejeitada: Erro ${codigoErro} - ${motivoErro}`,
                invoiceId: invoice.id,
            };
        }

        if (realStatus === "autorizado") {
            const xmlContent = await tryFetchXmlContent(result.xml_url);
            const update: Record<string, any> = {
                status: "authorized",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
                xml_url: result.xml_url,
                pdf_url: result.pdf_url,
            };
            if (xmlContent) update.xml_content = xmlContent;
            await supabase.from("fiscal_invoices").update(update).eq("id", invoice.id);
            return { success: true, invoiceId: invoice.id };
        }

        // processando
        await supabase
            .from("fiscal_invoices")
            .update({
                status: "processing",
                nuvemfiscal_uuid: result.id,
                chave_acesso: result.chave,
                numero: String(result.numero || ""),
                serie: String(result.serie || ""),
            })
            .eq("id", invoice.id);
        return { success: true, invoiceId: invoice.id, message: "NF-e em processamento" };

    } catch (error: any) {
        console.error("[NFe Devolução] Erro:", error);
        if (invoiceId) {
            await supabase
                .from("fiscal_invoices")
                .update({ status: "error", error_message: error.message })
                .eq("id", invoiceId);
        }
        return { success: false, error: error.message };
    }
}
