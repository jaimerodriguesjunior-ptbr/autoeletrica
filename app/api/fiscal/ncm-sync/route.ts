import { NextResponse } from "next/server";
import { syncNcmDatabase } from "@/src/actions/fiscal_db";
import { createClient } from "@/src/utils/supabase/server";

export const maxDuration = 300; // 5 minutos para download e carga em lote

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("Authorization");
        const cronSecret = process.env.CRON_SECRET;
        const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isCronAuthorized) {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
            }

            const { createAdminClient } = await import("@/src/utils/supabase/admin");
            const supabaseAdmin = createAdminClient();
            const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("cargo")
                .eq("id", user.id)
                .single();

            const cargo = (profile?.cargo || "").toLowerCase();
            const isAdmin = cargo === "owner" || cargo === "gerente" || cargo === "admin";

            if (!isAdmin) {
                return NextResponse.json({
                    error: "Acesso negado: apenas administradores podem sincronizar o catálogo fiscal."
                }, { status: 403 });
            }
        }

        const result = await syncNcmDatabase();

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            message: "Sincronização da tabela NCM concluída com sucesso!",
            total_inseridos: result.count
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Erro inesperado" }, { status: 500 });
    }
}
