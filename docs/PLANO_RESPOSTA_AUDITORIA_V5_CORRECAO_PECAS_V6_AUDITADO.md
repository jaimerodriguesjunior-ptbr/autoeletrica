# Resposta planejada à auditoria V5: correção de peças da OS

Esta é uma proposta documental, não uma alteração da correção auditada. O relatório [V5](AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md) examinou a tela, `migration_os_part_stock.sql` e o teste local; confirmou 15 cenários e TypeScript, sem banco remoto ou teste entre duas sessões. A auditoria não autorizou implementar, aplicar migração ou publicar. Preservar os hashes do relatório ao avaliar o código efetivamente lido.

## P2-B-01: inclusão repetida após resposta perdida

Implementar idempotência por **tentativa de inclusão**: gerar uma chave única antes da chamada e persistir o resultado da operação junto à inclusão, baixa e total na mesma transação. Serializar requisições concorrentes com a mesma chave. Repetição com mesma organização, ator, OS e conteúdo canônico devolve o mesmo item e resultado, sem inserir/debitar outra vez. Mesma chave com conteúdo diferente rejeita sem efeitos. Duas ações intencionais distintas recebem chaves distintas e podem incluir o mesmo produto.

A chave deve sobreviver à resposta incerta e ao recarregamento enquanto a tentativa não tiver sido resolvida; não usar apenas `useRef`. Antes de repetir, consultar/reconciliar o resultado por chave sob a mesma autenticação e escopo. Se a situação continuar desconhecida, informar que está sendo conferida, sem disparar silenciosamente uma nova inclusão. Definir prazo e persistência adequados sem guardar dados sensíveis no navegador. A chave não é autorização nem pode revelar a OS de outra organização. Repetição após status posterior retorna o resultado histórico com consulta do estado atual, sem efetuar nova transição.

Teste essencial: confirmar no banco, simular perda da resposta, repetir a mesma chave e provar uma linha/um débito; conteúdo diferente rejeitado; duas chaves intencionais geram duas linhas; chamadas simultâneas com a mesma chave resultam numa única inclusão. A edição existente usa snapshot e recusa estado antigo; não alegar que isso fornece replay idempotente de sucesso.

## P2-B-02: cadastro separado da inclusão

Proteger a ação inteira de cadastro contra cliques repetidos antes do primeiro `INSERT`. Se o cadastro foi confirmado e a inclusão falhou comprovadamente, informar: “Produto cadastrado; a peça não foi adicionada à OS” e oferecer selecionar o produto criado. Em resposta incerta, primeiro resolver a chave da tentativa antes de afirmar que falhou ou propor nova inclusão. Não criar outro produto automaticamente. Preservar a política existente de saldo negativo, inclusive ao incluir um novo produto cadastrado com saldo zero.

A transação única que também cadastra produto é alternativa, não requisito presumido. Testar sucesso de cadastro seguido de erro confirmado, resposta perdida da inclusão e segundo clique durante cadastro. A orientação deve refletir o estado comprovado, inclusive se a consulta de reconciliação falhar.

## P2-B-03: escritores concorrentes de saldo

O `FOR UPDATE` e o rollback das funções existentes protegem suas próprias operações; uma escrita absoluta antiga pode sobrescrever o resultado posteriormente. Não afirmar consistência global. Tratar a mesma decisão e as mesmas provas da seção 11.3 do [plano V6](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md), sem presumir aceite do risco nem impor ledger/inventário. As alterações do arquivamento devem proteger a OS contra caminhos que creditam e depois mudam status.

## P3-B-01: status legados

A tela atualmente oferece edição em estados além dos cinco aceitos pela função local. Antes de publicar, verificar compatibilidade com o esquema e estados efetivos do destino, sem investigar saldos antigos. A interface deve explicar de forma consistente qualquer estado bloqueado; ampliar a lista apenas para estados cujo tratamento for validado. Uma eventual verificação remota é atividade posterior, não executada por este plano.

## Entrega e validação futuras

Implementar e testar localmente antes de propor publicação. Adicionar testes significativos de idempotência, falha intermediária, peça sem `product_id`, status nulo e concorrência de duas sessões onde disponível. Testar também permissões, sem substituir RLS real por resultado de simulação. Migração e cliente precisam de ordem de implantação compatível e estratégia para abas antigas. Não modificar a migração auditada como se já estivesse aplicada: verificar seu estado real antes de escolher entre ajustar o arquivo preparado ou adicionar migração sequencial. Nenhuma consulta ou aplicação remota foi feita nesta revisão.
