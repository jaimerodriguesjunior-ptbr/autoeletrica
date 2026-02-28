import { NextResponse } from "next/server";
import { createClient } from "../../../../src/utils/supabase/server";

export const dynamic = "force-dynamic"; // Desativa cache para exibir em tempo real dependendo dos minutos

export async function GET() {
    console.log("[API Alertas] Incializada chamada...");
    try {
        const supabase = createClient();

        // Verifica auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log("[API Alertas] Sem usuario");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Busca o profile para pegar organization_id
        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single();

        if (!profile?.organization_id) {
            console.log("[API Alertas] Sem org");
            return NextResponse.json({ error: "No organization" }, { status: 400 });
        }

        const agora = new Date();
        const inicioIso = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0).toISOString();
        const fimIso = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

        console.log(`[Alertas] Buscando de ${inicioIso} a ${fimIso}`);

        const { data: apts, error } = await supabase
            .from("appointments")
            .select(`
                id,
                start_time,
                duration_minutes,
                type,
                status,
                description,
                token,
                work_order_id,
                alerta_adiado_ate,
                clients ( nome, whatsapp ),
                vehicles ( modelo, placa )
            `)
            .eq("organization_id", profile.organization_id)
            .in("status", ["agendado", "confirmado"])
            .gte("start_time", inicioIso)
            .lte("start_time", fimIso)
            .order("start_time", { ascending: true });

        if (error) {
            console.error("[API Alertas] Erro db", error);
            throw error;
        }

        console.log(`[Alertas] Encontrados no dia: ${apts?.length || 0}`);

        const alertasVigentes = (apts || []).filter((apt: any) => {
            const horaAgendamento = new Date(apt.start_time);

            // Marca de inicio do radar: 15 minutos antes da hora marcada
            const inicioDoRadar = new Date(horaAgendamento.getTime() - 15 * 60000);

            if (agora < inicioDoRadar) {
                console.log(`[Alertas] Cedo: ${horaAgendamento.toISOString()}. Comeca: ${inicioDoRadar.toISOString()}. Agora: ${agora.toISOString()}`);
                return false;
            }

            if (apt.alerta_adiado_ate) {
                const soneca = new Date(apt.alerta_adiado_ate);
                if (agora < soneca) {
                    console.log(`[Alertas] Em Soneca: ${apt.alerta_adiado_ate}`);
                    return false;
                }
            }

            console.log(`[Alertas] APROVADO! Mostrar no banner: ${horaAgendamento.toISOString()}`);
            return true;
        });

        return NextResponse.json(alertasVigentes);

    } catch (error: any) {
        console.error("[GET Alertas Erro CATCH]", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
