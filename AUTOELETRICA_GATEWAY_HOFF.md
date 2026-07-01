# Integracao Autoeletrica -> Gateway de Cobranca

## Contexto

Este repo `integracao-asaas` virou o gateway central de controle manual de mensalidades por loja.

O repo `autoeletrica` precisa consumir esse gateway para:

- consultar o status financeiro da loja atual
- reagir a `ativo`, `pendente`, `bloqueado`, `liberado` e `vip`
- preservar acesso a dados antigos
- bloquear apenas novas operacoes quando a loja estiver inadimplente fora da carencia

## Observacao importante sobre contexto

Neste contexto atual da IA, o workspace com escrita esta em:

- `G:\projetos\integracao-asaas`

Entao este contexto serve para:

- documentar o contrato
- validar o banco do gateway
- definir payloads e regras

Mas para editar o repo `G:\projetos\autoeletrica` com seguranca, o ideal e abrir um novo contexto diretamente naquele repo.

## Objetivo da integracao no Autoeletrica

O `autoeletrica` deve enviar o identificador da loja atual para o gateway e obter o status financeiro daquela loja.

No `autoeletrica`, a loja corresponde ao `organization_id`.

Esse valor deve ser enviado como `storeId` no contrato do gateway.

## Mapeamento de dados

### Origem no Autoeletrica

- `organization_id` ou `organizations.id`: ID real da loja
- `organizations.name`: nome basico da loja
- `company_settings.nome_fantasia`: nome mais amigavel para exibir e sincronizar
- `company_settings.razao_social`: nome juridico
- `company_settings.cnpj`: documento da loja

### Destino no Gateway

- `store_id`: UUID da loja no `autoeletrica`
- `store_name`: preferencialmente `company_settings.nome_fantasia`
- `store_document`: preferencialmente `company_settings.cnpj`

## Programa cadastrado no gateway

Hoje o programa ja existente no gateway e:

- `client_key`: `autoeletrica`

Esse programa precisa usar:

- header `x-client-key`
- header `x-client-secret`

O segredo real deve ser o mesmo cadastrado no gateway.

## Endpoint principal para consulta de status

### Requisicao

`GET /api/stores/[storeId]/status`

Exemplo:

```http
GET /api/stores/a60e0d8b-e045-467e-9bcb-9dc463639589/status HTTP/1.1
x-client-key: autoeletrica
x-client-secret: SEU_SEGREDO_REAL
```

### Resposta esperada quando a loja existe

```json
{
  "store": {
    "id": "1871e734-4434-4857-9c63-135cfd31b4bd",
    "client_id": "fd817a2e-aa3e-4761-9efe-3e19b56c9e09",
    "store_id": "a60e0d8b-e045-467e-9bcb-9dc463639589",
    "store_name": "Teste",
    "store_document": "12.345.678/0001-90",
    "monthly_amount": 150,
    "paid_until": "2026-08-01",
    "grace_days": 15,
    "is_vip": false,
    "manual_release_until": null,
    "notes": null,
    "active": true,
    "created_at": "2026-07-01T16:50:00.32169+00:00",
    "updated_at": "2026-07-01T16:51:07.198834+00:00"
  },
  "status": "ativo",
  "effectiveAccessUntil": "2026-08-01",
  "overdueSince": null,
  "blockAfter": "2026-08-16",
  "daysPastDue": 0,
  "shouldShowBillingReminder": false,
  "shouldBlockNewOperations": false,
  "blockScope": "none"
}
```

## Resposta quando a loja nao existe no gateway

Hoje o endpoint responde `404` com este formato:

```json
{
  "status": "bloqueado",
  "reason": "store_not_registered",
  "shouldShowBillingReminder": false,
  "shouldBlockNewOperations": true,
  "blockScope": "new_operations_only"
}
```

## Significado dos status

### `ativo`

Loja paga normalmente.

- sem bloqueio
- sem aviso obrigatorio

### `pendente`

Loja vencida, mas ainda dentro da carencia.

- pode exibir lembrete
- nao bloqueia novas operacoes

### `bloqueado`

Loja vencida e fora da carencia.

- bloquear apenas novas operacoes
- nao esconder historico, dados antigos ou relatorios antigos

### `liberado`

Excecao manual temporaria.

- sem bloqueio enquanto a data de liberacao estiver valida

### `vip`

Loja parceira fora da regua de cobranca.

- sem lembrete
- sem bloqueio

## Comportamento esperado no Autoeletrica

Quando o `autoeletrica` consultar o gateway:

### Se `status = ativo`

- sistema segue normal

### Se `status = vip`

- sistema segue normal

### Se `status = liberado`

- sistema segue normal
- opcionalmente pode mostrar aviso discreto informando liberacao temporaria

### Se `status = pendente`

- mostrar banner ou aviso de mensalidade
- nao bloquear criacao de OS, vendas ou demais operacoes

### Se `status = bloqueado`

- bloquear novas operacoes
- permitir consulta de dados antigos
- permitir relatorios antigos
- permitir navegacao em telas historicas

## Regra importante de bloqueio

O gateway foi desenhado para retornar:

- `shouldBlockNewOperations: true`
- `blockScope: "new_operations_only"`

O `autoeletrica` nao deve interpretar isso como:

- logout forcado
- erro geral no sistema
- bloqueio total da interface

A ideia e um bloqueio operacional, nao um apagao do sistema.

## Sugestao de pontos de integracao no Autoeletrica

O `organization_id` ja aparece em varios pontos no repo `autoeletrica`.

A integracao deve ficar perto do carregamento da loja logada ou do tenant atual.

Fluxo sugerido:

1. identificar `organization_id` da sessao atual
2. chamar o gateway com esse UUID
3. guardar o retorno num estado global, contexto ou carregamento comum do tenant
4. distribuir esse status para:
   - dashboard
   - criacao de OS
   - criacao de venda
   - qualquer outra acao que representa "nova operacao"

## Endpoint para sincronizar cadastro da loja no gateway

O gateway tambem ja suporta cadastro ou atualizacao da loja:

`POST /api/stores`

### Headers

```http
x-client-key: autoeletrica
x-client-secret: SEU_SEGREDO_REAL
Content-Type: application/json
```

### Payload recomendado para o Autoeletrica

```json
{
  "storeId": "a60e0d8b-e045-467e-9bcb-9dc463639589",
  "storeName": "Oficina Teste Auto",
  "storeDocument": "12.345.678/0001-90",
  "active": true
}
```

### Campos opcionais que o Autoeletrica pode mandar

```json
{
  "storeId": "a60e0d8b-e045-467e-9bcb-9dc463639589",
  "storeName": "Oficina Teste Auto",
  "storeDocument": "12.345.678/0001-90",
  "active": true,
  "notes": "Sincronizado automaticamente pelo Autoeletrica"
}
```

## Quando sincronizar

O ideal e nao depender de cadastro manual no gateway.

Sugestoes:

1. sincronizar quando uma loja for criada no `autoeletrica`
2. sincronizar quando nome fantasia ou CNPJ forem alterados
3. opcionalmente sincronizar no login da loja, se ainda nao existir no gateway

## Payload completo aceito hoje pelo gateway em `POST /api/stores`

```json
{
  "storeId": "uuid-da-loja",
  "storeName": "Nome da loja",
  "storeDocument": "12.345.678/0001-90",
  "monthlyAmount": 150,
  "paidUntil": "2026-08-01",
  "graceDays": 15,
  "isVip": false,
  "manualReleaseUntil": null,
  "paymentQrCode": null,
  "paymentCopyPaste": null,
  "notes": "observacao opcional",
  "active": true
}
```

## Campos que o Autoeletrica provavelmente NAO deve controlar

Estes campos pertencem mais ao gateway/admin do que ao programa cliente:

- `monthlyAmount`
- `paidUntil`
- `graceDays`
- `isVip`
- `manualReleaseUntil`

O `autoeletrica` deve preferir sincronizar apenas identidade da loja:

- `storeId`
- `storeName`
- `storeDocument`
- `active`

## Resposta de `POST /api/stores`

O gateway retorna o snapshot completo calculado.

Exemplo:

```json
{
  "store": {
    "id": "uuid-interno-do-gateway",
    "client_id": "uuid-do-programa",
    "store_id": "uuid-da-loja-no-autoeletrica",
    "store_name": "Oficina Teste Auto",
    "store_document": "12.345.678/0001-90",
    "monthly_amount": 150,
    "paid_until": "2026-08-01",
    "grace_days": 15,
    "is_vip": false,
    "manual_release_until": null,
    "notes": null,
    "active": true
  },
  "status": "ativo",
  "effectiveAccessUntil": "2026-08-01",
  "overdueSince": null,
  "blockAfter": "2026-08-16",
  "daysPastDue": 0,
  "shouldShowBillingReminder": false,
  "shouldBlockNewOperations": false,
  "blockScope": "none"
}
```

## Recomendacao de implementacao no Autoeletrica

### Fase 1

- consultar `GET /api/stores/[storeId]/status`
- exibir status na interface
- bloquear novas operacoes quando `shouldBlockNewOperations = true`

### Fase 2

- sincronizar `storeName` e `storeDocument` automaticamente via `POST /api/stores`

### Fase 3

- melhorar UX de aviso para `pendente`

## Dados de teste ja confirmados

Loja teste validada na origem `autoeletrica`:

- `organization_id`: `a60e0d8b-e045-467e-9bcb-9dc463639589`
- `organizations.name`: `teste`
- `company_settings.nome_fantasia`: `Oficina Teste Auto`
- `company_settings.razao_social`: `Oficina Teste Auto Eletrica LTDA`
- `company_settings.cnpj`: `12.345.678/0001-90`

No gateway, essa loja ja existe, mas ainda com nome manual simplificado:

- `store_name`: `Teste`
- `store_document`: `null`

## Recomendacao final

Abrir um novo contexto diretamente no repo:

- `G:\projetos\autoeletrica`

E usar este arquivo como handoff para implementar:

1. cliente HTTP do gateway
2. consulta de status por `organization_id`
3. bloqueio de novas operacoes
4. sincronizacao automatica de `storeName` e `storeDocument`
