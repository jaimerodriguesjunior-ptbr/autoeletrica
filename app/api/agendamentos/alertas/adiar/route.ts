import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../src/utils/supabase/server";

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();

        // Verifica auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { appointment_id, minutos } = body;

        if (!appointment_id || !minutos) {
            return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 });
        }

        // Calcula a nova hora de alerta adiada
        const agora = new Date();
        const novaSoneca = new Date(agora.getTime() + (minutos * 60000));

        const { error } = await supabase
            .from("appointments")
            .update({ alerta_adiado_ate: novaSoneca.toISOString() })
            .eq("id", appointment_id);

        if (error) throw error;

        return NextResponse.json({ message: "Soneca registrada" });

    } catch (error: any) {
        console.error("[POST Soneca Alerta]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
