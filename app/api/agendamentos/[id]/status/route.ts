import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        // Next.js 14.2+: params pode ser uma Promise
        const resolvedParams = await Promise.resolve(context.params);
        const appointmentId = resolvedParams.id;

        console.log("[PATCH status] Iniciando para ID:", appointmentId);

        // Supabase client inline (evita problema de resolucao do modulo server.ts)
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                    set(name: string, value: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value, ...options }); } catch (e) { }
                    },
                    remove(name: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value: '', ...options }); } catch (e) { }
                    },
                },
            }
        );

        // Verifica autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error("[PATCH status] Auth error:", authError);
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        // Busca organization_id
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: "Sem organização" }, { status: 400 });
        }

        const body = await request.json();
        const { status } = body;

        const validStatuses = ["agendado", "confirmado", "cancelado", "concluido", "nao_compareceu"];
        if (!status || !validStatuses.includes(status)) {
            return NextResponse.json({ error: "Status inválido" }, { status: 400 });
        }

        console.log(`[PATCH status] Atualizando ${appointmentId} para ${status}`);

        const { error } = await supabase
            .from("appointments")
            .update({ status })
            .eq("id", appointmentId)
            .eq("organization_id", profile.organization_id);

        if (error) {
            console.error("[PATCH status] Erro ao atualizar agendamento:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("[PATCH status] Sucesso!");
        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("[PATCH status] Exceção:", e);
        return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
    }
}
