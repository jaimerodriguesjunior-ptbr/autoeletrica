# Prompt completo — auditoria independente da versão 2 do plano

Você está começando uma sessão nova, sem o contexto da elaboração do plano ou da primeira auditoria. Este pedido contém o contexto necessário; os documentos e o código estão no workspace.

Atue como auditor independente de arquitetura, regras de negócio, integridade de dados, autorização e experiência de uso. Avalie a **versão 2 do plano antes da implementação**, verificando tanto a resposta à primeira auditoria quanto riscos novos ou ainda não resolvidos.

**Workspace:** `G:\projetos\autoeletrica`.

**Documento principal vigente:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.

**Referências históricas:**

- Plano original preservado: `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md`.
- Primeira auditoria: `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- Estudos visuais: `docs/referencias-fluxo-visual/`.

**Nova entrega:** grave seu relatório em `docs/AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`. Preserve o primeiro relatório, os planos e os prompts. Se o destino já existir, crie uma versão numerada em vez de sobrescrever um relatório alheio.

## 1. Natureza da tarefa e limites

Esta é uma revisão de proposta de implementação. As alterações feitas até agora foram documentais. O painel, o status `arquivado`, os novos guardas, as tabelas e as funções propostas **não foram implementados por esta sequência de trabalho**. Confirme o estado atual dos arquivos, pois outra pessoa pode ter feito mudanças depois.

Não implemente funcionalidades nem corrija o sistema. Não edite o plano vigente ou o histórico. A única escrita autorizada por este pedido é o novo relatório de auditoria.

Não aplique migrações, não altere dados/configurações/permissões e não faça deploy. Não execute scripts que escrevam no banco. Não gere novas imagens. Verificações locais devem ser somente de leitura ou isoladas de dados reais.

Não acesse o banco remoto apenas por encontrar credenciais no projeto: esse acesso não está autorizado por este prompt. Se houver autorização explícita adicional na sessão, use somente leitura de esquema e agregados necessários, sem expor credenciais ou dados pessoais. Sem essa autorização, marque grants, RLS, triggers, constraints e dados reais como não verificados no ambiente instalado.

Leia `AGENTS.md`. Antes de examinar código ou arquitetura fiscal, leia `CONTEXTO_NUVEM_LOCAL_FISCAL.md`. O provedor/integrador do projeto é a **Nuvem Local Fiscal**; nomes legados no código não autorizam substituí-lo nem criar outra integração.

O resultado da auditoria não autoriza iniciar implementação. Diferencie:

1. Plano suficientemente definido para desenvolver um bloco em ambiente isolado.
2. Decisões de negócio ainda necessárias.
3. Evidências e testes exigidos para habilitar o bloco com dados reais.
4. Correções que já existam de fato no código ou banco e tenham sido verificadas.

Não registre “a função proposta ainda não existe” como defeito do plano por si só. Avalie se o contrato e o mecanismo descritos são concretos, coerentes e verificáveis. Também não considere uma garantia resolvida apenas porque o plano passou a mencioná-la.

## 2. Contexto do produto e requisitos do usuário

O usuário deseja um painel visual de OS com carros genéricos em 2,5D. A representação mostra o **fluxo de trabalho**, não presença física: uma OS aguardando peça pode aparecer mesmo que o carro esteja com o cliente. Box, vaga, posição real e correspondência visual com fabricante/modelo/pintura não fazem parte do escopo.

O desenho genérico pode ser o mesmo para todos. A cor indica idade da OS, independentemente do status. As cinco filas correspondem a:

- `orcamento`: Orçamento/aguardando aprovação.
- `aprovado`: Aprovado.
- `aguardando_peca`: Aguardando peça.
- `em_servico`: Em serviço.
- `pronto`: Pronto.

Ao selecionar um carro, ele cresce e fica em evidência; os demais perdem foco e os dados principais recebem mais espaço. A experiência deve funcionar em celular e tablet, com navegação dentro das filas e sem engine 3D obrigatória.

Dashboard e Atendimento abrem a mesma tela. No dashboard, o acesso pode ser um card como janela que recorta uma cena maior, com arte pré-renderizada e carros ilustrativos. A imagem estática não é contagem real; o contador dinâmico precisa comunicar seu recorte.

O recorte proposto para os carros é OS com veículo, uma OS por carro. Duas OS da mesma placa não devem ser deduplicadas. Vendas e bancada sem veículo continuam nas listas próprias.

O usuário também quer o status **`arquivado`**, que não aparece nas filas gráficas. O status `recusado` não será criado. Após X dias em orçamento, o sistema sugere arquivar periodicamente, duas ou mais vezes por semana de uso; o lojista decide. Não há arquivamento automático pelo tempo. A negociação pode ter ocorrido pessoalmente, portanto a regra não depende de envio do orçamento ou aprovação pelo portal.

A ideia inclui preservar histórico, permitir desarquivamento e liberar somente estoque efetivamente debitado. A versão 2 propõe tratamento diferente para legado sem prova: arquivar sem devolver essa parcela de estoque. **Essa mudança é recomendação pendente de decisão do usuário**, não um requisito já aprovado.

Também continuam pendentes X, a cadência exata, as faixas de cor, os cargos autorizados e as decisões D01–D17 da seção 22. Não transforme valores propostos, como 30 dias ou intervalo de 3 dias, em regra aprovada.

## 3. Histórico da primeira auditoria

A primeira auditoria considerou o painel de consulta apto com condições e o arquivamento com efeito em estoque dependente de revisão. Não consultou o banco remoto e não implementou correções.

Os achados foram:

| ID original | Problema identificado |
| --- | --- |
| P1-01 | Revisão manual do legado transformava quantidade declarada em crédito, sem movimento que comprovasse a baixa. |
| P1-02 | Escritores antigos gravam `estoque_atual` como valor absoluto; travar somente a nova função não impede sobrescrita de movimentos. |
| P1-03 | Política local de perfil permite atualizar a própria linha sem proteção visível de `cargo`; a nova permissão não pode confiar em cargo autodeclarado. |
| P1-04 | FK por `product_id` não prova a organização do produto; função privilegiada pode creditar produto de outra oficina. |
| P2-01 | `aguardando_peca` é lido e rotulado, mas não foi encontrado comando de tela que grave esse status. |
| P2-02 | Reabertura, aprovação, adiantamento, agendamento, exclusão e vínculo fiscal podem contornar a nova transição se não compartilharem o guarda. |
| P2-03 | A prévia não tinha versão definida; `updated_at` não é atualizado por todos os caminhos locais e não é versão confiável. |
| P2-04 | Busca e contagem precisam ser feitas no servidor antes da paginação, sem filtrar só os carros já carregados. |
| P2-05 | “Agendamento ativo” precisava de estados definidos; configuração em `company_settings` poderia ser alterada por membro sem cargo administrativo. |
| P3-01 | O painel não deve criar uma nova restrição de visibilidade do total da OS se lista e detalhe já o mostram ao mesmo usuário. |
| P3-02 | Estimativa agregada não refletia adequadamente o conjunto espalhado de escritores e guardas. |

A versão 2 responde aos achados na seção 25. Entre as alterações, retira o crédito de legado por declaração, exige recusa de escrita direta de saldo, acrescenta igualdade de organização e versão monotônica, nomeia os caminhos alternativos, cria D17 e separa o esforço do painel do trabalho de estoque.

Não aceite essa resposta como prova independente. Compare o texto novo, o antigo e o código, e dê seu próprio parecer.

O usuário mencionou 69 OS abertas da NHT. Esse número não foi contado nesta sequência de análise. Não presuma que sejam todas orçamentos, veículos presentes ou peças com baixa.

## 4. Método de revisão

1. Leia o plano vigente completo e identifique sua versão/data. Registre essa identificação no relatório; um hash do arquivo também pode ajudar a distinguir a revisão auditada.
2. Faça uma leitura própria do código relevante, procurando também caminhos que o plano não listou.
3. Compare a versão 1 e o primeiro relatório para identificar o que mudou e o que pode continuar insuficiente.
4. Leia as decisões D01–D17 e a resposta aos achados na seção 25 sem assumir que estejam aprovadas ou corretas.
5. Produza conclusões por bloco: painel de consulta, lembretes, arquivamento/desarquivamento com estoque e tratamento do legado.

Para cada afirmação, distinga fato do repositório, proposta futura, hipótese de cenário, decisão do usuário e estado remoto ainda não comprovado. `schema.json`/`schema_types.txt` são fotografias locais; o código e migrações posteriores já podem divergir delas.

## 5. Investigação obrigatória

### A. Painel de consulta e fidelidade ao produto

Confirme cinco filas, significado da cor, idade desde `created_at`, OS que podem estar com o cliente, tratamento de OS sem veículo e duplicidade de placa. Examine a clareza da legenda e se a prévia estática pode parecer uma leitura fiel do estado atual.

Verifique se busca por OS, placa, cliente e modelo textual entra no servidor **antes** do limite/cursor e se contagens usam o mesmo predicado. Uma OS fora dos primeiros 20 precisa ser encontrada. Erro de contagem não pode virar zero.

Verifique D17: há realmente ausência de comando para `aguardando_peca`? A fila pode ser mostrada vazia sem prometer preenchimento automático? Se for proposto novo comando, trate-o como escrita com origens/destinos definidos, não como parte de uma entrega somente de consulta.

Confirme que o total da OS segue o acesso da lista/detalhe, sem ampliar a visibilidade do faturamento agregado do dashboard. Avalie celular, teclado, foco, fechamento da seleção, redução de movimento, número de ativos, paginação e custo de blur.

### B. Afiliação, cargos e fronteira de organização

Confira as políticas locais de `profiles`, os usos de `get_my_organization_id`, `AuthContext`, funções de servidor e clientes administrativos. Examine `cargo`, `organization_id` e `ativo`, não apenas a presença de RLS.

**Questão adicional da versão 2:** se o usuário puder trocar `profiles.organization_id`, obter esse valor no servidor não resolve o isolamento do painel de leitura. Avalie se a condição nova cobre isso de fato e qual evidência de grants/triggers instalados seria necessária antes de usar dados reais.

Confira propriedade de OS, item, produto, cliente, veículo, evento e obrigação relacionada. Analise a igualdade de organização exigida na função e a possibilidade de FKs compostas, sem presumir que relações simples por ID já a garantam.

Não confirme vulnerabilidade em produção apenas pela política local, mas não descarte o risco porque um botão está oculto. Funções privilegiadas precisam conferir a afiliação protegida e o perfil ativo. A política administrativa de X/cadência também precisa de escrita protegida.

### C. Estoque novo, legado e mistura dos dois

Localize todos os escritores: detalhes da OS, quantidade, peça do cliente, cadastro rápido sem baixa, cadastro global/scanner, resolução de catálogo, cancelamento/exclusão, venda de balcão, recibo, importação, entrada, saldo inicial e ajuste manual. Verifique se existe registro confiável instalado no material acessível antes de recomendar estrutura nova.

Avalie o significado de `stock_debited_qty`, histórico imutável, estado `legacy_unknown` e ciclos. Ter `product_id`, `quantity` ou catálogo resolvido não é prova de baixa. Não aceitar atribuição retroativa a partir do saldo atual nem quantidade declarada transformada em movimento antigo.

Julgue a política pendente D06: a proposta de arquivar legado sem movimento de estoque evita o crédito inventado, mas entrega ao usuário uma semântica diferente de liberar todo produto selecionado. Identifique o que precisa de aceitação de negócio e se há contradição com o restante do plano.

Examine especialmente OS que misturam parcelas antigas desconhecidas e débitos novos comprovados. O plano explica suficientemente adicionar, diminuir, remover, alternar peça do cliente, arquivar, desarquivar e arquivar outra vez sem transformar o desconhecido em zero conhecido? Se faltar contrato, descreva a lacuna em vez de presumir uma fórmula.

Não copie literalmente o critério antigo “editar quantidade não muda crédito” para todos os casos. A invariável correta é crédito limitado ao débito comprovado ainda aplicado. Uma alteração comercial sem movimento não prova crédito adicional; uma alteração nova que efetivamente registra delta de estoque modifica o débito e o crédito posterior juntos. Avalie as duas situações e a consistência da versão 2.

### D. Contenção de escritores antigos e mudança de protocolo

Avalie se a proposta impede no banco escritas diretas de `estoque_atual`, inclusive pelas rotas administrativas, ou apenas manda os novos componentes usar outra função.

Se houver indicador interno, verifique a fronteira de privilégio: quem pode defini-lo, quais funções auxiliares o expõem, como o PostgREST chega até ele e se uma configuração de sessão pode ser simulada. Um nome de variável não é autorização. Considere privilégios de tabela/coluna, RLS, execução das funções e triggers em conjunto.

Analise o corte dos clientes antigos: a tela atual pode inserir item/OS antes de falhar na etapa seguinte de estoque. A proteção proposta rejeita a operação sem deixar item, total, venda ou transação parcial? A versão 2 especifica uma troca coordenada plausível ou apenas declara essa garantia?

Proponha o menor mecanismo coerente que possa ser auditado, sem executar a mudança e sem inventar uma reescrita geral desnecessária do sistema.

### E. Concorrência, versão e idempotência

Avalie ordem de bloqueio da OS, filhos e produtos; manutenção da versão monotônica; consistência da prévia; condição de status na escrita; deduplicação e retorno após perda de resposta. `updated_at`, hash só no navegador e chave de operação isolada não substituem esses controles.

Trace estes cenários com estado inicial, interleaving e resultado:

- Duas pessoas arquivam a mesma OS, usando a mesma chave e chaves diferentes.
- Confirmação do servidor seguida de perda de resposta e repetição.
- Alteração de item/debito depois da prévia.
- Aprovação pelo portal ou local concorrendo com arquivamento.
- Venda, entrada e ajuste concorrentes no mesmo produto.
- Adiantamento, agendamento ou vínculo fiscal criado entre a checagem e a transição.
- Falha no último item, saldo negativo prévio e quantidade fracionada.
- Desarquivamento com falta de estoque e vários produtos.
- Produto de outra organização, item legado e OS mista.

Indique as provas mínimas necessárias em banco isolado antes de habilitar a funcionalidade, sem executar testes que escrevam dados reais nesta auditoria.

### F. Estado arquivado e caminhos alternativos

Confira `reopenOS`, aprovação por token, `handleStatusChange`, checkout, adiantamento, `handleSalvarAgendamento`, exclusão no cabeçalho, cancelamento, remoção de peça e emissão direta no backend.

Uma função administrativa existente não pode mover arquivada para `pronto`, apagar comissões ou gravar recebimento antes de validar a origem. Inserção de vínculo também precisa participar do controle da OS. Esconder o controle da tela não prova proteção contra aba antiga ou chamada direta.

Verifique efeitos em lista de abertas, scanner de placa, agenda baseada em `previsao_entrega`, tabela `appointments`, portal, extrato, impressão, histórico e pendências de catálogo. `ja_tem_os` é tipo de agendamento, não status.

Avalie D09/D10 sem presumir aprovação: vínculo financeiro ativo ou incerto, nota cancelada como histórico, comissão, intenção de pagamento versus adiantamento real e compromisso vinculado. Arquivar não deve estornar pagamento, cancelar documento na Nuvem Local Fiscal nem apagar agendamento automaticamente.

### G. Lembretes, migração e limites de escopo

Examine tempo contínuo em orçamento, data antiga aproximada, retorno de status, X não escolhido, múltiplos aparelhos/abas e cadência. Dois avisos semanais não podem ser prometidos para quem não acessa o sistema nas oportunidades correspondentes. Alterar a descrição não reinicia o prazo.

Avalie migração aditiva, versão/eventos, restrições de organização, proteção de afiliação e política, inicialização do legado sem histórico inventado e controle independente de ativação.

Julgue se as etapas distinguem desenvolvimento em ambiente isolado e habilitação em produção. A implantação/reversão precisa manter os guardas e entender as OS já arquivadas sem repetir movimentos.

Revise o esforço e a simplicidade: o painel não depende de refazer estoque; o arquivamento que devolve saldo tem pré-requisitos reais. Separe bloqueio indispensável de manutenção preexistente que pode ficar fora. Não imponha ledger histórico reconstruído, configuração fina de cores, Realtime, engine 3D ou inventário completo da NHT para liberar a consulta.

## 6. Pistas de código para começar, sem limitar sua busca

- `app/(admin)/dashboard/page.tsx`.
- `app/(admin)/atendimento/page.tsx` e `components/atendimento/ServiceOrderList.tsx`.
- `app/(admin)/os/page.tsx`, `app/(admin)/os/nova/page.tsx` e `app/(admin)/os/detalhes/[id]/page.tsx`.
- `app/api/os/create/route.ts` e `src/actions/os.ts`.
- `app/(admin)/atendimento/nova-venda/page.tsx`, `app/(admin)/atendimento/venda-direta/page.tsx` e `app/(admin)/recibo/[id]/page.tsx`.
- `app/(admin)/estoque/[id]/page.tsx`, `app/(admin)/estoque/novo/page.tsx` e `app/(admin)/estoque/importar/page.tsx`.
- `app/api/portal/aprovar/route.ts`, `app/api/portal/os/route.ts`, `app/api/portal/extrato/route.ts` e `app/acompanhar/PortalClient.tsx`.
- `src/contexts/AuthContext.tsx`, `src/lib/billing-guard.ts`, clientes Supabase, `migration_rls_multi_tenant.sql` e `fix_profiles_rls.sql`.
- `migration_appointments.sql`, `migration_add_confirmado_status.sql`, `migration_add_type_ja_tem_os.sql` e demais migrações da raiz.
- `schema.json`, `schema_types.txt` e migrações posteriores, observando as diferenças entre eles.
- Após ler o contexto fiscal: `src/actions/fiscal_emission.ts`, `src/actions/fiscal_db.ts` e `components/os/WorkOrderFiscalCard.tsx`.

O arquivo de migração de `G:\projetos\otica-gestao` mencionado no IDE pertence a outro projeto e está fora desta auditoria.

## 7. Como registrar cada achado

Use prioridade P0 (corrupção/acesso indevido de alto impacto), P1 (bloqueia habilitação segura do bloco), P2 (risco relevante corrigível) ou P3 (refinamento). Justifique o impacto e considere se é risco de proposta ou problema já existente.

Cada achado deve apresentar ID novo, título, natureza, bloco afetado, seção da versão 2, caminho e linha do código, cenário concreto, efeito, confiança e correção mínima recomendada. Cite o trecho mínimo necessário e registre o que depende de leitura do banco instalado.

Não invente quantidade mínima de achados. Não trate toda decisão aberta como bug, nem rebaixe falha de consistência a detalhe visual. Se discordar da primeira auditoria ou da resposta do autor, apresente a razão e a evidência.

## 8. Formato exigido do relatório novo

1. **Identificação e parecer inicial:** versão auditada, método, limitações e avaliação separada dos quatro blocos.
2. **Achados novos ou persistentes, por prioridade:** com o padrão de evidência acima.
3. **Matriz de reavaliação dos onze IDs anteriores:** para cada ID, indique resposta documental suficiente/parcial/insuficiente; decisões ainda abertas; e evidência futura necessária. Não confunda “corrigido no plano” com “corrigido no sistema”.
4. **Revisão da seção 25 da versão 2:** avalie a rastreabilidade e os dois refinamentos de interpretação, sem aceitá-los automaticamente.
5. **D01–D17:** classifique o que é negócio, garantia técnica, proposta dispensável ou desconhecido; indique quais decisões impedem desenvolver um bloco e quais impedem apenas habilitá-lo.
6. **Escopo mínimo e fases:** indique o que pode começar isoladamente, o que precisa de contrato mais concreto e o que está ampliando o trabalho sem necessidade.
7. **Mudanças recomendadas no documento:** por seção, sem editar os planos.
8. **Critérios verificáveis de habilitação e reversão:** evidências de código/banco e provas de concorrência ainda necessárias, separadas dos ajustes de produto.
9. **Parecer final por bloco:** “apto”, “apto com condições” ou “requer revisão” para o plano de desenvolvimento, com conclusão separada sobre prontidão de habilitação. Uma funcionalidade não implementada não fica pronta para produção por aprovação documental.

Finalize com as decisões que o usuário realmente precisa tomar e com os bloqueios técnicos que exigem trabalho/evidência, sem delegar ao usuário a escolha de detalhes que o código pode resolver. A resposta deve permitir avaliar a versão 2 em uma sessão nova, sem depender do histórico deste chat e sem iniciar implementação.
