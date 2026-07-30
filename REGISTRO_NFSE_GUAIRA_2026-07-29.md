# Registro — NFS-e Guaíra, 29/07/2026

## Caso tratado

- Emitente: Norberto Hitoshi Tajiri Ltda. (Guaíra/PR).
- Tomador: Riedi Comércio de Veículos Ltda. (Palotina/PR).
- OS: `889`.
- NFS-e municipal: `234`, série `1`.
- Número interno exibido pela Autoelétrica: `240`.
- Documento no Nuvem Local Fiscal: `doc_a4372282`.

## Problemas identificados

### Município do tomador incorreto no PDF

O cadastro e o payload da NFS-e continham corretamente Palotina (`IBGE 4117909`) para o tomador. O erro era exclusivo da geração do PDF no Nuvem Local Fiscal: o conversor de município conhecia somente Guaíra e Toledo e, para um código desconhecido, usava o município do emitente como alternativa. Por isso o PDF mostrava Guaíra para o tomador.

### Falso erro no cancelamento

Na primeira solicitação de cancelamento, a prefeitura recebeu/processou o pedido, mas o Nuvem Local não conseguiu interpretar a resposta IPM porque o XML tinha declaração XML fora da posição esperada. O resultado foi tratado como falha e o status local permaneceu autorizado.

Nas tentativas posteriores, a IPM respondeu código `117` (NFS-e já cancelada). Essa resposta também era classificada como erro, embora confirme que não há nova ação a executar. A Autoelétrica ainda descartava a mensagem principal retornada pela API e mostrava o texto genérico “Erro ao cancelar nota.”.

## Evidência da prefeitura

O XML oficial baixado no portal da Prefeitura de Guaíra (`NFSE_234_324743_1_1.xml`) informa:

- `situacao_codigo_nfse = 2`
- `situacao_descricao_nfse = Cancelada`

Esse arquivo é evidência local e não deve ser versionado nem conter credenciais.

## Correções implementadas e implantadas

### Nuvem Local Fiscal

Commit implantado: `b08f047` — correção do município do tomador no PDF.

- Incluída a conversão do IBGE `4117909` para Palotina.
- O PDF passa a priorizar a cidade recebida no tomador.
- Para códigos ainda não mapeados, deixa de usar Guaíra como fallback e apresenta o código IBGE, evitando informação fiscal incorreta.

Commit implantado: `fbf362b` — reconciliação de cancelamentos IPM ambíguos.

- Normalização de BOM, conteúdo antes da declaração XML e declarações XML duplicadas na resposta IPM.
- Código IPM `117` passa a ser reconhecido como cancelamento já confirmado.
- Se houver resposta municipal mas falhar a leitura, o documento fica em processamento e é consultado antes de retornar falha definitiva.

O serviço no VPS foi atualizado e validado pela rota de prontidão.

### Autoelétrica

Commit enviado: `9f4a5bc` — tratamento de cancelamentos confirmados ou em processamento.

- A ação de cancelamento lê a mensagem efetivamente retornada pela API.
- `117` e estados cancelados são sincronizados como `cancelled`.
- Estados em processamento deixam a nota como `processing`, com mensagem apropriada, em vez de erro genérico.

## Reconciliação manual realizada

Não foi reenviado pedido de cancelamento à prefeitura.

1. Foi executada uma consulta municipal do documento `doc_a4372282` pelo Nuvem Local já corrigido.
2. O Nuvem Local persistiu o documento como `cancelado`, com status municipal `2`.
3. A nota interna `240` foi atualizada para `cancelled`.
4. O XML oficial da prefeitura foi preservado no campo XML da nota interna.
5. A OS `889` permaneceu `entregue`, com um serviço, e voltou a ficar elegível para uma nova NFS-e: os bloqueios consideram apenas notas `draft`, `processing` ou `authorized`; notas `cancelled` não bloqueiam emissão.

## Verificação final

- Nuvem Local: `doc_a4372282` em `cancelado`.
- Autoelétrica: nota interna `240` em `cancelled`.
- OS `889`: apta a aparecer novamente na lista de emissão de NFS-e após atualização da tela.
