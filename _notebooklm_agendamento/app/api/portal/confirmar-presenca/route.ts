import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/src/utils/supabase/admin'

export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json()

        if (!token) {
            return NextResponse.json({ error: 'Token não informado.' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Buscar agendamento pelo token
        const { data: apt, error: findError } = await supabase
            .from('appointments')
            .select('id, status')
            .eq('token', token)
            .single()

        if (findError || !apt) {
            return NextResponse.json({ error: 'Agendamento não encontrado.' }, { status: 404 })
        }

        if (apt.status === 'confirmado') {
            return NextResponse.json({ message: 'Presença já confirmada.' })
        }

        if (apt.status === 'cancelado' || apt.status === 'nao_compareceu') {
            return NextResponse.json({ error: 'Este agendamento foi cancelado.' }, { status: 400 })
        }

        // Atualizar status para confirmado
        const { error: updateError } = await supabase
            .from('appointments')
            .update({ status: 'confirmado' })
            .eq('id', apt.id)

        if (updateError) throw updateError

        return NextResponse.json({ message: 'Presença confirmada com sucesso!' })

    } catch (err: any) {
        console.error('[Portal Confirmar] Erro:', err.message)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
