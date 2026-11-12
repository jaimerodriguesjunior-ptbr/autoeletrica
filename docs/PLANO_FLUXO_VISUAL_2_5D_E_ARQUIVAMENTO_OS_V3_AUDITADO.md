# Plano de implementação: fluxo visual 2,5D e arquivamento de OS

**Data-base:** 09/11/2026.  
**Projeto:** `G:\projetos\autoeletrica`.  
**Versão:** 3, revisão documental após a segunda auditoria independente.  
**Estado:** painel de consulta apto com condições; arquivamento com efeito em estoque requer revisão e continua bloqueado.  
**Entrega desta etapa:** este documento e cópias dos estudos visuais usados como referência. Nenhuma funcionalidade, migração ou alteração de dados foi executada nesta etapa.

Foram preservados a [versão 1 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V1_AUDITADO.md), o [primeiro relatório](AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md), a [versão 2 auditada](PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS_V2_AUDITADO.md) e a [auditoria da versão 2](AUDITORIA_V2_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md). A cópia da versão 2 mantém o SHA-256 `0063572E6B20B48EE32BD80DA75FCF9A030DF4FED2F2569336B2FDA729C080FB` informado pelo auditor.

Esta revisão incorpora correções técnicas e identifica as recomendações que dependem de decisão de negócio; não representa aprovação dessas decisões nem comprovação do estado do banco remoto. A seção 25 preserva a resposta à primeira auditoria; a seção 26 registra a resposta à segunda.

## 1. Objetivo e limite deste plano

Criar uma visualização operacional das ordens de serviço com carros genéricos em 2,5D, distribuídos em cinco filas por status. A visualização deve comunicar rapidamente o volume de trabalho e a idade das OS, funcionar em celular e tablet e permitir abrir os dados principais ao selecionar um carro.

Criar também o status `arquivado` para retirar da operação os orçamentos antigos que o lojista decidir arquivar. O sistema sugere a revisão após um prazo configurável; a mudança de status continua sendo uma decisão humana.

O painel representa **OS em acompanhamento**. Um veículo pode aparecer mesmo estando com o cliente, como no caso de espera por uma peça. Presença física, box e vaga não fazem parte da regra.

Este plano reúne o produto, a arquitetura, os efeitos em estoque e os critérios de liberação. As propostas ainda não decididas estão identificadas e concentradas na seção 22, para que a auditoria não as confunda com decisões já aprovadas.

## 2. Decisões já alinhadas na conversa

| Tema | Decisão alinhada |
| --- | --- |
| Finalidade | Representar o fluxo de OS, incluindo veículos que estejam fora da oficina. |
| Aparência dos carros | Um modelo genérico repetido, com o acabamento intermediário dos estudos 2,5D. |
| Correspondência com o carro real | Não reproduzir fabricante, modelo, ano ou pintura reais na ilustração. Esses dados aparecem como texto. |
| Filas | Cinco: Orçamento/aguardando aprovação, Aprovado, Aguardando peça, Em serviço e Pronto. |
| Significado da cor | Tempo da OS, independentemente do status. |
| Seleção | O carro selecionado cresce e ganha destaque; os demais ficam atenuados/desfocados; as informações recebem mais espaço. |
| Celular | Filas adaptadas à largura, com navegação dentro de cada fila. |
| Acesso | Dashboard e Atendimento abrem a mesma funcionalidade. |
| Atalho no dashboard | Card que lembra uma janela recortando uma cena maior, com desenho pré-renderizado e alguns carros aparecendo. |
| Novo status | `arquivado`, sem fila nem representação gráfica. |
| Status recusado | Não será criado. |
| Regra de sugestão | Depois de X dias em `orcamento`, oferecer arquivamento e reapresentar a sugestão duas ou mais vezes por semana de uso. |
| Referência do prazo | Não depender de orçamento enviado, mensagem ou aceite pelo portal. A negociação pode ocorrer pessoalmente. |
| Decisão de arquivar | Manual pelo lojista; não haverá arquivamento silencioso por tempo. |
| Histórico | Manter os dados da OS arquivada e permitir desarquivar. |
| Estoque | Liberar as quantidades efetivamente baixadas pela OS, uma única vez; conferir disponibilidade ao desarquivar. |

O valor de X, as faixas de cor, os cargos autorizados e a cadência exata dos lembretes ainda precisam ser definidos. Também são decisões explícitas a política de legado sem crédito (D06), o efeito das edições/remoções antigas (D18) e a distinção entre sugerir depois de X dias e impedir arquivar antes desse prazo (D01). Essas propostas não foram aprovadas pelo usuário.

## 3. Evidências do código atual e limites da análise

Foram feitas leituras locais dos arquivos abaixo. Não houve consulta ao banco remoto. `schema.json` é uma fotografia local, com campos que já diferem do código atual; não substitui a inspeção do esquema efetivamente instalado.

| Evidência local | Consequência para o plano |
| --- | --- |
| [package.json](../package.json): Next.js 14, React 18, Tailwind e Supabase; não há dependência de renderização 3D. | Fazer a primeira versão com imagens transparentes, HTML e CSS; uma engine 3D não é necessária. |
| [ServiceOrderList.tsx](../components/atendimento/ServiceOrderList.tsx): `OPEN_STATUSES` contém `orcamento`, `aprovado`, `em_servico`, `aguardando_peca`, `pronto`. | As cinco filas podem usar os status existentes. |
| `aguardando_peca` aparece em leituras e rótulos; não foi encontrado comando de tela que grave esse status. | A fila só terá registros já existentes ou gravados por outro meio até ser incluída uma transição explícita. Não inferir esse status pelo saldo do produto. |
| A mesma lista filtra OS com `vehicle_id` não nulo. | A representação com carros seguirá esse recorte, com contagem explicitamente referente a OS com veículo. |
| [Atendimento](../app/(admin)/atendimento/page.tsx) separa OS e vendas. | O novo acesso entra na área de OS, sem transformar serviços de bancada ou vendas em carros. |
| [Dashboard](../app/(admin)/dashboard/page.tsx) calcula fila, produtividade, últimas OS e entregas com regras distintas. | O novo contador não pode ser confundido com presença física ou com todos os indicadores existentes. |
| A contagem geral de OS do dashboard não tem filtro explícito de organização nessa consulta; depende do RLS vigente. | Qualquer consulta nova deve ter escopo explícito e isolamento no banco. A consulta de contagem tocada pela integração deve receber filtro explícito. |
| A agenda do dashboard exclui apenas `entregue` e `cancelado`. | Se apenas adicionarmos o status, uma OS arquivada poderá continuar aparecendo como entrega atrasada. |
| [Criação de OS](../app/api/os/create/route.ts) inicia com `status: 'orcamento'`. | A contagem do orçamento pode começar na criação da OS; não precisa de envio ao cliente. |
| [Detalhes da OS](../app/(admin)/os/detalhes/[id]/page.tsx), `handleAdicionarItem`: inserir peça normalmente diminui `estoque_atual`. | Arquivar precisa tratar a baixa existente. |
| No mesmo arquivo, `handleCadastrarEAdicionarPeca` chama `handleAdicionarItem(..., false)`. | Ter `product_id` e quantidade na OS **não prova** que houve baixa de estoque. |
| A edição de quantidade atualiza o item e o total, sem ajuste correspondente de estoque no trecho inspecionado. | `item.quantity` também não prova quanto precisa ser devolvido. |
| Remover item, cancelar OS, alternar peça do cliente e excluir OS alteram estoque por operações separadas no cliente. | Não copiar esse padrão para o arquivamento; é preciso proteger todas as operações concorrentes que afetam a mesma OS/peça. |
| Venda de balcão, cancelamento de recibo, edição de saldo e importação também gravam valores absolutos de `estoque_atual`. | Uma função nova de delta não basta enquanto essas gravações diretas puderem concorrer com ela. |
| [Cadastro de estoque](../app/(admin)/estoque/novo/page.tsx) pode vincular um produto a item pendente de catálogo. | Resolver o catálogo não é evidência de débito de estoque; arquivadas não podem sofrer vínculo que provoque baixa ou devolução implícita. |
| [Aprovação pelo portal](../app/api/portal/aprovar/route.ts) lê `orcamento` e depois faz um update separado. | É necessário tratar a corrida entre aprovação e arquivamento. A condição deve ser revalidada na escrita transacional. |
| [Extrato do portal](../app/api/portal/extrato/route.ts) soma totais de OS excluindo apenas canceladas. | Arquivadas precisam ser excluídas desse total operacional sem apagar o orçamento ou o histórico. |
| [Reabertura existente](../src/actions/os.ts) usa PIN, trata comissões e muda para `pronto`. | Desarquivar orçamento será operação separada; não reutilizar essa função como se tivesse a mesma finalidade. |
| `reopenOS` não lê o status atual antes de escrever `pronto`. | A própria função administrativa existente deve rejeitar arquivadas e destinos incompatíveis, no banco, antes de habilitar o novo status. |
| Há lançamento de adiantamento em `transactions` enquanto a OS ainda está em orçamento, e criação de agendamento vinculada à OS. | Um orçamento pode ter pendência real. Esses caminhos também precisam participar do controle transacional da OS. |
| `work_orders.updated_at` tem padrão no esquema local, mas não foi encontrado mecanismo local que o atualize em todas as mutações de OS e itens. | Não usar esse campo como versão da prévia nem relógio de entrada no status. |
| [Migração RLS](../migration_rls_multi_tenant.sql) mostra acesso por `organization_id`. | Revalidar políticas instaladas e privilégios; filtro na interface não é controle de acesso. |
| `profiles_update_own` permite atualizar a própria linha no SQL local, sem proteção visível de `cargo`, `organization_id` e `ativo`. | Verificar privilégios/triggers reais. Autorização por cargo e isolamento por organização exigem uma afiliação que o próprio usuário não possa elevar ou trocar. |
| A FK local do item aponta para `products.id`, sem compor organização. | Toda operação privilegiada deve validar também a organização do produto e do item, antes de alterar saldo. |
| A política local de `company_settings` permite atualização por membro da organização, sem regra de cargo. | Não colocar ali a política administrativa de arquivamento sem antes proteger sua escrita. |
| [Regra fiscal compartilhada](../src/lib/work-order-fiscal.ts) inclui `pending`, além de `draft`, `processing` e `authorized`, entre notas ativas. | O guarda de arquivamento deve abranger esses quatro status, todos os tipos vinculados e todos os ambientes. O gatilho antigo de duplicidade é mais estreito e não serve como predicado completo. |
| A lista pesquisa trecho do identificador e placa normalizada, além de cliente/modelo. | A consulta nova deve encontrar também o identificador abreviado exibido e a placa com pontuação, mesmo fora da primeira página. |
| Criação/importação de produto pode inserir `estoque_atual` já preenchido. | A recusa de saldo deve cobrir `INSERT`, `UPDATE` e os dois ramos de `UPSERT`, não somente alterações de uma linha existente. |
| [Contexto fiscal obrigatório](../CONTEXTO_NUVEM_LOCAL_FISCAL.md) define a integração Nuvem Local Fiscal. | Arquivamento não cancela documentos fiscais nem altera o provedor. Os bloqueios de vínculo precisam respeitar essa arquitetura. |

Os 69 registros abertos da NHT foram informados pelo usuário. Não foi verificado quantos estão em cada status, quantos têm veículo ou quantos tiveram estoque baixado. O plano não assume que a maioria seja de orçamento.

### 3.1. Correção necessária sobre a devolução de estoque

Na conversa, a ideia inicial foi devolver as peças vinculadas ao arquivar. A inspeção mais detalhada mostrou que essa regra, se aplicada literalmente, pode criar estoque: alguns itens foram adicionados sem baixa e algumas quantidades podem ter sido alteradas depois.

A regra implementável deve ser: **devolver somente o débito de estoque ainda aplicado e comprovado por movimentos registrados junto com a baixa**. Uma quantidade digitada numa revisão posterior não transforma o passado em comprovado.

Foi retirada a proposta da versão 1 que convertia a declaração manual de débito antigo em crédito durante o arquivamento. A nova recomendação para D06 é arquivar o legado sem movimentar seu saldo desconhecido e tratar eventual ajuste físico em outro processo de estoque, com origem e justificativa próprias. Enquanto essa recomendação não for aceita, o arquivamento de itens indeterminados permanece bloqueado.

## 4. Estrutura do produto

### 4.1. Uma tela principal

Rota proposta: `/atendimento/fluxo-visual`.

Os dois pontos de entrada abrem essa rota. A página concentra a busca, as cinco filas, a seleção de OS e o acesso à revisão de orçamentos antigos. O componente da lista atual continua sendo uma opção normal de trabalho.

No Atendimento, oferecer o botão “Fluxo visual” junto aos controles da lista de OS. Na primeira versão, usar navegação para a rota compartilhada, em vez de manter duas cópias do painel com estados independentes.

Ao voltar da visualização ou dos detalhes de uma OS, preservar busca, fila e posição de rolagem quando possível. Qualquer parâmetro de retorno deve aceitar somente rotas internas permitidas.

### 4.2. Card no dashboard

O card deve parecer uma janela sobre uma cena 2,5D maior: recorte de filas, alguns carros entrando e saindo das bordas e espaço para o título “Fluxo visual”. O clique em qualquer região acessível do card abre a tela completa.

A imagem de fundo será uma composição estática pré-renderizada, com os carros genéricos. Os carros dessa imagem são ilustrativos. Um texto curto como “Prévia ilustrativa” e um contador dinâmico separado evitam interpretar a quantidade desenhada como quantidade real de OS.

O contador deve comunicar o recorte real, por exemplo “OS ativas com veículo”, e usar a mesma regra de inclusão do painel. Durante carregamento, mostrar estado de carregamento; em falha, não apresentar zero como se fosse um resultado confirmado.

O card não deve carregar a tela inteira, todas as OS ou uma biblioteca de renderização apenas para mostrar a miniatura. Usar imagem local otimizada com recorte responsivo, dimensões reservadas e texto sobreposto em HTML.

### 4.3. O que cada carro representa

Cada carro equivale a **uma OS**, identificada pelo número da OS. Uma mesma placa pode ter duas OS abertas; nesse caso, aparecem dois carros, sem deduplicação silenciosa.

OS sem veículo, vendas de balcão e serviços de bancada não serão representados por carros nesta versão. A lista continua acessível para esses registros. O número total de toda a operação pode diferir da soma de carros; a interface deve explicar esse recorte.

## 5. Filas e regras de inclusão

| Ordem visual proposta | Status no banco | Título da fila | Observação |
| --- | --- | --- | --- |
| 1 | `orcamento` | Orçamento | Subtítulo “Aguardando aprovação”. Não implica que uma mensagem tenha sido enviada. |
| 2 | `aprovado` | Aprovado | OS aprovada, ainda nesse estágio do fluxo. |
| 3 | `aguardando_peca` | Aguardando peça | Pode representar carro que está com o cliente. |
| 4 | `em_servico` | Em serviço | Cor do carro continua significando tempo. |
| 5 | `pronto` | Pronto | Permanece visível até entrega ou outra transição válida. |

Exclusões: `arquivado`, `cancelado`, `entregue`, registros de outra organização e registros fora do recorte de OS com veículo.

`arquivado` terá rótulo e filtro na lista, mas não terá fila, desenho residual, vaga reservada ou inclusão nos totais do painel.

Status não reconhecido deve continuar acessível na lista e gerar indicação de registro não representado para revisão. Não encaixar automaticamente em outra fila.

A fila `aguardando_peca` não recebe registros por nenhum comando encontrado nas telas atuais. Não é possível afirmar que esteja vazia no banco remoto. D17 exige escolher entre adicionar uma ação explícita nos detalhes da OS, em entrega separada de consulta, ou publicar a fila como leitura dos registros existentes até esse comando ser implementado. Ela permanece visível quando vazia. A ação, se aprovada, não será inferida de estoque e precisará de origens/destinos de status definidos.

Manter cinco filas identificáveis mesmo quando alguma estiver vazia. Mostrar o estado vazio na própria fila, sem carros fictícios. A lista de status, os rótulos e o predicado de OS ativa serão centralizados para reduzir divergências entre as telas.

## 6. Dois relógios diferentes

### 6.1. Idade visual da OS

**Proposta:** usar o tempo desde `work_orders.created_at` para a cor do carro. O rótulo deve ser “Tempo da OS” ou “Dias desde a abertura”, porque o veículo pode estar fora da oficina.

Trocar de status não reinicia essa idade. Desarquivar também não altera a data de criação, embora reinicie o tempo contínuo em orçamento usado para o lembrete.

Faixas sugeridas apenas para discussão:

| Tempo da OS | Cor do carro |
| --- | --- |
| Menos de 3 dias | Verde |
| De 3 a menos de 7 dias | Amarelo/âmbar |
| De 7 a menos de 14 dias | Laranja |
| 14 dias ou mais | Vermelho |

Os limites serão configuráveis ou definidos como política inicial após a auditoria. Não foram aprovados na conversa. Cor deve vir acompanhada de texto de idade, para não ser a única forma de leitura.

Usar uma função compartilhada para cor e idade. Proposta de cálculo: intervalos completos de 24 horas desde o instante de abertura, usando o relógio do servidor como referência. Datas e horários serão apresentados em `America/Sao_Paulo` nesta versão; não pressupor configuração de fuso por organização que não foi encontrada. Valores ausentes, inválidos ou futuros aparecem como “Data a conferir”, com cor neutra, sem números negativos.

### 6.2. Tempo contínuo em Orçamento

O lembrete usa o período desde a entrada mais recente em `orcamento`. Uma alteração de descrição, preço, foto ou previsão não deve reiniciar esse período.

Adicionar registro confiável da entrada no status, atualizado no banco quando o status realmente muda. Os caminhos de criação e aprovação local ou pelo portal devem participar da mesma regra. `updated_at` não substitui esse registro e também não será usado como versão da prévia: alterações nos itens podem não mudar esse campo.

Para novas OS em orçamento, esse instante coincide com a criação. Ao desarquivar, retornar a `orcamento` com um novo início desse período.

Para OS antigas, a data exata de entrada pode não existir. A proposta é usar `created_at` como aproximação explicitamente identificada para as que ainda estão em `orcamento`, após a auditoria de dados. Não registrar essa aproximação como um evento histórico comprovado. A alternativa de começar a contagem na implantação adia os lembretes para todos os orçamentos antigos e precisa ser decidida na auditoria.

## 7. Aparência, ativos e efeito de seleção

### 7.1. Carro reutilizável

A primeira versão usará um pequeno conjunto de imagens transparentes do mesmo carro genérico, em ângulo fixo e com uma versão de carroceria por faixa de cor. A seleção usa o mesmo ativo em tamanho maior, evitando que o carro mude de desenho ao tocar.

Criar o ativo isolado, com transparência real, sombra contida e boa leitura em tamanho pequeno. As imagens completas geradas na conversa são referências de direção; não são sprites prontos para recortar em produção.

O conjunto deve ter o mesmo tamanho de tela, perspectiva, rodas, contorno e alinhamento em todas as cores. Preferir WebP/PNG transparente otimizado e hospedado no próprio projeto. Se uma ilustração vetorial editável conseguir preservar o acabamento aprovado, ela pode substituir as variantes raster após comparação visual.

Não gerar uma imagem por OS nem chamar IA durante o uso do painel. Não instalar Three.js/WebGL ou produzir modelos específicos de fabricantes para esta versão.

### 7.2. Composição

Fundo simples, filas bem separadas e profundidade sugerida pelas sombras e pelo desenho dos carros. O espaço disponível deve favorecer leitura e toque. Não reproduzir o galpão, as ferramentas, as vagas ou as portas de garagem dos primeiros estudos.

As cores de idade devem dominar os carros. Os títulos de status usam rótulos e ícones legíveis; evitar outra escala colorida forte que concorra com o significado das cores dos carros.

Proposta de ordenação dentro de cada fila: OS mais antiga primeiro, com desempate por ID. Busca por trecho da identificação da OS, placa normalizada, modelo textual e cliente, nos termos da seção 8. Os totais devem indicar claramente quando se referem ao resultado filtrado.

### 7.3. Ao selecionar

1. A seleção confirma qual OS foi tocada e mantém essa identificação visível.
2. O carro cresce com transição curta de escala e opacidade, com sombra de destaque.
3. As outras filas/carros recebem atenuação e desfoque moderado.
4. Um painel de detalhes ganha espaço e recebe foco acessível.
5. Ao fechar, o foco volta ao mesmo carro e a fila mantém sua posição.

O desfoque é um efeito visual. A camada de diálogo também deve impedir interação acidental com elementos de fundo. O carro selecionado e o painel ficam fora do elemento desfocado.

Dados iniciais: número da OS, status, placa, modelo textual, cliente, data de abertura, idade total e previsão de entrega quando existir. O total da OS segue a regra já praticada na lista e nos detalhes: é visível a quem possui acesso àquela OS. Não reutilizar a permissão de faturamento agregado do dashboard nem ampliar seu acesso. “Abrir OS” leva à tela de detalhes existente. Informações adicionais serão carregadas sob demanda, sem buscar todo o histórico de cada OS na abertura do painel.

A primeira versão do painel é de consulta e navegação. Aprovar, iniciar serviço, entregar e editar itens continuam nos fluxos existentes, com os novos bloqueios para arquivadas. Isso limita duplicação de regras.

### 7.4. Celular e tablet

| Contexto | Comportamento proposto |
| --- | --- |
| Celular vertical | Cinco filas empilhadas, cada uma com rolagem horizontal própria. Título e quantidade permanecem legíveis; mostrar próximo carro parcialmente para sugerir continuidade. |
| Tablet/desktop | Filas mais largas, mais carros por faixa e painel de seleção lateral ou sobreposto com espaço suficiente para os dados. |
| Seleção no celular | Camada de foco com carro ampliado e painel inferior, expandível até a altura disponível. Conteúdo longo rola dentro do painel. |
| Teclado | Tab alcança cada carro; Enter/Espaço selecionam; Escape fecha; foco retorna à origem. |
| Redução de movimento | Usar troca imediata ou fade mínimo; nenhuma informação depende de animação. |
| Falha do ativo | Nome/ID e controle continuam utilizáveis com representação simples de fallback. |

Não exigir hover, gesto de pinça ou rotação. A página não deve ter rolagem horizontal global; apenas as filas podem rolar lateralmente. Respeitar área segura e navegação inferior já existente.

## 8. Dados e atualização do painel

Usar uma consulta compartilhada no backend, sempre com a organização derivada da sessão autenticada e de uma afiliação protegida. Aplicar filtro explícito de organização e RLS/validação equivalente. Nunca aceitar um `organization_id` livre como prova de acesso. Conferir a organização dos relacionamentos de cliente e veículo, especialmente se a consulta usar privilégios administrativos.

Há uma condição de isolamento também para o painel somente de leitura: se a política instalada permitir ao usuário trocar `profiles.organization_id`, buscar esse valor no servidor não corrige a afiliação adulterada. Confirmar e, se necessário, proteger essa coluna antes de publicar acesso a dados reais pelo novo endpoint. O problema de `cargo` também deve ser resolvido antes das mutações administrativas.

Resposta inicial proposta:

- Contagens exatas por cada um dos cinco status, considerando o mesmo filtro de OS com veículo.
- Primeira página de carros por fila, com ID, status, abertura, início do status, placa, modelo e nome do cliente.
- Cursor de continuação independente por fila.
- Instante de referência do servidor para cálculo da idade.
- Indicação de sugestões de arquivamento para usuários autorizados.

Não depender da contagem dos registros renderizados: uma fila com 60 OS pode mostrar apenas a primeira página. **Busca por número, placa, modelo textual e cliente será executada no servidor sobre todo o universo autorizado antes da paginação.** As contagens usam exatamente o mesmo predicado de organização, tipo, status, veículo e busca aplicado às páginas. Não copiar o filtro exclusivamente local da lista atual para páginas de 20 registros.

Proposta inicial de paginação: 20 OS por fila, com cursor por `created_at` e ID, mantidos na ordenação escolhida. Ajustar após medir o tamanho real das respostas.

### 8.1. Contrato de correspondência da busca

O servidor recebe o termo como texto, sem exigir ID inteiro nem UUID completo. Depois de retirar espaços externos, termo vazio significa ausência de filtro. O predicado é a união dos seguintes testes de ocorrência literal, sem distinção de maiúsculas/minúsculas:

1. Trecho em `id` convertido para texto, incluindo os primeiros quatro caracteres que a tela de detalhes pode exibir.
2. Trecho no nome do cliente.
3. Trecho no modelo textual do veículo.
4. Trecho na placa em texto, ou na placa normalizada com somente letras/números ASCII e letras em maiúsculas, aplicando a mesma normalização ao termo.

O teste da placa normalizada só participa quando o termo normalizado não está vazio. Isso evita que uma busca composta só de pontuação encontre todas as OS por conter uma cadeia vazia. `%`, `_` e barras do termo são literais, não operadores de busca; parâmetros SQL devem ser vinculados/escapados corretamente. Não acrescentar uma nova regra de remoção de acentos sem necessidade de compatibilidade.

O cursor é aplicado depois desse predicado, e as contagens usam o mesmo predicado sem o corte de página. Exemplos de prova: ID fora da primeira página localizado pelos quatro caracteres exibidos; mesma placa encontrada com e sem hífen; cliente/modelo por trecho; termo com pontuação sem transformar o resultado em toda a organização.

### 8.2. Atualização e estados de consulta

Atualizar ao entrar na rota, retornar de uma edição, concluir arquivamento/desarquivamento e voltar o aplicativo ao primeiro plano. Oferecer atualização manual. Polling leve enquanto a tela estiver visível pode ser adicionado se a atualização por retomada não bastar; não incluir Realtime obrigatório na primeira versão.

Se o registro selecionado mudar de status ou desaparecer da consulta por ação de outra pessoa, atualizar a seleção e informar a mudança. Não manter um carro com status antigo como se o servidor tivesse confirmado aquele estado.

Distinguir carregamento, vazio confirmado, erro, falta de autorização e conexão indisponível. Não executar ações de estoque offline nem remover carro de forma otimista antes da confirmação do arquivamento.

## 9. Sugestão periódica de arquivamento

### 9.1. Elegibilidade

Uma OS pode entrar na revisão quando:

- Pertence à organização do usuário.
- Está atualmente em `orcamento`.
- Completou X dias contínuos nesse status, conforme a política da organização.
- É uma OS com veículo, no escopo inicial desta funcionalidade.

A elegibilidade por idade não significa que o arquivamento possa ser concluído imediatamente: vínculos financeiros, fiscais e incertezas de estoque devem ser verificados e apresentados conforme as seções seguintes.

### 9.2. Cadência proposta

**Proposta para auditoria:** lembrete a cada 3 dias, por usuário autorizado e por organização, enquanto existirem candidatos. Isso produz duas ou três oportunidades semanais para quem acessa o sistema regularmente. Se o usuário não abrir o aplicativo, não há garantia de exibição naquela semana.

O botão de arquivar uma OS elegível permanece disponível na revisão e nos detalhes, mesmo entre lembretes. A cadência limita o reaparecimento do aviso; não limita o acesso à ação.

Um aviso agregado evita uma notificação por orçamento: “Há orçamentos antigos para revisar”, com contador real e acesso à lista. Depois de apresentado/adiado, persistir a próxima oportunidade no servidor. Não depender apenas de `localStorage`, para evitar repetição no celular, tablet e em várias abas.

O aviso deve aparecer no dashboard ou Atendimento, conforme o acesso do usuário, sem duas apresentações na mesma oportunidade. Ao abrir a revisão, o lojista pode arquivar uma OS, manter como está ou adiar a revisão. A decisão de manter não reinicia a idade do orçamento; apenas adia o lembrete.

Não exigir cron, WhatsApp, e-mail, notificação do navegador ou aplicativo aberto em segundo plano para a primeira versão. A consulta de candidatos e a verificação da oportunidade acontecem ao usar as telas relevantes. Não reaproveitar o alerta sonoro de agenda para essa finalidade.

### 9.3. Valores ainda propostos

X sugerido para avaliação: 30 dias, configurável por organização. Esse número não foi aprovado e não será gravado como política implícita. Sem X escolhido, as sugestões ficam desativadas. A ação manual depende da decisão separada de D01: se for independente do prazo, não exige X por si só; se também for limitada por idade, exige X definido. Enquanto essa escolha não estiver registrada, não habilitar a ação por suposição. O painel de consulta funciona independentemente disso. A cadência de 3 dias também é proposta; dois dias fixos da semana podem corresponder melhor à expectativa da oficina, mas não garantem duas exibições a quem não acessar nas oportunidades correspondentes.

Para a primeira versão, não incluir arquivamento em lote. Uma lista de revisão com ações individuais reduz o risco até o comportamento de estoque estar validado. Lote poderá ser uma evolução independente.

## 10. Comportamento do status `arquivado`

### 10.1. Arquivar

Transição considerada no escopo inicial: `orcamento -> arquivado`. O prazo X está alinhado como disparador da sugestão. A versão 2 também o tratava como proibição da ação antes de X; essa restrição adicional não foi decidida pelo usuário.

D01 deve escolher entre permitir a ação manual a qualquer momento em orçamento e apenas sugeri-la após X, ou restringir também a ação a X dias. A opção escolhida será aplicada pelo backend. Sem decisão, não assumir a restrição nem uma liberação silenciosa. O painel não depende dessa escolha.

Antes da confirmação, apresentar resumo da OS e do estoque rastreado que será liberado. Itens de legado desconhecido devem ser identificados como “sem ajuste automático de estoque”, caso D06 autorize seu arquivamento. Não exibir esses itens como liberados. O texto deve falar em arquivamento de orçamento, sem afirmar recusa do cliente. Não pedir um motivo obrigatório extenso; motivo padrão proposto: “Orçamento antigo”, com observação opcional.

Na confirmação, o servidor revalida estado, idade, permissão, versão dos itens, vínculos e plano de estoque. Usar uma versão monotônica da operação da OS, incrementada no banco pelas mutações relevantes, incluindo itens e débitos. A prévia recebe essa versão do servidor. `updated_at` ou um hash calculado apenas no navegador não substituem a versão. Se algo mudou desde a prévia, retornar conflito e pedir nova revisão.

Depois de confirmado:

- Gravar `arquivado`, instante e autor.
- Liberar o saldo de estoque comprovadamente debitado por movimentos registrados, uma vez. Legado sem prova não gera crédito, conforme a proposta pendente D06.
- Preservar itens, valores, cliente, veículo, fotos, observações e eventos anteriores.
- Retirar da visualização 2,5D, dos contadores de OS ativas e das entregas/pendências operacionais incompatíveis.
- Manter acesso por filtro “Arquivadas”, histórico do cliente e consulta autorizada.

### 10.2. OS arquivada é consultável

Apresentar faixa “OS arquivada”, data e responsável. Permitir leitura e consulta do histórico. Bloquear alterações de itens, quantidades, peça do cliente, aprovação, início de serviço, entrega, baixa de estoque e nova emissão a partir dessa OS enquanto estiver arquivada.

O arquivamento não deve ser confundido com conclusão de serviço, recebimento ou cancelamento fiscal. Não zerar o total para retirar do painel; filtrar pelo status correto.

O botão de exclusão existente precisa de tratamento específico: uma OS arquivada não pode usar o fluxo antigo que devolve novamente todas as peças. Proposta inicial: bloquear exclusão permanente de arquivadas, preservando o histórico da liberação.

### 10.3. Desarquivar

Criar operação específica `arquivado -> orcamento`. Ela não usa a função atual `reopenOS`, que possui regra e destino diferentes.

A reativação verifica produtos ainda existentes, organização, quantidades e estoque atual. Reaplicar somente as quantidades que o último arquivamento efetivamente liberou. Um item que nunca teve baixa não ganha uma baixa nova só por reabrir. Para a parcela legada desconhecida que não gerou crédito, desarquivar também não aplica um débito por suposição nem altera seu estado para “conhecido”.

Se faltar estoque para recompor essas quantidades, a proposta é bloquear a reativação inteira e informar os itens indisponíveis. Não restaurar metade da OS nem gerar saldo negativo sem decisão de negócio. O histórico continua consultável, permitindo criar uma nova revisão quando necessário.

Ao concluir, registrar o evento, reiniciar o relógio contínuo em orçamento e devolver a OS à fila. A idade visual total desde a criação permanece a mesma.

## 11. Estoque: desenho necessário para liberar peças com segurança

### 11.1. Problema que precisa ser resolvido

O código atual combina seleção comercial de item com alteração direta de saldo. Além das inserções sem baixa, há edição de quantidade sem ajuste de estoque no trecho inspecionado. Portanto:

- `product_id` não é prova de reserva/baixa.
- `catalog_status = resolved` não é prova de reserva/baixa.
- `item.quantity` não é prova da quantidade debitada.
- O saldo atual do produto não revela qual OS o alterou.

Também existem escritas de estoque em venda de balcão, cancelamento de recibo, importação e ajuste/cadastro de produtos. Bloquear a linha do produto somente na nova função de arquivar não protege contra uma escrita antiga que leu um saldo anterior e depois grava um valor absoluto.

### 11.2. Registro de débito por item

Proposta de estado adicional por item de OS:

| Campo conceitual | Finalidade |
| --- | --- |
| `stock_tracking_state` | `known` para linha nova cujo comportamento foi registrado; `legacy_unknown` para linha antiga de peça sem prova. O segundo estado nunca é convertido por uma edição comum. |
| `stock_debited_qty` | Em `known`, número não negativo que representa o débito comprovado ainda aplicado. Em `legacy_unknown`, `NULL`; não preencher com zero ou com a quantidade comercial. |
| `stock_mode` | Na linha nova, distingue inclusão com aplicação ao estoque (`managed`) de inclusão conhecida sem baixa (`no_debit`). A exceção atual `baixarEstoque = false` torna-se modo explícito, não uma informação perdida. |
| Referência de movimento/ciclo | Relacionar cada aplicação e devolução ao evento que a causou. |

Nomes e tipos finais dependerão do esquema instalado. Quantidades devem usar precisão compatível com produtos fracionados; não assumir inteiro apenas porque o exemplo é uma peça.

Manter um registro de movimentos de estoque com organização, produto, item/OS quando aplicável, quantidade com sinal, origem, autor, instante e chave de idempotência. O histórico não pode ser alterado livremente pelo navegador.

Para operações novas, inserir/editar/remover item e registrar o débito ocorre na mesma transação. Uma linha nova inserida sem baixa fica em `known`, com débito zero. Serviços e peças fornecidas pelo cliente não geram baixa da loja; o modo de origem da linha deve ser preservado para definir uma alternância posterior. Um evento digitado depois para afirmar uma baixa antiga não satisfaz esse requisito.

**Contrato proposto para a primeira versão de estoque: uma linha não mistura legado desconhecido com débito novo.** A OS pode conter os dois em linhas distintas, inclusive do mesmo produto. Uma linha `legacy_unknown` não recebe débito novo. Para acrescentar quantidade com nova baixa, usar a inclusão normal e criar outra linha `known`; não fundir as linhas pelo `product_id`. O aumento direto da quantidade da linha antiga será rejeitado com orientação para essa inclusão explícita. Essa proposta D18 precisa de aceite pelo efeito visível sobre o editor atual.

Os contratos das seções 11.6 e 11.7 substituem a frase genérica da versão 2 sobre “preservar a parcela desconhecida”. Não há dados criados por esta iniciativa que exijam converter um item misto já instalado. Se outro sistema possuir mistura rastreada no banco real, ela exige diagnóstico específico, sem mapeamento automático para este modelo.

### 11.3. Protocolo único de mutação de saldo

Migrar os caminhos que modificam o mesmo saldo para operações de banco que apliquem deltas atomicamente ou ajustes explícitos protegidos por versão. **Além de trocar os arquivos, o banco precisa recusar `INSERT`, `UPDATE` e os dois ramos de `UPSERT` de produtos fora desse protocolo de saldo**, inclusive pelas rotas com cliente administrativo. Um produto já pode nascer com estoque informado, portanto um guarda somente de `UPDATE` é incompleto. Sem a recusa, abas e clientes antigos continuam capazes de criar saldo não registrado ou sobrescrever movimentos.

A implementação deverá combinar privilégios efetivos e guardas no banco. Mecanismo de referência proposto: funções de mutação `SECURITY DEFINER` pertencentes a papel dedicado `NOLOGIN`, sem associação aos papéis expostos e sem execução de auxiliares privilegiados livres. As funções validam sessão, perfil ativo, afiliação, permissão e organizações antes de alterar dados. Seus privilégios devem ser os mínimos necessários.

Um guarda de produto `BEFORE INSERT OR UPDATE`, com função de trigger em contexto de invocador, rejeita a criação fora do papel executor e rejeita atualização de saldo fora desse contexto. O papel executor é o `current_user` efetivo durante a função definidora autorizada. Não declarar o próprio trigger como definidor de modo que qualquer chamada herde esse papel e sempre passe. `UPSERT` atravessa os dois caminhos. Atualizar somente metadados pode seguir os privilégios próprios, desde que não altere saldo nem seus controles.

Não usar um booleano do navegador ou uma configuração livre de sessão como autorização. Provar que `authenticated`, `anon` e o papel usado pelo cliente administrativo não conseguem assumir o executor, mudar o dono das funções, desabilitar os triggers, definir `session_replication_role` ou chamar auxiliares que contornem as validações. `BYPASSRLS` não é autorização para ignorar o guarda. Revogar permissão de coluna não basta se ainda existir `GRANT` mais amplo na tabela. O mecanismo final deve ser testado com os privilégios reais, não aceito apenas por seu nome.

O mesmo corte deve proteger a escrita dos itens: um cliente antigo não pode inserir um item, receber erro somente ao baixar estoque e deixar uma inserção parcial. A criação/alteração de item com efeito de saldo deve usar uma operação atômica admitida pelo banco; o fluxo antigo deve falhar antes de qualquer efeito parcial.

O limite da transação é o comando de negócio: inclusão de peça reúne item/saldo/total; venda reúne os registros que compõem sua confirmação; criação de produto com saldo reúne produto/inicialização. Uma OS vazia criada por comando anterior independente pode continuar existindo se uma inclusão posterior for recusada. Não prometer desfazer chamadas já confirmadas fora da transação nem apagar cadastros anteriores como compensação silenciosa. Se um caminho antigo de venda já puder confirmar parte do mesmo comando antes do guarda, esse caminho ainda não atende ao corte e a mudança não será habilitada.

Inventariar e adaptar, no mínimo:

1. Adição, remoção e mudança de quantidade de peças da OS.
2. Alternância de peça fornecida pelo cliente.
3. Cancelamento e exclusão de OS, evitando nova devolução após liberação anterior.
4. Venda de balcão em `atendimento/nova-venda` e cancelamento em `recibo/[id]`.
5. Importação em `estoque/importar`, edição manual em `estoque/[id]` e saldo inicial em `estoque/novo`.
6. Vínculo de item pendente ao catálogo, registrando se houve ou não movimento.
7. Cadastro rápido com `baixarEstoque = false`, cadastro global e scanner de código de barras nos detalhes da OS; estes últimos podem criar saldo zero e depois debitá-lo.

Saldo inicial e entradas de importação também passam pela função: criar produto e registrar a inicialização de saldo são uma transação. Não deixar `INSERT` com quantidade da nota fora do protocolo, nem usar saldo zero como exceção para uma criação direta antiga que depois produza efeitos parciais. Para contagem física, o valor absoluto é uma operação explícita com versão/saldo de referência, delta calculado no servidor e origem registrada. Não aceitar a escrita genérica antiga como se fosse esse ajuste auditado.

Essa etapa pode exigir tocar mais arquivos do que a tela 2,5D. Se a auditoria optar por adiar essa base, o painel pode ser liberado de forma independente; o arquivamento com liberação de estoque permanece desligado até existir garantia de consistência.

Não se trata de criar um sistema completo de compras ou reservas. O objetivo é rastrear o débito aplicado e impedir que um novo fluxo devolva estoque indevido ou perca uma alteração concorrente.

### 11.4. Algoritmo de arquivamento

Executar em uma transação no banco:

1. Validar sessão, perfil ativo, afiliação protegida e cargo autorizado.
2. Serializar a chave de operação da organização e comparar seu conteúdo canônico, incluindo ator autenticado, ação, OS e versão esperada. Se já houver resultado confirmado da mesma solicitação, devolvê-lo conforme a seção 11.4.1, antes de exigir que o status atual ainda seja `orcamento`.
3. Para uma operação nova, adquirir controle da OS e conferir se continua em `orcamento`, com a política de prazo de D01 escolhida. A chave de operação não substitui a condição de status na escrita.
4. Comparar a versão monotônica do servidor com a prévia e estabilizar os itens, pelo mesmo controle da OS usado por suas mutações.
5. Validar vínculos impeditivos e rastreabilidade dos itens. Se houver legado desconhecido, aplicar somente a política D06 explicitamente escolhida, sem converter declaração em débito.
6. Exigir `item.organization_id = work_order.organization_id` e, para cada produto utilizado, `product.organization_id = work_order.organization_id`. Divergência aborta tudo, mesmo que o `product_id` exista. Conferir também a organização dos movimentos e vínculos relacionados.
7. Agrupar os débitos das linhas `known` por produto, bloquear em ordem determinística, aplicar os deltas e registrar os movimentos/ciclo por linha. As linhas liberadas passam a débito zero conhecido; linhas `legacy_unknown` permanecem com débito `NULL`, sem movimento e com seu estado preservado.
8. Gravar o evento com versão/ciclo e mudar o status pela transição protegida.
9. Confirmar tudo junto; qualquer falha desfaz todos os passos.

Duplo clique, repetição de requisição após perda de resposta e duas pessoas arquivando ao mesmo tempo devem resultar em uma única devolução. Reutilizar a mesma chave de operação com conteúdo diferente deve retornar conflito.

#### 11.4.1. Retorno após repetição de uma operação

O registro idempotente e o resultado de sucesso são confirmados na mesma transação do status e dos movimentos. Mesma chave e mesmo conteúdo devolvem o resultado já confirmado, sem novo movimento. Mesma chave com conteúdo diferente devolve conflito. Chave nova depois de um arquivamento concluído encontra status incompatível e devolve conflito de estado, sem crédito.

O resultado persistido identifica a ação, OS, ciclo/evento, versão e status ao confirmar, instante e movimentos autorizados. A resposta informa se foi reapresentada. O cliente conserva a chave/conteúdo durante uma repetição após timeout; não gera outra chave apenas porque perdeu a resposta. Falhas antes do commit não deixam sucesso parcial registrado.

Se uma operação posterior já desarquivou a OS, repetir a chave antiga continua sendo consulta ao sucesso histórico, não nova transição. Depois de qualquer sucesso, inclusive reapresentado, o cliente atualiza o estado corrente pelo servidor e não remove um carro baseado somente num resultado histórico. A repetição mantém autorização e afiliação verificadas; a chave não dá acesso por si só.

### 11.5. OS antigas com histórico indeterminado

Não preencher `stock_debited_qty = quantity` por migração automática. Não criar movimentos de débito retroativos com base em `product_id`, `quantity`, saldo atual ou declaração do lojista. Nenhuma dessas fontes comprova a baixa original.

**Recomendação revisada para D06, ainda pendente de decisão do usuário:**

- Serviço e peça do cliente não creditam estoque da loja.
- A parcela desconhecida de um item antigo fica como `legacy_unknown` e não gera crédito ao arquivar nem débito ao desarquivar.
- Se D06 for aceita, o arquivamento pode mudar o status desse legado sem alterar seu saldo, depois dos demais guardas de estado, autorização e vínculos estarem ativos.
- A prévia distingue “liberação rastreada” de “estoque antigo sem ajuste automático”. Não afirma que todo produto selecionado ficou disponível.
- Se D06 não for aceita, o arquivamento de OS com essa parcela desconhecida permanece bloqueado; o painel de consulta não depende dessa escolha.
- Uma OS mista tem linhas novas e antigas distintas. Liberar somente os débitos conhecidos das linhas novas, sem agregar ou converter a identidade da linha antiga. O contrato das demais mutações está na seção 11.6.

Uma eventual contagem física ou correção de estoque é uma operação separada do arquivamento, com motivo, responsável e referência de inventário próprios. Ela pode corrigir o saldo presente, mas não será apresentada como prova de qual OS causou uma baixa antiga nem será repetida em ciclos de arquivar/desarquivar.

Não criar formulário de “quantidade antiga ainda debitada” que alimente automaticamente um crédito. Não fazer correção retroativa de estoque em massa durante a migração. Caso seja encontrado um ledger confiável no banco instalado, sua evidência e compatibilidade terão de ser auditadas antes de qualquer aproveitamento; esse ledger não foi encontrado no material local.

### 11.6. Contrato completo do ciclo do item — proposta D18

O contrato abaixo é uma proposta explícita para fechar a lacuna P1-V2-01. Não foi aceito pelo usuário. Ele evita uma fórmula de divisão arbitrária de unidades antigas e novas na mesma linha. Se for recusado, é necessário definir outra tabela de transições antes de desenvolver os escritores; não deixar a escolha para cada tela.

Definições:

- `Q`: quantidade comercial positiva e finita da linha; nunca é interpretada sozinha como quantidade debitada.
- `D`: `stock_debited_qty`, somente numérico para uma linha `known`.
- `L`: linha `legacy_unknown`, com `D = NULL`. Esse `NULL` é ausência de prova, não zero aritmético.
- `K`: linha nova `known`. Se o modo for `managed`, a OS estiver ativa e a peça for da loja, `D = Q`. Em modo `no_debit`, serviço ou peça atualmente do cliente, `D = 0`.
- `C`: quantidade exata creditada por linha no ciclo de arquivamento confirmado. É salva no evento a partir de `D`, não recalculada depois por `Q`.

Todos os contratos respeitam a permissão/status em que a operação é admitida. Itens de OS arquivada não podem ser editados, removidos ou alternados. Quantidades usam o tipo numérico do banco, sem truncar frações. Estado, modo, débito, saldo, total e eventos relevantes mudam na mesma transação; o navegador não escreve esses campos de controle.

| Operação | Linha `K` conhecida | Linha `L` legada desconhecida |
| --- | --- | --- |
| Criar | Em `managed` com peça da loja, debitar `Q` e registrar `D = Q`; em `no_debit`, serviço ou peça do cliente, registrar zero conhecido sem delta de saldo. | Migração identifica a linha antiga sem gerar movimento e mantém `D = NULL`. Uma inclusão comum nunca cria linha legada artificial. |
| Editar preço/descrição | Não altera `D` ou saldo; atualiza total/versão quando pertinente. | Não altera `NULL`, saldo nem classificação; registra a edição comercial. |
| Alterar quantidade | Calcular `D_alvo = Q_novo` em `managed` com peça da loja; nos demais casos, `D_alvo = 0`. Aplicar `delta_saldo = D_atual - D_alvo` e registrar `D_alvo`. | Diminuir `Q` altera somente o orçamento e registra zero efeito em saldo. Aumentar `Q` na mesma linha é rejeitado; orientar “inclua a quantidade adicional como novo item”. A nova linha passa pela regra `K`. |
| Marcar peça do cliente | Creditar somente `D_atual`, gravar `D = 0` e manter o modo de origem. | Alterar a indicação comercial sem saldo; continuar `L` e `D = NULL`. |
| Desmarcar peça do cliente | Em modo `managed`, debitar `Q` e registrar `D = Q`. Em `no_debit`, manter zero e não criar baixa. | Alterar a indicação comercial sem débito; continuar `L` e `D = NULL`. Não inferir uma nova baixa de toda a quantidade antiga. |
| Trocar produto | Não substituir a identidade na mesma linha com débito: remover pelo protocolo e incluir novo item, com novo ID e movimento explícito. Vínculo inicial de catálogo sem baixa não inventa débito. | Não trocar produto já vinculado em lugar; remover comercialmente e incluir nova linha. Resolver produto pendente pode preencher o vínculo da mesma organização, mas mantém `L`, `NULL` e nenhum delta. |
| Remover item | Creditar somente `D_atual`, registrar o movimento, preservar o evento/snapshot e retirar do orçamento. `no_debit` credita zero. | Retirar do orçamento sem movimento de produto; preservar no histórico o estado `L`, a quantidade comercial e `D = NULL`. |
| Cancelar OS | Creditar a soma dos `D` conhecidos ainda aplicados, uma vez; gravar os zeros/eventos e o estado de cancelamento. | Não movimentar a quantidade comercial nem substituir `NULL` por zero. Essa mudança em relação ao comportamento atual deve ser aceita em D18. |
| Arquivar | Salvar `C = D_atual`, creditar `C` uma vez e deixar `D = 0`. | Se D06 autorizar, mudar apenas o estado da OS; linha permanece `L`, `D = NULL` e sem crédito. Sem aceite D06, rejeitar a OS que contenha essas linhas. |
| Desarquivar | Validar estoque de todos os produtos e debitar exatamente `C` do último ciclo aplicável; restaurar `D = C`. Não usar `Q` para aumentar a reposição. | Nenhum débito; manter `L` e `D = NULL`. O histórico desconhecido não se torna conhecido por reativar. |
| Arquivar de novo | Novo ciclo captura o `D` então aplicado, inclusive deltas válidos ocorridos após reativar; a liberação anterior não é repetida. | Continua sem movimento; não perde sua classificação por participar de vários ciclos. |

No modo `managed`, o momento comercial da baixa continua sendo a solicitação explícita de aplicação de estoque. A correção das quantidades conhecidas passa a registrar o delta que hoje falta. O modo `no_debit` é preservado nas edições e alternâncias; convertê-lo em `managed` na mesma linha não faz parte desta versão. Se houver necessidade de aplicar estoque depois, remover a linha sem baixa e incluir uma linha nova pelo fluxo explícito, mantendo o histórico.

Remover a linha do orçamento não pode apagar seus movimentos/snapshots por cascata. Preservar seu identificador original e a classificação no histórico, mesmo se o vínculo à linha operacional for anulado. Não reativar o ID removido nem reconstruí-lo ao desarquivar. Uma inclusão posterior do mesmo produto é uma nova linha; não herda a baixa presumida da antiga.

Exclusão permanente de OS que já tenha histórico legado ou movimentos deve ficar bloqueada nesta proposta, inclusive quando não estiver arquivada; usar o cancelamento auditado quando essa operação for permitida. Isso evita perder a origem dos movimentos e é uma ampliação explícita de D16, ainda pendente de decisão. O status não será alterado silenciosamente por um botão de exclusão.

**Efeito visível que precisa de aceite antes do corte de escritores:** remover, diminuir, marcar peça do cliente ou cancelar um item antigo deixa de devolver `item.quantity` automaticamente. O orçamento muda, o saldo desconhecido não. Acrescentar unidades novas utiliza outra linha. D06 aceita o tratamento do arquivamento; D18 aceita esse tratamento das demais mutações. Nenhuma das duas decisões substitui a outra.

### 11.7. Exemplos numéricos de uma OS mista

1. Antes do corte, há uma linha antiga com `Q = 2`, `L` e `D = NULL`; o saldo atual do produto é 10. Esses números não provam se as 2 unidades foram baixadas.
2. Tentar mudar essa linha para 5 unidades é rejeitado sem efeito parcial. O lojista inclui 3 unidades em uma nova linha `managed`: saldo 7, linha nova com `Q = D = 3`. A linha antiga continua com 2 e `NULL`.
3. Com D06 aceita, arquivar credita 3 da linha nova: saldo 10; linha nova `D = 0`, ciclo `C = 3`; linha antiga permanece `NULL`.
4. Desarquivar debita os mesmos 3, se disponíveis: saldo 7; linha nova `D = 3`; linha antiga segue `NULL`. Arquivar de novo credita 3 uma vez: saldo 10.
5. Se, quando ativa, a linha nova for reduzida de 3 para 1, a operação devolve 2 e deixa `D = 1`; o próximo arquivamento libera somente 1. Não volta a usar o `C = 3` de um ciclo encerrado.
6. Remover a linha antiga ou alterná-la para peça do cliente e voltar não modifica o saldo nem produz um `D = 2`. O evento comercial registra a alteração sem fingir movimento de estoque.

Um item novo incluído com `baixarEstoque = false` é diferente: possui zero conhecido em `no_debit`. Seu aumento comercial, remoção e alternância não debitam/creditam estoque; arquivar e desarquivar também não. O fato de ser zero conhecido não autoriza misturá-lo com a linha antiga desconhecida.

## 12. Vínculos financeiros, fiscais e outras pendências

O status `orcamento` não deve ser usado sozinho como prova de ausência de movimento financeiro ou fiscal.

**Regra inicial proposta para D09, ainda não aprovada pelo usuário:** impedir o arquivamento quando houver transação `paid` ou `pending`, comissão com efeito pendente ou pago, ou nota em `draft`, `processing`, `pending` ou `authorized`. O conjunto inclui os quatro estados de `ACTIVE_FISCAL_STATUSES` usados no código atual. A regra abrange todo documento vinculado, inclusive NF-e e naturezas especiais, e qualquer ambiente; não se limita aos tipos que aparecem no cartão de venda.

`error`, `rejected` e estados não classificados continuam impedindo enquanto não houver confirmação de desfecho terminal e da ausência de obrigação. Confirmar os nomes e significados no esquema instalado. Não copiar o predicado de `migration_prevent_duplicate_fiscal_invoice_per_os.sql`: o gatilho antigo trata menos status/tipos e não é a regra completa de arquivamento.

Vínculos comprovadamente cancelados/inativos podem ser liberados pela política auditada, sem serem apagados. Uma nota cancelada não deve permanecer bloqueando só por existir como histórico, desde que o cancelamento e a ausência de outra obrigação estejam confirmados. Não implementar uma lista permissiva presumida de estados com base apenas nos exemplos acima.

O adiantamento já insere uma transação real quando a OS ainda está em orçamento. O botão atual não prova ausência dessa pendência; a verificação é no banco. A emissão local pode gravar `fiscal_invoices.work_order_id` por caminhos que não repetem a conferência do status da OS no servidor; esse vínculo precisa participar do guarda, mesmo quando a tela normalmente só oferece emitir em OS pronta/entregue.

O arquivamento não apaga cobranças, não estorna recebimentos, não cancela comissões e não envia cancelamento à Nuvem Local Fiscal. A mensagem de impedimento deve apontar a pendência que precisa de tratamento no fluxo correspondente.

Intenção de pagamento não equivale a pagamento confirmado. Deve ser lida como dado do orçamento, sem criação ou exclusão automática de transação.

Agendamentos vinculados exigem D10. Proposta inicial: avisar e impedir enquanto existir compromisso em `agendado`, `confirmado` ou `em_atendimento`. `concluido`, `cancelado` e `nao_compareceu` não impedem por si só; estado desconhecido exige revisão. Confirmar o conjunto instalado. `ja_tem_os` é um tipo de agendamento, não um status, e não dispensa a regra. Não cancelar agendamento em silêncio. Essa tabela é distinta da lista de entregas atrasadas do dashboard, que usa `work_orders.previsao_entrega`.

As verificações precisam ser revalidadas na transação. Criação de vínculos financeiros/fiscais e aprovação devem usar o mesmo controle da OS ou uma proteção equivalente, para não inserir uma pendência depois da verificação e antes do arquivamento.

## 13. Autorização e proteção contra caminhos alternativos

Consulta do painel segue o acesso atual às OS da organização, com afiliação validada. Alterações devem conferir sessão válida, perfil ativo, organização da OS e permissão da operação no backend e no banco.

**Proposta de permissão para D04:** arquivar e desarquivar apenas para `owner`, `admin` e `gerente`, com normalização dos valores reais de cargo. Funcionários mantêm a consulta conforme o acesso já existente. A decisão final deve considerar quem atualmente administra os orçamentos na oficina. O formulário de reconciliação que gerava crédito legado foi retirado desta revisão.

Antes de confiar em `profiles.cargo`, confirmar grants, políticas e triggers reais. A política local `profiles_update_own` não protege essa coluna. Impedir o usuário de elevar o próprio cargo, trocar `organization_id` ou reativar o próprio perfil pelo caminho de atualização comum; alterações administrativas legítimas devem passar por autorização confiável separada. A verificação de `ativo` também ocorre no servidor/banco, não apenas no `AuthContext` do navegador. O estado remoto dessa proteção não foi comprovado.

A rota administrativa existente `app/api/admin/users/route.ts` também consome `cargo` para então usar o cliente administrativo. A prova da afiliação/autoridade protegida precisa cobrir esse consumidor, não somente o novo endpoint de arquivamento. Isso não prova que o banco remoto esteja vulnerável; prova que a restrição precisa ser confirmada antes de tratar o perfil como credencial.

Não confiar em `actor_id`, cargo ou organização enviados pelo navegador. Derivar da identidade autenticada. Funções privilegiadas devem ter permissões mínimas, `search_path` controlado e validações explícitas. Chave administrativa não aparece no cliente.

Criar proteção no banco para impedir que `update work_orders set status = 'arquivado'` por um caminho antigo contorne as verificações de estoque. A solução escolhida na migração deve garantir que toda transição de entrada/saída de arquivado execute a operação transacional ou seja rejeitada, inclusive sob o cliente administrativo. Um sinalizador livre enviado pelo cliente não pode liberar essa proteção.

O contrato também abrange `reopenOS`: hoje a função confere PIN e organização, mas não o status de origem. Ela não poderá mover uma arquivada para `pronto` nem apagar comissões antes de descobrir que a origem é inválida. A aprovação local, checkout, adiantamento, criação de agendamento e inserção de vínculo fiscal devem bloquear/validar a mesma OS na transação, com todas as validações anteriores a qualquer efeito parcial.

Também bloquear no banco mutações de itens e ações incompatíveis de OS arquivada. Esconder botões não protege contra uma aba antiga ainda aberta, chamada direta à API ou cliente antigo.

O portal público continua usando o token já existente para consulta individual; o token não concede poder de desarquivar nem de liberar estoque. Uma aprovação concorrente deve ter escrita condicional/transacional em `orcamento`. Se o arquivamento vencer, aprovação falha com mensagem de contato com a oficina. Se a aprovação vencer, arquivamento falha sem devolver estoque.

## 14. Modelo de dados proposto

Os nomes abaixo são uma proposta para o auditor; não são declaração de estruturas já existentes.

| Estrutura | Alteração proposta |
| --- | --- |
| `work_orders` | Aceitar `arquivado`; registrar instante de entrada no status, origem conhecida/estimada, metadados atuais de arquivamento e versão monotônica da operação, mantida no banco. |
| `work_order_status_events` | Um histórico imutável a partir da implantação, com organização, OS, origem/destino, autor, instante, origem da ação, chave de operação e dados do ciclo de arquivamento. Motivo, política e movimentos liberados podem ficar nesse mesmo evento tipado; não criar segunda tabela sem necessidade demonstrada. |
| `work_order_items` | Estado `known`/`legacy_unknown`, modo de origem da linha nova e débito numérico ou `NULL` conforme a seção 11.6. Rejeitar mistura de histórico desconhecido e débito novo na mesma linha. |
| `product_stock_movements` | Movimentos com origem, produto, quantidade, autor e chave de deduplicação, incluindo OS e demais escritores adaptados. |
| Configuração da organização | X dias escolhido e cadência, com escrita administrativa protegida. A política local de `company_settings` permite escrita por qualquer membro; não usar esse caminho sem corrigir os privilégios relevantes. Uma tabela específica também precisa de RLS/grants restritos. A primeira versão pode manter faixas de cor centrais, sem configuração fina por oficina. |
| `work_order_archive_reminder_state` | Próxima oportunidade/última apresentação por organização e usuário, com controle de concorrência entre dispositivos. |

Usar tipos e chaves compatíveis com o banco real. A função exige igualdade de organização entre OS, item e produto antes de qualquer crédito/débito; a FK simples de `product_id` não cumpre essa regra. Avaliar FKs compostas para prevenir novos vínculos cruzados, após identificar registros inválidos sem corrigi-los por suposição. Conferir também os vínculos de cliente, veículo, movimentos e obrigações. Não adicionar uma FK com cascata que apague o histórico de movimentos ao excluir um item.

A versão monotônica aumenta em toda mutação relevante de status, itens e débito. Mutações de filhos adquirem o mesmo controle da OS e atualizam essa versão na transação. Novos vínculos impeditivos também precisam desse controle, mesmo que a mudança de versão não seja necessária para o texto da prévia. Não depender de uma atualização voluntária de `updated_at` pelo cliente.

Índices candidatos: organização/status/abertura/ID para o painel; organização/status/início do status para os candidatos; organização/OS/instante para eventos; organização/produto para movimentos. Definir a forma final com os planos de consulta e a distribuição real dos dados.

Persistir versão do evento/ciclo permite distinguir arquivar, desarquivar e arquivar novamente sem duplicar efeitos. A unicidade de uma ação deve incluir a organização e sua identidade de operação, não apenas um valor temporário do navegador.

## 15. Contratos de backend e organização do código

### 15.1. Leitura

- `GET /api/os/fluxo-visual`: resumo e páginas das filas, com filtros validados e escopo de organização.
- Leitura de resumo selecionado por ID, reutilizando o acesso existente quando possível, com os mesmos controles de organização.
- Consulta de candidatos a arquivamento separada das linhas de carro; retorna motivos de impedimento e idade usada na regra.

### 15.2. Escrita

- `POST /api/os/[id]/arquivar`: chave de operação e versão da prévia; delega à função transacional.
- `POST /api/os/[id]/desarquivar`: valida estoque e executa a reversão controlada.
- Não criar endpoint de reconciliação que converta quantidade legada declarada em crédito de arquivamento. Ajustes de inventário continuam como operação de estoque separada, se forem necessários.
- Operação autenticada para reivindicar/adiar a oportunidade de lembrete, persistida no servidor.

Usar respostas distintas para não autenticado, sem permissão, OS inexistente/fora do escopo, conflito de estado, falta de estoque e impedimento de vínculo. Os textos de produto devem explicar a ação possível, sem expor SQL, credenciais ou detalhes internos.

Mutações financeiras e de estoque devem ter uma única fonte de regra no banco, acessada pelo backend autenticado. Endpoints não implementam laços independentes de devolução de saldo.

### 15.3. Arquivos candidatos

| Área | Arquivos existentes a integrar/auditar | Novos módulos propostos |
| --- | --- | --- |
| Painel | `app/(admin)/dashboard/page.tsx`, `app/(admin)/atendimento/page.tsx`, `components/atendimento/ServiceOrderList.tsx` | `app/(admin)/atendimento/fluxo-visual/page.tsx`, `components/fluxo-visual/*` |
| Consulta | Clientes Supabase e autenticação já existentes | `src/lib/os-status.ts`, `src/lib/os-age.ts`, consulta compartilhada e contratos tipados do painel |
| Ativos | Estilo do produto e fontes atuais | `public/fluxo-visual/` com carros transparentes e prévia otimizada |
| Arquivamento | Detalhes da OS, listas, configurações e funções de servidor | Rotas de arquivar/desarquivar, revisão e lembrete; serviço de aplicação compartilhado |
| Estoque | Detalhes da OS, estoque/cadastro/importação, venda de balcão e recibo/cancelamento | Funções transacionais e registro de movimentos |
| Portal | `app/api/portal/aprovar/route.ts`, `app/api/portal/os/route.ts`, `app/api/portal/extrato/route.ts`, `app/acompanhar/PortalClient.tsx` | Tratamento do rótulo, estado consultável e bloqueio de aprovação para arquivadas |
| Histórico | `app/(admin)/os/page.tsx`, histórico de cliente, impressão e recibos relacionados | Filtro/rótulo e predicados compartilhados |
| Migração | Projeto tem migrações SQL na raiz; não há diretório versionado funcional em `supabase/migrations` nesta leitura | Arquivo separado na convenção adotada após a auditoria, por exemplo `migration_fluxo_visual_arquivamento_os.sql` |

O arquivo de migração da ótica aberto no IDE pertence a outro projeto e não faz parte desta implementação.

## 16. Matriz de efeitos do novo status

| Superfície | Tratamento esperado de `arquivado` |
| --- | --- |
| Cinco filas e contadores do fluxo | Excluir. |
| Card do dashboard | Contagem dinâmica exclui; imagem ilustrativa não depende da OS. |
| Fila de espera/prioridade | Excluir das pendências ativas; preservar definições dos outros indicadores quando não houver relação com a mudança. |
| Agenda de entregas atrasadas | Excluir OS arquivada. Compromissos vinculados seguem regra explícita de impedimento/revisão. |
| Produtividade/faturamento | Arquivar não conta como entrega, serviço concluído ou receita. |
| Lista “Abertas” e leitura de placa | Excluir. |
| Lista “Arquivadas” | Incluir com data e responsável. |
| Lista “Todos”/histórico | Continuar consultável, com rótulo claro. Proposta: manter a semântica de “Todos” incluindo arquivadas. |
| Busca direta por número | Encontrar a OS para usuários autorizados; abrir estado de consulta. |
| Detalhes | Consulta e desarquivamento conforme permissão; bloquear alterações incompatíveis. |
| Aprovação local e portal | Rejeitar enquanto arquivada, inclusive em corrida com a ação de arquivar. |
| `handleStatusChange` e checkout | Condição de origem e controle da OS no banco; não permitir saída de arquivada por uma aba anterior nem efetuar recebimentos antes de validar a origem. |
| `reopenOS` administrativo | Validar status atual antes de remover comissões ou escrever `pronto`; não pode reabrir arquivadas por esse caminho. |
| Adiantamento (`handleConfirmarAdiantamento`) | Inserção de `transactions` usa o mesmo controle da OS; arquivada recusa a inserção, e um sinal concorrente impede o arquivamento. |
| Novo agendamento (`handleSalvarAgendamento`) | Validar status sob controle da OS antes de inserir em `appointments`; aplicar a política D10 aos registros existentes. |
| Agendamento pela tela `agendamentos/page.tsx` e demais inserções | Todo `INSERT`/alteração de vínculo em `appointments` com `work_order_id` valida a OS sob o mesmo controle no banco, qualquer que seja a tela de origem. |
| Portal de acompanhamento | Exibir aviso de orçamento arquivado e contato da oficina; sem botão de aprovação. |
| Extrato/resumo do cliente | Não tratar total de orçamento arquivado como dívida ativa; manter histórico e valores orçados. |
| Emissão fiscal | OS arquivada não deve entrar em uma nova emissão por caminhos alternativos. Documentos existentes permanecem íntegros. |
| Emissão direta no backend | A validação não depende do cartão fiscal: guardar a escrita de `fiscal_invoices.work_order_id` e suas corridas com o arquivamento. |
| Impressão | Rótulo “Arquivado”; preservar valores históricos, sem aparentar OS ativa. |
| Catálogo pendente | Não tratar o item arquivado como pendência operacional de baixa; impedir vínculo que altere estoque de OS arquivada. |
| Exclusão/cancelamento antigo | Não permitir segunda devolução por um fluxo legado. |
| Botão de exclusão no cabeçalho | Também sujeito ao bloqueio do banco, mesmo fora das condições que escondem controles de itens na tela atual. |

Não aplicar um filtro global de `arquivado` em toda consulta do projeto: há telas de histórico onde o registro deve aparecer. Aplicar predicados de atividade e de histórico conforme a finalidade.

## 17. Referências visuais preservadas

Os estudos abaixo foram copiados para o projeto para que a auditoria não dependa do histórico do chat.

| Estudo | O que aproveitar | O que já foi superado |
| --- | --- | --- |
| [Estilo do carro](referencias-fluxo-visual/01-estilo-carro.png) | Acabamento genérico intermediário do carro, que o usuário aprovou. | Galpão, vagas, fila única e cor por status. |
| [Filas no tablet](referencias-fluxo-visual/02-estudo-filas-tablet.png) | Separação por status e cor/idade. | O estudo mostra quatro filas; a especificação atual tem cinco. |
| [Seleção no tablet](referencias-fluxo-visual/03-estudo-selecao-tablet.png) | Carro destacado, fundo desfocado e dados com mais espaço. | Textos e números são fictícios; faixas de tempo e layout final não foram aprovados. |
| [Celular](referencias-fluxo-visual/04-estudo-mobile.png) | Filas empilhadas e navegação por fila. | Quatro filas, agrupamento homogêneo de cores e excesso de espaço de títulos precisam ser revistos. Cada fila poderá conter várias cores. |

Essas referências não são promessa de fidelidade ao mockup nem ativos finais de produção. A próxima validação visual deve conter cinco filas, legenda “Tempo da OS”, mistura de idades em cada status e o card recortado do dashboard.

## 18. Desempenho e acessibilidade

Metas propostas, a medir na implementação:

- Dashboard carrega somente a prévia e seu resumo, sem trazer o painel completo.
- Prévia preferencialmente até 150 KB; conjunto inicial de carros otimizado preferencialmente até 500 KB. Se a qualidade exigir mais, registrar o impacto antes de aceitar.
- Um único ativo por faixa, reaproveitado pelo cache; nada de um arquivo por OS.
- Paginação independente por fila e carregamento sob demanda de dados adicionais.
- Transições principalmente com `transform` e `opacity`; evitar blur em centenas de elementos individualmente. Aplicar a camada de foco em contêiner apropriado e medir no tablet/celular de referência.
- Botões com área de toque confortável, foco visível, identificação textual da OS e suporte a teclado.
- Legenda e idade textual tornam o painel legível para quem não distingue as cores.
- Compatibilidade com redução de movimento e uso sem animação.

Antes de alegar que o efeito funciona bem, medir em pelo menos um aparelho real representativo da oficina. Não presumir que a fluidez do desktop representa o tablet.

## 19. Sequência de implementação proposta

### Fase 0 — Auditoria deste plano e diagnóstico somente de leitura

Incorporar o relatório independente e fechar decisões da seção 22. Verificar esquema instalado, constraints, grants, RLS e triggers efetivos, proteção de afiliação/cargos/configuração, FKs de organização, índices e todos os escritores de estoque. A leitura local não libera essas garantias em produção.

Levantar contagem de OS por organização/status/tipo, idade, vínculos e presença de produtos. Verificar eventual histórico instalado sem inferir movimentos antigos a partir de quantidades atuais. Nenhuma descoberta autoriza correção retroativa automática.

Para a NHT, obter a distribuição real das OS abertas, sem arquivar ou atualizar qualquer registro. O relatório deve diferenciar orçamento, aprovado, espera de peça, serviço e pronto, além de OS sem veículo e vínculos impeditivos.

**Saída:** plano revisado, decisões registradas e evidências dos pré-requisitos. Esta versão 2 é uma revisão documental; os bloqueios não foram corrigidos no código nem confirmados no banco.

### Fase 1 — Painel visual de consulta

Criar ativos, cinco filas, busca e contagem no servidor antes da paginação, interação de seleção, adaptação móvel e card ilustrativo do dashboard. Adicionar acesso no Atendimento. O total da OS segue a permissão da lista atual. Confirmar proteção da afiliação e isolamento da consulta antes de usar dados reais. Essa fase não cria nem aceita `arquivado`.

Resolver D17 na apresentação: a fila “Aguardando peça” lê registros existentes e pode continuar vazia até entrar um comando de status. Se o comando for aprovado, implementá-lo como pequena entrega de operação separada, com transições definidas; não anunciá-lo como parte somente de leitura.

**Saída:** visualização útil e revisável, incluindo casos vazios, muitas OS, seleção e navegação móvel.

### Fase 2 — Base de status e estoque

Preparar migração aditiva, registro de início de status, versão monotônica, histórico de eventos e rastreamento apenas dos débitos comprovados novos. Implementar o contrato de linhas separadas da seção 11.6 somente depois de D18 ser decidida. Proteger cargo/afiliação e a escrita da configuração. Adaptar os escritores de saldo, estados e vínculos que concorrem com a OS; o banco passa a recusar os caminhos diretos antigos, incluindo criação de saldo por `INSERT`/`UPSERT`.

Planejar a troca coordenada de cliente, endpoints e guardas para não deixar uma operação antiga inserir OS/item/transação antes de falhar na etapa de saldo. O lançamento do front que usa a função e dos bloqueios no banco é uma mudança coordenada, sem intervalo operacional em que o caminho novo ainda não esteja disponível. Preparar a ordem real de implantação e o tratamento de abas antigas em ambiente isolado antes desse corte. Implementar proteção de OS arquivada e compatibilidade nas telas existentes antes de aceitar a primeira transição. Esta fase não habilita crédito de legado.

**Saída:** garantias transacionais, autorização e isolamento validados em ambiente isolado, incluindo chamadas antigas rejeitadas sem efeitos parciais. Verificação da configuração efetiva do banco continua sendo requisito de implantação.

### Fase 3 — Arquivar/desarquivar e lembretes

Implementar revisão de orçamentos, prévia versionada, validação, ações idempotentes e cadência persistida de lembrete. Ajustar portal, listas, agendas, totais e permissões. A revisão é de arquivamento, não um formulário para declarar débito passado. Só liberar quando X estiver escolhido, D06 estiver decidida e os demais guardas estiverem provados.

**Saída:** arquivamento manual e reversível, sem devolução duplicada ou baseada em débito desconhecido. Na proposta revisada, legado pode mudar status sem crédito somente se D06 for aceita.

### Fase 4 — Piloto e liberação gradual

Ativar primeiro a consulta visual para uma organização piloto. Depois da base de mutações estar coberta, observar registros novos com baixa rastreada antes de habilitar crédito. Habilitar a revisão e arquivamento para responsáveis escolhidos, acompanhando conflitos e movimentos. Não executar arquivamento em massa nem correção silenciosa de saldos no piloto.

Usar controles independentes para painel e arquivamento. A desativação do recurso deve impedir novas ações, preservando a consulta e as proteções necessárias aos registros já arquivados.

## 20. Validação planejada e critérios de aceite

Este documento não executa testes. A implementação de estoque/arquivamento exigirá verificações de integração em ambiente isolado, pois altera saldos e possui concorrência. Reaproveitar as ferramentas disponíveis no repositório quando forem adequadas; não introduzir uma suíte extensa só para espelhar componentes simples.

| Caso | Resultado exigido |
| --- | --- |
| OS nos cinco status | Cada OS com veículo aparece exatamente na fila do próprio status. |
| OS `pronto` | Continua no painel até sair do conjunto ativo. |
| Arquivada/cancelada/entregue | Nenhum carro ou contagem ativa no painel. |
| Mesmo veículo, duas OS | Dois carros identificados por OS; sem deduplicação indevida. |
| OS sem veículo/venda/bancada | Fora do recorte com carros, sem desaparecer das listas correspondentes. |
| Diferentes idades no mesmo status | Cores diferentes na mesma fila, com texto de idade correto. |
| Troca de status | Cor mantém a idade total; relógio do novo status atualiza apenas na transição real. |
| Alteração de descrição/preço | Não reinicia tempo em orçamento. |
| Fila Aguardando peça sem registros | Permanece vazia, sem criar carros ou inferir status por falta de estoque. D17 define a inclusão do comando. |
| Busca encontra a 45ª OS da fila | Trecho do ID que o detalhe exibe e placa com/sem hífen localizam a OS antes do corte de página; resultado e contador não se limitam aos 20 registros carregados. |
| Busca com `%`, `_` ou só pontuação | Operadores são literais e termo normalizado vazio não corresponde a todas as placas; nenhum acesso fora da organização. |
| Arquivar antes de X | Resultado segue a escolha explícita de D01 sobre a ação manual; o prazo da sugestão não cria uma proibição automática. |
| Lembrete repetido em abas/aparelhos | Persistência evita exibição multiplicada na mesma oportunidade. |
| Aplicativo fechado por uma semana | Não afirmar que houve notificação; apresentar revisão na próxima oportunidade de uso. |
| Arquivar sem peças | Muda status e registra evento sem movimento de produto. |
| Peça com baixa conhecida | Devolve exatamente o débito registrado junto da baixa e ainda aplicado, não a quantidade presumida. |
| Peça sem baixa/serviço/peça do cliente | Nenhum crédito ao estoque. |
| Quantidade de linha nova `managed` editada | Aplicar `D_alvo` e delta da seção 11.6 na mesma transação. Ex.: débito de 1, aumento de 2, liberação final de 3. |
| Quantidade de linha nova `no_debit` editada | Alteração comercial sem saldo; `D = 0` conhecido antes e depois, sem converter o modo silenciosamente. |
| Quantidade de linha `legacy_unknown` editada | Redução comercial não credita; aumento na mesma linha é rejeitado sem efeitos. Inclusão adicional é linha nova distinta, conforme D18. |
| Item legado desconhecido | Se D06 for aceita, muda o status com saldo do produto inalterado para essa parcela. Se não for aceita, rejeita a ação. Nenhum formulário ou migração fabrica a baixa. |
| OS mista, com legado e débito novo | A OS tem linhas distintas do mesmo produto; libera apenas os débitos conhecidos, mantém os `NULL` antigos e percorre todos os passos numéricos da seção 11.7. |
| Alternar peça do cliente e voltar | Linha nova `managed` devolve e reaplica somente sua quantidade rastreada; `no_debit` mantém zero; linha antiga mantém `NULL` e nenhum movimento. |
| Remover/cancelar item antigo | Não credita `quantity`; snapshot registra alteração comercial e estado desconhecido. Aplicar somente depois de aceitar D18. |
| Exclusão de OS com histórico/movimentos | Operação rejeitada conforme D16 proposta, sem perda de eventos nem segunda devolução. Cancelamento auditado tem contrato próprio. |
| Quantidade fracionada e saldo já negativo | Preserva a precisão numérica, sem truncar; devolver débito comprovado não depende de o saldo inicial ser positivo. |
| Duplo clique/repetição após timeout | Uma transição e uma devolução; mesma chave/conteúdo devolvem o resultado confirmado com identificação de reapresentação. Conteúdo diferente conflita. |
| Repetir uma chave antiga depois de desarquivar | Retorna o sucesso histórico sem nova transição, e a interface busca o estado corrente antes de atualizar a fila. |
| Duas pessoas arquivam juntas | Uma operação efetiva; a outra recebe resultado consistente. |
| Aprovação concorre com arquivamento | Somente uma transição vence; nunca aprovar uma OS cujo estoque já foi liberado. |
| Venda/entrada concorre pelo mesmo produto | Duas conexões com interleaving controlado provam a soma dos deltas. Reproduzir o escritor absoluto antigo e demonstrar que o banco o recusa após a proteção. |
| Produto criado/importado por `INSERT` ou `UPSERT` direto | Criação direta, inclusive saldo zero e chamada administrativa, é recusada pelo guarda. Operação autorizada inicializa produto e movimento juntos. |
| Cliente antigo insere item/OS antes de baixar | Operação antiga é barrada sem deixar item, OS comercial ou transação parcial que a nova camada interprete como rastreada. |
| Falha no último item | Nenhum saldo, evento ou status parcial. |
| Desarquivar com saldo disponível | Reaplica somente o liberado, uma vez, e retorna a orçamento. |
| Desarquivar sem saldo | Nenhuma reativação ou baixa parcial. |
| Arquivar/desarquivar/arquivar | Cada ciclo tem rastreio próprio, com saldo final correto. |
| Chamada direta alterando status/itens | Não contorna regras transacionais e estado arquivado. |
| Outra organização/perfil inativo | Sem acesso à leitura ou à mutação indevida. |
| Usuário tenta alterar `profiles.organization_id`, `cargo` ou `ativo` | A escrita comum não altera a afiliação/autoridade; consulta e funções não aceitam a alteração como credencial. Verificar grants e RLS reais, não só botões. |
| Funcionário tenta alterar X em `company_settings`/tabela de política | Banco recusa; não contornar pela atualização genérica de configurações. |
| Produto de outra organização num item | Rejeita a transação antes do primeiro delta, mesmo com função privilegiada. |
| Cliente tenta simular marcador interno de mutação | Não consegue habilitar escrita direta nem chamar função auxiliar privilegiada. |
| Usuário sem permissão | Consulta segue a política; ações administrativas são rejeitadas no servidor. |
| Vínculo financeiro/fiscal ativo ou não classificado | Arquivamento impedido conforme regra auditada, sem exclusão ou cancelamento automático. |
| Nota `pending` e NF-e vinculada | Bloqueiam conforme conjunto fiscal ativo, qualquer tipo/ambiente; não reutilizar o predicado incompleto de duplicidade. |
| Adiantamento ou novo agendamento durante a prévia | Compartilha a trava da OS: vale para detalhes e tela de agenda, além de qualquer outro escritor de vínculo. Ou o vínculo impede arquivar, ou arquivamento vence e a escrita incompatível é recusada sem efeitos parciais. |
| Portal e extrato | Arquivada consultável, sem aceite ativo e sem inflar dívida/pendência operacional. |
| Cancelar/excluir arquivada por tela antiga | Não provoca nova devolução de produto. |
| Falha de rede | Estado não é confirmado como sucesso; repetir não duplica efeito. |
| Celular/tablet/teclado | Cinco filas utilizáveis, foco correto, fechar e voltar mantêm contexto. |

Executar verificação de tipos/build e checagens existentes adequadas após as alterações. Verificações que escrevem banco usarão dados de teste e ambiente separado. Não usar emissão fiscal de produção como mecanismo de teste.

## 21. Implantação, observação e reversão

1. Confirmar proteção de afiliação e isolamento; publicar primeiro o painel somente de consulta, sem aceitar `arquivado` e sem depender de X.
2. Inventariar permissões, todas as escritas e o esquema instalado; confirmar backup e estratégia de migração.
3. Validar em ambiente isolado a troca coordenada de protocolos: novos endpoints/RPCs, rastreio, versão, restrição de saldo/itens e guardas de status/vínculos. O cliente antigo deve falhar antes de produzir efeitos parciais.
4. Preparar a migração remota separada, preservando compatibilidade; não misturar correção de saldos históricos com mudança estrutural. Publicar proteções e caminhos compatíveis antes de habilitar o arquivamento.
5. Ligar e observar a baixa rastreada nas operações novas, ainda sem usar declarações de legado para devolver saldo.
6. Ativar arquivamento no piloto após fechar as decisões e provar todos os critérios. Legado só muda status sem crédito se D06 for aceita. Lote permanece fora.
7. Observar eventos, conflitos, bloqueios, falhas de transação e duração das consultas; registrar IDs e autor sem expor tokens ou dados desnecessários de clientes.

Se houver problema, desligar novas ações de arquivar/desarquivar e manter os registros legíveis. Não restaurar em massa status antigos, não somar/subtrair estoque novamente por um rollback genérico e não remover o histórico de movimentos.

Uma reversão de código precisa continuar entendendo `arquivado`. Retornar a uma versão que trata esse status como editável pode reabrir os caminhos de devolução duplicada; portanto, manter uma camada compatível e os guardas no banco durante a reversão.

## 22. Decisões pendentes e pauta para auditoria

| ID | Decisão a fechar | Proposta inicial / pergunta de auditoria |
| --- | --- | --- |
| D01 | X dias e acesso à ação | Escolher X para disparar sugestões (30 é somente exemplo) e, separadamente, decidir se a ação manual também exige X ou pode ocorrer antes. Não inferir a proibição do pedido de lembrete. |
| D02 | Cadência | Avaliar intervalo de 3 dias por usuário autorizado; alternativa de dias fixos semanais. |
| D03 | Faixas de cor | Aprovar limites e legenda de idade total da OS. |
| D04 | Cargos | Confirmar quem pode arquivar/desarquivar. A proposta de `owner`, `admin` e `gerente` só pode ser usada após provar proteção de cargo, afiliação e perfil ativo. |
| D05 | Data de orçamento antigo | Aceitar `created_at` como estimativa identificada ou começar em outra referência comprovável. |
| D06 | Estoque legado ao arquivar | Recomenda-se permitir arquivar linhas antigas sem alterar seu saldo desconhecido, com aviso explícito. Nenhum número declarado vira crédito. Essa mudança precisa de decisão do usuário; até lá, bloquear essas OS. D18 trata as outras mutações, que não ficam decididas por D06. |
| D07 | Escritores de estoque | Cobrir os caminhos da seção 11.3 com protocolo atômico e recusa de `INSERT`, `UPDATE` e `UPSERT` direto, inclusive clientes antigos/administrativos. Validar o papel executor e o corte coordenado. |
| D08 | Falta de estoque ao desarquivar | Aprovar bloqueio integral e tratamento da OS sem reaplicar baixa indevida. |
| D09 | Vínculos financeiros/fiscais | Avaliar a classificação da seção 12: bloquear obrigações ativas ou incertas; histórico comprovadamente cancelado pode não impedir. Nenhuma exceção nova foi aprovada pelo usuário. |
| D10 | Agenda vinculada | Confirmar impedimento em `agendado`, `confirmado` e `em_atendimento`, sem cancelar compromisso. Conferir estados reais; `ja_tem_os` é tipo. |
| D11 | Escopo de OS sem veículo | Manter arquivamento inicial só para OS com veículo ou ampliar também para orçamentos de bancada. Essa ampliação não criará carros artificiais. |
| D12 | Nome da tela | Confirmar “Fluxo visual”, evitando interpretar “Pátio” como localização física obrigatória. |
| D13 | Ordenação e paginação | Confirmar mais antigas primeiro, tamanho de página e busca. |
| D14 | Política comercial de estoque | Confirmar que a seleção no orçamento continuará baixando estoque quando o fluxo assim solicitar; separar de uma futura mudança para reservar só após aprovação. |
| D15 | Prévia estática | Confirmar miniatura ilustrativa com contador real, em vez de uma segunda miniatura dinâmica de todas as OS. |
| D16 | Cancelamento/exclusão | Aprovar bloqueio da exclusão permanente de arquivadas e de OS com histórico/movimentos, preservando o cancelamento auditado quando permitido. Retirar devolução por `quantity` dos fluxos antigos; tratamento do legado requer D18. |
| D17 | Gravação de Aguardando peça | Incluir comando explícito nos detalhes da OS, com transições permitidas definidas, ou aceitar a fila apenas como leitura de registros existentes até outra entrega. Não há escritor de tela encontrado atualmente. |
| D18 | Ciclo dos itens antigos e novos | Aceitar o contrato das seções 11.6/11.7: não misturar origem na mesma linha; acréscimos antigos viram linhas novas; diminuir/remover/cancelar/alternar legado não movimenta saldo; `NULL` não vira zero. São mudanças visíveis no comportamento atual e precisam de aceite antes do corte dos escritores. |

### 22.1. Perguntas técnicas que a auditoria deve responder

- O banco possui enum/check/trigger de status não refletido nos arquivos locais?
- Existe histórico de movimentação de estoque já instalado e não identificado nesta leitura?
- Os identificadores, escalas de quantidade, cargos e políticas de organização são os que o código presume?
- Há produto compartilhado entre organizações ou FKs que permitam ligação cruzada?
- Existe alguma automação, integração ou cliente antigo que atualize status/saldo diretamente?
- Algum relatório ou portal interpreta toda OS não cancelada como dívida ou serviço prestado?
- Uma aprovação por token pode atravessar a transição de arquivamento no estado atual?
- O recorte de “OS ativas com veículo” coincide com as expectativas do contador do dashboard?
- O histórico de catálogo permite distinguir produto cadastrado de produto efetivamente baixado?
- O processo de implantação permite publicar compatibilidade antes de habilitar novas transições?

**Condições por bloco:**

- **Painel de consulta:** busca/contagem no servidor antes da paginação, sem regra financeira nova, recorte fiel e afiliação protegida. Registrar D17 para não prometer preenchimento automático da fila de peças. D03/D13/D15 definem a apresentação; não dependem de ledger.
- **Lembrete:** X escolhido (D01), cadência definida (D02), referência legada aceita (D05), relógio de status confiável e escrita da política protegida. A opção efetiva de arquivar só é habilitada com o bloco de mutações completo.
- **Arquivar/desarquivar:** D04, D06, D07, D08, D09, D10, D16 e D18 decididas; igualdade de organização, versão monotônica, operações antigas contidas e provas transacionais no banco. A restrição temporal da ação manual segue a escolha separada de D01; não herda 30 dias sem autorização.
- **Corte dos escritores de estoque:** contrato 11.6 aceito antes de mudar o comportamento das linhas antigas. O desenvolvimento isolado pode exercitar esse contrato como proposta, mas não o publica nem o trata como política aprovada.

As recomendações do relatório são referências técnicas/de produto, não aprovação do usuário. Esta revisão não fecha as decisões de negócio.

## 23. Esforço estimado após esta ampliação de escopo

As estimativas iniciais da conversa cobriam a representação visual simplificada. O pacote atual inclui novo status, lembretes persistidos, portal, permissões, retomada e liberação segura de estoque, inclusive situações legadas.

| Bloco | Situação da estimativa |
| --- | --- |
| Ativos, cinco filas, seleção, celular e entradas de consulta | Ordem de grandeza preliminar de 2 a 4 dias de uma pessoa familiarizada com o projeto, após fechar a apresentação e confirmar isolamento de leitura. |
| Proteção de afiliação, cargos e políticas | Dimensionar após leitura de grants, RLS e triggers instalados; não está resolvida por uma mudança de tela. |
| Protocolo de estoque, escritores, guardas e provas de concorrência | Sem prazo fechado: completar o inventário da seção 11.3, escolher o mecanismo efetivo e estimar cada fluxo, incluindo recibo, importação, ajuste e abas antigas. |
| Arquivar/desarquivar, lembretes, portal e demais superfícies | Estimar depois de fechar D01/D02 e os pré-requisitos de escrita, sem incorporar correção histórica de estoque ao arquivamento. |

A faixa agregada de **8 a 16 dias da versão 1 foi retirada como previsão do pacote completo**. Ela não estava sustentada por cobertura suficiente do corte de estoque, segurança e clientes antigos. A base só estará pronta quando todos os escritores e cenários obrigatórios estiverem cobertos, e não pelo término de uma janela de dias.

A auditoria deve poder optar por liberar primeiro o painel visual e depois o arquivamento, sem que a tela de consulta dependa de uma correção de estoque ainda não comprovada.

## 24. Resultado esperado da auditoria

Para cada achado, registrar severidade, seção do plano, evidência do código/esquema, cenário de falha e ajuste recomendado. Separar bloqueios de consistência dos refinamentos visuais. Não considerar o plano aprovado apenas porque a tela foi demonstrada.

Cada bloco estará pronto para desenvolvimento quando suas decisões e contratos estiverem definidos e houver um caminho verificável para preservar dados e histórico. As proteções, testes e provas no banco são entregas desse desenvolvimento e condições para habilitar a funcionalidade, não uma afirmação de que já existam. No momento, esta revisão documental não autoriza iniciar a implementação.

## 25. Histórico da revisão 1 para 2

O relatório original não foi editado. A tabela abaixo preserva as respostas documentais da versão 2 à primeira auditoria; a seção 26 registra as mudanças posteriores. “Incorporado” não significa corrigido no software ou validado em produção.

| Achado independente | Tratamento nesta versão | Situação antes da implementação |
| --- | --- | --- |
| P1-01: crédito por declaração de legado | Retirado o formulário que gerava débito/crédito por declaração; nova proposta D06 não movimenta a parcela desconhecida. | Regra de negócio pendente de decisão. Nenhum histórico foi convertido. |
| P1-02: escritores absolutos concorrentes | Exigida recusa de escrita direta no banco e cobertura do cliente antigo antes de efeitos parciais. Lista de escritores ampliada. | Mecanismo e implantação precisam ser demonstrados; código atual continua igual. |
| P1-03: cargo autodeclarado | Exigida proteção de `cargo`, `organization_id` e `ativo`; verificação de perfil também no servidor/banco. | Grants/triggers remotos não foram lidos. Proteção de afiliação é condição também da nova consulta. |
| P1-04: produto de outra organização | Algoritmo exige igualdade de organização entre OS, item, produto e movimento antes do primeiro delta. | Necessita validação/constraints reais e testes negativos. |
| P2-01: Aguardando peça sem escritor de tela | Registrada D17 e a possibilidade de fila vazia; comando será uma decisão explícita e entrega com escrita. | Comando não foi criado. Não há conclusão sobre contagem remota. |
| P2-02: caminhos alternativos de status/vínculo | Matriz nomeia reabertura, adiantamento, agendamento, checkout, exclusão e emissão direta. | Guardas compartilhados ainda não existem nesta implementação. |
| P2-03: prévia sem versão confiável | Introduzido contrato de versão monotônica mantida no banco; `updated_at` rejeitado como substituto. | Coluna, triggers/RPCs e testes ainda precisam ser implementados. |
| P2-04: busca/paginação | Explicitado filtro no servidor antes da paginação e contagem com o mesmo predicado. | Condição da entrega de consulta. |
| P2-05: agenda/configuração | Definidos estados propostos de compromisso e escrita de política restrita; fuso inicial fixado em São Paulo. | Estados instalados e decisão D10 ainda pendentes. |
| P3-01: total com permissão nova | Painel segue a lista/detalhe da OS, sem copiar a trava de faturamento agregado. | Requisito de compatibilidade da consulta. |
| P3-02: esforço subestimado | Painel estimado separadamente; retirada a previsão total antes de dimensionar os guardas e escritores. | Nova estimativa de escrita depende do diagnóstico. |

Dois refinamentos de interpretação são necessários ao usar os critérios do relatório:

1. “Editar quantidade não muda crédito” vale quando não ocorreu novo movimento comprovado. Se o novo fluxo efetivamente aplica um delta ao estoque na edição, o débito rastreado e o crédito posterior mudam juntos. A seção 20 testa os dois casos, sem vincular crédito ao número comercial sozinho.
2. Um trigger com “indicador interno” só é uma solução se a autorização desse indicador for demonstravelmente inacessível aos clientes expostos. O nome do marcador ou uma variável de sessão, por si só, não cria uma barreira de privilégio. A seção 11.3 deixa esse requisito como prova obrigatória.

**Conclusão documental vigente:** o painel pode avançar como consulta mediante suas condições; o arquivamento não está liberado. Resolver riscos preexistentes é pré-requisito da escrita quando eles permitem contornar o novo recurso, sem transformar automaticamente toda manutenção do sistema em parte do painel 2,5D.

## 26. Resposta documental à auditoria da versão 2

A versão 2 e os dois relatórios foram preservados. A revisão 3 não implementa seus contratos, não comprova grants remotos e não resolve decisões em nome do usuário. O número de OS da NHT continua não verificado.

| Achado da segunda auditoria | Mudança nesta versão | Limite/decisão pendente |
| --- | --- | --- |
| P1-V2-01: ciclo misto sem fórmula | Seções 11.6/11.7 definem estado conhecido com número, zero conhecido e legado com `NULL`, mais todas as mutações. A proposta evita mistura na mesma linha: a OS mista possui linhas novas/antigas separadas. | D18 precisa de aceite. O aumento de uma linha antiga passa pela inclusão de novo item; remover/cancelar/alternar antigo deixa de movimentar a quantidade comercial. D06 decide arquivar esse legado sem crédito. |
| P2-V2-01: fiscal sem `pending` | Seção 12 inclui `pending` e todos os tipos/ambientes vinculados; estados incertos continuam bloqueando. Não copiar o gatilho incompleto de duplicidade. | Política D09 e estados instalados precisam ser confirmados antes de habilitar. Nenhuma alteração fiscal foi executada. |
| P2-V2-02: guarda apenas de atualização | Seção 11.3 exige `INSERT`, `UPDATE` e `UPSERT`, inclusive saldo zero inicial. Especifica executor dedicado, trigger em contexto de invocador e testes de privilégios/corte de clientes antigos. | Ainda precisa ser implementado e provado no banco isolado e na configuração instalada. Não é segurança demonstrada por um parágrafo. |
| P2-V2-03: busca sem compatibilidade exata | Seção 8.1 define ocorrência literal por trecho do ID, nome/modelo e placa normalizada, antes do cursor e com o mesmo predicado de contagem. | Verificar ID real e testes de primeira página/abreviação. A busca da aplicação atual não foi alterada. |
| P3-V2-01: retorno idempotente indefinido | Seção 11.4.1 define retorno do sucesso já confirmado para mesma chave/conteúdo, conflito por conteúdo diferente e atualização do estado corrente depois do retorno. O reconhecimento da repetição precede a condição de origem para uma nova operação. | Exige contrato persistido e prova após perda de resposta. Chave não concede permissão por si só. |
| Consumidor de cargo já existente | Seção 13 cita `app/api/admin/users/route.ts`, além dos novos endpoints. | Restrição efetiva de cargo/afiliação/ativo continua não verificada remotamente. |
| Agenda possui outro escritor de vínculo | Seção 16 inclui a tela de agenda e toda escrita de `appointments.work_order_id`. | Guardas não podem depender da origem da tela. |
| Sugestão após X não equivale a proibição antes de X | D01 separa as duas decisões; seção 10 deixa a restrição da ação pendente. | O usuário escolhe a política; não pressupor aprovação da regra mais restrita. |

O contrato da seção 11.6 é uma redução deliberada de estados possíveis, não uma interpretação de que o auditor tenha aprovado linhas separadas. A alternativa de permitir legado e novas alocações dentro da mesma linha exigiria outra estrutura e fórmulas completas, que não serão inventadas durante a implementação. A escolha proposta fica exposta para revisão e aceite.

**Próxima avaliação:** verificar se o contrato restrito é adequado ao uso da oficina e se remove a ambiguidade técnica, mantendo a distinção entre desenvolvimento isolado e habilitação com dados reais. Painel e lembretes continuam sujeitos às condições independentes; nenhum bloco está publicado ou autorizado para publicação por este documento.
