# Correção da baixa de peças na OS

Data: 09/11/2026. Implementação local; banco remoto não consultado nem alterado.

## Comportamento

**Regra confirmada pelo usuário em 09/11/2026:** a quantidade de peças comprometidas com a OS acompanha a quantidade editada na própria linha. No exemplo do relê, passar de 1 para 2 compromete mais uma unidade; passar de 2 para 1 libera uma unidade. Essa regra vale nos dois sentidos e não exige criar outra linha para o acréscimo. No modelo atual, o efeito é feito no saldo disponível (`estoque_atual`); não existe uma nova coluna separada de reserva nesta correção.

A tela de detalhes passa a usar operações de banco para incluir peças e salvar o editor de quantidade/preço. Item, estoque e total da OS são confirmados juntos. Uma falha em qualquer escrita desfaz a operação.

| Ação | Efeito no estoque da loja |
| --- | --- |
| Adicionar peça existente à OS | Debitar a quantidade incluída. |
| Cadastrar peça pelo botão “Cadastrar e adicionar à OS” | Criar o cadastro como antes; a inclusão subsequente na OS também debita estoque. Foi removido o desvio `baixarEstoque = false`. |
| Editar quantidade de 1 para 2 | Debitar mais 1. |
| Editar quantidade de 3 para 1 | Creditar a diferença de 2. |
| Alterar apenas o preço | Nenhum movimento de estoque. |
| Editar serviço ou peça marcada como do cliente | Nenhum movimento de estoque da loja. |

Quantidades fracionadas são preservadas. A política existente que permite saldo negativo foi mantida: cadastrar uma peça com saldo zero e adicioná-la normalmente leva o saldo a -1. Bloquear estoque negativo exige outra decisão, especialmente para oficinas que não controlam saldo.

As funções usam a sessão autenticada e as permissões/RLS do próprio usuário (`SECURITY INVOKER`), validam perfil ativo e a igualdade de organização entre OS, item e produto. Apenas os cinco status operacionais aceitam a operação. O editor envia a quantidade, preço e identidade lidos ao abrir; se esses dados mudaram, a escrita é rejeitada sem movimentar estoque. O usuário deve fechar o editor, atualizar a OS e abrir novamente.

## Limites e legado

Esta é uma correção pontual dos lançamentos futuros. Não implementa ledger, arquivamento, reserva separada, reconstrução histórica ou ajuste em massa de saldo.

O delta do editor é calculado a partir da quantidade comercial atualmente registrada no item. Isso não comprova que a quantidade anterior tenha sido debitada corretamente. Os testes de devolução usam linhas incluídas pela função nova, cuja baixa ocorreu na mesma transação. A regra de edição nos dois sentidos foi confirmada; ela não recompõe automaticamente todas as baixas passadas.

**Decisão posterior de escopo:** o usuário retirou o levantamento e a correção geral de estoque desta entrega e definiu que arquivar uma OS antiga devolve a quantidade atual das peças da loja vinculadas. O [plano versão 5](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md) registra essa política. Não usar a falta de histórico de baixa como requisito para exigir inventário prévio ou para impor linhas separadas. Os saldos anteriores permanecem sem reconciliação geral; o arquivamento terá seu próprio controle de transação e de repetição.

Os caminhos existentes de remoção/cancelamento, alternância de peça do cliente, venda de balcão, importação e ajuste manual de saldo não foram migrados nesta correção. Eles ainda podem escrever saldo absoluto e concorrer com estas operações. Portanto, esta mudança não oferece garantia global de consistência de estoque para todos os fluxos ou clientes antigos. A correção completa desse conjunto continua no estudo e no plano próprios.

A criação do cadastro de produto continua sendo uma operação separada da inclusão na OS. Se a inclusão falhar, o cadastro pode existir sem item na OS; a operação que falhou não deixa baixa parcial.

## Arquivos e publicação

- [Tela de detalhes](../app/(admin)/os/detalhes/[id]/page.tsx).
- [Migração](../migration_os_part_stock.sql): duas funções novas, sem atualização retroativa de linhas ou saldos.
- [Teste isolado](../scripts/test_os_part_stock.cjs).

Antes de publicar a tela, conferir o esquema e as permissões efetivamente instalados e aplicar a migração no ambiente de destino. A tela não tem fallback para as escritas antigas caso a função esteja ausente ou falhe. Publicar apenas a tela, sem a migração, impede essas inclusões e edições; nenhum sucesso é exibido como se a baixa tivesse ocorrido.

Nenhum comando de aplicação remota ou publicação foi executado nesta etapa. O cadastro já usa `marca` e `catalog_status`; a fotografia antiga `schema.json` não contém todos esses campos. A compatibilidade remota precisa ser conferida antes da aplicação.

## Validação local

Os testes usam PostgreSQL isolado em memória via PGlite, sem credenciais ou dados reais:

```powershell
npm install --prefix .tmp/os-stock-validation --no-audit --no-fund @electric-sql/pglite@0.5.11
node scripts/test_os_part_stock.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false
```

Foram aprovados 15 cenários, incluindo quantidades fracionadas, baixa a partir de zero, rejeição de outra organização, status fechados, números inválidos, perfil inativo, conflitos do editor, ausência de movimento em serviço/peça do cliente/preço e reversão de todas as escritas após falha de estoque ou total. Também foi verificada a ausência de permissão de execução para `anon` e `service_role`.

Isso valida o contrato na estrutura isolada dos testes, sem provar o esquema remoto, os saldos anteriores, a concorrência real entre conexões ou o uso visual em navegador. O comando ESLint existente ignorou o arquivo TSX com a configuração atual; não foi considerado uma validação de lint aprovada.
