# Prompt — auditoria independente do plano de fluxo visual e arquivamento

Atue como auditor independente de arquitetura, regras de negócio, integridade de dados e experiência de uso deste projeto.

Seu trabalho é avaliar criticamente o plano em `docs/PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md`, confrontando as propostas com o código atual. A implementação descrita ainda não foi iniciada: audite a viabilidade e a segurança do plano antes de sua execução, sem presumir que as funcionalidades propostas já existam.

Workspace: `G:\projetos\autoeletrica`.

Entregue o relatório em `docs/AUDITORIA_PLANO_FLUXO_VISUAL_2_5D_E_ARQUIVAMENTO_OS.md` e apresente os achados mais importantes na resposta final.

## 1. Escopo e forma de trabalho

- Leia `AGENTS.md` e o plano completo. Antes de analisar integrações ou código fiscal, leia também `CONTEXTO_NUVEM_LOCAL_FISCAL.md` e respeite a arquitetura da Nuvem Local Fiscal.
- Use o plano como objeto da auditoria, não como prova de que suas afirmações sobre o código estão corretas. Confira as evidências por conta própria.
- Não implemente funcionalidades, não altere o plano original e não aplique correções. A única escrita autorizada nesta tarefa é o relatório de auditoria.
- Não aplique migrações, não altere configurações, não faça deploy e não execute scripts que escrevam dados. Verificações locais devem ser somente de leitura ou isoladas de dados reais.
- Não exponha credenciais nem dados pessoais no relatório. Se houver acesso ao banco explicitamente autorizado para leitura, restrinja-se ao esquema e aos agregados necessários. Sem esse acesso, registre a limitação e não trate arquivos locais como confirmação do estado remoto.
- Não atribua ao banco os 69 registros abertos da NHT como um fato verificado por você: esse número foi informado pelo usuário. Contagem por status, estoque debitado e presença de veículos continuam sem comprovação até consulta apropriada.
- Diferencie requisito do usuário, proposta do autor do plano, fato do código, hipótese e informação ainda não verificável.

## 2. Requisitos do usuário que devem orientar a auditoria

O produto pretende representar o fluxo de OS, mesmo quando o carro está com o cliente. O painel não depende de box, vaga ou presença física.

Haverá cinco filas por status: Orçamento/aguardando aprovação, Aprovado, Aguardando peça, Em serviço e Pronto. Os carros podem ser todos iguais, genéricos e com acabamento 2,5D. A cor indica tempo da OS e não pintura real ou status. Ao selecionar, o carro ganha destaque, o restante perde foco e os dados recebem mais espaço. A experiência deve funcionar em celular e tablet.

Dashboard e Atendimento terão acesso à mesma tela. O dashboard terá um card como uma janela que recorta uma cena maior, usando desenho pré-renderizado e alguns carros ilustrativos.

Será criado o status `arquivado`, sem representação gráfica. Não criar o status `recusado`. O lojista decide arquivar: após X dias em `orcamento`, a opção é sugerida periodicamente, duas ou mais vezes por semana de uso. Isso não depende do envio do orçamento, pois a negociação pode acontecer pessoalmente.

O histórico deve continuar consultável. A ideia discutida inclui liberar as quantidades de estoque efetivamente baixadas e conferir estoque ao desarquivar. Não interpretar produto selecionado como prova automática de débito.

Os valores de X, as cores/faixas de idade, os cargos autorizados, o intervalo exato do lembrete e as demais decisões D01–D16 do plano são propostas pendentes, não aprovações já dadas pelo usuário.

## 3. Pergunta central

O plano permite entregar o efeito visual desejado e o arquivamento de orçamentos com um escopo proporcional, sem criar estoque, perder movimentos concorrentes, permitir transições indevidas ou esconder pendências reais?

Avalie separadamente a possibilidade de liberar o painel de consulta e a possibilidade de habilitar arquivamento/desarquivamento com efeitos em estoque. Um bloqueio em um desses blocos não implica automaticamente bloquear o outro.

## 4. Investigações obrigatórias

### A. Fidelidade ao produto e simplicidade

- O plano mantém cinco filas, cor por tempo e representação de OS que podem estar fora da oficina?
- Os dois relógios propostos — idade total e período contínuo em orçamento — estão claros, justificáveis e implementáveis com os dados existentes?
- As decisões técnicas ou de interface introduzem restrições de negócio que o usuário ainda não aprovou?
- O tratamento de bancada, vendas sem veículo, várias OS para a mesma placa e status desconhecidos é coerente?
- A prévia estática do dashboard pode induzir interpretação falsa de contagem ou situação atual?
- O efeito de seleção, a leitura das filas e a navegação no celular são plausíveis sem engine 3D ou peso excessivo?
- Existe complexidade desnecessária? Proponha redução de escopo quando ela preservar os requisitos e a integridade dos dados.

### B. Estoque e histórico legado

Localize os escritores reais de estoque; não se limite à lista do documento. Examine adição de peças, edição de quantidade, remoção, peça do cliente, cadastro rápido sem baixa, resolução de catálogo, cancelamento/exclusão de OS, venda de balcão, cancelamento de recibo, importação/entrada e ajuste manual.

Confira se o plano consegue distinguir quantidade orçada, débito aplicado e quantidade já devolvida. Verifique se existe rastreamento ou movimentação instalada que possa ser reaproveitada antes de recomendar novas tabelas.

Analise estes cenários concretos:

1. Produto adicionado com e sem baixa.
2. Item que teve quantidade alterada após a inclusão.
3. Serviço e peça trazida pelo cliente.
4. Mesmo produto em mais de uma linha e em várias OS.
5. Estoque inicialmente negativo e quantidades fracionadas, se admitidos pelo sistema.
6. Produto excluído, inativo ou com vínculo de organização incorreto.
7. Arquivar, repetir a chamada, desarquivar e arquivar novamente.
8. Excluir ou cancelar por uma tela antiga depois de arquivar.
9. Legado sem prova da baixa, inclusive o risco de criar estoque ao assumir `quantity` como débito.

Julgue se a reconciliação manual proposta tem base suficiente para não registrar uma estimativa como fato. Indique o conjunto mínimo de evidências, restrições e registros necessários. Não sugira corrigir saldos antigos por suposição.

### C. Transações, concorrência e caminhos alternativos

Avalie atomicidade, ordem dos bloqueios, deduplicação por chave de operação, controle de versão da prévia e rollback integral.

Descreva o que acontece quando:

- Duas pessoas arquivam a mesma OS.
- O servidor confirma, a resposta se perde e o cliente repete.
- Uma pessoa edita o item enquanto outra arquiva.
- O cliente aprova pelo portal enquanto o lojista arquiva.
- Uma venda, entrada ou ajuste altera o mesmo produto durante a devolução.
- Um vínculo financeiro/fiscal é criado depois da verificação e antes da mudança de status.
- Uma aba ou integração antiga tenta atualizar diretamente o status, itens ou saldo.

Confira se bloquear linhas somente na nova função seria suficiente diante dos escritores antigos. Avalie concretamente como impedir bypass por DML direto, políticas permissivas ou sinalizadores controlados pelo cliente. Não aceite “usar transação” como explicação completa sem demonstrar quais recursos participam dela e como as demais escritas cooperam.

### D. Autorização e isolamento de organização

Confira autenticação, perfil ativo, cargos reais, limites de visualização de dados financeiros, `organization_id`, RLS, FKs e uso de clientes administrativos. Avalie separadamente leitura, arquivamento, desarquivamento e reconciliação de legado.

Valide que token público do portal, parâmetros do navegador e chamadas diretas não possam liberar estoque ou reativar OS. Considere funções privilegiadas e permissões do banco, além dos botões da interface.

### E. Efeitos nas telas e integrações existentes

Procure todas as regras de “aberta”, “não cancelada”, “finalizada” e “editável” que possam interpretar `arquivado` incorretamente. Examine listas, leitura de placa, dashboard/entregas, histórico do cliente, portal, extrato, impressão, comissões, agenda, emissão e funções de reabertura.

Verifique se a proposta de bloquear vínculos financeiros/fiscais e agendamentos ativos é necessária e proporcional. Separe bloqueio técnico obrigatório de decisão de negócio ainda pendente. Não presuma que arquivar deva estornar valores, cancelar documentos ou apagar compromissos.

Confirme que desarquivar orçamento tem semântica distinta da reabertura de OS entregue já existente.

### F. Lembretes e datas

Avalie X dias contínuos em orçamento, a aproximação para registros antigos e o efeito de alterações ou retorno ao status. Verifique fuso, fronteiras das faixas de cor, data futura/inválida e relógio do servidor.

Julgue se a cadência proposta atende “duas ou mais vezes por semana” nas condições reais de uso, sem prometer notificação quando o sistema está fechado. Examine persistência entre aparelhos, múltiplas abas, usuários diferentes, ausência de candidatos e adiamento.

### G. Migração, desempenho, validação e reversão

Confira a convenção real de migrações e as diferenças entre o esquema local e o instalado. Avalie índices, paginação independente, contagens, consistência com filtros, carregamento dos ativos e custo de blur/animação em celular/tablet.

Avalie a sequência de publicar compatibilidade antes de aceitar `arquivado`, os controles independentes de ativação e a reversão sem novo movimento de estoque. Identifique como clientes antigos serão protegidos.

Revise a matriz de validação: os cenários demonstram os invariantes ou apenas repetem a implementação? Indique testes de integração/concorrência realmente necessários e evidências que ainda faltam. Avalie também se a estimativa de esforço corresponde à quantidade de fluxos afetados.

## 5. Padrão de evidência dos achados

Cada achado deve conter:

- Identificador e título objetivo.
- Prioridade: P0 (corrupção/acesso indevido de alto impacto), P1 (bloqueia habilitação segura do bloco afetado), P2 (risco relevante corrigível) ou P3 (refinamento).
- Natureza: defeito atual, risco introduzido pelo plano, contradição, decisão de produto ou limitação de evidência.
- Seção do plano e caminho/linha do código que sustentam a conclusão. Quando possível, cite o trecho mínimo necessário.
- Cenário concreto: estado inicial, sequência de ações e resultado incorreto ou indeterminado.
- Efeito para usuário/dados e correção mínima recomendada.
- Bloco afetado: painel de consulta, arquivamento, estoque, legado ou implantação.
- Grau de confiança e o que precisa ser confirmado.

Não apresente uma possibilidade genérica como falha comprovada. Não trate uma decisão D01–D16 ainda aberta como bug automaticamente: explique qual etapa fica impedida enquanto ela estiver aberta. Não invente achados para preencher categorias ou atingir uma quantidade.

## 6. Formato do relatório

1. **Parecer inicial:** prontidão separada do painel e do arquivamento, com os bloqueios relevantes.
2. **Achados por prioridade:** evidências e cenários conforme o padrão acima, antes de sugestões cosméticas.
3. **Mapa de cobertura:** áreas investigadas, arquivos consultados e limitações, incluindo o que não foi possível validar no banco.
4. **Decisões D01–D16:** para cada uma, recomendar caminho, registrar se é decisão de negócio ou requisito técnico e apontar o que permanece aberto.
5. **Escopo mínimo seguro:** ajustes indispensáveis ao recurso e problemas preexistentes que podem ficar fora, com justificativa. Avaliar se o plano está ampliando demais uma implementação simples.
6. **Plano de correção do documento:** mudanças propostas por seção, sem editar o original.
7. **Critérios para liberar:** provas concretas necessárias para iniciar/habilitar cada bloco e avaliação da sequência de implantação/reversão.
8. **Parecer final:** “apto”, “apto com condições” ou “requer revisão”, por bloco, sem pressupor autorização para implementar.

Se não encontrar falhas em determinada área, diga que não encontrou com base no material inspecionado. Não transforme ausência de evidência em garantia. O resultado deve permitir ao usuário decidir o que corrigir no plano antes de iniciar a implementação.
