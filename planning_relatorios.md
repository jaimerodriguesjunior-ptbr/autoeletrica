# Planejamento: Nova Página de Relatórios e Dashboard

Este documento registra a ideia e o plano para a futura implementação da página de Relatórios Detalhados.

## Objetivos
Criar uma visão analítica e financeira completa, baseada na estrutura de "Fechamento para o Contador", mas com foco em gestão de indicadores (KPIs).

## Métricas Solicitadas
- **Receita Bruta**: Total faturado no período.
- **Origem do Faturamento**: Divisão entre Peças (Produtos) e Serviços.
- **Recebimentos por Meio de Pagamento**: Pix, Cartão, Dinheiro, etc.
- **Valores pagos por Categoria**: Agrupamento de despesas (Operacional, Administrativo, Pessoal, etc).
- **Valores a Pagar/Receber**: Pendências financeiras dentro do mês selecionado.
- **Quantidade de OS**: Total de ordens de serviço finalizadas no mês.
- **Top Vendas**: Ranking das peças e serviços mais vendidos.

## Visualização (UI/UX)
- **Cards de Destaque**: Para os grandes números (Faturamento, Lucro, Pendências).
- **Gráficos Sugeridos**:
  - Donut/Pizza para Peças vs Serviços.
  - Barras para Meios de Pagamento.
  - Donut para Despesas por Categoria.
- **Tabelas de Ranking**: Para os itens mais vendidos.
- **Filtros**: Seletor de Mês e Ano no topo da página.

## Navegação e Acesso
- **Menu Lateral**: Nova opção "Relatórios" na categoria Gestão Corporativa.
- **Financeiro**: Botão de atalho "Relatórios Detalhados" na seção de Ações Rápidas.

## Detalhes Técnicos (Backend)
- Implementação de uma nova RPC no Supabase `get_dashboard_metrics(p_organization_id, p_month, p_year)` para consolidar todos os dados em um único JSON, otimizando o carregamento da página.

---
*Documento gerado em 03/03/2026 para referência futura.*
