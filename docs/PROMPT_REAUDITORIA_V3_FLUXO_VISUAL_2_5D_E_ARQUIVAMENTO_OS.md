# Prompt completo — auditoria independente da versão 3 do plano

Você está em uma sessão nova, sem o histórico da elaboração ou das duas auditorias anteriores. Use o contexto abaixo e os arquivos do workspace para realizar uma revisão independente do plano vigente. Não dependa de nenhuma conversa anterior.

**Workspace:** `G:\projetos\autoeletrica`.

**Plano vigente:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`, cujo cabeçalho deve identificar a versão 3.

**Histórico preservado para comparação:**

- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md`.
- `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V2_AUDITADO.md`.
- `docs/AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- Estudos de aparência em `docs/referencias-fluxo-visual/`; são imagens ilustrativas anteriores, algumas ainda com quatro filas.

**Entrega:** `docs/AUDITORIA_V3_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`, com os achados principais também na resposta final. Se já existir, crie uma versão numerada, preservando o relatório anterior.

## 1. Tarefa e limites

Audite a proposta antes de sua implementação, confrontando o texto com o código e com as evidências das auditorias anteriores. Nenhuma dessas revisões documentais implementou o painel, `arquivado`, ledger ou funções de estoque. Confira o estado atual do repositório antes de assumir que permaneceu assim.

A única escrita autorizada nesta tarefa é o novo relatório. Não altere planos, código, imagens, configurações, permissões ou dados. Não aplique migração, não faça deploy e não execute scripts que escrevam em banco real. Verificações locais devem ser somente de leitura ou isoladas de dados reais.

Não acesse o banco remoto só porque encontrou credenciais. Este prompt não autoriza esse acesso. Se a sessão contiver autorização adicional explícita, limite-a à leitura necessária, com dados agregados e sem exposição de credenciais ou dados pessoais. Caso contrário, registre grants, RLS, triggers, constraints e dados instalados como não verificados remotamente.

Leia `AGENTS.md`. Antes de examinar código/arquitetura fiscal, leia `CONTEXTO_NUVEM_LOCAL_FISCAL.md` e respeite a Nuvem Local Fiscal. Nomes legados não autorizam substituir o provedor.

A auditoria deve distinguir: requisito do usuário; recomendação ainda pendente; fato local; cenário hipotético; estado remoto desconhecido; prontidão para desenvolver isoladamente; e prontidão para habilitar com dados reais. Não considere a ausência de uma função futura como defeito do plano por si só. Também não considere uma garantia resolvida apenas porque ganhou um parágrafo.

## 2. Requisitos e decisões ainda abertas

O usuário quer uma representação de **OS em acompanhamento**, mesmo quando o carro está com o cliente. Não há controle de vaga, box ou presença física.

São cinco filas: `orcamento`, `aprovado`, `aguardando_peca`, `em_servico`, `pronto`. Um carro genérico representa uma OS; a mesma placa pode aparecer em duas OS. O recorte inicial é de OS com veículo, sem desenhar vendas ou bancada sem veículo.

Os carros são iguais em forma e podem usar ativos pré-renderizados em 2,5D. A cor indica idade da OS desde `created_at`, e não status ou pintura real. Selecionar amplia o carro, atenua/desfoca os demais e dá espaço aos dados. A experiência deve funcionar em celular/tablet, com filas navegáveis, teclado e redução de movimento.

Dashboard e Atendimento abrem a mesma tela. O dashboard terá um card que recorta uma cena maior, com carros ilustrativos estáticos e contador real separado, sem confundir a imagem com dados atuais.

O novo status `arquivado` não terá representação gráfica. Não criar `recusado`. O lojista decide arquivar; o sistema sugere após X dias em orçamento e reapresenta a revisão periodicamente. Não depender de mensagem enviada ou portal, pois a negociação pode ser pessoal. Não haverá arquivamento silencioso por tempo. Histórico e desarquivamento fazem parte da ideia.

O usuário deseja liberar estoque efetivamente baixado, mas a investigação encontrou ausência de prova em itens antigos. As políticas revisadas de não devolver legado, de não aumentar a mesma linha antiga e de mudar remoção/cancelamento **ainda são propostas sem aceite**. Audite-as como propostas, não como ordens do usuário.

Continuam abertas as decisões D01–D18 da seção 22. X de 30 dias, intervalo de 3 dias, faixas de cores e grupo `owner/admin/gerente` não são aprovações implícitas. D01 agora separa o prazo de sugerir da possível proibição da ação antes do prazo. D06 trata arquivar legado sem crédito; D18 trata as outras mutações do legado.

Os 69 registros da NHT foram informados pelo usuário. Nenhuma das duas auditorias os contou; não presuma quantidade por status, presença física ou estoque debitado.

## 3. Histórico das duas auditorias

A primeira auditoria apontou: crédito de estoque por declaração de passado sem prova; escritores absolutos concorrentes; cargo/afiliação potencialmente alteráveis pelo próprio perfil; produto sem garantia de organização na FK; fila de peça sem comando de gravação; caminhos alternativos de reabertura/vínculos; prévia sem versão confiável; busca/paginação; configuração/agenda; permissão de total da OS e esforço agregado insuficientemente dimensionado.

A versão 2 respondeu documentalmente, sem corrigir o software. A segunda auditoria manteve painel e lembretes aptos com condições para desenvolver isoladamente e considerou estoque/legado ainda dependentes de revisão. O arquivo V2 auditado tem SHA-256 `0063572E6B20B48EE32BD80DA75FCF9A030DF4FED2F2569336B2FDA729C080FB`.

Os novos achados da segunda auditoria foram:

| ID | Lacuna |
| --- | --- |
| P1-V2-01 | A mesma linha poderia misturar origem legada desconhecida e débito novo sem fórmula para editar, remover, alternar peça do cliente, cancelar e repetir ciclos. |
| P2-V2-01 | A lista fiscal não nomeava `pending`, já usado pelo código como nota ativa, nem tornava inequívoca a cobertura de todos os tipos. |
| P2-V2-02 | A recusa de saldo podia ser implementada só em `UPDATE`, deixando `INSERT`/`UPSERT` criar estoque fora do protocolo. |
| P2-V2-03 | Busca por ID inteiro/placa crua poderia não encontrar o identificador abreviado e a placa normalizada já usados na lista. |
| P3-V2-01 | O efeito era idempotente, mas a repetição após perda da resposta não tinha resultado de retorno definido. |

Também foi identificado outro escritor de `appointments.work_order_id`, na tela da agenda, e o consumidor de cargo `app/api/admin/users/route.ts`. A segunda auditoria não verificou o banco remoto nem executou testes de concorrência.

## 4. O que a versão 3 propõe — verifique sem aceitar automaticamente

### 4.1. Ciclo do item com redução de estados

As seções 11.6/11.7 propõem evitar mistura **na mesma linha**, em vez de modelar componentes antigos e novos dentro dela. Uma OS pode misturar linhas de origens diferentes, inclusive do mesmo produto.

- Linha nova `known`: débito `D` numérico, com modo `managed` ou `no_debit` registrado na origem.
- Linha antiga `legacy_unknown`: `D = NULL`, nunca convertido por edição comum em zero conhecido ou baixa comprovada.
- Novo `managed` com peça da loja: débito corresponde à quantidade comercial Q; mudanças registram o delta na mesma transação.
- Novo `no_debit`, serviço ou peça atualmente do cliente: débito zero conhecido, preservando o modo de origem para alternância posterior.
- Aumento da quantidade antiga em lugar é rejeitado. A orientação é incluir a quantidade adicional como novo item `known`, com outro ID e intenção de estoque explícita. Não fundir linhas por produto.
- Reduzir, remover, cancelar ou alternar peça do cliente de uma linha antiga não movimenta saldo; o orçamento e o histórico comercial mudam. Isso exige D18 e difere do comportamento atual que soma `quantity`.
- Arquivar libera apenas débitos conhecidos e salva C por linha/ciclo; desconhecidos permanecem `NULL` sem movimento, somente se D06 for aceita.
- Desarquivar repõe exatamente C, não a quantidade comercial recalculada. Novo arquivamento usa o débito então aplicado, sem repetir a liberação anterior.
- Remoção preserva eventos/snapshots; não há cascata que apague a origem do movimento. A proposta de D16 bloqueia exclusão permanente de OS com histórico/movimentos, além das arquivadas.

Essa solução é proposta do autor, não recomendação aprovada pela segunda auditoria. Verifique se resolve a lacuna ou a desloca, se simplifica o bastante e se impõe restrições de uso desproporcionais. Se preferir componentes na mesma linha, apresente o contrato completo necessário, sem apenas pedir “preservar o desconhecido”.

### 4.2. Demais respostas da versão 3

A seção 11.3 cobre `INSERT`, `UPDATE` e `UPSERT`, inclusive produto com saldo inicial zero. Propõe executor dedicado `NOLOGIN`, funções definidoras validadoras e trigger em contexto de invocador, conferindo o `current_user` efetivo da operação. Não aceita GUC/booleano livre como autorização e exige prova de que papéis expostos/administrativos não assumam o executor ou desabilitem o guarda. O corte de front/endpoints e bloqueios é coordenado.

A seção 12 inclui `pending`, todos os tipos e ambientes fiscais vinculados, e estados incertos bloqueados. O predicado antigo de duplicidade não é usado como regra pronta. Arquivar não chama cancelamento na Nuvem Local Fiscal.

A seção 8.1 define busca literal por trecho do ID, cliente/modelo e placa normalizada antes do cursor. Impede que termo de placa normalizada vazio encontre todas as OS, e trata `%`/`_` como literais.

A seção 11.4.1 define replay da mesma chave/conteúdo como retorno do sucesso confirmado. Conteúdo diferente conflita; chave nova depois do sucesso conflita com estado. O reconhecimento do replay vem antes da condição de origem da operação nova. Uma repetição antiga depois de desarquivar não executa outra transição; a interface busca estado atual depois do retorno.

A seção 26 registra a resposta aos achados. Esta tabela é objeto de auditoria, não prova de correção.

## 5. Investigações obrigatórias

1. **Contrato das linhas:** percorra criar, preço, aumentar/diminuir quantidade, remover, trocar produto, resolver catálogo, alternar peça do cliente e voltar, cancelar, arquivar/desarquivar e repetir. Verifique `known` com débito positivo, zero conhecido, `legacy_unknown` com `NULL`, modo `no_debit` e OS com linhas distintas do mesmo produto. Confira preservação de histórico e compatibilidade com os cálculos de total. Não aceite `COALESCE(D, Q)` ou uma conversão de origem implícita.
2. **Efeito comercial das restrições:** identifique precisamente o que D06/D16/D18 mudam. A ausência de aceite é decisão pendente, não garantia técnica resolvida. Não reduza a avaliação a “o usuário decide” se o contrato ainda tiver ambiguidade de saldo.
3. **Mecanismo de privilégio:** examine grants de tabela/coluna, RLS, papéis, função definidora e trigger invocador como conjunto. Confira se `current_user` realmente distingue a função autorizada de chamada direta e se auxiliares/membership permitem contorno. `BYPASSRLS` não desliga trigger. Estado remoto não foi confirmado.
4. **Todas as escritas:** produtos novos/importados e saldo inicial passam pelo mesmo protocolo. Clientes antigos devem falhar antes de deixar produto/OS/item/total/transação parcial, não só na última chamada. Avalie a viabilidade da troca coordenada, sem pedir uma reescrita geral por conveniência.
5. **Concorrência:** duas sessões com mesma/diferente chave; resposta perdida; edição após prévia; venda/entrada/ajuste do mesmo produto; aprovação por token/local; adiantamento, agendamento e nota concorrentes. Verifique ordem dos locks, versão monotônica e condição de status na escrita. A falta de implementação é esperada; o desenho precisa explicar a cooperação dos escritores.
6. **Replay:** mesma chave deve devolver o sucesso original sem reaplicar saldo; chave antiga depois de outro ciclo não deve induzir a interface a esconder uma OS atualmente ativa. Autorização continua necessária e a chave não é credencial.
7. **Isolamento e autoridade:** proteção de `profiles.organization_id`, `cargo`, `ativo`, incluindo o consumidor administrativo já existente. Derivar a organização no servidor não resolve perfil adulterável. Produto, item, OS, cliente/veículo e movimentos têm escopo conferido. A consulta de leitura também depende disso antes de dados reais.
8. **Fiscal e vínculos:** `pending` e NF-e entram no guarda, todos os ambientes/tipos; erro/rejeição incerta não são liberação automática. Diferencie intenção de pagamento de adiantamento real. Examine `reopenOS`, checkout, exclusão do cabeçalho e ambos os caminhos de agenda, além de todas as inserções vinculadas no banco.
9. **Painel:** cinco filas, uma OS por carro, `pronto` incluído, sem veículo fora, status desconhecido preservado na lista, fila de peça honestamente vazia se não houver registro. Busca por quatro caracteres exibidos e placa com hífen deve achar uma OS após a primeira página; contagem usa mesmo filtro e erro não vira zero.
10. **Lembretes:** separar prazo de sugerir e possível prazo da ação manual, status contínuo versus idade visual, estimativa antiga identificada, política protegida e cadência entre aparelhos/abas sem prometer aviso com aplicativo fechado.
11. **Migração/reversão:** não inventar débitos por migração, não apagar movimentos por cascata, não reativar quantidade antiga por suposição. Reversão mantém guardas e leitura do status novo. Publicar consulta não exige habilitar os escritores.
12. **Proporção:** separar painel simples de pré-requisitos reais do estoque. Identificar manutenção anterior que possa ficar fora, complexidade sem justificativa e provas mínimas para cada fase. Não exigir ledger histórico reconstruído ou inventário da NHT para desenhar o painel.

## 6. Fontes locais para iniciar a revisão

Não limite a busca a esta lista:

- `package.json`, `schema.json`, `schema_types.txt` e migrações SQL da raiz.
- `app/(admin)/dashboard/page.tsx`, `app/(admin)/atendimento/page.tsx`, `components/atendimento/ServiceOrderList.tsx`.
- `app/(admin)/os/page.tsx`, `app/(admin)/os/detalhes/[id]/page.tsx`, `app/api/os/create/route.ts`, `src/actions/os.ts`.
- `app/(admin)/atendimento/nova-venda/page.tsx`, `app/(admin)/recibo/[id]/page.tsx`, `app/(admin)/estoque/novo/page.tsx`, `app/(admin)/estoque/[id]/page.tsx`, `app/(admin)/estoque/importar/page.tsx`.
- `app/(admin)/agendamentos/page.tsx`, `app/api/portal/aprovar/route.ts`, `app/api/portal/os/route.ts`, `app/api/portal/extrato/route.ts`, `app/acompanhar/PortalClient.tsx`.
- `migration_rls_multi_tenant.sql`, `fix_profiles_rls.sql`, `src/contexts/AuthContext.tsx`, `app/api/admin/users/route.ts`, `src/lib/billing-guard.ts` e clientes Supabase.
- Após a leitura fiscal obrigatória: `src/lib/work-order-fiscal.ts`, `src/actions/fiscal_emission.ts`, `src/actions/fiscal_db.ts`, `components/os/WorkOrderFiscalCard.tsx`, `migration_prevent_duplicate_fiscal_invoice_per_os.sql`.

A migração aberta no IDE em `G:\projetos\otica-gestao` pertence a outro projeto. Está fora do escopo.

## 7. Evidência e formato do relatório

Identifique versão/data/hash do plano efetivamente lido. Registre arquivos consultados, limitações e divergências de esquema. Não confirme produção com base no snapshot local. Não use o primeiro ou segundo relatório como substituto de evidência do código.

Apresente achados por prioridade: P0 para corrupção/acesso indevido de alto impacto; P1 para bloqueio de habilitação segura do bloco; P2 para risco relevante corrigível; P3 para refinamento. Não invente uma quantidade mínima de achados.

Cada achado precisa de ID, natureza (fato atual, lacuna de proposta, decisão de negócio ou limitação de evidência), bloco, seção/linha do plano, arquivo/linha do código, cenário concreto, efeito, confiança e correção mínima. Se discordar de um auditor ou da resposta do autor, justifique.

O relatório deve conter:

1. Parecer inicial separado de painel, lembretes, estoque e legado, com colunas para desenvolvimento isolado e habilitação com dados reais.
2. Achados novos ou persistentes, antes de refinamentos visuais.
3. Reavaliação individual de P1-V2-01, P2-V2-01, P2-V2-02, P2-V2-03 e P3-V2-01: correção documental suficiente/parcial/insuficiente e prova futura necessária. Revisar também se alguma resposta anterior regrediu.
4. Revisão explícita das seções 11.6/11.7 e 26: o contrato de linhas separadas realmente remove o estado ambíguo ou deixou brechas? O mecanismo de proteção é implementável?
5. D01–D18: o que requer escolha do usuário, o que é requisito técnico e o que impede desenvolver ou apenas habilitar. Não presumir aprovação das restrições novas.
6. Alterações mínimas recomendadas por seção, sem editar o plano. Evitar abrir novas frentes sem relação necessária com o recurso.
7. Provas de integração/concorrência e critérios de implantação/reversão por bloco, a executar futuramente em banco isolado.
8. Parecer final “apto”, “apto com condições” ou “requer revisão” para o plano de desenvolvimento de cada bloco, separado de prontidão de produção. Plano aprovado não significa funcionalidade implementada nem autorização para implementá-la.

Conclua com as decisões que o usuário precisa tomar e os bloqueios técnicos que dependem de evidência/trabalho. Seja específico sobre o que ainda falta; não repita “precisa de mais auditoria” como conclusão genérica.
