# Catálogo de Fornecedores Parceiros

## Ideia

Criar um módulo onde autopeças parceiras (ex: Utida) cadastram seu próprio catálogo com preços no sistema. Oficinas consultam esse catálogo na hora de montar uma OS e já sabem onde comprar, por quanto, antes de vender ao cliente.

## Proposta de valor

### Para a autopeças (Utida)
- Catálogo digital visível para todos os mecânicos da região que usam o sistema
- Controle total sobre preços e disponibilidade
- Preços visíveis apenas para oficinas autenticadas — concorrentes não acessam
- Sem custo inicial — retorno vem em visibilidade e vendas

### Para a oficina
- Consulta preço de custo real antes de fechar a OS
- Sabe onde comprar sem ligar pra vários fornecedores
- Puxa o produto direto pro catálogo da tenant com custo já preenchido

## Fluxo

1. No modal "Adicionar Peça" da OS, além da busca local e base global anônima, aparece uma seção **"Peças disponíveis na [Utida]"**
2. Mecânico vê nome, marca, referência e **preço de custo do fornecedor**
3. Seleciona o produto → entra no catálogo da tenant com custo preenchido e preço de venda zerado
4. Gerente define margem e preço de venda normalmente

## Estrutura de dados

### Tabela nova: `suppliers`

| Coluna | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| name | TEXT | Nome da autopeças |
| city | TEXT | Cidade |
| phone | TEXT | Contato |
| active | BOOLEAN | |
| created_at | TIMESTAMP | |

### Tabela nova: `supplier_products`

| Coluna | Tipo | Observação |
|---|---|---|
| id | UUID | PK |
| supplier_id | UUID | FK → suppliers.id |
| ean | TEXT | Opcional |
| name | TEXT | Nome da peça |
| brand | TEXT | Marca |
| reference_code | TEXT | Código interno do fornecedor |
| cost_price | DECIMAL | Preço de custo para a oficina |
| available | BOOLEAN | Se tem em estoque |
| updated_at | TIMESTAMP | |

### Alteração em `products` (tenant)

| Coluna nova | Tipo | Observação |
|---|---|---|
| supplier_id | UUID | FK → suppliers.id, nullable |

Rastreia de qual fornecedor o produto foi importado.

## Acesso e RLS

- Fornecedor tem login próprio com role `supplier`
- Fornecedor só lê e edita seus próprios produtos (`supplier_products` filtrado por `supplier_id`)
- Oficinas autenticadas fazem SELECT em qualquer `supplier_products` ativo
- Nenhum acesso público — preços protegidos

## Modelo de negócio futuro

- **Fase 1**: Gratuito para o primeiro fornecedor — foco em validar o modelo
- **Fase 2**: Cobrar mensalidade de fornecedores para estar no sistema
- **Fase 3**: Com múltiplos fornecedores, a oficina compara preços de custo entre eles na mesma tela

## Estratégia para convencer o primeiro fornecedor

1. Mostrar quantas oficinas já usam o sistema na cidade/região
2. Pitch: *"Seu catálogo aparece na frente do mecânico no momento exato em que ele está decidindo onde comprar"*
3. Oferecer gratuito com contrato simples de 3 meses para avaliar resultado
4. Mostrar relatório de quantas vezes o catálogo deles foi consultado (métrica de valor)

## Relação com a Base Global de Produtos

As duas features coexistem no modal da OS sem conflito:

| Seção no modal | Origem | Preço de custo? |
|---|---|---|
| Busca local | Catálogo da tenant | Sim |
| Base global | Contribuição anônima entre tenants | Não |
| Catálogo Utida | Fornecedor parceiro | Sim |

## Implementação estimada

1. Tabelas `suppliers` e `supplier_products` + migração
2. Login e interface de gestão do fornecedor (tela separada, fora do app da oficina)
3. Seção "Fornecedores" no modal "Adicionar Peça" da OS
4. Ação de importar produto do fornecedor para o catálogo da tenant
5. Relatório de consultas por fornecedor (argumento de venda para a Utida)
