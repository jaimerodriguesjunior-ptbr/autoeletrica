# Validação PostgreSQL fiscal — 23/10/2026

## Resultado

Os 12 cenários passaram em PostgreSQL real, com conexões independentes.
A migração instalada também foi conferida no banco do aplicativo, exclusivamente
por consultas de catálogo no endpoint Supabase de somente leitura.
Nenhuma nota fiscal foi consultada, emitida, reenviada, cancelada ou alterada.

## Ambiente descartável

- Imagem oficial `postgres:17-alpine`, versão efetivamente executada **17.10**.
- Contêiner criado sem rede externa, sem portas publicadas e sem volumes.
- Dados exclusivamente sintéticos, em tabela com as colunas utilizadas pelo trigger.
- Migração executada integralmente a partir do arquivo local.
- Papel `fiscal_app_test`, sem superusuário e com `NOBYPASSRLS`.
- Políticas SELECT/INSERT/UPDATE/DELETE com a mesma condição por organização do
  banco instalado. A identidade da organização foi simulada por variável de sessão.
- Contêiner e seu banco removidos ao final com sucesso.

## Cenários aprovados

1. Instalação da migração, trigger habilitado e papel sem bypass de RLS.
2. NFC-e/NF-e impedem outra venda nos status `draft`, `pending`, `processing` e `authorized`.
3. Concorrência: NFC-e primeiro; NF-e aguarda e é recusada após o commit.
4. Concorrência inversa: NF-e primeiro; NFC-e aguarda e é recusada após o commit.
5. Concorrência com rollback: a segunda conexão consegue inserir.
6. Concorrência entre duas NFS-e da mesma OS: apenas uma persiste.
7. Cancelamento, erro e rejeição permitem nova tentativa.
8. Reativação de tentativa inativa ou mudança de OS/ambiente passa pelo bloqueio.
9. Separação entre organizações e ambientes; NFS-e pode coexistir com venda de produtos;
   inserção em organização alheia é recusada por RLS.
10. Remessas, retornos, transferência, bonificação e devolução não consomem a venda.
11. Duplicidades legadas continuam sincronizáveis; uma nova venda fica bloqueada.
12. Classificação SQL comparada ao TypeScript em 27 combinações de tipo/payload,
    incluindo nulo, vazio, natureza especial, finalidade especial, string JSON e string inválida.

Nos casos concorrentes, uma terceira conexão observou efetivamente a segunda
sessão em `wait_event_type = Lock`, `wait_event = advisory` antes da liberação da
primeira transação. Após commit, a segunda recebeu SQLSTATE `23505`; após rollback,
ela inseriu normalmente. Em cada caso ficou apenas um documento persistido.
Os testes usaram explicitamente `READ COMMITTED`.

## Catálogo do banco instalado

- PostgreSQL **17.6**.
- Os corpos das funções `fiscal_is_product_sale` e
  `prevent_duplicate_active_fiscal_invoice_per_os` correspondem ao arquivo local,
  desconsiderando comentários e espaços.
- Classificador `IMMUTABLE`; função do trigger `VOLATILE`, `SECURITY INVOKER`.
- Trigger habilitado e ligado às colunas esperadas de `public.fiscal_invoices`.
- Índice `idx_fiscal_active_product_sale_os` presente com as colunas e status esperados.
- `default_transaction_isolation = read committed`, com origem `default`.
- Nenhuma configuração específica de isolamento encontrada para os papéis
  `authenticated`, `anon` e `authenticator`, nem nos ajustes globais/da base consultados.
- RLS habilitado. Os três papéis acima não têm `BYPASSRLS` nem superusuário.
- As políticas de notas usam `organization_id = get_my_organization_id()`.
- A função instalada de organização consulta `profiles` pelo `auth.uid()`.

## Limites da validação

- Os testes de escrita foram feitos apenas no PostgreSQL descartável.
- O PostgreSQL de teste é da mesma versão principal do instalado, com patch diferente.
- A tabela sintética não reproduz todos os índices, FKs e demais constraints do Supabase.
- O teste RLS reproduz a condição por organização, mas não executa autenticação JWT
  nem requisições HTTP reais via PostgREST.
- O isolamento foi confirmado como padrão no catálogo e nos papéis inspecionados;
  não foi capturado dentro de uma requisição HTTP autenticada do aplicativo.
- A garantia concorrente foi testada em `READ COMMITTED`, não em outros isolamentos.
- Esta validação não abrange interface no navegador ou emissão real no provedor.

## Evidências e reprodução

- `postgres-tests.json`: resultados dos 12 cenários e versão do contêiner.
- `installed-catalog.json`: metadados instalados, sem credenciais ou dados de notas.
- `node scripts/validate_fiscal_postgres.cjs`: recria e remove o banco descartável via Docker.
- `node scripts/inspect_fiscal_postgres_readonly.cjs`: repete somente a inspeção de catálogo.

Endpoint utilizado na inspeção:
[Supabase Management API — read-only query](https://supabase.com/docs/reference/api/v1-read-only-query).

A pendência de execução prática do trigger foi atendida nos cenários acima.
As alterações do aplicativo não foram publicadas por esta validação.
