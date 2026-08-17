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
- A tela `/estoque/pendencias` permite vincular o item a produto existente ou criar e vincular um novo produto.
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
