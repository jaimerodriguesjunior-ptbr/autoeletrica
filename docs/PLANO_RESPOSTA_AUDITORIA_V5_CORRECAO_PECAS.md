# Resposta planejada à auditoria V5: correção de peças da OS

Esta é uma proposta documental, não uma alteração da correção auditada. O relatório [V5](AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md) examinou a tela, `migration_os_part_stock.sql` e o teste local; confirmou 15 cenários e TypeScript, sem banco remoto ou teste entre duas sessões. A auditoria não autorizou implementar, aplicar migração ou publicar. Preservar os hashes do relatório ao avaliar o código efetivamente lido.

A [auditoria V6](AUDITORIA_V6_FLUXO_VISUAL_E_CORRECAO_PECAS.md) identificou duas lacunas no texto desta proposta. A [versão examinada](PLANO_RESPOSTA_AUDITORIA_V5_CORRECAO_PECAS_V6_AUDITADO.md) foi preservada. Os complementos abaixo respondem a P2-V6-01 e P2-V6-02; continuam sem implementação.

## P2-B-01: inclusão repetida após resposta perdida

Implementar idempotência por **tentativa de inclusão**: gerar uma chave única antes da chamada e persistir o resultado da operação junto à inclusão, baixa e total na mesma transação. Serializar requisições concorrentes com a mesma chave. Repetição com mesma organização, ator, OS e conteúdo canônico devolve o mesmo item e resultado, sem inserir/debitar outra vez. Mesma chave com conteúdo diferente rejeita sem efeitos. Duas ações intencionais distintas recebem chaves distintas e podem incluir o mesmo produto.

A chave deve sobreviver à resposta incerta e ao recarregamento enquanto a tentativa não tiver sido resolvida; não usar apenas `useRef`. Antes de repetir, consultar/reconciliar o resultado por chave sob a mesma autenticação e escopo. Se a situação continuar desconhecida, informar que está sendo conferida, sem disparar silenciosamente uma nova inclusão. Definir prazo e persistência adequados sem guardar dados sensíveis no navegador. A chave não é autorização nem pode revelar a OS de outra organização. Repetição após status posterior retorna o resultado histórico com consulta do estado atual, sem efetuar nova transição.

**P2-V6-01:** impor unicidade da chave da tentativa no banco por restrição única e serializar a reserva/resultado na mesma transação que cria item, débito e total; uma busca anterior seguida de inserção sem unicidade não atende o contrato. O identificador da tentativa é único globalmente, sem permitir que uma mudança de organização ou ator crie outra linha com a mesma chave. Se já existir com ator, organização, OS ou conteúdo divergentes, rejeitar sem efeito e sem devolver conteúdo ou dados da tentativa alheia. A verificação do contexto autenticado precede qualquer retorno de resultado. Canonicalizar quantidade e preço com valores numéricos estáveis, de modo que diferenças meramente de escala sejam equivalentes.

Retenção não pode transformar uma chave antes usada em operação nova: manter registro ou marcador durável que permita replay ou rejeite aquela chave mesmo depois de expirar a resposta detalhada. O tempo de retenção não autoriza débito novamente. Se a chave local se perder, recarregar os itens e reconciliar o estado da OS antes de gerar uma nova chave; não presumir que a operação anterior falhou apenas porque não há chave no dispositivo. Se não for possível determinar o resultado, orientar a conferência da OS antes de nova ação intencional. Nenhuma dessas medidas garante deduplicação de dois comandos intencionais com chaves diferentes.

Teste essencial: confirmar no banco, simular perda da resposta, repetir a mesma chave e provar uma linha/um débito; conteúdo diferente rejeitado; duas chaves intencionais geram duas linhas; chamadas simultâneas com a mesma chave resultam numa única inclusão. A edição existente usa snapshot e recusa estado antigo; não alegar que isso fornece replay idempotente de sucesso.

Complementar com duas conexões reais simultâneas, divergência de ator, organização e OS sem vazamento de payload, conteúdo/escala numérica, resposta detalhada expirada com marcador preservado e perda da chave local com recarga antes de nova tentativa. Provar rollback de chave e operação em falha anterior ao commit.

## P2-B-02: cadastro separado da inclusão

Proteger a ação inteira de cadastro contra cliques repetidos antes do primeiro `INSERT`. Se o cadastro foi confirmado e a inclusão falhou comprovadamente, informar: “Produto cadastrado; a peça não foi adicionada à OS” e oferecer selecionar o produto criado. Em resposta incerta, primeiro resolver a chave da tentativa antes de afirmar que falhou ou propor nova inclusão. Não criar outro produto automaticamente. Preservar a política existente de saldo negativo, inclusive ao incluir um novo produto cadastrado com saldo zero.

A transação única que também cadastra produto é alternativa, não requisito presumido. Testar sucesso de cadastro seguido de erro confirmado, resposta perdida da inclusão e segundo clique durante cadastro. A orientação deve refletir o estado comprovado, inclusive se a consulta de reconciliação falhar.

**P2-V6-02:** substituir o contrato do helper que captura o próprio erro por um retorno tipado `sucesso`, `falha_confirmada` ou `resultado_incerto`, com informação suficiente para o chamador sem expor dados indevidos. Uma exceção inequívoca de rejeição de servidor pode ser falha confirmada; timeout ou perda de resposta não prova rollback. O chamador não pode emitir mensagem de falha ou sucesso enquanto a reconciliação estiver incerta.

Aplicar trava antes do primeiro `INSERT` e tratamento de cadastro confirmado seguido de inclusão aos caminhos **Cadastrar e adicionar**, **scanner** e **base global**, inclusive seus estados e mensagens. No cadastro rápido, que cadastra mas não adiciona a peça à OS, proteger o clique antes do `INSERT` e informar apenas o cadastro; não prometer inclusão ou baixa. Testar cada caminho, simulando dados de scanner sem rede externa: cadastro confirmado com inclusão rejeitada, resposta perdida, falha da reconciliação e clique simultâneo no `INSERT`. Não gerar produto novo automaticamente quando o anterior foi confirmado ou seu resultado permanece desconhecido.

## P2-B-03: escritores concorrentes de saldo

O `FOR UPDATE` e o rollback das funções existentes protegem suas próprias operações; uma escrita absoluta antiga pode sobrescrever o resultado posteriormente. Não afirmar consistência global. Em 09/11/2026, o usuário aceitou expressamente essa possibilidade; ver seção 11.3 do [plano vigente](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md). As alterações do arquivamento devem proteger a OS contra caminhos que creditam e depois mudam status; essa proteção permanece distinta da corrida de saldo geral aceita.

## P3-B-01: status legados

A tela atualmente oferece edição em estados além dos cinco aceitos pela função local. Antes de publicar, verificar compatibilidade com o esquema e estados efetivos do destino, sem investigar saldos antigos. A interface deve explicar de forma consistente qualquer estado bloqueado; ampliar a lista apenas para estados cujo tratamento for validado. Uma eventual verificação remota é atividade posterior, não executada por este plano.

## Entrega e validação futuras

Implementar e testar localmente antes de propor publicação. Adicionar testes significativos de idempotência, falha intermediária, peça sem `product_id`, status nulo e concorrência de duas sessões onde disponível. Testar também permissões, sem substituir RLS real por resultado de simulação. Migração e cliente precisam de ordem de implantação compatível e estratégia para abas antigas. Não modificar a migração auditada como se já estivesse aplicada: verificar seu estado real antes de escolher entre ajustar o arquivo preparado ou adicionar migração sequencial. Nenhuma consulta ou aplicação remota foi feita nesta revisão.
