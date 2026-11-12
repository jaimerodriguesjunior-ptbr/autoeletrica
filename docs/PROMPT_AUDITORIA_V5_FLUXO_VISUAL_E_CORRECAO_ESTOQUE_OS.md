# Prompt completo — auditoria independente da versão 5 e da correção de peças na OS

Você está em uma sessão independente, sem acesso ao histórico da conversa. Audite o plano da versão 5 do fluxo visual 2,5D e do arquivamento de ordens de serviço **e**, separadamente, a correção de estoque de peças já preparada no código local. Confronte o plano e a correção com o código e com as migrações locais. Esta é uma auditoria: não implemente nem publique nada.

## 1. Identificação e entrega

**Workspace:** `G:\projetos\autoeletrica`.

**Plano principal:** `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`. O arquivo estava identificado como versão 5, data-base 09/11/2026, com SHA-256 `6A2FD3D4E884F0509FCDB1CBE5C09F2E8759BE1471C227D5DB868B9D779EC0F7` quando este prompt foi criado. Calcule e registre o hash efetivamente lido. Se ele diferir, identifique a diferença de versão e ajuste o escopo do parecer; não atribua suas conclusões ao hash anterior.

**Correção local a auditar em separado:**

- `app/(admin)/os/detalhes/[id]/page.tsx` — tela com alterações locais de inclusão e edição de peças.
- `migration_os_part_stock.sql` — funções de inclusão e edição; preparada localmente.
- `scripts/test_os_part_stock.cjs` — testes isolados da correção.
- `docs/CORRECAO_BAIXA_PECAS_OS.md` — descrição, limites e comandos de validação.

Registre o hash dessas quatro fontes no momento da auditoria e confira o `git status`. Não suponha que arquivos não rastreados foram aplicados em produção. Não trate o estado do Git como prova do que está instalado remotamente.

**Relatório novo:** `docs/AUDITORIA_V5_FLUXO_VISUAL_E_CORRECAO_ESTOQUE_OS.md`. Se já existir, preserve-o e escolha um nome numerado. Apresente na resposta final o parecer resumido, achados principais, caminhos do relatório e limites da análise.

Histórico disponível:

- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md` e `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V2_AUDITADO.md` e `docs/AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V3_AUDITADO.md` e `docs/AUDITORIA_V3_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`.
- `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V4_ANTES_SIMPLIFICACAO_ESTOQUE.md`. Não presuma que exista relatório da V4.

## 2. Limites e método

Leia `AGENTS.md`. **Antes de analisar código, migrações ou integrações fiscais**, leia `CONTEXTO_NUVEM_LOCAL_FISCAL.md`. O projeto usa **Nuvem Local Fiscal**; nomes legados não autorizam trocar provedor, endpoints ou credenciais.

A única escrita permanente autorizada é o novo relatório. Não altere planos, relatórios anteriores, código, migrações, imagens, configurações ou dados existentes. Não implemente, publique, execute migração no banco remoto, faça reparo de histórico nem ajuste saldos.

Este pedido não autoriza conectar-se ao banco remoto por encontrar credenciais. Sem autorização adicional, dados reais, RLS, grants, triggers, constraints e esquema instalados permanecem desconhecidos. Não exponha segredos ou dados pessoais. Não conte nem consulte OS da NHT ou de outras oficinas.

Pode executar verificações locais sem escrita de produção, incluindo o teste PGlite existente se a dependência isolada estiver disponível. Examine o script antes de executar; ele deve usar apenas banco temporário em memória. Testes temporários próprios, se indispensáveis, ficam em `.tmp` e não alteram arquivos existentes. Não instale pacotes pela rede nem execute scripts que acessem serviços externos. Prefira `tsc --noEmit --incremental false` para não criar saída de compilação. Registre comandos, resultados e o que não conseguiu executar.

Leia o plano V5 integralmente e forme sua própria conclusão. Os planos e relatórios anteriores são contexto, não prova de estado atual. Diferencie **regra escolhida**, **proposta pendente**, **código existente**, **migração preparada**, **teste executado** e **estado remoto desconhecido**. A correção de peças é código local; painel, status de arquivamento e suas operações foram descritos como ainda não implementados. Confira em vez de assumir.

Não altere decisões do usuário por preferência arquitetural. Pode e deve apontar efeitos, riscos, corridas e incompatibilidades reais, inclusive riscos que continuem após a simplificação, com cenários e mitigação proporcional. A regra de devolver pela quantidade da OS é uma decisão explícita; a avaliação deve verificar **se ela é aplicada conforme escolhida**, sem exigir prova de baixa anterior ou inventário como condição de negócio. Não apresente o saldo resultante como necessariamente fiel ao estoque físico.

## 3. Contexto e decisões do usuário

O painel representa o fluxo das OS, inclusive veículos que podem estar com o cliente. Não representa vagas, boxes ou presença física. Usa cinco filas: `orcamento`, `aprovado`, `aguardando_peca`, `em_servico` e `pronto`. Cada carro genérico representa uma OS; a cor significa tempo desde a abertura, não a cor real ou o status. Ao selecionar, o carro aumenta, os demais são atenuados e as informações ganham espaço. Celular e tablet são requisitos; usar imagens/HTML/CSS é suficiente, sem engine 3D obrigatória.

Dashboard e Atendimento abrem a mesma tela. O card do dashboard parece uma janela sobre cena ilustrativa, com contador real separado. O recorte previsto no painel é organização da sessão, `tipo = 'os'`, veículo preenchido e um dos cinco status. Fila de peça pode estar vazia: o código local lido anteriormente não revelou uma tela que grave esse status.

O status `arquivado` não tem carro. Uma pessoa decide arquivar uma OS em `orcamento`; o lembrete é sugerido após **15 dias contínuos**, mas a ação manual pode ocorrer antes. Não depende de orçamento enviado e não há arquivamento automático pelo tempo. Preservar histórico e permitir desarquivar; não criar status `recusado`.

**Mudança essencial da V5, decidida pelo usuário:** ao arquivar OS antiga ou nova, devolver ao estoque a quantidade atual das peças da loja vinculadas a produtos. Serviços e peças do cliente não geram devolução. Não exigir evidência da baixa passada. Não fazer levantamento da NHT ou das outras oficinas, inventário, reconstrução de baixas nem correção geral de saldos como parte desta entrega. Não tornar um ledger geral ou migração de todos os fluxos de estoque pré-requisito. Isso aceita o efeito da regra sobre o saldo registrado mesmo quando a baixa antiga não pode ser comprovada.

O usuário informou que grande parte das OS abertas é de serviços e que a Kabroski compra peças conforme necessário. Isso é contexto fornecido por ele, não contagem verificada. As 69 OS abertas da NHT também são apenas informação dele; não foram conferidas.

**Regra de edição também confirmada:** na mesma linha, passar 1 relê para 2 compromete mais 1; passar 2 para 1 libera 1; mudar apenas o preço não movimenta estoque. Não exigir outra linha para o acréscimo. A correção pontual local reflete a operação no saldo disponível; não cria uma coluna separada de reserva nem comprova a situação anterior.

Não confunda essa correção local, já codificada, com o arquivamento futuro. A migração preparada para a correção não foi aplicada ao banco remoto nesta sequência. O comportamento atual permite saldo negativo; o usuário não decidiu criar um bloqueio geral de saldo negativo. A ação “cadastrar e adicionar peça” passa a incluir a peça com baixa na correção local; examine o efeito de um cadastro criado com saldo zero e a experiência da oficina.

## 4. Avaliação A — plano do painel, lembretes e arquivamento

Leia a V5 por inteiro e responda com evidências localizadas:

1. **Produto e experiência:** o painel representa cinco filas e OS com veículo, sem sugerir localização física? O carro genérico e suas cores indicam idade? Seleção, acessibilidade, celular e tablet estão descritos suficientemente? O card identifica a imagem como ilustrativa e usa contador real com mesmo recorte da tela? `aguardando_peca` pode nascer vazio sem prometer um comando inexistente?
2. **Consulta:** filtros, organização, busca por trecho de ID, cliente/modelo e placa normalizada ocorrem antes da paginação? Contagem e resultados compartilham o predicado? O termo cuja normalização de placa é vazia pode retornar tudo por engano? Erro, vazio e falta de autorização são distintos?
3. **Prazo e lembretes:** diferencie idade total da OS de tempo contínuo no orçamento. Confirmar 15 dias para sugestão e ação manual anterior ao prazo. Identifique proposta pendente para data de entrada desconhecida em OS já existentes, cadência de 3 dias e estado persistido entre abas. Não atribua aceite a essas propostas.
4. **Regra simples de devolução:** para OS só de serviços, nada é creditado; para peça vinculada da loja, credita a quantidade comercial atual independentemente de prova passada; peça do cliente não credita. Percorra várias linhas do mesmo produto, quantidade fracionada, saldo negativo, item sem produto e vínculo inválido ou de outra organização. Diferencie a orientação da V5 sobre item sem vínculo da decisão expressa do usuário e aponte se precisar de escolha operacional.
5. **Atomicidade e repetição:** verifique se o plano define operação única para bloquear OS/itens/produtos, revalidar prévia e status, creditar produtos, registrar evento e mudar estado com rollback integral. Analise dois cliques com chaves iguais e diferentes, timeout, repetição após desarquivar e rearquivamento em novo ciclo. Identifique qual snapshot e resultado o replay precisa manter, sem reconstruir estoque anterior.
6. **Concorrência com caminhos antigos:** investigue como remoção de item, cancelamento, exclusão, alternância de peça do cliente, edição, `reopenOS`, checkout e aprovação do portal podem ocorrer durante ou depois do arquivamento. Em especial, procure caminhos que escrevem saldo em chamada separada *antes* de atualizar status; uma trava aplicada apenas no final não desfaz crédito anterior. Proponha o menor tratamento que cumpra o comportamento da OS e a instrução de não reestruturar estoque geral.
7. **Outros escritores de saldo:** avalie a corrida concreta entre crédito atômico do arquivamento e escritores antigos de valor absoluto em venda, recibo, importação, edição e exclusão de produto. Informe se o plano demonstra o comportamento desejado ou se aceita uma limitação que pode anular/sobrescrever a devolução. Não declare que uma função atômica isolada protege todos os escritores. Apresente opções proporcionais e seus efeitos, sem impor automaticamente o antigo projeto de ledger ou inventário; se alguma ação técnica for necessária para cumprir o pedido de devolução, fundamente com um cenário e explique sua abrangência.
8. **Desarquivar:** deve usar somente o snapshot efetivamente creditado naquele ciclo, com repetição protegida e transação. A regra quando não houver saldo suficiente está pendente; avalie alternativas sem decidir pelo usuário. A criação de evento de arquivamento é histórico necessário ao ciclo, não equivale a ledger global.
9. **Organização e autenticação:** confronte RLS e políticas locais, inclusive proteção de `profiles.organization_id`, `cargo` e `ativo`, e vinculação de OS/item/produto à mesma organização. Verifique se as operações propostas conseguem ser usadas por conta de usuário sem ampliar privilégios indevidamente. Não declare que o banco remoto está vulnerável ou seguro com base apenas no código local.
10. **Vínculos e superfícies:** examine adiantamentos, transações, agenda, portal e dashboard. Após ler o contexto fiscal, confira as duas migrações locais de prevenção de duplicidade e `src/lib/work-order-fiscal.ts`: não confundir prevenção de duplicidade com guarda amplo. Os bloqueios financeiros, fiscais e de agenda seguem propostas, não decisões aprovadas. Identifique onde uma inserção concorrente poderia passar após a verificação de arquivamento. Não faça emissão ou cancelamento fiscal.
11. **Consistência da V5:** procure trechos que ainda exijam `known`/`legacy_unknown`, comprovação histórica, linhas adicionais obrigatórias, inventário prévio ou um gateway geral contrariando a escolha atual. Não confunda descrição histórica dos riscos com exigência vigente. Confira que a V5 não atribui aprovação a cargos, cadência, referência de data antiga, falta de estoque ao desarquivar ou regras de vínculos.

## 5. Avaliação B — correção local de quantidade e estoque

Audite como implementação real, não apenas como proposta. Leia as funções, a tela completa relevante e os testes. Não altere o código.

1. **Incluir peça:** confira o caminho de peça existente e o de “Cadastrar e adicionar à OS”. Verifique status permitido, quantidade, preço, produto/organização e atualização de saldo/total. Diferencie a criação do cadastro de produto, que pode ser uma transação própria, da inclusão da peça; examine o resultado quando a segunda falha e a informação mostrada ao usuário.
2. **Editar a mesma linha:** demonstre 1→2, 2→1, edição só de preço, quantidades fracionadas, serviço, peça do cliente, item sem produto e saldo zero/negativo. Confira que a diferença usada vem da quantidade anterior efetiva, que o preço não altera estoque e que a alteração antiga não é recalculada retroativamente.
3. **Transação e falhas:** verifique se item, saldo e total ficam atômicos nas funções de peça e edição, se erros de produto/total abortam a transação e se a tela trata a resposta. Examine falha de rede antes/depois da confirmação, repetição, clique duplo, atualização da tela após o sucesso e possível persistência com feedback incorreto. Diferencie evidência de teste de raciocínio estático.
4. **Edições concorrentes:** verifique comparação de `p_expected_item`, quais atributos fazem parte do snapshot e quando ele é capturado. Teste conceitualmente duas abas, troca de produto ou flag de peça do cliente, mudança de preço e exclusão/alteração do item. Dois cliques de inclusão, rede com timeout após commit e repetição da mesma solicitação são cenários distintos: a trava no navegador não comprova idempotência no banco.
5. **Segurança e escopo:** verifique `SECURITY INVOKER`, `auth.uid()`, perfil ativo, RLS, grants efetivos, coerência entre organizações e verificações de status. A função não deve ganhar direitos extras em relação ao usuário; confira o que as políticas locais realmente comprovam e o que depende do ambiente remoto. Não afirme proteção global de cargo/afiliação se isso não for provado.
6. **Compatibilidade e rollout:** compare as colunas da migração com o código e com a fotografia `schema.json`, que pode estar desatualizada. Confira ordem de publicação da função e da tela, comportamento se a função ainda não existir, permissões e compatibilidade de clientes antigos. Avalie se o bloqueio por status afeta OS legadas ou tipos existentes além das cinco situações previstas. Não aplique a migração remotamente.
7. **Saldos e caminhos concorrentes:** examine concorrência entre as funções novas e escritores antigos que salvam valores absolutos. Separe garantia transacional *dentro da RPC* da garantia global entre todas as telas. Cite cenários concretos, inclusive exclusão de produto ou mudança de status durante a operação, e proponha resposta proporcional.
8. **Testes existentes:** leia `scripts/test_os_part_stock.cjs`, suas tabelas/políticas sintéticas, dependência PGlite isolada e os 15 cenários relatados. Confirme o que é coberto, o que apenas é simulado e o que não demonstra concorrência real, esquema remoto, frontend ou deploy. Se executar, registre o resultado efetivo. Não trate o ESLint que ignorou o arquivo como teste aprovado. Indique testes adicionais apenas se cobrirem comportamento ou risco relevante.

## 6. Fontes para iniciar

- `app/(admin)/os/detalhes/[id]/page.tsx`, `migration_os_part_stock.sql`, `scripts/test_os_part_stock.cjs` e `docs/CORRECAO_BAIXA_PECAS_OS.md`.
- `app/(admin)/dashboard/page.tsx`, `app/(admin)/atendimento/page.tsx`, `components/atendimento/ServiceOrderList.tsx` e `app/api/os/create/route.ts`.
- `src/actions/os.ts`, `app/(admin)/atendimento/nova-venda/page.tsx`, `app/(admin)/recibo/[id]/page.tsx`, telas de cadastro, edição e importação de estoque.
- `migration_rls_multi_tenant.sql`, `fix_profiles_rls.sql`, `src/contexts/AuthContext.tsx`, clientes Supabase, `app/api/admin/users/route.ts` e migrações relevantes de permissões ou catálogo.
- Rotas do portal de aprovação e extrato, `app/(admin)/agendamentos/page.tsx` e demais escritores relacionados à OS encontrados na busca.
- Após ler o contexto fiscal: `migration_prevent_duplicate_fiscal_invoice_per_os.sql`, `migration_prevent_duplicate_product_sale_per_os.sql` e `src/lib/work-order-fiscal.ts`, mais os escritores de vínculos quando necessários.
- `schema.json`, `schema_types.txt` e `package.json`. A fotografia do esquema pode estar desatualizada e não substitui o banco instalado.

A migração de `G:\projetos\otica-gestao` que aparece em algumas abas pertence a outro projeto e está fora do escopo.

## 7. Formato do relatório

Para cada achado, informe **ID, prioridade, bloco, natureza, evidência com arquivo e linha, cenário concreto, efeito, confiança e ação mínima**. Explique se o efeito é fato demonstrado no código/teste, risco por interleaving ou hipótese dependente do ambiente instalado. Use P0/P1/P2/P3 de forma proporcional; não invente achados para preencher categorias.

O relatório deve conter:

1. Identificação dos hashes, arquivos locais alterados e limites do ambiente; estado de execução dos testes.
2. Parecer separado para **painel**, **lembretes**, **plano de arquivamento**, **desarquivamento** e **correção de quantidade já codificada**. Em cada bloco, distinguir desenvolvimento/ensaio isolado, revisão da implementação quando existir e habilitação com dados reais.
3. Achados ordenados por prioridade, com a evidência e um cenário verificável. Separe problemas anteriores ao escopo de regressões da correção local e lacunas do plano futuro.
4. Tabela dos principais achados das auditorias anteriores: resolvido no plano, substituído por decisão do usuário, ainda relevante, não verificado ou não aplicável. A política V5 de devolver a quantidade registrada substitui a exigência anterior de comprovar baixa; isso não elimina automaticamente riscos de concorrência ou dupla devolução.
5. Verificação das decisões já tomadas e lista curta das decisões de negócio realmente pendentes. Não transforme uma sugestão do plano em aceite nem reabra a regra expressa de devolução simplesmente por discordância técnica.
6. Análise de implantação, convivência com clientes antigos e reversão, especialmente ordem entre migração e tela e proteção contra novos créditos em OS arquivada. Indicar qualquer prova de ambiente necessária sem executá-la no remoto.
7. Próximos passos proporcionais: o que pode ser desenvolvido ou testado isoladamente, o que precisa de correção antes de uso real, o que é risco aceito pela decisão do usuário e o que depende de escolha. Diga claramente se não houver bloqueio documental para determinada etapa; não peça outra auditoria apenas por preferência.

Este parecer não autoriza implementar a funcionalidade, aplicar migrações, alterar dados reais ou publicar. Preserve todos os arquivos de entrada.
