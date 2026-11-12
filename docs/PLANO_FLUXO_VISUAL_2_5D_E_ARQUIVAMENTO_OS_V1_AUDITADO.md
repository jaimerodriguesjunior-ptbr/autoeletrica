# Plano de implementação: fluxo visual 2,5D e arquivamento de OS

**Data-base:** 09/11/2026.  
**Projeto:** `G:\projetos\autoeletrica`.  
**Estado:** proposta para auditoria antes da implementação.  
**Entrega desta etapa:** este documento e cópias dos estudos visuais usados como referência. Nenhuma funcionalidade, migração ou alteração de dados foi executada nesta etapa.

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

O valor de X, as faixas de cor, os cargos autorizados e a cadência exata dos lembretes ainda precisam ser definidos na auditoria.

## 3. Evidências do código atual e limites da análise

Foram feitas leituras locais dos arquivos abaixo. Não houve consulta ao banco remoto. `schema.json` é uma fotografia local, com campos que já diferem do código atual; não substitui a inspeção do esquema efetivamente instalado.

| Evidência local | Consequência para o plano |
| --- | --- |
| [package.json](../package.json): Next.js 14, React 18, Tailwind e Supabase; não há dependência de renderização 3D. | Fazer a primeira versão com imagens transparentes, HTML e CSS; uma engine 3D não é necessária. |
| [ServiceOrderList.tsx](../components/atendimento/ServiceOrderList.tsx): `OPEN_STATUSES` contém `orcamento`, `aprovado`, `em_servico`, `aguardando_peca`, `pronto`. | As cinco filas podem usar os status existentes. |
| A mesma lista filtra OS com `vehicle_id` não nulo. | A representação com carros seguirá esse recorte, com contagem explicitamente referente a OS com veículo. |
| [Atendimento](../app/(admin)/atendimento/page.tsx) separa OS e vendas. | O novo acesso entra na área de OS, sem transformar serviços de bancada ou vendas em carros. |
| [Dashboard](../app/(admin)/dashboard/page.tsx) calcula fila, produtividade, últimas OS e entregas com regras distintas. | O novo contador não pode ser confundido com presença física ou com todos os indicadores existentes. |
| A contagem geral de OS do dashboard não tem filtro explícito de organização nessa consulta; depende do RLS vigente. | Qualquer consulta nova deve ter escopo explícito e isolamento no banco. A consulta de contagem tocada pela integração deve receber filtro explícito. |
| A agenda do dashboard exclui apenas `entregue` e `cancelado`. | Se apenas adicionarmos o status, uma OS arquivada poderá continuar aparecendo como entrega atrasada. |
| [Criação de OS](../app/api/os/create/route.ts) inicia com `status: 'orcamento'`. | A contagem do orçamento pode começar na criação da OS; não precisa de envio ao cliente. |
| [Detalhes da OS](../app/(admin)/os/detalhes/[id]/page.tsx), `handleAdicionarItem`: inserir peça normalmente diminui `estoque_atual`. | Arquivar precisa tratar a baixa existente. |
| No mesmo arquivo, `handleCriarProduto` chama `handleAdicionarItem(..., false)`. | Ter `product_id` e quantidade na OS **não prova** que houve baixa de estoque. |
| A edição de quantidade atualiza o item e o total, sem ajuste correspondente de estoque no trecho inspecionado. | `item.quantity` também não prova quanto precisa ser devolvido. |
| Remover item, cancelar OS, alternar peça do cliente e excluir OS alteram estoque por operações separadas no cliente. | Não copiar esse padrão para o arquivamento; é preciso proteger todas as operações concorrentes que afetam a mesma OS/peça. |
| [Cadastro de estoque](../app/(admin)/estoque/novo/page.tsx) pode vincular um produto a item pendente de catálogo. | Resolver o catálogo não é evidência de débito de estoque; arquivadas não podem sofrer vínculo que provoque baixa ou devolução implícita. |
| [Aprovação pelo portal](../app/api/portal/aprovar/route.ts) lê `orcamento` e depois faz um update separado. | É necessário tratar a corrida entre aprovação e arquivamento. A condição deve ser revalidada na escrita transacional. |
| [Extrato do portal](../app/api/portal/extrato/route.ts) soma totais de OS excluindo apenas canceladas. | Arquivadas precisam ser excluídas desse total operacional sem apagar o orçamento ou o histórico. |
| [Reabertura existente](../src/actions/os.ts) usa PIN, trata comissões e muda para `pronto`. | Desarquivar orçamento será operação separada; não reutilizar essa função como se tivesse a mesma finalidade. |
| [Migração RLS](../migration_rls_multi_tenant.sql) mostra acesso por `organization_id`. | Revalidar políticas instaladas e privilégios; filtro na interface não é controle de acesso. |
| [Contexto fiscal obrigatório](../CONTEXTO_NUVEM_LOCAL_FISCAL.md) define a integração Nuvem Local Fiscal. | Arquivamento não cancela documentos fiscais nem altera o provedor. Os bloqueios de vínculo precisam respeitar essa arquitetura. |

Os 69 registros abertos da NHT foram informados pelo usuário. Não foi verificado quantos estão em cada status, quantos têm veículo ou quantos tiveram estoque baixado. O plano não assume que a maioria seja de orçamento.

### 3.1. Correção necessária sobre a devolução de estoque

Na conversa, a ideia inicial foi devolver as peças vinculadas ao arquivar. A inspeção mais detalhada mostrou que essa regra, se aplicada literalmente, pode criar estoque: alguns itens foram adicionados sem baixa e algumas quantidades podem ter sido alteradas depois.

A regra implementável deve ser: **devolver somente o débito de estoque ainda aplicado e comprovado para cada item**. A seção 11 detalha como registrar isso para operações novas e como tratar registros antigos sem inventar um histórico.

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

Usar uma função compartilhada para cor e idade. Proposta de cálculo: intervalos completos de 24 horas desde o instante de abertura, usando o relógio do servidor como referência. Datas e horários são apresentados no fuso da organização, com `America/Sao_Paulo` como padrão proposto. Valores ausentes, inválidos ou futuros aparecem como “Data a conferir”, com cor neutra, sem números negativos.

### 6.2. Tempo contínuo em Orçamento

O lembrete usa o período desde a entrada mais recente em `orcamento`. Uma alteração de descrição, preço, foto ou previsão não deve reiniciar esse período.

Adicionar registro confiável da entrada no status, atualizado no banco quando o status realmente muda. Os caminhos de criação e aprovação local ou pelo portal devem participar da mesma regra.

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

Proposta de ordenação dentro de cada fila: OS mais antiga primeiro, com desempate por ID. Busca por OS, placa, modelo textual e cliente. Os totais devem indicar claramente quando se referem ao resultado filtrado.

### 7.3. Ao selecionar

1. A seleção confirma qual OS foi tocada e mantém essa identificação visível.
2. O carro cresce com transição curta de escala e opacidade, com sombra de destaque.
3. As outras filas/carros recebem atenuação e desfoque moderado.
4. Um painel de detalhes ganha espaço e recebe foco acessível.
5. Ao fechar, o foco volta ao mesmo carro e a fila mantém sua posição.

O desfoque é um efeito visual. A camada de diálogo também deve impedir interação acidental com elementos de fundo. O carro selecionado e o painel ficam fora do elemento desfocado.

Dados iniciais: número da OS, status, placa, modelo textual, cliente, data de abertura, idade total e previsão de entrega quando existir. Total financeiro só aparece se o usuário tiver a permissão correspondente. “Abrir OS” leva à tela de detalhes existente. Informações adicionais serão carregadas sob demanda, sem buscar todo o histórico de cada OS na abertura do painel.

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

Usar uma consulta compartilhada no backend, sempre com a organização derivada da sessão autenticada. Aplicar filtro explícito de organização e RLS/validação equivalente. Nunca aceitar um `organization_id` livre como prova de acesso.

Resposta inicial proposta:

- Contagens exatas por cada um dos cinco status, considerando o mesmo filtro de OS com veículo.
- Primeira página de carros por fila, com ID, status, abertura, início do status, placa, modelo e nome do cliente.
- Cursor de continuação independente por fila.
- Instante de referência do servidor para cálculo da idade.
- Indicação de sugestões de arquivamento para usuários autorizados.

Não depender da contagem dos registros renderizados: uma fila com 60 OS pode mostrar apenas a primeira página. Proposta inicial de paginação: 20 OS por fila, com cursor por `created_at` e ID, mantidos na ordenação escolhida. Ajustar após medir o tamanho real das respostas.

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

X sugerido para avaliação: 30 dias, configurável por organização. Esse número não foi aprovado. A cadência de 3 dias também é proposta; a auditoria pode preferir dias fixos da semana.

Para a primeira versão, não incluir arquivamento em lote. Uma lista de revisão com ações individuais reduz o risco até o comportamento de estoque estar validado. Lote poderá ser uma evolução independente.

## 10. Comportamento do status `arquivado`

### 10.1. Arquivar

Transição permitida no escopo inicial: `orcamento -> arquivado`, depois do prazo configurado. A mesma regra de prazo deve valer no backend; não será apenas um botão escondido na interface.

Antes da confirmação, apresentar resumo da OS e do estoque que será liberado. O texto deve falar em arquivamento de orçamento, sem afirmar recusa do cliente. Não pedir um motivo obrigatório extenso; motivo padrão proposto: “Orçamento antigo”, com observação opcional.

Na confirmação, o servidor revalida estado, idade, permissão, versão dos itens, vínculos e plano de estoque. Se algo mudou desde a prévia, retornar conflito e pedir nova revisão.

Depois de confirmado:

- Gravar `arquivado`, instante e autor.
- Liberar o saldo de estoque comprovadamente debitado, uma vez.
- Preservar itens, valores, cliente, veículo, fotos, observações e eventos anteriores.
- Retirar da visualização 2,5D, dos contadores de OS ativas e das entregas/pendências operacionais incompatíveis.
- Manter acesso por filtro “Arquivadas”, histórico do cliente e consulta autorizada.

### 10.2. OS arquivada é consultável

Apresentar faixa “OS arquivada”, data e responsável. Permitir leitura e consulta do histórico. Bloquear alterações de itens, quantidades, peça do cliente, aprovação, início de serviço, entrega, baixa de estoque e nova emissão a partir dessa OS enquanto estiver arquivada.

O arquivamento não deve ser confundido com conclusão de serviço, recebimento ou cancelamento fiscal. Não zerar o total para retirar do painel; filtrar pelo status correto.

O botão de exclusão existente precisa de tratamento específico: uma OS arquivada não pode usar o fluxo antigo que devolve novamente todas as peças. Proposta inicial: bloquear exclusão permanente de arquivadas, preservando o histórico da liberação.

### 10.3. Desarquivar

Criar operação específica `arquivado -> orcamento`. Ela não usa a função atual `reopenOS`, que possui regra e destino diferentes.

A reativação verifica produtos ainda existentes, organização, quantidades e estoque atual. Reaplicar somente as quantidades que o último arquivamento efetivamente liberou. Um item que nunca teve baixa não ganha uma baixa nova só por reabrir.

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
| `stock_tracking_state` | Distinguir estado conhecido de histórico legado indeterminado. |
| `stock_debited_qty` | Quantidade cujo débito continua aplicado no saldo do produto. Não confundir com quantidade orçada. |
| Referência de movimento/ciclo | Relacionar cada aplicação e devolução ao evento que a causou. |

Nomes e tipos finais dependerão do esquema instalado. Quantidades devem usar precisão compatível com produtos fracionados; não assumir inteiro apenas porque o exemplo é uma peça.

Manter um registro de movimentos de estoque com organização, produto, item/OS quando aplicável, quantidade com sinal, origem, autor, instante e chave de idempotência. O histórico não pode ser alterado livremente pelo navegador.

Para operações novas, inserir/editar/remover item e registrar o débito deve ocorrer na mesma transação. Itens inseridos sem baixa ficam explicitamente com débito zero. Serviços e peças do cliente não geram baixa de estoque da loja.

### 11.3. Protocolo único de mutação de saldo

Migrar os caminhos que modificam o mesmo saldo para operações de banco que apliquem deltas atomicamente ou ajustes explícitos protegidos por versão. Não manter leituras e gravações absolutas sem controle concorrendo com o arquivamento.

Inventariar e adaptar, no mínimo:

1. Adição, remoção e mudança de quantidade de peças da OS.
2. Alternância de peça fornecida pelo cliente.
3. Cancelamento e exclusão de OS, evitando nova devolução após liberação anterior.
4. Venda de balcão e cancelamento correspondente.
5. Entradas/importações de produtos e ajustes manuais de saldo.
6. Vínculo de item pendente ao catálogo, registrando se houve ou não movimento.

Essa etapa pode exigir tocar mais arquivos do que a tela 2,5D. Se a auditoria optar por adiar essa base, o painel pode ser liberado de forma independente; o arquivamento com liberação de estoque permanece desligado até existir garantia de consistência.

Não se trata de criar um sistema completo de compras ou reservas. O objetivo é rastrear o débito aplicado e impedir que um novo fluxo devolva estoque indevido ou perca uma alteração concorrente.

### 11.4. Algoritmo de arquivamento

Executar em uma transação no banco:

1. Validar sessão, organização e cargo autorizado.
2. Adquirir controle da OS e conferir se continua em `orcamento`, com o prazo completo.
3. Reconhecer repetição pela chave de operação; a mesma solicitação não produz efeitos duas vezes.
4. Estabilizar os itens e impedir alterações concorrentes enquanto se calcula a liberação.
5. Validar vínculos impeditivos e rastreabilidade dos itens.
6. Agrupar as quantidades debitadas por produto e bloquear produtos em ordem determinística.
7. Aplicar a devolução por delta, registrar movimentos e marcar o débito aplicado de cada item como zero.
8. Gravar o evento de arquivamento e mudar o status.
9. Confirmar tudo junto; qualquer falha desfaz todos os passos.

Duplo clique, repetição de requisição após perda de resposta e duas pessoas arquivando ao mesmo tempo devem resultar em uma única devolução. Reutilizar a mesma chave de operação com conteúdo diferente deve retornar conflito.

### 11.5. OS antigas com histórico indeterminado

Não preencher `stock_debited_qty = quantity` por migração automática. Isso inventaria informação que não está provada pelos campos existentes.

Proposta para a implantação:

- Itens sem produto, serviços e peças do cliente têm regra explícita de nenhuma devolução ao estoque da loja.
- Itens antigos com débito comprovável podem ser reconciliados com evidência identificada.
- Itens antigos sem prova entram como `legacy_unknown` e impedem a confirmação do arquivamento com devolução até revisão por responsável autorizado.
- A revisão registra a quantidade que ainda está debitada ou registra zero, com autor e justificativa. Não credita saldo apenas por marcar a revisão.
- A confirmação de arquivamento usa esse resultado na mesma transação e registra o movimento correspondente.

A interface deve explicar a decisão em termos de negócio, como “Quantas unidades desta peça continuam baixadas por esta OS?”. Valores não podem vir pré-preenchidos como certeza quando são desconhecidos. Essa revisão de legado é uma proposta a ser auditada com a oficina; não pode ser escondida como detalhe técnico.

Não fazer correção retroativa de estoque em massa durante a migração. O volume desse trabalho depende da auditoria real dos dados da NHT e das demais organizações.

## 12. Vínculos financeiros, fiscais e outras pendências

O status `orcamento` não deve ser usado sozinho como prova de ausência de movimento financeiro ou fiscal.

**Regra inicial proposta, conservadora e explícita para auditoria:** impedir o arquivamento quando houver vínculo em transações, comissões ou documentos fiscais. Após verificar os estados reais usados nessas tabelas, a auditoria pode aprovar exceções para vínculos comprovadamente inativos. Estado desconhecido não será interpretado como inativo.

O arquivamento não apaga cobranças, não estorna recebimentos, não cancela comissões e não envia cancelamento à Nuvem Local Fiscal. A mensagem de impedimento deve apontar a pendência que precisa de tratamento no fluxo correspondente.

Intenção de pagamento não equivale a pagamento confirmado. Deve ser lida como dado do orçamento, sem criação ou exclusão automática de transação.

Agendamentos futuros vinculados exigem uma decisão na auditoria. Proposta inicial: avisar e impedir o arquivamento enquanto existir agendamento ativo vinculado, até o lojista decidir o destino desse compromisso. Não cancelar agendamento em silêncio.

As verificações precisam ser revalidadas na transação. Criação de vínculos financeiros/fiscais e aprovação devem usar o mesmo controle da OS ou uma proteção equivalente, para não inserir uma pendência depois da verificação e antes do arquivamento.

## 13. Autorização e proteção contra caminhos alternativos

Consulta do painel segue o acesso atual às OS da organização. Alterações devem conferir sessão válida, perfil ativo, organização da OS e permissão da operação no backend e no banco.

**Proposta de permissão para auditoria:** arquivar, desarquivar e reconciliar estoque legado apenas para `owner`, `admin` e `gerente`, com normalização dos valores reais de cargo. Funcionários mantêm a consulta conforme o acesso já existente. A decisão final deve considerar quem atualmente administra os orçamentos na oficina.

Não confiar em `actor_id`, cargo ou organização enviados pelo navegador. Derivar da identidade autenticada. Funções privilegiadas devem ter permissões mínimas, `search_path` controlado e validações explícitas. Chave administrativa não aparece no cliente.

Criar proteção no banco para impedir que `update work_orders set status = 'arquivado'` por um caminho antigo contorne as verificações de estoque. A solução escolhida na migração deve garantir que toda transição de entrada/saída de arquivado execute a operação transacional ou seja rejeitada. Um sinalizador livre enviado pelo cliente não pode liberar essa proteção.

Também bloquear no banco mutações de itens e ações incompatíveis de OS arquivada. Esconder botões não protege contra uma aba antiga ainda aberta, chamada direta à API ou cliente antigo.

O portal público continua usando o token já existente para consulta individual; o token não concede poder de desarquivar nem de liberar estoque. Uma aprovação concorrente deve ter escrita condicional/transacional em `orcamento`. Se o arquivamento vencer, aprovação falha com mensagem de contato com a oficina. Se a aprovação vencer, arquivamento falha sem devolver estoque.

## 14. Modelo de dados proposto

Os nomes abaixo são uma proposta para o auditor; não são declaração de estruturas já existentes.

| Estrutura | Alteração proposta |
| --- | --- |
| `work_orders` | Aceitar `arquivado`; registrar instante de entrada no status, origem conhecida/estimada desse instante e metadados atuais de arquivamento. |
| `work_order_status_events` | Histórico imutável de mudanças a partir da implantação, com organização, OS, origem/destino, autor, instante, origem da ação e chave de operação. |
| `work_order_archive_events` | Dados específicos do ciclo de arquivamento/desarquivamento: motivo, política aplicada, saldo liberado, reconciliação usada e referências dos movimentos. Pode ser consolidado com a tabela de eventos se o contrato continuar claro. |
| `work_order_items` | Estado de rastreamento e quantidade cujo débito continua aplicado, com restrições de consistência. |
| `product_stock_movements` | Movimentos com origem, produto, quantidade, autor e chave de deduplicação, incluindo OS e demais escritores adaptados. |
| Configuração da organização | X dias, lembretes ativos, intervalo de revisão e política de cores; reutilizar `company_settings` se a auditoria confirmar relação e permissões adequadas. |
| `work_order_archive_reminder_state` | Próxima oportunidade/última apresentação por organização e usuário, com controle de concorrência entre dispositivos. |

Usar tipos e chaves compatíveis com o banco real. Conferir FKs que comprovem organização tanto da OS quanto do produto, índices, RLS e o comportamento de exclusões. Não adicionar uma FK com cascata que apague o histórico de movimentos ao excluir um item.

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
- Operação de revisão do histórico de estoque legado, com permissão específica, evidência e auditoria.
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
| Portal de acompanhamento | Exibir aviso de orçamento arquivado e contato da oficina; sem botão de aprovação. |
| Extrato/resumo do cliente | Não tratar total de orçamento arquivado como dívida ativa; manter histórico e valores orçados. |
| Emissão fiscal | OS arquivada não deve entrar em uma nova emissão por caminhos alternativos. Documentos existentes permanecem íntegros. |
| Impressão | Rótulo “Arquivado”; preservar valores históricos, sem aparentar OS ativa. |
| Catálogo pendente | Não tratar o item arquivado como pendência operacional de baixa; impedir vínculo que altere estoque de OS arquivada. |
| Exclusão/cancelamento antigo | Não permitir segunda devolução por um fluxo legado. |

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

Confirmar decisões da seção 22. Verificar esquema instalado, constraints, RLS, cargos, índices, escritores de estoque e possibilidade de rastrear movimentos antigos. Levantar contagem de OS por organização/status/tipo, idade, vínculos e presença de produtos.

Para a NHT, obter a distribuição real das OS abertas, sem arquivar ou atualizar qualquer registro. O relatório deve diferenciar orçamento, aprovado, espera de peça, serviço e pronto, além de OS sem veículo e vínculos impeditivos.

**Saída:** plano revisado, decisões registradas e classificação do esforço de legado.

### Fase 1 — Painel visual de consulta

Criar ativos, cinco filas, consulta isolada por organização, interação de seleção, adaptação móvel e card do dashboard. Adicionar acesso no Atendimento. Essa fase pode ser demonstrada com dados autorizados sem criar o status arquivado ainda.

**Saída:** visualização útil e revisável, incluindo casos vazios, muitas OS, seleção e navegação móvel.

### Fase 2 — Base de status e estoque

Preparar migração aditiva, registro de início de status, eventos e rastreamento de débito. Adaptar os escritores de saldo que concorrem com as OS. Implementar proteção de OS arquivada e compatibilidade nas telas existentes antes de habilitar a primeira transição para o novo status.

**Saída:** garantias transacionais e tratamento do legado validados em ambiente isolado.

### Fase 3 — Arquivar/desarquivar e lembretes

Implementar revisão, prévia, validação, ações idempotentes e cadência persistida de lembrete. Ajustar portal, listas, agendas, totais e permissões. Só liberar essa fase quando a política de estoque histórico estiver resolvida.

**Saída:** arquivamento manual completo e reversível, sem devolução duplicada de estoque.

### Fase 4 — Piloto e liberação gradual

Ativar primeiro a consulta visual para uma organização piloto. Depois habilitar a revisão e arquivamento para responsáveis escolhidos, acompanhando conflitos e movimentos. Não executar arquivamento em massa nem correção silenciosa de saldos no piloto.

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
| Arquivar antes de X | Backend rejeita conforme a política inicial proposta. |
| Lembrete repetido em abas/aparelhos | Persistência evita exibição multiplicada na mesma oportunidade. |
| Aplicativo fechado por uma semana | Não afirmar que houve notificação; apresentar revisão na próxima oportunidade de uso. |
| Arquivar sem peças | Muda status e registra evento sem movimento de produto. |
| Peça com baixa conhecida | Devolve exatamente o débito ainda aplicado, não a quantidade presumida. |
| Peça sem baixa/serviço/peça do cliente | Nenhum crédito ao estoque. |
| Quantidade editada | Liberação corresponde ao débito rastreado depois da edição, não a um número desatualizado. |
| Item legado desconhecido | Exige revisão; não cria estoque pela migração ou por padrão de formulário. |
| Duplo clique/repetição após timeout | Uma transição e uma devolução. |
| Duas pessoas arquivam juntas | Uma operação efetiva; a outra recebe resultado consistente. |
| Aprovação concorre com arquivamento | Somente uma transição vence; nunca aprovar uma OS cujo estoque já foi liberado. |
| Venda/entrada concorre pelo mesmo produto | Saldo final incorpora todos os deltas sem sobrescrita perdida. |
| Falha no último item | Nenhum saldo, evento ou status parcial. |
| Desarquivar com saldo disponível | Reaplica somente o liberado, uma vez, e retorna a orçamento. |
| Desarquivar sem saldo | Nenhuma reativação ou baixa parcial. |
| Arquivar/desarquivar/arquivar | Cada ciclo tem rastreio próprio, com saldo final correto. |
| Chamada direta alterando status/itens | Não contorna regras transacionais e estado arquivado. |
| Outra organização/perfil inativo | Sem acesso à leitura ou à mutação indevida. |
| Usuário sem permissão | Consulta segue a política; ações administrativas são rejeitadas no servidor. |
| Vínculo financeiro/fiscal ativo ou não classificado | Arquivamento impedido conforme regra auditada, sem exclusão ou cancelamento automático. |
| Portal e extrato | Arquivada consultável, sem aceite ativo e sem inflar dívida/pendência operacional. |
| Cancelar/excluir arquivada por tela antiga | Não provoca nova devolução de produto. |
| Falha de rede | Estado não é confirmado como sucesso; repetir não duplica efeito. |
| Celular/tablet/teclado | Cinco filas utilizáveis, foco correto, fechar e voltar mantêm contexto. |

Executar verificação de tipos/build e checagens existentes adequadas após as alterações. Verificações que escrevem banco usarão dados de teste e ambiente separado. Não usar emissão fiscal de produção como mecanismo de teste.

## 21. Implantação, observação e reversão

1. Confirmar backup e estratégia de migração conforme o processo real do projeto.
2. Publicar primeiro a compatibilidade com `arquivado` e as proteções, mantendo a ação desabilitada.
3. Aplicar migração revisada no ambiente de validação, com permissões e concorrência verificadas.
4. Preparar migração remota separada e revisar seu efeito; não misturar reparo de dados antigos com mudança estrutural.
5. Ativar consulta visual no piloto e confirmar contagens contra consulta equivalente.
6. Ativar arquivamento para o piloto após aprovação dos critérios de estoque e legado.
7. Observar eventos, conflitos, bloqueios, falhas de transação e duração das consultas; registrar IDs e autor sem expor tokens ou dados desnecessários de clientes.

Se houver problema, desligar novas ações de arquivar/desarquivar e manter os registros legíveis. Não restaurar em massa status antigos, não somar/subtrair estoque novamente por um rollback genérico e não remover o histórico de movimentos.

Uma reversão de código precisa continuar entendendo `arquivado`. Retornar a uma versão que trata esse status como editável pode reabrir os caminhos de devolução duplicada; portanto, manter uma camada compatível e os guardas no banco durante a reversão.

## 22. Decisões pendentes e pauta para auditoria

| ID | Decisão a fechar | Proposta inicial / pergunta de auditoria |
| --- | --- | --- |
| D01 | X dias em orçamento | Avaliar 30 dias como padrão inicial; valor por organização. |
| D02 | Cadência | Avaliar intervalo de 3 dias por usuário autorizado; alternativa de dias fixos semanais. |
| D03 | Faixas de cor | Aprovar limites e legenda de idade total da OS. |
| D04 | Cargos | Confirmar quem pode arquivar, desarquivar e revisar estoque legado. |
| D05 | Data de orçamento antigo | Aceitar `created_at` como estimativa identificada ou começar em outra referência comprovável. |
| D06 | Estoque legado | Aprovar bloqueio até revisão explícita, evidências aceitas e responsável pela reconciliação. |
| D07 | Escritores de estoque | Confirmar todos os fluxos que gravam saldo e o mecanismo comum de concorrência. Sem isso, liberação automática de estoque não é segura. |
| D08 | Falta de estoque ao desarquivar | Aprovar bloqueio integral e tratamento da OS sem reaplicar baixa indevida. |
| D09 | Vínculos financeiros/fiscais | Definir exceções documentadas à regra inicial de bloquear qualquer vínculo. |
| D10 | Agenda futura | Confirmar impedimento/revisão quando houver agendamento ativo vinculado. |
| D11 | Escopo de OS sem veículo | Manter arquivamento inicial só para OS com veículo ou ampliar também para orçamentos de bancada. Essa ampliação não criará carros artificiais. |
| D12 | Nome da tela | Confirmar “Fluxo visual”, evitando interpretar “Pátio” como localização física obrigatória. |
| D13 | Ordenação e paginação | Confirmar mais antigas primeiro, tamanho de página e busca. |
| D14 | Política comercial de estoque | Confirmar que a seleção no orçamento continuará baixando estoque quando o fluxo assim solicitar; separar de uma futura mudança para reservar só após aprovação. |
| D15 | Prévia estática | Confirmar miniatura ilustrativa com contador real, em vez de uma segunda miniatura dinâmica de todas as OS. |
| D16 | Cancelamento/exclusão | Aprovar bloqueio da exclusão de arquivadas e adaptação dos fluxos que hoje devolvem todas as peças sem rastreio. |

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

**Condição para iniciar a escrita de arquivamento:** resolver D04, D06, D07, D08 e D09 e provar os invariantes de estoque e concorrência. As demais decisões de produto também precisam ser fechadas antes de publicar a experiência final. O painel de consulta pode evoluir enquanto a base de arquivamento é auditada.

## 23. Esforço estimado após esta ampliação de escopo

As estimativas iniciais da conversa cobriam a representação visual simplificada. O pacote atual inclui novo status, lembretes persistidos, portal, permissões, retomada e liberação segura de estoque, inclusive situações legadas.

| Bloco | Ordem de grandeza proposta |
| --- | --- |
| Ativos, cinco filas, seleção, celular e entradas | 2 a 4 dias de desenvolvimento |
| Rastreio e adequação dos fluxos de estoque concorrentes | 3 a 6 dias |
| Arquivar/desarquivar, lembretes e integração das superfícies | 2 a 4 dias |
| Validação integrada, ajustes e piloto | 1 a 2 dias |

Faixa total inicial: **8 a 16 dias de desenvolvimento de uma pessoa familiarizada com o projeto**, antes de medir o trabalho de reconciliação manual de legado. Os blocos podem compartilhar atividades; a faixa não é um cronograma fechado. Esquema remoto diferente, escritores de estoque adicionais ou histórico indeterminado podem alterar o esforço.

A auditoria deve poder optar por liberar primeiro o painel visual e depois o arquivamento, sem que a tela de consulta dependa de uma correção de estoque ainda não comprovada.

## 24. Resultado esperado da auditoria

Para cada achado, registrar severidade, seção do plano, evidência do código/esquema, cenário de falha e ajuste recomendado. Separar bloqueios de consistência dos refinamentos visuais. Não considerar o plano aprovado apenas porque a tela foi demonstrada.

O plano estará pronto para implementação quando as decisões pendentes estiverem registradas, o escopo de estoque for verificável, os caminhos alternativos para status arquivado estiverem protegidos e houver uma sequência de implantação que preserve dados e histórico.
