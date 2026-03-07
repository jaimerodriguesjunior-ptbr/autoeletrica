import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/src/utils/supabase/admin'

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Token não informado.' }, { status: 400 })
    }

    try {
        const supabase = createAdminClient()

        // 1. Buscar cliente pelo public_token
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('id, nome, whatsapp, organization_id')
            .eq('public_token', token)
            .single()

        if (clientError || !client) {
            return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
        }

        // 2. Buscar dados da empresa
        let empresa: any = null
        if (client.organization_id) {
            const { data: companyData } = await supabase
                .from('company_settings')
                .select('nome_fantasia, logo_url, telefone, endereco')
                .eq('organization_id', client.organization_id)
                .limit(1)
                .single()
            empresa = companyData
        }

        // 3. Buscar todas as OS deste cliente
        const { data: workOrders, error: woError } = await supabase
            .from('work_orders')
            .select(`
                id, description, status, total, created_at, 
                vehicles ( modelo, placa ),
                work_order_items ( name, total_price, tipo, peca_cliente )
            `)
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })

        if (woError) throw woError

        // 4. Buscar todas as transações vinculadas às OS deste cliente
        const woIds = (workOrders || []).map(wo => wo.id)
        let transactions: any[] = []

        if (woIds.length > 0) {
            const { data: txData, error: txError } = await supabase
                .from('transactions')
                .select('id, description, amount, type, category, status, payment_method, date, work_order_id')
                .in('work_order_id', woIds)
                .order('date', { ascending: false })

            if (txError) throw txError
            transactions = txData || []
        }

        // 5. Calcular resumo financeiro com base nas OSs e Transações Pagas
        const totalServicos = (workOrders || [])
            .filter(wo => wo.status !== 'cancelado')
            .reduce((sum, wo) => sum + (wo.total || 0), 0)

        const totalPago = transactions
            .filter(t => t.type === 'income' && t.status === 'paid')
            .reduce((sum, t) => sum + (t.amount || 0), 0)

        const totalPendente = Math.max(0, totalServicos - totalPago)

        return NextResponse.json({
            client: { nome: client.nome, whatsapp: client.whatsapp },
            empresa,
            workOrders: workOrders || [],
            transactions,
            resumo: {
                totalServicos,
                totalPago,
                totalPendente,
            }
        })

    } catch (err: any) {
        console.error('[Portal Extrato] Erro:', err.message)
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }
}
