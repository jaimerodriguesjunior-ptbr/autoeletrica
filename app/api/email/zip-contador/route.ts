export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";

async function getOrgId(): Promise<string | null> {
    const cookieStore = cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
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

        const { zipBase64, fileName, year, month } = await req.json();
        if (!zipBase64 || !fileName) {
            return NextResponse.json({ error: "ZIP ou nome do arquivo ausente" }, { status: 400 });
        }

        const saveLog = async (status: string, errorMessage?: string) => {
            if (!year || !month) return;
            try {
                const { createAdminClient } = await import('@/src/utils/supabase/admin');
                const supabaseAdmin = createAdminClient();
                await supabaseAdmin.from("monthly_closing_log").upsert({
                    organization_id: orgId,
                    year: Number(year),
                    month: Number(month),
                    sent_at: new Date().toISOString(),
                    status,
                    error_message: errorMessage || null,
                }, { onConflict: 'organization_id,year,month' });
            } catch (e) {
                console.error("[Email Contador] Erro ao salvar log:", e);
            }
        };

        // Buscar email do contador e nome da empresa
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
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

        const { data: company } = await supabase
            .from("company_settings")
            .select("email_contador, razao_social, nome_fantasia")
            .eq("organization_id", orgId)
            .single();

        const emailContador = company?.email_contador;
        if (!emailContador) {
            return NextResponse.json(
                { error: "E-mail do contador não configurado. Acesse Configurações para cadastrá-lo." },
                { status: 400 }
            );
        }

        const nomeEmpresa = company?.nome_fantasia || company?.razao_social || "AutoElétrica";

        // Configurar transporter SMTP
        const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
        const smtpPort = parseInt(process.env.SMTP_PORT || "465");
        const smtpUser = process.env.SMTP_USER || "";
        const smtpPass = process.env.SMTP_PASS || "";
        const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
        const smtpFromName = process.env.SMTP_FROM_NAME || "AutoElétrica Pro";

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false },
        });

        const zipBuffer = Buffer.from(zipBase64, "base64");

        await transporter.sendMail({
            from: `${smtpFromName} <${smtpFromEmail}>`,
            to: emailContador,
            subject: `Fechamento Fiscal — ${nomeEmpresa} — ${fileName.replace(".zip", "")}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #1a1a1a; margin-bottom: 8px;">Fechamento Fiscal</h2>
                    <p style="color: #555; margin-bottom: 24px;">
                        Segue em anexo o arquivo ZIP com os XMLs e o resumo do fechamento de
                        <strong>${fileName.replace(".zip", "").replace("Fechamento_", "").replace(/_/g, " ")}</strong>
                        da empresa <strong>${nomeEmpresa}</strong>.
                    </p>
                    <p style="color: #555;">
                        O arquivo contém:<br/>
                        • XMLs de saída (vendas)<br/>
                        • XMLs de entrada (compras)<br/>
                        • XMLs cancelados<br/>
                        • Resumo em CSV e PDF
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                    <p style="color: #aaa; font-size: 12px;">
                        Enviado automaticamente pelo sistema ${smtpFromName}.
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: fileName,
                    content: zipBuffer,
                    contentType: "application/zip",
                },
            ],
        });

        await saveLog('success');
        console.log(`[Email Contador] Enviado para ${emailContador} — ${fileName}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        await saveLog('error', error.message || "Erro ao enviar email");
        console.error("[Email Contador] Erro:", error);
        return NextResponse.json({ error: error.message || "Erro ao enviar email" }, { status: 500 });
    }
}
