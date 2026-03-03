import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE(
    request: Request,
    context: { params: { id: string } }
) {
    try {
        const { id } = context.params;
        console.log("[DELETE agendamento] ID:", id);

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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
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

        // Deleta o agendamento (somente da própria organização)
        const { error } = await supabase
            .from("appointments")
            .delete()
            .eq("id", id)
            .eq("organization_id", profile.organization_id);

        if (error) {
            console.error("[DELETE agendamento] Erro:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("[DELETE agendamento] Sucesso!");
        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("[DELETE agendamento] Exceção:", e);
        return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
    }
}
