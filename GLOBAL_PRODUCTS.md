# Base Global de Produtos

## Ideia

Criar uma tabela compartilhada entre todas as tenants com produtos identificados por EAN/UPC. A base global não tem preço nem estoque — apenas dados de identificação. Cada tenant mantém seu próprio catálogo com preços e quantidades.

## Fluxo 1 — Tenant contribui para o global

Quando uma tenant salva um produto **com EAN preenchido**, o backend tenta inserir na tabela global:

- Se o EAN **não existe** no global → insere (nome, marca, EAN)
- Se o EAN **já existe** → não faz nada

Acontece silenciosamente. O usuário não percebe.

## Fluxo 2 — Mechanic descobre produto na OS

1. Mechanic abre modal "Adicionar Peça" na OS
2. Digita o nome da peça
3. Se **encontrou** no catálogo da tenant → comportamento atual, sem mudança
4. Se **não encontrou** localmente → mostra:
   - Botão "Cadastrar Nova Peça +" (comportamento atual)
   - Separador visual: "Resultados da base global"
   - Lista de produtos da tabela global que batem com a busca

5. Se o mechanic **seleciona um produto global**:
   - Copia os dados (nome, marca, EAN) para o catálogo da tenant com preço e estoque zerados
   - Adiciona à OS normalmente (mesmo comportamento do "Cadastrar Nova Peça +")
   - O gerente completa preço e estoque depois no Estoque e Serviços

## Estrutura de dados

### Tabela nova: `global_products`

| Coluna | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| ean | TEXT | UNIQUE, obrigatório |
| name | TEXT | Nome da peça |
| brand | TEXT | Marca |
| reference_code | TEXT | Código do fabricante |
| created_at | TIMESTAMP | |

Sem `organization_id` — é global.

### Alteração em `products` (tenant)

| Coluna nova | Tipo | Observação |
|---|---|---|
| global_product_id | UUID | FK → global_products.id, nullable |

Permite rastrear a origem do produto sem criar dependência.

## RLS da tabela global

- **SELECT**: aberto a qualquer usuário autenticado
- **INSERT/UPDATE/DELETE**: somente via função RPC no backend (nunca direto)

A função RPC de insert verifica duplicata por EAN antes de gravar.

## O que NÃO muda

- Dropdown da OS no fluxo normal (produto local encontrado) → idêntico ao atual
- Cadastro manual no Estoque e Serviços → idêntico ao atual
- Qualquer tenant que não use EAN → não contribui e não é afetada

## Regras de qualidade

- Só vai para o global se EAN for válido (validação de dígito verificador EAN-13/UPC-A)
- Primeiro a cadastrar "vence" — o nome que fica é o da primeira tenant a gravar
- A tenant importadora pode editar o nome localmente sem afetar o global

## Implementação estimada

1. Migração SQL: tabela `global_products` + coluna `global_product_id` em `products`
2. RPC Supabase: `upsert_global_product(ean, name, brand, reference_code)`
3. Hook no save de produto: chama a RPC se EAN preenchido
4. Modal "Adicionar Peça" na OS: quando busca local retorna vazio, busca no global e exibe seção separada
5. Ação de seleção do produto global: copia para `products` da tenant e adiciona à OS
