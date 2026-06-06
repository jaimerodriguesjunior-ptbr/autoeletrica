const CP1252_EXTRA: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
};

function encodeWindows1252(value: string): Uint8Array {
    const bytes: number[] = [];

    for (const char of value) {
        const code = char.codePointAt(0) || 0x3f;
        if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
            bytes.push(code);
        } else {
            bytes.push(CP1252_EXTRA[code] ?? 0x3f);
        }
    }

    return Uint8Array.from(bytes);
}

function digits(value: unknown) {
    return String(value || "").replace(/\D/g, "");
}

function fixed(value: unknown, length: number) {
    return String(value || "").replace(/[\r\n;]/g, " ").slice(0, length).padEnd(length, " ");
}

function numeric(value: unknown, length: number) {
    return digits(value).slice(-length).padStart(length, "0");
}

function money(value: unknown) {
    return Number(value || 0).toFixed(2).padStart(18, "0");
}

function rate(value: unknown) {
    return Number(value || 0).toFixed(2).padStart(6, "0");
}

function formatDate(value: unknown) {
    const raw = String(value || "");
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function normalizePhone(value: unknown) {
    const phone = digits(value);
    if (phone.length === 10) return `${phone.slice(0, 2)}9${phone.slice(2)}`;
    return phone.slice(0, 12);
}

function getClient(invoice: any) {
    const workOrder = Array.isArray(invoice.work_orders)
        ? invoice.work_orders[0]
        : invoice.work_orders;
    const client = Array.isArray(workOrder?.clients)
        ? workOrder.clients[0]
        : workOrder?.clients;
    return client || {};
}

export async function buildNfseAccountingExport(
    supabase: any,
    organizationId: string,
    month: number,
    year: number
): Promise<{ fileName: string; content: Uint8Array; invoiceCount: number } | null> {
    const startDate = new Date(Date.UTC(year, month, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month + 1, 1)).toISOString();

    const [{ data: company, error: companyError }, { data: invoices, error: invoicesError }] = await Promise.all([
        supabase
            .from("company_settings")
            .select("cnpj, cpf_cnpj, cidade, uf, cep")
            .eq("organization_id", organizationId)
            .single(),
        supabase
            .from("fiscal_invoices")
            .select(`
                id, numero, serie, chave_acesso, valor_total, data_emissao, created_at,
                destinatario_nome, destinatario_cnpj, payload_json,
                work_orders(client_id, clients(nome, cpf_cnpj, whatsapp, endereco))
            `)
            .eq("organization_id", organizationId)
            .eq("tipo_documento", "NFSe")
            .eq("direction", "output")
            .eq("status", "authorized")
            .neq("environment", "homologation")
            .or(`and(data_emissao.gte.${startDate},data_emissao.lt.${endDate}),and(data_emissao.is.null,created_at.gte.${startDate},created_at.lt.${endDate})`)
            .order("data_emissao", { ascending: true, nullsFirst: false }),
    ]);

    if (companyError || invoicesError) {
        throw new Error(
            `Erro ao gerar TXT contabil de NFS-e: ${companyError?.message || invoicesError?.message}`
        );
    }

    if (!invoices?.length) return null;

    const issuerDocument = digits(company?.cnpj || company?.cpf_cnpj);
    const issuerType = issuerDocument.length === 14 ? "J" : "F";
    const lines: string[] = [];
    let cityCode = "7571";

    for (const invoice of invoices as any[]) {
        const infDps = invoice.payload_json?.infDPS || {};
        const recipient = infDps.toma || {};
        const service = infDps.serv?.cServ || {};
        const tax = infDps.valores?.trib?.tribMun || {};
        const client = getClient(invoice);
        const clientAddress = client.endereco || {};
        const payloadAddress = recipient.end || {};
        const payloadNationalAddress = payloadAddress.endNac || {};
        const accessKey = digits(invoice.chave_acesso);
        cityCode = accessKey.slice(0, 4) || cityCode;

        const recipientDocument = digits(
            recipient.CNPJ || recipient.CPF || invoice.destinatario_cnpj || client.cpf_cnpj
        );
        const recipientType = recipientDocument.length === 14 ? "J" : "F";
        const invoiceNumber = numeric(invoice.numero, 18);
        const series = String(invoice.serie || "1");
        const issueDate = formatDate(infDps.dCompet || infDps.dhEmi || invoice.data_emissao || invoice.created_at);
        const serviceTotal = Number(infDps.valores?.vServPrest?.vServ ?? invoice.valor_total ?? 0);
        const serviceCode = numeric(service.cTribNac || service.cTribMun, 7);
        const description = fixed(service.xDescServ || "SERVICO", 250);
        const municipalCode = numeric(cityCode, 8);

        lines.push([
            "10",
            issuerType,
            issuerDocument,
            series,
            invoiceNumber,
            accessKey,
            issueDate,
            "00:00:00",
            recipientType,
            numeric(recipientDocument, 14),
            money(serviceTotal),
            money(0),
            money(0),
            money(0),
            money(0),
            "E",
            fixed("", 250),
            fixed("", 10),
            fixed("", 250),
            money(0),
            money(0),
            money(0),
            "S",
            "",
        ].join(";"));

        lines.push([
            "20",
            issuerType,
            issuerDocument,
            series,
            invoiceNumber,
            serviceCode,
            rate(tax.pAliq),
            description,
            "00",
            money(serviceTotal),
            money(0),
            money(0),
            municipalCode,
            "S",
            "",
        ].join(";"));

        const street = payloadAddress.xLgr || clientAddress.logradouro || clientAddress.rua || "Nao Informado";
        const number = payloadAddress.nro || clientAddress.numero || "SN";
        const complement = payloadAddress.xCpl || clientAddress.complemento || "";
        const district = payloadAddress.xBairro || clientAddress.bairro || "Centro";
        const city = payloadAddress.xMun || clientAddress.cidade || company?.cidade || "";
        const state = payloadAddress.UF || clientAddress.uf || company?.uf || "";
        const zipCode = digits(payloadNationalAddress.CEP || payloadAddress.CEP || clientAddress.cep || company?.cep);
        const phone = normalizePhone(client.whatsapp || recipient.fone);

        lines.push([
            "30",
            recipientType,
            numeric(recipientDocument, 14),
            fixed(String(recipient.xNome || invoice.destinatario_nome || client.nome || "").toUpperCase(), 100),
            fixed(street, 40),
            fixed(number, 8),
            fixed(complement, 20),
            fixed(district, 20),
            fixed(city, 30),
            fixed(String(state).toUpperCase(), 2),
            numeric(zipCode, 8),
            fixed(phone, 12),
            fixed("", 12),
            "",
        ].join(";"));
    }

    const now = new Date();
    const timestamp = `${now.getDate()}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const fileName = `exp_${cityCode}_${timestamp}_wne_nota_fiscal.txt`;

    return {
        fileName,
        content: encodeWindows1252(`${lines.join("\r\n")}\r\n`),
        invoiceCount: invoices.length,
    };
}
