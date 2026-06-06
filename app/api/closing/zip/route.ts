export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { buildClosingZip, type ClosingData } from "@/src/lib/closing-zip";
import { extractItemsFromXmlContent } from "@/src/lib/nfe_xml";

export async function buildFiscalReportData(
    supabase: ReturnType<typeof createAdminClient>,
    organizationId: string,
    month: number,
    year: number,
    closingData: ClosingData
): Promise<ClosingData> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;
    const fields = "id, tipo_documento, valor_total, xml_content, data_emissao, created_at";

    const [
        { data: datedInvoices, error: datedError },
        { data: fallbackInvoices, error: fallbackError },
    ] = await Promise.all([
        supabase
            .from("fiscal_invoices")
            .select(fields)
            .eq("organization_id", organizationId)
            .eq("direction", "output")
            .eq("status", "authorized")
            .neq("environment", "homologation")
            .gte("data_emissao", startDate)
            .lt("data_emissao", endDate),
        supabase
            .from("fiscal_invoices")
            .select(fields)
            .eq("organization_id", organizationId)
            .eq("direction", "output")
            .eq("status", "authorized")
            .neq("environment", "homologation")
            .is("data_emissao", null)
            .gte("created_at", startDate)
            .lt("created_at", endDate),
    ]);

    if (datedError || fallbackError) {
        throw new Error(
            `Erro ao apurar valores fiscais do fechamento: ${datedError?.message || fallbackError?.message}`
        );
    }

    const invoices = [...(datedInvoices || []), ...(fallbackInvoices || [])]
        .filter((invoice, index, list) => list.findIndex((item) => item.id === invoice.id) === index);

    const cfopTotals = new Map<string, number>();
    let productSales = 0;
    let serviceSales = 0;

    for (const invoice of invoices) {
        const total = Number(invoice.valor_total || 0);

        if (invoice.tipo_documento === "NFCe") {
            productSales += total;
        } else if (invoice.tipo_documento === "NFSe") {
            serviceSales += total;
            continue;
        }

        if (!invoice.xml_content || !["NFCe", "NFe"].includes(invoice.tipo_documento)) {
            continue;
        }

        const { items } = await extractItemsFromXmlContent(invoice.xml_content);
        for (const item of items) {
            const cfop = item.cfop || "Sem CFOP";
            cfopTotals.set(cfop, (cfopTotals.get(cfop) || 0) + Number(item.valor_total || 0));
        }
    }

    return {
        ...closingData,
        faturamento: {
            total_pecas: productSales,
            total_servicos: serviceSales,
        },
        faturamento_por_cfop: Array.from(cfopTotals, ([cfop, total]) => ({ cfop, total }))
            .sort((a, b) => a.cfop.localeCompare(b.cfop)),
    };
}

async function getOrgId(): Promise<string | null> {
    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch { }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

    return profile?.organization_id ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const orgId = await getOrgId();
        if (!orgId) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        const body = await req.json();
        const month = Number(body.month);
        const year = Number(body.year);

        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
            return NextResponse.json({ error: "Período inválido" }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();
        const { data: closingData, error } = await supabaseAdmin.rpc("get_monthly_closing_data", {
            p_organization_id: orgId,
            p_month: month,
            p_year: year,
        });

        if (error || !closingData) {
            console.error("[Closing ZIP] Erro ao buscar fechamento:", error);
            return NextResponse.json({ error: "Não foi possível gerar o fechamento" }, { status: 500 });
        }

        const fiscalReportData = await buildFiscalReportData(
            supabaseAdmin,
            orgId,
            month,
            year,
            closingData as ClosingData
        );

        const { blob, folderName } = await buildClosingZip(
            supabaseAdmin,
            orgId,
            month - 1,
            year,
            fiscalReportData
        );

        const buffer = Buffer.from(await blob.arrayBuffer());
        const fileName = `${folderName}.zip`;

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
                "X-File-Name": fileName,
            },
        });
    } catch (error: any) {
        console.error("[Closing ZIP] Erro ao gerar ZIP:", error);
        return NextResponse.json(
            { error: error?.message || "Erro ao gerar ZIP" },
            { status: 500 }
        );
    }
}
