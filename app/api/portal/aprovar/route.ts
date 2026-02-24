import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/src/utils/supabase/admin'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { token, aprovacao_ip, aprovacao_dispositivo, aprovacao_versao_hash } = body

        if (!token) {
            return NextResponse.json({ error: 'Token não informado.' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Buscar OS pelo token para validar
        const { data: os, error: fetchErr } = await supabase
            .from('work_orders')
            .select('id, status')
            .eq('public_token', token)
            .single()

        if (fetchErr || !os) {
            return NextResponse.json({ error: 'OS não encontrada.' }, { status: 404 })
        }

        if (os.status !== 'orcamento') {
            return NextResponse.json({ error: 'Esta OS não está aguardando aprovação.' }, { status: 400 })
        }

        // Atualizar status para aprovado com metadados
        const { error: updateErr } = await supabase
            .from('work_orders')
            .update({
                status: 'aprovado',
                aprovacao_ip: aprovacao_ip || 'desconhecido',
                aprovacao_dispositivo: aprovacao_dispositivo || 'desconhecido',
                aprovacao_timestamp: new Date().toISOString(),
                aprovacao_versao_hash: aprovacao_versao_hash || null
            })
            .eq('id', os.id)

        if (updateErr) {
            throw updateErr
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Portal Aprovar] Erro:', err.message)
        return NextResponse.json({ error: 'Erro ao aprovar.' }, { status: 500 })
    }
}
