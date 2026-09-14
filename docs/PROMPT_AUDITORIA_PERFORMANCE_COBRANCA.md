# Auditoria — plano curto (abertura + paid_until)

Plano vigente: `docs/PLANO_PERFORMANCE_COBRANCA.md`.

Julgue só: SW, auth, dashboard, **migração da data de vencimento**, janela de 3 dias, **cron diário**, pausa das consultas fora da janela.

Fora de escopo: rota de venda, 3x, webhook, emissão fiscal, copiar QR no BD. Não implemente.
