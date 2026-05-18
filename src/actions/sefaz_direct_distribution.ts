"use server";

import fs from "fs";
import https from "https";
import zlib from "zlib";
import { XMLParser } from "fast-xml-parser";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { createClient } from "@/src/utils/supabase/server";

const SEFAZ_DIST_DFE_URL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

function onlyDigits(value?: string | null) {
    return String(value || "").replace(/\D/g, "");
}

function xmlEscape(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function getDirectSefazCertificate() {
    const pfxBase64 = process.env.SEFAZ_DIRECT_PFX_BASE64;
    const pfxPath = process.env.SEFAZ_DIRECT_PFX_PATH;
    const passphrase = process.env.SEFAZ_DIRECT_PFX_PASSWORD;

    if (!passphrase) {
        throw new Error("Senha do certificado direto nao configurada. Defina SEFAZ_DIRECT_PFX_PASSWORD.");
    }

    if (pfxBase64) {
        return { pfx: Buffer.from(pfxBase64, "base64"), passphrase };
    }

    if (pfxPath) {
        return { pfx: fs.readFileSync(pfxPath), passphrase };
    }

    throw new Error("Certificado direto nao configurado. Defina SEFAZ_DIRECT_PFX_BASE64 ou SEFAZ_DIRECT_PFX_PATH.");
}

async function getOrgAndCompany() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuario nao autenticado.");

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    if (!profile?.organization_id) throw new Error("Organizacao nao encontrada.");

    const { data: company } = await supabase
        .from("company_settings")
        .select("cnpj, cpf_cnpj, uf")
        .eq("organization_id", profile.organization_id)
        .single();

    const cpfCnpj = onlyDigits(company?.cnpj || company?.cpf_cnpj);
    if (!cpfCnpj) throw new Error("CNPJ da oficina nao configurado.");

    return { organizationId: profile.organization_id as string, cpfCnpj, uf: company?.uf || "PR" };
}

function ufToCUF(uf: string) {
    const codes: Record<string, string> = {
        RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
        MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
        MG: "31", ES: "32", RJ: "33", SP: "35",
        PR: "41", SC: "42", RS: "43",
        MS: "50", MT: "51", GO: "52", DF: "53",
    };
    return codes[uf.toUpperCase()] || "41";
}

function buildSoapEnvelope(params: { cnpj: string; cUFAutor: string; chave: string }) {
    return `<?xml version="1.0" encoding="utf-8"?>` +
        `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
        `<soap12:Body>` +
        `<nfeDistDFeInteresse xmlns="${WSDL_NS}">` +
        `<nfeDadosMsg>` +
        `<distDFeInt xmlns="${NFE_NS}" versao="1.01">` +
        `<tpAmb>1</tpAmb>` +
        `<cUFAutor>${xmlEscape(params.cUFAutor)}</cUFAutor>` +
        `<CNPJ>${xmlEscape(params.cnpj)}</CNPJ>` +
        `<consChNFe><chNFe>${xmlEscape(params.chave)}</chNFe></consChNFe>` +
        `</distDFeInt>` +
        `</nfeDadosMsg>` +
        `</nfeDistDFeInteresse>` +
        `</soap12:Body>` +
        `</soap12:Envelope>`;
}

async function postSoapDirect(xmlBody: string) {
    const cert = getDirectSefazCertificate();
    const url = new URL(SEFAZ_DIST_DFE_URL);

    return new Promise<string>((resolve, reject) => {
        const req = https.request({
            protocol: url.protocol,
            hostname: url.hostname,
            path: `${url.pathname}${url.search}`,
            method: "POST",
            pfx: cert.pfx,
            passphrase: cert.passphrase,
            rejectUnauthorized: true,
            headers: {
                "Content-Type": `application/soap+xml; charset=utf-8; action="${WSDL_NS}/nfeDistDFeInteresse"`,
                "Content-Length": Buffer.byteLength(xmlBody, "utf8"),
            },
        }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", chunk => chunks.push(Buffer.from(chunk)));
            res.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${text}`));
                    return;
                }
                resolve(text);
            });
        });

        req.on("error", reject);
        req.write(xmlBody, "utf8");
        req.end();
    });
}

function findDeep(value: any, key: string): any {
    if (!value || typeof value !== "object") return undefined;
    if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    for (const child of Object.values(value)) {
        const found = findDeep(child, key);
        if (found !== undefined) return found;
    }
    return undefined;
}

function docZipToXml(docZip: any) {
    const zipped = typeof docZip === "string" ? docZip : docZip?.["#text"];
    if (!zipped) return null;
    const buffer = Buffer.from(zipped, "base64");
    try {
        return zlib.gunzipSync(buffer).toString("utf8");
    } catch {
        return buffer.toString("utf8");
    }
}

function extractDocZips(retDist: any) {
    const lote = retDist?.loteDistDFeInt;
    const docs = lote?.docZip ? (Array.isArray(lote.docZip) ? lote.docZip : [lote.docZip]) : [];
    return docs.map((doc: any) => ({
        schema: doc?.["@_schema"] || doc?.schema || null,
        nsu: doc?.["@_NSU"] || doc?.NSU || null,
        xml: docZipToXml(doc),
    })).filter((doc: any) => doc.xml);
}

export async function searchNfeDirectSefazByAccessKey(chaveAcesso: string) {
    try {
        const cleanKey = onlyDigits(chaveAcesso);
        if (!/^[0-9]{44}$/.test(cleanKey)) {
            throw new Error("Chave de acesso invalida. Informe os 44 digitos da NF-e.");
        }

        const { organizationId, cpfCnpj, uf } = await getOrgAndCompany();
        const soap = buildSoapEnvelope({
            cnpj: cpfCnpj,
            cUFAutor: ufToCUF(uf),
            chave: cleanKey,
        });
        const responseXml = await postSoapDirect(soap);
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            parseTagValue: false,
            parseAttributeValue: false,
            removeNSPrefix: true,
        });
        const parsed = parser.parse(responseXml);
        const retDist = findDeep(parsed, "retDistDFeInt");
        const cStat = String(retDist?.cStat || "");
        const xMotivo = String(retDist?.xMotivo || "");
        const docs = extractDocZips(retDist);

        if (docs.length === 0) {
            return {
                success: true,
                found: false,
                inserted: 0,
                codigoStatus: cStat,
                motivoStatus: xMotivo,
                cpfCnpj,
                rawStatus: { ultNSU: retDist?.ultNSU, maxNSU: retDist?.maxNSU },
            };
        }

        const notaDoc = docs.find((doc: any) => doc.xml.includes("<resNFe") || doc.xml.includes("<NFe") || doc.xml.includes("<nfeProc")) || docs[0];
        const isResumo = notaDoc.xml.includes("<resNFe");

        const existingInvoice = await createAdminClient()
            .from("fiscal_invoices")
            .select("id, numero, emitente_nome, data_emissao")
            .eq("organization_id", organizationId)
            .eq("chave_acesso", cleanKey)
            .maybeSingle();

        if (existingInvoice.data) {
            return {
                success: true,
                found: true,
                inserted: 0,
                alreadyImported: true,
                invoice: existingInvoice.data,
                resumo: isResumo,
                codigoStatus: cStat,
                motivoStatus: xMotivo,
                cpfCnpj,
            };
        }

        const supabaseAdmin = createAdminClient();
        const { data: queueItem, error } = await supabaseAdmin
            .from("nfe_import_queue")
            .upsert({
                organization_id: organizationId,
                chave_acesso: cleanKey,
                nsu: notaDoc.nsu ? Number(notaDoc.nsu) : null,
                schema: notaDoc.schema,
                resumo: isResumo,
                status: "pending",
                xml_content: isResumo ? null : notaDoc.xml,
                metadata: {
                    origem: "sefaz-direto",
                    schema: notaDoc.schema,
                    cStat,
                    xMotivo,
                },
                updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,chave_acesso" })
            .select("id")
            .single();

        if (error) throw error;

        return {
            success: true,
            found: true,
            inserted: 1,
            alreadyImported: false,
            queueId: queueItem?.id || null,
            resumo: isResumo,
            codigoStatus: cStat,
            motivoStatus: xMotivo,
            cpfCnpj,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
