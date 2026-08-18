# Auditoria — catálogo local, marcas e itens avulsos

## Objetivo

## Status do banco

A migration `migration_product_catalog_guard.sql` foi aplicada no banco e a estrutura foi conferida por consulta somente leitura.

Confirmado em `public.work_order_items`:

- coluna `marca` existente;
- coluna `catalog_status` existente;
- valores aceitos: `resolved`, `pending` e `dismissed`;
- total atual: `1952` itens `resolved`, `0` `pending` e `0` `dismissed`.

Isso confirma que a base esta preparada para registrar itens avulsos como pendentes e apresenta-los para regularizacao no catalogo oficial. A verificacao nao alterou dados.

O registro abaixo que menciona a migration como "necessaria" e historico: neste momento ela ja foi executada e conferida no banco.

## Atualizacao tecnica

- A funcao SQL de normalizacao foi consolidada em uma unica declaracao, usando `unaccent` e removendo pontuacao.
- A validacao do cadastro de produtos agora usa a mesma regra de normalizacao do banco.
- O status de itens oficiais na OS foi simplificado para `resolved`.
- O item avulso continua sem marca por decisao de usabilidade; a marca pode ser preenchida durante a regularizacao administrativa.
- As contagens do banco registradas acima foram obtidas diretamente no Supabase por consulta somente leitura.
- A lista de pendencias encaminha cada item para a tela normal de Novo Produto por `pendingItemId`.
- A lista de pendencias passou a aparecer diretamente no card de alerta de Estoque e Servicos; nao existe etapa intermediaria de pendencias.
- O nome e a marca do item avulso sao carregados como valores iniciais e podem ser ajustados antes do salvamento.
- Ao salvar, o produto oficial e criado e o item original da OS recebe `product_id`, nome, marca e `catalog_status = 'resolved'`.
- O preco e o total historicos da OS nao sao alterados durante o vinculo.
- Depois da regularizacao, o administrador retorna para Estoque e Servicos; os demais itens continuam visiveis no mesmo card.
- No cadastro normal de produto, os resultados da propria loja agora sao clicaveis e abrem diretamente a edicao do produto existente.
- Os resultados do catalogo global continuam preenchendo o formulario para revisao antes de salvar uma copia na loja.
- O catalogo global recebeu marcas explicitas em 45 registros, incluindo `BATERIA BOSH S6 38AH` com marca `Bosh`.
- A migration `migration_global_products_ncm.sql` adiciona NCM ao catalogo global e classifica apenas correspondencias de alta confianca do catalogo local.

Evitar duplicações reais no cadastro sem impedir o atendimento quando o mecânico não encontrar uma peça ou serviço.

## Alterações implementadas no código

- A seleção de peças na OS passa a carregar e exibir marca e código de referência.
- A busca de peças na OS considera nome, marca, referência e EAN.
- Ao cadastrar um produto, a tela consulta primeiro os produtos da própria loja e mostra nome, marca, referência e preço.
- Produto com o mesmo nome e a mesma marca é bloqueado no cadastro.
- Mesmo nome com marca diferente continua permitido.
- O banco recebeu uma proteção para impedir a mesma combinação normalizada de nome + marca dentro da loja, inclusive em concorrência.
- O cadastro rápido da OS verifica produto/serviço existente antes de inserir outro.
- Quando a peça não é encontrada no modal da OS, aparece uma única ação: `Usar “...” nesta OS`.
- O item avulso é gravado diretamente em `work_order_items`, sem criar produto no estoque.
- Foi adicionada a coluna `marca` em `work_order_items` para preservar a identificação de itens avulsos.
- Itens avulsos passam a usar `catalog_status = 'pending'` e aparecem como pendência administrativa.
- A antiga tela `/estoque/pendencias` foi removida; as pendencias agora aparecem diretamente em Estoque e Servicos.
- O vínculo atualiza a referência fiscal da OS sem substituir o preço histórico do item.
- NCM, preço, estoque e referências de cadastros existentes não são alterados por esse fluxo.

## Migração necessária

Aplicar o arquivo `migration_product_catalog_guard.sql` no banco. A versão atual adiciona `marca`, `catalog_status` e instala a proteção de duplicidade por loja.

## Regra funcional

1. Produto local encontrado: usar o cadastro existente.
2. Produto local não encontrado: permitir item avulso na OS.
3. Item avulso não cria cadastro automático.
4. O cadastro definitivo pode ser feito posteriormente pelo responsável pelo estoque.

## Observação para auditoria

Não foram feitas alterações de dados nesta implementação. A deduplicação realizada anteriormente na Kabroski permanece registrada no backup correspondente.
