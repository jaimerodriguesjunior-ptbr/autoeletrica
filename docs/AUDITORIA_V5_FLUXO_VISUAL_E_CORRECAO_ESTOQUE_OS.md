# Auditoria independente — plano V5 do fluxo visual e correção de estoque na OS

**Data:** 09/11/2026.  
**Workspace:** `G:\projetos\autoeletrica`.  
**Natureza:** auditoria somente de leitura. Nenhum plano, código, migração, imagem ou dado existente foi alterado. Nada foi publicado, aplicado em banco remoto ou reconciliado.

Este parecer não autoriza implementar o painel, aplicar migrações, alterar dados reais ou publicar.

## 1. Identificação, hashes e limites

### 1.1. Plano lido

Arquivo: `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.

| Campo | Valor |
| --- | --- |
| Versão declarada | 5, data-base 09/11/2026 |
| SHA-256 lido nesta sessão | `6A2FD3D4E884F0509FCDB1CBE5C09F2E8759BE1471C227D5DB868B9D779EC0F7` |
| SHA-256 citado no prompt | o mesmo |
| Conclusão | o arquivo lido é a versão 5 esperada. As conclusões abaixo se referem a este hash. |

Não há relatório de auditoria da versão 4. A cópia `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V4_ANTES_SIMPLIFICACAO_ESTOQUE.md` permanece só como histórico. Os pareceres V1, V2 e V3 foram lidos como contexto e não como prova do código atual.

### 1.2. Correção local auditada em separado

| Arquivo | SHA-256 |
| --- | --- |
| `app/(admin)/os/detalhes/[id]/page.tsx` | `35652740CD02E943AA9B727ED9BBE0AFE3841EE5128C607B194B8D8602813719` |
| `migration_os_part_stock.sql` | `FEFE0D7F0DD87E7F6E5E1487D05069008980DE584A07DA346A0E4367AD3F5A7F` |
| `scripts/test_os_part_stock.cjs` | `F91424E237393673F730FABE58BE53FC5B6813EC64D6BE62592C39DFE229FECD` |
| `docs/CORRECAO_BAIXA_PECAS_OS.md` | `0C80692910F69094EDA47C791478A29AEE99889BBEACBE0F9221EE28BDDC2C65` |

### 1.3. Git local

Branch `main`, último commit `dd52d0c` (`imrpessao de oraçamento`).

- Modificação rastreada: `app/(admin)/os/detalhes/[id]/page.tsx`.
- Não rastreados, entre outros: o plano V5, as cópias V1–V4, as auditorias anteriores, `docs/CORRECAO_BAIXA_PECAS_OS.md`, `migration_os_part_stock.sql` e `scripts/test_os_part_stock.cjs`.

O estado do Git não prova o que está instalado no banco ou no cliente publicado. A migração da correção não foi aplicada a nenhum banco remoto nesta auditoria. Funções `add_work_order_part_with_stock` e `update_work_order_item_with_stock` existem apenas no arquivo local e no PostgreSQL temporário do teste.

### 1.4. O que foi executado

| Comando | Resultado |
| --- | --- |
| `node scripts/test_os_part_stock.cjs` | `PASS 15 scenarios; anon/service_role execution denied.` O PGlite já estava em `.tmp/os-stock-validation`. Nenhum pacote foi instalado. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` | saída vazia, código de saída 0. |

O teste cobre o SQL da migração num esquema sintético de uma conexão. Não cobre navegador, duas sessões simultâneas, RLS instalada, grants remotos nem saldos reais. O `tsc` cobre tipos do projeto, inclusive a tela alterada. Não exercita estoque.

Não houve consulta a banco remoto, contagem de OS, emissão fiscal nem leitura de credenciais. RLS, grants, triggers e constraints instalados permanecem desconhecidos. `schema.json` é fotografia antiga: `work_order_items` ali não tem `marca` nem `catalog_status`, embora a tela e `migration_product_catalog_guard.sql` já usem essas colunas.

### 1.5. Como ler os rótulos

| Rótulo | Significado neste parecer |
| --- | --- |
| Decisão | regra que o plano V5 atribui ao usuário e que o texto não reabre |
| Proposta | item da seção 20 ainda sem aceite |
| Código existente | comportamento lido nos arquivos atuais |
| Migração preparada | `migration_os_part_stock.sql`, só local |
| Teste executado | os 15 cenários PGlite desta sessão |
| Remoto desconhecido | qualquer coisa que exigiria o banco ou o deploy publicados |

O saldo produzido pela regra de devolver a quantidade da OS é o saldo registrado. Ele não fica, por essa regra, comprovado como estoque físico.

## 2. Parecer por bloco

### 2.1. Painel

**Apto para desenvolvimento e ensaio isolado.** Não há implementação: busca em `*.ts`, `*.tsx` e `*.sql` não achou rota `fluxo-visual` nem status `arquivado` no código de aplicação. Habilitar com dados reais espera a consulta da seção 8 do plano, o predicado único e a distinção entre erro, vazio e falta de autorização. Não depende da correção de peças nem de inventário.

O plano representa fluxo de OS, inclusive veículo com o cliente. Não descreve box, vaga ou presença física. São cinco filas, um carro genérico por OS, cor pela idade desde `created_at`, com texto além da cor. Seleção amplia o mesmo carro, atenua os demais e devolve foco por botão e Escape. Celular e tablet estão especificados com rolagem, alvo de toque, contraste e redução de movimento. Imagem, HTML e CSS bastam. As imagens em `docs/referencias-fluxo-visual/` são referência; o plano registra que algumas mostram quatro filas.

O card deve dizer “Prévia ilustrativa”, abrir a mesma rota e mostrar contador real com o mesmo predicado do painel: organização da sessão, `tipo = 'os'`, `vehicle_id` preenchido e um dos cinco status. Tipo nulo não vira `os`. Bancada e venda ficam de fora do desenho.

`aguardando_peca` pode nascer vazia. Nenhum arquivo de aplicação grava esse status. Em `app/(admin)/os/detalhes/[id]/page.tsx`, o cartão “Peças / Insumos” pinta a etapa `aguardando_peca`, e o botão visível, nas linhas 1882–1885, grava `em_servico` a partir de `aprovado` ou de `aguardando_peca`. A fila é leitura do que já existir. A decisão D17 continua proposta e não segura as outras filas.

A lista atual, `components/atendimento/ServiceOrderList.tsx` linhas 75–90 e 151–163, carrega as OS com veículo e filtra no navegador. Não exige `tipo = 'os'`. Um termo cuja placa normalizada fica vazia, como `...` ou espaços, faz `includes("")` e devolve todas as OS. O plano, seção 8, já proíbe esse efeito na tela nova e manda buscar, filtrar e contar no servidor, com o mesmo predicado, antes da paginação. A seção 7 impede o card de mostrar zero quando a contagem falhou. A página das filas ainda não separa, em frase própria, erro, lista vazia e sessão sem autorização. O card e a seção 16 cobrem o contador e os erros de mutação. Isso é folga pequena de especificação, registrada em P3-V5-01, e não muda o desenho do produto.

### 2.2. Lembretes

**A regra de 15 dias e a ação manual anterior estão decididas e separadas da idade visual.** Dá para desenvolver o aviso agregado em ensaio. Cadência, data de OS antiga e persistência entre abas são propostas. Não entram como aceite.

A seção 6 separa dois relógios. A idade do carro nasce em `created_at` e não reinicia ao mudar status ou desarquivar. O lembrete conta 15 dias contínuos desde a entrada mais recente em `orcamento`. Editar descrição, preço ou quantidade não zera esse prazo. `updated_at` não serve de relógio. Desarquivar volta a orçamento e abre outro período. A ação manual nos detalhes independe dos 15 dias.

Propostas ainda abertas, seção 20: a cada 3 dias por usuário e organização; usar `created_at` como estimativa identificada quando a OS antiga não tem instante de entrada. O plano diz para não apresentar essa estimativa como transição histórica. Faixas de cor também seguem proposta.

### 2.3. Plano de arquivamento

**A regra simplificada está coerente com a decisão do usuário e pode ser ensaiada em banco isolado.** Não está codificada. Habilitar com dados reais espera a transação da seção 11.2 e o fechamento dos caminhos que devolvem estoque ou mudam status fora dela (P1-V5-01), mais o ajuste das superfícies que ainda tratariam `arquivado` como pendência (P2-V5-02). Não exige ledger, inventário, prova de baixa nem classificação `known` / `legacy_unknown`.

A seção 11.1 aplica a decisão: serviço não credita; peça do cliente não credita; peça da loja com `product_id` credita a `quantity` atual, uma vez por ciclo, antiga ou nova. Várias linhas do mesmo produto somam antes de um único crédito. Quantidade fracionada permanece numérica. Saldo negativo recebe a soma e não é zerado. Item sem produto é preservado, sem cadastro artificial, e a prévia informa que não há saldo a movimentar. Produto inexistente, de outra organização, ou quantidade inválida rejeita a operação inteira.

Essa orientação sobre item sem vínculo aplica a frase do usuário, “peças da loja vinculadas a produtos”. Não cria crédito. A prévia apenas mostra a ausência de movimento. Não há escolha operacional pendente para o crédito. Bloquear o arquivamento por causa de item sem vínculo seria outra regra, e o plano não a adota.

A seção 11.2 define uma transação: usuário e perfil ativo, repetição pela mesma chave e pelo mesmo conteúdo, trava da OS ainda em `orcamento`, prévia, vínculos que forem adotados, produtos em ordem estável, soma no `estoque_atual`, evento do ciclo e status `arquivado`, com desfazer integral. Chaves diferentes não creditam duas vezes porque a segunda não encontra orçamento. Chave antiga, depois de desarquivar, devolve o resultado histórico e não abre outro ciclo. O replay precisa guardar o snapshot creditado e o resultado confirmado daquele ciclo. Não reconstrói o estoque anterior. A interface consulta o estado corrente para desenhar a fila.

A seção 11.3 aceita, com clareza, que venda, entrada, importação e ajuste manual continuam gravando saldo absoluto. Uma função atômica de arquivamento não protege esses escritores. O crédito pode ser anulado por uma gravação posterior. Ver P2-V5-01. Isso continua depois da simplificação e não reabre a exigência de ledger.

Os caminhos da própria OS que creditam em chamada separada, antes de mudar status, estão no código e não são desfeitos por uma trava só no fim. A seção 13 pede a transação única. O menor tratamento que cumpre a devolução, sem reorganizar o estoque geral, é: em cada operação da OS, travar a linha da OS primeiro, recusar `arquivado` ou exigir o status de origem no próprio `UPDATE`, e aplicar item e saldo na mesma transação. A lista concreta está em P1-V5-01. Portal, checkout e `reopenOS` entram nessa lista mesmo sem movimentar produto, porque sobrescrevem o status.

### 2.4. Desarquivamento

**O contrato do snapshot está definido. A falta de saldo está pendente.** Pode ser ensaiado em banco isolado. Não habilitar com dados reais antes da escolha D08 e da mesma proteção contra repetição e contra `reopenOS`.

A operação é `arquivado -> orcamento`, distinta de `reopenOS`, que grava `pronto`. O débito usa somente as quantidades do evento daquele ciclo. Serviço, peça do cliente e item que não gerou crédito ficam de fora. Novo arquivamento é outro ciclo e pode creditar de novo a quantidade que voltou a ficar na OS. O evento de ciclo é o histórico dessa devolução. Não é um ledger de todos os escritores.

Alternativas para saldo insuficiente, sem escolha desta auditoria:

| Alternativa | Efeito |
| --- | --- |
| Recusar o ciclo inteiro | a OS permanece arquivada; nenhum débito parcial. É a proposta antiga. Afasta a política atual, que permite saldo negativo. |
| Debitar mesmo assim e deixar o saldo negativo | o desarquivamento sempre conclui. Fica alinhado à política que a correção de peças manteve, e ainda assim é escolha, porque o usuário não a estendeu ao desarquivamento. |
| Concluir o status e registrar a quantidade não debitada no evento | a OS volta sem sumir, e o snapshot deixa explícito o que não voltou a ser comprometido. Exige leitura posterior desse resto. |
| Debitar só até zero e deixar o restante pendente | parte a quantidade do ciclo e pede controle extra. É o desenho mais largo. |

### 2.5. Correção de quantidade já codificada

**A regra 1→2, 2→1 e preço sem movimento está implementada nas duas funções e foi exercitada nos 15 cenários.** É correção local, separada do arquivamento. Pode ir a ensaio e, depois da migração no destino, a uso real, com os limites abaixo. Não concilia saldos antigos e não torna o saldo fiel à prateleira.

O que o teste demonstrou, nesta sessão: inclusão debita uma vez e recalcula o total; saldo zero vai a −1; quantidade fracionada permanece; outra organização não grava; status fora da lista é recusado; número inválido não grava; perfil inativo ou sessão vazia não grava; falha de estoque ou de total desfaz item, saldo e total; 1→2 debita só a unidade extra e a repetição com o snapshot velho não debita de novo; redução e fração aplicam a diferença; preço não dispara atualização de estoque; serviço e peça do cliente não alteram estoque; anon e service_role não executam.

O que continua raciocínio estático ou código de tela: duas conexões, timeout depois do commit, cadastro de produto separado, navegador e esquema remoto.

Diferença útil para o arquivamento futuro: as funções já recusam status fora de `orcamento`, `aprovado`, `aguardando_peca`, `em_servico` e `pronto`. `arquivado` cai nessa recusa. Remover, cancelar, excluir, alternar peça do cliente, checkout, aprovação e `reopenOS` ainda não recusam.

## 3. Achados

### P1-V5-01 — Devolver ou mudar a OS fora da transação de arquivamento

- **Bloco:** plano de arquivamento. Código atual; o plano ainda não está implementado.
- **Natureza:** ordem real das chamadas no código. O efeito duplo aparece quando o arquivamento passar a creditar e esses caminhos continuarem como estão.
- **Evidência:** `app/(admin)/os/detalhes/[id]/page.tsx` linhas 762–774 (remove: lê saldo, soma `item.quantity`, depois apaga o item), 809–821 (alternar peça do cliente: grava o flag e depois grava saldo absoluto), 885–904 (cancelar: credita e só então grava `cancelado`), 941–963 (excluir: credita, apaga itens, apaga a OS), 703–710 (status livre por id) e 1003–1005 (checkout grava `entregue` antes das transações). `app/(admin)/recibo/[id]/page.tsx` linhas 115–140 creditam e só depois gravam `cancelado`. `app/api/portal/aprovar/route.ts` linhas 26–41 leem `orcamento` e atualizam por id, sem repetir o status no `UPDATE`, via cliente administrativo. `src/actions/os.ts` linhas 73–93 apagam comissões pendentes e gravam `pronto` sem ler o status, também com cliente administrativo.
- **Cenário:** arquivar credita 2 de um relê e marca `arquivado`. Uma aba antiga remove a linha: lê o saldo já creditado e soma de novo a quantidade. O evento diz que a devolução ocorreu uma vez; o saldo recebeu duas.
- **Efeito:** a seção 13 do plano já exige uma transação e diz que recusar o status depois do crédito não basta. A enumeração não cita checkout, o `UPDATE` do portal, o recibo nem a ordem das comissões em `reopenOS`.
- **Confiança:** alta sobre a ordem do código; o entrelaçamento com o arquivamento é risco futuro, porque a operação de arquivar não existe.
- **Ação mínima:** antes de dados reais, cada caminho acima trava a OS, exige o status de origem no próprio `UPDATE` e, quando mexe em saldo, faz isso na mesma transação. Recusar exclusão ou cancelamento de arquivada é a proposta D16, ainda em aberto; qualquer alternativa precisa impedir o segundo crédito. Isso não é ledger geral.

### P2-V5-01 — Um saldo absoluto posterior apaga a devolução

- **Bloco:** plano de arquivamento.
- **Natureza:** risco de entrelaçamento que o plano aceita na seção 11.3. Não é defeito de redação.
- **Evidência:** gravação absoluta em `app/(admin)/estoque/[id]/page.tsx` linhas 144–160, `app/(admin)/estoque/importar/page.tsx` linhas 531–537, `app/(admin)/atendimento/nova-venda/page.tsx` linhas 388–399, além dos caminhos do P1-V5-01. A exclusão do produto, linhas 174–178 da edição de estoque, espera erro de chave estrangeira quando há item. `schema.json` linhas 5660–5662 mostram `product_id` apontando só para `products.id`, sem a ação `ON DELETE`. O padrão do PostgreSQL impediria apagar o produto enquanto o item existir. O banco instalado não foi lido.
- **Cenário:** a ficha do produto está aberta com saldo 5. O arquivamento soma 2 e o saldo fica 7. Salvar a ficha grava 5. O evento do ciclo continua dizendo que 2 foram devolvidos.
- **Efeito:** a função atômica protege o crédito contra quem participa da mesma trava. Não protege quem grava o valor absoluto depois. A seção 11.3 registra essa limitação e retira o gateway geral do escopo.
- **Confiança:** alta como leitura do plano e do código; a frequência no uso da oficina não foi medida.
- **Ação mínima:** manter a limitação, como o plano faz, se a oficina aceita que um salvamento simultâneo de estoque pode cobrir o número. A única contenção proporcional, se a devolução precisar permanecer diante desses salvamentos, é recusar `UPDATE` absoluto de `estoque_atual` fora das operações de OS e de arquivamento. Isso alcança todas as telas que gravam a coluna. Não reconstrói histórico e não é inventário. Não está decidido e não é pré-requisito da redação atual.

### P2-V5-02 — Extrato e agenda ainda tratam orçamento fora de cancelado/entregue como pendência

- **Bloco:** vínculos. Código atual; ajuste pedido pelo plano e ainda não feito.
- **Natureza:** fato do código. O efeito surge quando existir status `arquivado`.
- **Evidência:** `app/api/portal/extrato/route.ts` linhas 66–74 somam o total de toda OS do cliente com status diferente de `cancelado`. `app/(admin)/dashboard/page.tsx` linhas 122–135 listam previsão de entrega excluindo só `entregue` e `cancelado`. A fila do dashboard, linhas 92–93, não inclui um status desconhecido, então `arquivado` ficaria de fora dessa conta por acaso. A lista de Atendimento não conhece o filtro “Arquivadas”.
- **Cenário:** arquivar um orçamento com valor e previsão. O extrato do cliente continua somando esse valor em serviços, e o dashboard continua mostrando a previsão entre as entregas do dia.
- **Efeito:** a seção 17 pede tirar arquivadas das pendências operacionais e do extrato, preservando a consulta histórica. Os bloqueios de adiantamento, documento e agenda da seção 14 seguem proposta.
- **Confiança:** alta no código atual.
- **Ação mínima:** no mesmo lançamento que gravar `arquivado`, excluir esse status do total operacional do extrato e da lista de previsões. Inserção concorrente de adiantamento ou compromisso só fica contida se a verificação e a mudança de status dividirem a trava da OS. Enquanto D09 e D10 não forem escolhidos, o plano não manda estornar nem cancelar esses vínculos.

### P2-V5-03 — O SQL local não impede o usuário de reescrever o próprio perfil

- **Bloco:** autorização. Anterior ao plano; continua relevante se cargo virar credencial.
- **Natureza:** fato dos scripts locais. Efeito no ambiente instalado é hipótese.
- **Evidência:** `migration_rls_multi_tenant.sql` linhas 16–24 e 120–121; `fix_profiles_rls.sql` linhas 41–42. `profiles_update_own` permite `UPDATE` onde `id = auth.uid()`, sem lista de colunas. `get_my_organization_id()` é `SECURITY DEFINER` e lê `organization_id`. `app/api/admin/users/route.ts` altera cargo e `ativo` de outra pessoa pelo cliente administrativo, restrito ao chamador `owner` e à organização da sessão. Isso é outra porta, também não conferida no remoto.
- **Cenário:** se essa política for a que está instalada, o usuário atualiza `cargo`, `organization_id` ou `ativo` na própria linha e em seguida passa na checagem de perfil das funções novas.
- **Efeito:** o plano, seções 3 e 15, já diz que o SQL local não prova a proteção e que D04 não está aceita. A correção de peças não amplia privilégio: é `SECURITY INVOKER` e só age no que o RLS do usuário deixar. Também não prova que cargo ou afiliação estejam protegidos.
- **Confiança:** alta nos arquivos; nenhuma sobre o banco publicado.
- **Ação mínima:** antes de autorizar arquivamento por cargo, ler as políticas instaladas e restringir colunas ou usar gatilho. A consulta do painel pode seguir o acesso atual às OS. Não dá para declarar o remoto vulnerável nem seguro a partir destes arquivos.

### P3-V5-01 — A busca da lista atual confirma o defeito que a tela nova precisa evitar

- **Bloco:** painel, consulta.
- **Natureza:** fato do código atual. O plano da tela nova já corrige o caso da placa vazia.
- **Evidência:** `components/atendimento/ServiceOrderList.tsx` linhas 51–53 e 151–163. `normalizePlate("...")` produz `""`, e qualquer placa satisfaz `includes("")`. Erro de carga cai em `console.error` e a tela mostra lista vazia, linhas 93–100.
- **Cenário:** pesquisar `...` na lista de Atendimento devolve todas as OS carregadas. Na tela nova, o mesmo termo não pode entrar na cláusula de placa. Falha de permissão não pode aparecer como “nenhuma OS”.
- **Efeito:** quem copiar a lista atual para o painel reabre o defeito. A seção 8 do plano já o proíbe. Falta uma frase para três estados visuais na página das filas.
- **Confiança:** alta.
- **Ação mínima:** na implementação, ignorar a cláusula de placa quando a normalização ficar vazia; usar o mesmo predicado na contagem; mostrar erro, vazio e sessão inválida como resultados diferentes.

### P2-B-01 — A inclusão de peça não é idempotente

- **Bloco:** correção de quantidade.
- **Natureza:** fato do código. O teste mostra duas inclusões intencionais virando dois débitos; não simula resposta perdida.
- **Evidência:** `migration_os_part_stock.sql` linhas 51–63 inserem um item novo a cada chamada. `page.tsx` linhas 1270–1271 seguram o segundo clique só na memória da aba. No erro, linhas 1334–1336 alertam e não chamam `fetchOS`. A edição, linhas 123–130 da migração e 1243–1255 da tela, compara o snapshot e recusa a repetição. O teste, linhas 149–157, cobre essa recusa da edição.
- **Cenário:** a inclusão confirma no banco e a resposta se perde. A tela mostra erro e mantém a lista antiga. O segundo toque insere outra peça e debita de novo. Duas abas também passam, porque cada uma tem o próprio `adicionandoItemRef`.
- **Efeito:** duas linhas e dois débitos para um gesto que o usuário entende como uma tentativa. A trava do navegador não é idempotência.
- **Confiança:** alta no código; o timeout em si não foi executado.
- **Ação mínima:** antes do uso real, recarregar a OS quando a chamada falhar e não disparar outra inclusão em cima da lista antiga. Chave de operação da inclusão, se for adicionada, precisa ser da tentativa, não um bloqueio de “uma peça por OS”.

### P2-B-02 — O cadastro do produto e a baixa na OS são transações diferentes

- **Bloco:** correção de quantidade.
- **Natureza:** fato do código, já descrito em `docs/CORRECAO_BAIXA_PECAS_OS.md`.
- **Evidência:** `page.tsx` linhas 1370–1395 inserem o produto com `estoque_atual: 0` e depois chamam `handleAdicionarItem`. Essa função, linhas 1334–1336, captura o próprio erro e não o relança. O mesmo desenho está no código de barras, linhas 1541–1569, e na base global, linhas 1455–1478. O cadastro rápido, linhas 1608–1658, cria o produto com saldo zero e não coloca o item na OS; a baixa só ocorre se alguém selecionar o produto depois.
- **Cenário:** o produto novo é gravado e a função de inclusão falha, ou ainda não existe no remoto. A mensagem é “Erro ao adicionar item”. O cadastro permanece com saldo zero, sem peça na OS e sem baixa. Um segundo toque em “Cadastrar e adicionar” pode criar outro produto antes de a trava da inclusão ser ligada, porque o `ref` só é marcado dentro de `handleAdicionarItem`.
- **Efeito:** não há baixa parcial. A oficina fica com um cadastro zerado e pode não perceber que a OS não recebeu a peça. Selecionar esse cadastro em seguida debita e leva o saldo a −1, que é a política mantida.
- **Confiança:** alta.
- **Ação mínima:** na falha da segunda etapa, dizer que o cadastro foi criado e a OS não recebeu a peça, e oferecer selecioná-lo. Segurar o botão de cadastrar antes do `INSERT`. Unir cadastro e inclusão numa transação só se for necessário evitar o produto órfão; a política de saldo negativo não precisa mudar.

### P2-B-03 — A transação da função não alcança os escritores absolutos

- **Bloco:** correção de quantidade.
- **Natureza:** atomicidade interna demonstrada pelo teste; corrida externa por leitura estática. O documento da correção já declara o limite.
- **Evidência:** dentro da função, `FOR UPDATE` da OS, do item e do produto, e os testes de gatilho que falham estoque ou total, `scripts/test_os_part_stock.cjs` linhas 137–147 e 185–195. Fora dela, os `UPDATE` absolutos citados em P1-V5-01 e P2-V5-01. A alternância de peça do cliente continua creditando ou debitando a quantidade inteira da linha, `page.tsx` linhas 809–821, e não a diferença da edição.
- **Cenário:** estoque 10 e linha com quantidade 1. A edição 1→2 debita 1 e o saldo fica 9. Em paralelo, a remoção leu 10 e grava 12. O débito da edição desaparece. Outro caso, em sequência: depois da edição 1→2, marcar a peça como do cliente soma a quantidade atual inteira, 2. Se a unidade original nunca tinha sido baixada, o saldo sobe uma unidade além do que a edição tirou.
- **Efeito:** item, saldo e total ficam juntos quando a função é a única escritora. Exclusão do produto durante a função espera a trava da linha; depois do commit, o item novo referencia o produto. Garantia global entre telas não existe.
- **Confiança:** alta na função e no teste de uma conexão; a corrida de duas conexões não foi executada.
- **Ação mínima:** publicar a correção com esse limite explícito. Não transformar isso em ledger para liberar a edição. Se a alternância passar a respeitar a mesma diferença da linha, isso é extensão da regra D18 aos outros botões, ainda não codificada.

### P3-B-01 — A função aceita menos status do que a tela deixa editar

- **Bloco:** correção de quantidade, compatibilidade.
- **Natureza:** fato dos dois arquivos. Existência de linhas antigas no remoto é hipótese.
- **Evidência:** a tela esconde editar, remover e adicionar só para `cancelado` e `entregue`, linhas 2284, 2331 e 2363. A migração, linhas 36–37 e 114–115, aceita apenas os cinco status operacionais. `migration_add_wo_tipo.sql` linha 20 ainda cita `em_andamento`. Não há, no código atual, um botão que grave `em_andamento`.
- **Cenário:** uma OS antiga nesse status mostra os botões. Incluir ou editar responde “Esta OS nao permite alterar itens” e não grava. Remover ainda devolve estoque pelo caminho antigo.
- **Efeito:** o bloqueio protege `entregue`, `cancelado`, `arquivado` e qualquer status desconhecido. Pode impedir manutenção de OS legada que a tela ainda considera aberta.
- **Confiança:** alta na diferença entre tela e função; baixa sobre haver linhas `em_andamento` no destino.
- **Ação mínima:** antes de publicar, conferir no destino os status fora da lista, sem usar essa conferência como inventário. Ou a tela passa a explicar o bloqueio, ou a lista da função inclui só status que a oficina ainda edita. Não alargar a lista por suposição.

## 4. Avaliação da correção, ponto a ponto

### 4.1. Incluir peça

Peça existente segue `handleAdicionarItem` com quantidade 1 e preço do catálogo, linhas 1274–1288, e a função valida quantidade, preço, OS, produto e organização. O saldo é `coalesce(estoque_atual, 0) - quantidade`. O total da OS é a soma dos itens que não são peça do cliente. Status fora dos cinco aborta sem item.

“Cadastrar e adicionar à OS” removeu o antigo `baixarEstoque = false`. O diff local mostra a chamada passando a usar a inclusão comum. O `INSERT` do produto continua à parte. Falha da inclusão não desfaz o cadastro e não deixa baixa pela metade. A mensagem mostra só o erro da inclusão. Ver P2-B-02.

Saldo inicial zero mais uma peça produz −1. O teste “new product with zero balance” confirmou isso. A tela não avisa antes. A decisão de não bloquear saldo negativo permanece.

### 4.2. Editar a mesma linha

O delta é `p_quantity - v_item.quantity` da linha travada, e só segue se o snapshot esperado for essa linha. Preço não entra no delta. Serviço, peça do cliente e peça sem `product_id` não atualizam produto. A função não reescreve baixas antigas: a quantidade anterior é a que está gravada agora.

O teste cobriu 1→2, 3→1, fração, preço com gatilho que explodiria se houvesse `UPDATE` de produto, serviço e peça do cliente. A tela envia o snapshot copiado na abertura do editor, linhas 2287 e 2366, com quantidade, preço, produto, tipo e `peca_cliente`. `handleAtualizarPrecoItem`, linha 846, não é chamado em nenhum arquivo; o editor é o caminho de preço.

### 4.3. Transação, rede e repetição

Item, saldo e total estão na mesma função. Falha de produto ou de total aborta. A tela alerta `error.message` e, no sucesso, recarrega OS e catálogo. Na edição, sucesso também fecha o modal.

Falha de rede antes do commit não grava. Falha depois do commit, na inclusão, pode gravar e ainda assim mostrar erro; a repetição cria outra peça (P2-B-01). Na edição, a repetição com o mesmo snapshot encontra a linha já mudada e não debita de novo; a mensagem pede fechar e atualizar. Isso foi testado numa sessão. O teste não abre duas conexões.

O snapshot é capturado na abertura, não no clique de salvar. Duas abas com o mesmo original: a primeira confirma e a segunda recebe `40001` sem movimento. Troca de produto, tipo ou peça do cliente também diverge o snapshot. Excluir o item faz a função não encontrá-lo. Mudança só de preço por outra aba diverge `unit_price` e recusa. Esses desfechos estão no SQL; o teste cobre snapshot velho, peça do cliente alterada e produto de outra organização.

O teste monta o JSON esperado dentro do SQL. A tela envia o valor já usado em `toFixed`, então o caminho visível trata quantidade e preço como número. Se um dia o cliente mandar esses campos como texto, a comparação recusa a edição e não movimenta estoque. É falha fechada, não um débito errado, e não foi o caso exercitado pelo PGlite.

### 4.4. Segurança

As duas funções são `SECURITY INVOKER`, com `search_path` fixo, `auth.uid()` qualificado e perfil `ativo`. Revogam execução de `public`, `anon` e `service_role` e concedem a `authenticated`. O teste confirmou a recusa de `anon` e `service_role` no banco sintético. Não há checagem de cargo. Quem já puder atualizar OS, item e produto pela RLS consegue operar; quem não puder faz a função falhar e desfazer. Isso não prova as políticas remotas nem protege `cargo` e `organization_id`. Ver P2-V5-03.

O teste cria políticas sintéticas com `test_org()`. Não usa `get_my_organization_id()` nem as políticas de `migration_rls_multi_tenant.sql`.

### 4.5. Compatibilidade e publicação

A função grava `marca` e `catalog_status`. A tela já lê essas colunas. `schema.json` não as lista em `work_order_items`. Se faltarem no destino, a inclusão falha e a transação inteira desfaz; não há baixa parcial. A fotografia não substitui o esquema instalado.

Ordem: aplicar a migração antes de publicar a tela. A tela não tem volta ao `INSERT` antigo. Publicar só a tela faz inclusão e edição de peça falharem e o alerta aparecer; o sucesso não é exibido no lugar da baixa. Publicar só a migração deixa o JavaScript antigo no comportamento anterior, em que “Cadastrar e adicionar” não debitava. Durante a transição, abas antigas e novas divergem nesse botão.

Reversão: voltar a tela restaura o comportamento antigo mesmo com as funções instaladas. Remover as funções com a tela nova no ar interrompe inclusão e edição de peça. As funções não atualizam linhas nem saldos existentes na instalação.

Cliente antigo continua able a inserir item e gravar saldo absoluto. A correção não fecha essa porta. O status `text` em `schema.json`, linha 6218, não mostra uma lista fechada. Não foi achado um `CHECK` local de `work_orders.status`. Aceitar `arquivado` no futuro continua dependendo do que estiver instalado.

### 4.6. O que os 15 cenários não demonstram

Coberto: os comportamentos da seção 2.5 e a recusa de execução para `anon` e `service_role`.

Simulado: RLS por uma função de teste; falha de estoque e de total por gatilho local; uma só conexão.

Não demonstra: concorrência real, esquema remoto, grants do Supabase publicado, tela no navegador, timeout, cadastro órfão, peça sem produto na edição, status nulo, duas abas e deploy. O ESLint que ignora o arquivo não entrou como aprovação. O `tsc` desta sessão passou e também não substitui esses cenários.

Testes que ainda valem a pena, só pelos riscos desta auditoria: inclusão repetida depois de commit com a lista desatualizada; cadastro confirmado e inclusão falha; duas conexões, uma na função e outra num `UPDATE` absoluto; edição de peça com `product_id` nulo.

## 5. Fiscal, agenda e vínculos

O contexto lido é o da Nuvem Local Fiscal. Nomes legados no código não trocam provedor nem endpoint. Esta auditoria não emitiu, cancelou nem consultou documento fiscal.

As duas migrações locais evitam duplicidade. Não são guarda de arquivamento.

- `migration_prevent_duplicate_fiscal_invoice_per_os.sql` trava NFC-e e NFS-e de saída em `draft`, `processing` e `authorized`. Não inclui `pending`, NF-e, `error` nem `rejected`.
- `migration_prevent_duplicate_product_sale_per_os.sql` substitui essa função. Inclui `pending` e agrupa NFC-e/NF-e de venda. Natureza especial, como remessa ou devolução, retorna na linha 46 sem bloquear. `error` e `rejected` ficam fora do status ativo.
- `src/lib/work-order-fiscal.ts` linhas 10–25 repetem a mesma ideia de status ativo e de venda de produto. `ACTIVE_FISCAL_STATUSES` não contém `error` nem `rejected`.

O plano, seção 14, manda não reutilizar esses gatilhos como regra de arquivamento. Se o bloqueio fiscal for adotado, a proposta pede `draft`, `pending`, `processing` e `authorized`, todos os tipos, naturezas e ambientes, e tratamento próprio para estado incerto. Essa adoção continua proposta. Uma nota inserida depois da verificação só fica impedida se a checagem ocorrer na mesma transação da OS.

Agenda: `app/(admin)/agendamentos/page.tsx` linhas 263–272 e a tela da OS, linhas 1677–1686, inserem compromisso com `work_order_id` sem olhar status futuro de arquivamento. `ja_tem_os` é tipo. Status usados na tela incluem `confirmado`, `cancelado` e `concluido`. Impedir `agendado`, `confirmado` e `em_atendimento` é a proposta D10. Não há cancelamento automático no plano.

Adiantamento, `page.tsx` linhas 1220–1229, insere `transactions` com a OS em orçamento, sem trava da OS. Estornar isso não é decisão tomada.

## 6. Achados das auditorias anteriores

| ID | Situação nesta V5 |
| --- | --- |
| P1-01 | Substituído pela decisão. Creditar a quantidade registrada da peça vinculada é a regra. O formulário de “quantidade ainda debitada” saiu. A dupla devolução do P1-V5-01 permanece. |
| P1-02 | Ainda relevante, repartido. Caminhos da própria OS: P1-V5-01, obrigatório antes de dados reais. Escritores absolutos externos: limitação aceita em P2-V5-01. O ledger geral foi retirado. |
| P1-03 | Ainda relevante e não verificado no remoto. P2-V5-03. |
| P1-04 | Resolvido no texto do plano: produto de outra organização aborta sem crédito. A correção de peças já faz essa checagem na função. O arquivo de arquivamento não existe. A FK local continua sem organização. |
| P2-01 | Resolvido no plano. A fila pode ficar vazia. O código confirma que não há comando de gravação. D17 segue proposta. |
| P2-02 | Ainda relevante. Virou P1-V5-01 e P2-V5-02. |
| P2-03 | Substituído pela comparação da prévia dentro da transação. `updated_at` continua afastado. Não há coluna de versão no código. |
| P2-04 | Resolvido no texto da seção 8. A lista atual ainda busca no cliente. |
| P2-05 | Ainda relevante como proposta D10. A política local de `company_settings`, linhas 207–213 de `migration_rls_multi_tenant.sql`, permite atualização a quem passa na organização. O plano não manda guardar o lembrete nessa tabela. |
| P3-01 | Resolvido no plano: valores do painel seguem a permissão da lista. |
| P3-02 | Não aplicável. A faixa de 8 a 16 dias não está na V5. As cores novas são proposta. |
| P1-V2-01 | Substituído pela decisão. Não há ciclo `known` / `legacy_unknown`. A quantidade atual é a quantidade devolvida. Remover e alternar ainda podem creditar de novo, P1-V5-01 e P2-B-03. |
| P2-V2-01 | Resolvido no texto da proposta fiscal, que inclui `pending` e estado incerto. A função de duplicidade não serve de guarda. Não é aceite de D09. |
| P2-V2-02 | Substituído. O gateway de todos os escritores saiu com a antiga D07. O risco residual é P2-V5-01. |
| P2-V2-03 | Resolvido no plano. O defeito continua na lista atual, P3-V5-01. |
| P3-V2-01 | Resolvido no plano: mesma chave e mesmo conteúdo devolvem o resultado salvo; conteúdo diferente conflita; a tela lê o estado corrente. |
| P2-V3-01 | Não aplicável. Não há migração que classifique linhas legadas. |
| P2-V3-02 | Ainda relevante de forma estreita. Apagar produto referenciado deve falhar pela FK, sem prova remota. Apagar não desfaz um crédito já confirmado. Não volta a exigir ledger. |
| P2-V3-03 | Resolvido como aviso de implementação. As duas migrações foram relidas; a mais nova libera natureza especial e não trata `error`/`rejected` como ativos. |
| P2-V3-04 | Ainda relevante para o modo de construir o arquivamento. Portal e `reopenOS` usam cliente administrativo. O plano pede sessão do usuário e revoga a ideia de função aberta ao papel de serviço. A correção de peças revoga `service_role` no arquivo local; o teste sintético confirmou isso. |
| P3-V3-01 | Resolvido. O predicado fixa `tipo = 'os'`. |
| P3-V3-02 | Não aplicável. O arquivo lido se identifica como versão 5 e o hash confere. |

## 7. Decisões

### 7.1. Já tomadas

- Painel de fluxo, cinco filas, carro genérico, cor por idade desde a abertura, mesma tela a partir do dashboard e do Atendimento, card ilustrativo com contador real.
- `arquivado` sem carro. Sem status `recusado`. Sem arquivamento automático. Ação manual em `orcamento`, permitida antes de 15 dias. Sugestão aos 15 dias contínuos.
- Ao arquivar, devolver a quantidade atual das peças da loja vinculadas a produtos, uma vez por ciclo, com ou sem prova da baixa. Serviço e peça do cliente não devolvem. Sem levantamento, inventário ou ledger geral nesta entrega.
- Edição na mesma linha, nos dois sentidos. Preço não movimenta estoque. Saldo negativo continua permitido. A correção local segue essa edição e não cria coluna de reserva.
- Os 69 registros e a proporção de OS de serviço permanecem informação do usuário, sem contagem nesta auditoria.

### 7.2. Pendentes de negócio

- D02/D05: cadência de 3 dias e uso de `created_at` como estimativa identificada para orçamento antigo.
- D04: cargos que podem arquivar.
- D08: o que fazer se faltar saldo ao desarquivar. As quatro alternativas estão na seção 2.4.
- D09/D10: impedir arquivamento com adiantamento, obrigação, documento ou compromisso ativo.
- D11: ampliar o arquivamento para bancada, separado do desenho dos carros.
- D03/D12/D13/D15: faixas de cor, nome visível, ordem, página de 20 e detalhes da prévia.
- D16: bloquear exclusão e cancelamento da arquivada, ou outra forma que não credite de novo.
- D17: criar comando para `aguardando_peca` ou manter a fila como leitura.

Nenhuma proposta desta lista foi tratada como aceite. A regra de devolver a quantidade registrada não foi reaberta.

## 8. Implantação, clientes antigos e reversão

| Etapa | Ordem e efeito |
| --- | --- |
| Correção de peças | Migração no destino antes da tela. A tela nova sem a função falha a inclusão e a edição e mostra o erro. A função sem a tela nova não muda o JavaScript antigo. Reverter a tela volta o cadastro sem baixa nesse botão. Não remover a função enquanto a tela nova estiver publicada. |
| Painel | Pode sair sem status novo e sem crédito. O predicado e a busca no servidor precisam nascer juntos. |
| Arquivamento | Banco com status, evento e operação antes dos clientes que chamam a operação. Desligar a ação nova se a publicação falhar; não apagar eventos nem estornar créditos em massa. Um cliente antigo que cancele ou exclua a arquivada não pode voltar a ser servido. |
| Proteção da arquivada | As funções de peça já recusam status desconhecido, inclusive `arquivado`, no arquivo local. Remoção, cancelamento, exclusão, alternância, checkout, portal e `reopenOS` precisam da trava antes do uso real. |

Prova ainda necessária, sem execução nesta auditoria: políticas e grants instalados de `profiles`, `work_orders`, `work_order_items` e `products`; colunas `marca` e `catalog_status`; constraint real de `work_orders.status`; ação da FK de `product_id`; presença de status fora dos cinco; se as funções novas já existem no destino. Isso não inclui contar OS nem ajustar saldo.

## 9. Próximos passos

**Sem bloqueio documental para desenvolver e ensaiar:** o painel com o predicado da seção 4 e a busca da seção 8; o lembrete visual de 15 dias com ação manual, deixando cadência e data antiga marcadas como proposta; a operação de arquivar em PostgreSQL isolado, com a soma da quantidade atual, evento e status na mesma transação; a correção de peças, que já tem migração e teste local.

**Corrigir antes do uso real da correção de peças:** publicar a migração antes da tela; na falha de rede da inclusão, recarregar a OS antes de outra tentativa; informar quando o cadastro nascer e a peça não entrar na OS. Não é necessário outro parecer para esse ajuste.

**Corrigir antes de arquivar com dados reais:** P1-V5-01 e P2-V5-02. A regra de negócio já está escolhida. O bloqueio é a convivência com os escritores atuais.

**Risco aceito pela decisão, enquanto não houver outra escolha:** saldo negativo; crédito da quantidade registrada mesmo sem baixa comprovada; saldo resultante que pode não coincidir com a prateleira; escritores absolutos de venda, importação e ficha de produto podendo cobrir o número depois (P2-V5-01).

**Depende de escolha:** cargos, cadência, data de orçamento antigo, falta de saldo ao desarquivar, bloqueios financeiro, fiscal e de agenda, alcance da bancada, detalhes visuais, destino da exclusão de arquivada e comando de `aguardando_peca`.

Não há motivo, neste parecer, para uma nova auditoria só por preferência de desenho. Há motivo para não publicar o arquivamento em cima dos caminhos atuais de remoção, cancelamento, exclusão e alternância.
