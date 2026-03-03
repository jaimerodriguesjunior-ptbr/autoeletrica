-- Função para consolidar dados do dashboard financeiro detalhado
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_organization_id UUID,
    p_month INT,
    p_year INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_result JSONB;
BEGIN
    -- Define o intervalo do mês
    v_start_date := (p_year || '-' || p_month || '-01')::DATE;
    v_end_date := (v_start_date + interval '1 month')::DATE;

    WITH 
    pecas_servicos AS (
        -- Faturamento (Receita Bruta baseada em OS finalizadas pagas) dividida entre Peças e Serviços
        SELECT 
            COALESCE(SUM(CASE WHEN i.tipo = 'peca' AND NOT COALESCE(i.peca_cliente, false) THEN i.total_price ELSE 0 END), 0) as total_pecas,
            COALESCE(SUM(CASE WHEN i.tipo = 'servico' THEN i.total_price ELSE 0 END), 0) as total_servicos
        FROM work_orders o
        JOIN work_order_items i ON i.work_order_id = o.id
        WHERE o.organization_id = p_organization_id
        AND o.status IN ('entregue', 'finalizado')
        AND EXISTS (
            SELECT 1 FROM transactions t 
            WHERE t.work_order_id = o.id 
            AND t.date >= v_start_date 
            AND t.date < v_end_date
            AND t.type = 'income'
            AND t.status = 'paid'
        )
    ),
    meios_pagamento AS (
        -- Agrupa recebimentos (entradas pagas) por forma de pagamento
        SELECT 
            COALESCE(payment_method, 
                CASE 
                    WHEN description ILIKE '%(pix)%' OR description ILIKE '% pix %' THEN 'pix'
                    WHEN description ILIKE '%(cartao_credito)%' OR description ILIKE '%credito%' THEN 'cartao_credito'
                    WHEN description ILIKE '%(cartao_debito)%' OR description ILIKE '%debito%' THEN 'cartao_debito'
                    WHEN description ILIKE '%(dinheiro)%' THEN 'dinheiro'
                    WHEN description ILIKE '%(boleto)%' THEN 'boleto'
                    WHEN description ILIKE '%(cheque)%' THEN 'cheque_pre'
                    ELSE 'outros'
                END
            ) as metodo,
            SUM(amount) as total
        FROM transactions
        WHERE organization_id = p_organization_id
        AND type = 'income'
        AND status = 'paid'
        AND date >= v_start_date
        AND date < v_end_date
        GROUP BY 1
    ),
    despesas_categoria AS (
        -- Agrupa despesas pagas por categoria
        SELECT 
            COALESCE(category, 'Outros') as categoria,
            SUM(amount) as total
        FROM transactions
        WHERE organization_id = p_organization_id
        AND type = 'expense'
        AND status = 'paid'
        AND date >= v_start_date
        AND date < v_end_date
        GROUP BY 1
    ),
    pendencias AS (
        -- Contas a Pagar e a Receber dentro do mês
        SELECT 
            COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) as a_receber,
            COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) as a_pagar
        FROM transactions
        WHERE organization_id = p_organization_id
        AND status = 'pending'
        AND date >= v_start_date
        AND date < v_end_date
    ),
    os_finalizadas AS (
        -- Quantidade de OS finalizadas no mês
        SELECT COUNT(*) as quantidade
        FROM work_orders
        WHERE organization_id = p_organization_id
        AND status IN ('entregue', 'finalizado')
        AND updated_at >= v_start_date 
        AND updated_at < v_end_date
    ),
    top_vendas AS (
        -- Top 10 Peças e Serviços mais vendidos no mês (baseado em OS finalizadas)
        SELECT 
            i.name as nome,
            i.tipo,
            SUM(i.quantity) as quantidade,
            SUM(i.total_price) as valor_total
        FROM work_orders o
        JOIN work_order_items i ON i.work_order_id = o.id
        WHERE o.organization_id = p_organization_id
        AND o.status IN ('entregue', 'finalizado')
        AND o.updated_at >= v_start_date 
        AND o.updated_at < v_end_date
        AND NOT COALESCE(i.peca_cliente, false)
        GROUP BY i.name, i.tipo
        ORDER BY valor_total DESC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'faturamento', (SELECT jsonb_build_object('total_pecas', total_pecas, 'total_servicos', total_servicos) FROM pecas_servicos),
        'pagamentos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('metodo', metodo, 'total', total)), '[]'::jsonb) FROM meios_pagamento),
        'despesas_categoria', (SELECT COALESCE(jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total)), '[]'::jsonb) FROM despesas_categoria),
        'pendencias', (SELECT jsonb_build_object('a_pagar', a_pagar, 'a_receber', a_receber) FROM pendencias),
        'os_finalizadas', (SELECT quantidade FROM os_finalizadas),
        'top_vendas', (SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'tipo', tipo, 'quantidade', quantidade, 'valor_total', valor_total)), '[]'::jsonb) FROM top_vendas)
    ) INTO v_result;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
