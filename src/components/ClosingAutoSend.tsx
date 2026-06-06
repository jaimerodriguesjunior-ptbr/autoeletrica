"use client";

import { useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { createClient } from "@/src/lib/supabase";
import { getClosingLog, getCompanyFiscalStatus } from "@/src/actions/closing_log";

// Dispara silenciosamente nos dias 1–5 do mês para orgs com módulo fiscal ativo.
// Usa localStorage para garantir uma única tentativa por mês.
export function ClosingAutoSend() {
    const { profile } = useAuth();
    const supabase = createClient();

    useEffect(() => {
        if (!profile?.organization_id) return;

        const today = new Date();
        const day = today.getDate();
        if (day < 1 || day > 5) return;

        const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonth = prevDate.getMonth() + 1; // 1-indexed para DB
        const prevYear = prevDate.getFullYear();

        const storageKey = `closing_autosend_${prevYear}_${prevMonth}_${profile.organization_id}`;
        if (localStorage.getItem(storageKey)) return;

        const orgId = profile.organization_id;

        async function doAutoSend() {
            try {
                const [log, fiscal] = await Promise.all([
                    getClosingLog(prevYear, prevMonth),
                    getCompanyFiscalStatus(),
                ]);

                // Já enviado com sucesso — marcar e não tentar de novo
                if (log?.status === "success") {
                    localStorage.setItem(storageKey, new Date().toISOString());
                    return;
                }
                // Módulo fiscal desativado — ignorar silenciosamente
                if (!fiscal?.usa_fiscal) return;
                // E-mail não configurado — gravar erro no banco para o banner aparecer em /fechamento
                if (!fiscal?.email_contador) {
                    await supabase.from("monthly_closing_log").upsert({
                        organization_id: orgId,
                        year: prevYear,
                        month: prevMonth,
                        sent_at: new Date().toISOString(),
                        status: "error",
                        error_message: "E-mail do contador não configurado. Acesse Configurações para cadastrá-lo.",
                    }, { onConflict: "organization_id,year,month" });
                    return;
                    // Não marcamos localStorage — na próxima visita tenta de novo (pode já ter e-mail)
                }

                // Marcar agora — vai tentar o envio (evita disparos paralelos)
                localStorage.setItem(storageKey, new Date().toISOString());

                const { data: closingData, error } = await supabase.rpc("get_monthly_closing_data", {
                    p_organization_id: orgId,
                    p_month: prevMonth,
                    p_year: prevYear,
                });
                if (error || !closingData) return;

                const zipResponse = await fetch("/api/closing/zip", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ month: prevMonth, year: prevYear }),
                });

                if (!zipResponse.ok) {
                    throw new Error("Não foi possível gerar o ZIP do fechamento.");
                }

                const blob = await zipResponse.blob();
                const folderName = zipResponse.headers.get("X-File-Name")?.replace(/\.zip$/i, "") || `Fechamento_${prevMonth}_${prevYear}`;

                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                await fetch("/api/email/zip-contador", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        zipBase64: base64,
                        fileName: `${folderName}.zip`,
                        year: prevYear,
                        month: prevMonth,
                    }),
                });
            } catch (e) {
                console.error("[ClosingAutoSend]", e);
            }
        }

        doAutoSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.organization_id]);

    return null;
}
