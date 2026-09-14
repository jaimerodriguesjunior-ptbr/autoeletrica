# Plano — abertura da tela + pausa nas consultas de cobrança

**Produção:** mudanças pequenas e reversíveis. Sem mover venda para o servidor, sem webhook, sem emissão fiscal, sem cartão 3x.

Duas frentes, só o que combinamos no começo:

1. A tela abrir mais rápido (SW, auth, dashboard).
2. **Persistir a data de vencimento da mensalidade** na Autoelétrica e **parar de consultar o gateway** fora da janela crítica. Um **cron diário** atualiza essa data (VIP, pagamento adiantado, correção no painel).

---

## Frente A — abertura (sem banco novo)

| O quê | Arquivo | Por quê |
|---|---|---|
| SW não intercepta GET; limpa cache velho | `public/sw.js`, `PwaRegistration.tsx` | Hard refresh depois de deploy |
| Um fetch de perfil; loading visível; unsubscribe real | `AuthContext.tsx`, layout admin | Tela bege + perfil 2× |
| Dashboard em paralelo + `.eq('organization_id')` | `dashboard/page.tsx` | 4 queries em série |

Atendimento (lista de OS) **não mexe**. Na DOM já era rápido.

---

## Frente B — a ideia da data (migração mínima)

### O que você pediu

O vencimento existe no programa de integração (`paid_until`) e **não** na Autoelétrica. Por isso o app pergunta o gateway **em toda entrada de tela**.

Persistir essa data no BD da loja. Fora das janelas abaixo, o sistema **não busca**. No resto do mês, um cron **uma vez por dia**.

### Migração

Uma tabela (ou 3 colunas em `company_settings`, o que for mais simples no PR):

- `organization_id`
- `paid_until` (date, o vencimento)
- `last_synced_at` (quando o cron ou a janela atualizou)

Só isso. Sem QR, sem PIX, sem histórico Asaas.

### Duas janelas (não misturar)

O gateway **nunca bloqueia OS/venda/nota antes da tolerância**. Na prática o bloqueio só pode existir **depois** do vencimento. Por isso **não** adianta o guard perguntar o gateway 3 dias *antes* de vencer — nessa hora o bloqueio é impossível.

**A) Aviso / QR (banner do owner)** — se ainda quisermos lembrar de pagar:

- Pode começar **3 dias antes** de `paid_until`.
- GET só para montar QR/Pix (não grava QR no BD).
- Não trava lista de OS nem emissão.

**B) Bloqueio (o que pesa na OS e na nota)** — criar OS, venda, abrir `/fiscal` / emitir:

- **Zero GET** enquanto `hoje < paid_until + 10 dias`.
- A data local basta: ainda está na tolerância → **não bloqueia**.
- Consulta ao gateway **só a partir do 10º dia após o vencimento**, e segue até o cron/GET trazer um `paid_until` novo (pagou).
- Constante: **10 dias** (o que você definiu). Não usar os 3 dias do banner aqui.

Hoje `useBillingEmissionBlock` chama `/api/cobranca/guard` **sempre** que a tela fiscal abre e a lista espera (`billingLoading`). Com a regra B, no meio do mês e nos primeiros 10 dias de atraso isso some.

### Fora das janelas

- Trocar de tela no meio do ciclo pago: **zero** `/api/cobranca/status`.
- Abrir fiscal / criar OS / emitir: **zero** `/api/cobranca/guard` até `paid_until + 10 dias`.

### Cron diário (a rede de segurança que eu falei)

Uma vez por dia, por loja: um GET no gateway, grava `paid_until` + `last_synced_at`.

Serve para:

- Cliente **pagou adiantado** (a data local ainda é a antiga; no dia seguinte o cron puxa a nova e o guard nem chega nos +10 dias).
- Loja marcada **VIP** ou data corrigida no painel.

Não substitui a janela. Não roda a cada tela. Atraso máximo desses casos: **até 24 h**, não 1,5 s por clique.

Se não quiser Vercel Cron no primeiro PR: a **primeira abertura do dia do owner** pode fazer esse GET único e gravar a data — mesmo efeito, um pouco mais sujo. Preferência: cron de verdade (`vercel.json` + rota com secret).

### Loja sem data ainda (primeira vez)

Um GET, grava `paid_until`, segue a regra. Backfill: o próprio cron na primeira noite.

### O que isto não faz

- Não cadastra loja no gateway.
- Não muda emissão de nota.
- Não cria rota de venda.
- Não depende de webhook (o cron cobre o “pagou fora da janela”).

---

## Ordem

1. SW  
2. Auth / loading  
3. Dashboard paralelo  
4. Migração `paid_until` + banner/guard leem a data + **param de consultar fora da janela**  
5. Cron diário (ou 1 GET na primeira abertura do dia, se o cron atrasar)

1–3 não dependem de 4–5. Dá para ir ao ar em fatias.

---

## Risco em produção (honesto)

- **Janela errada por fuso:** usar data civil `America/Sao_Paulo` para “hoje vs paid_until”.  
- **Pagou hoje, cron só amanhã:** se ainda não chegou em `paid_until + 10`, o guard já estava liberado; o cron só atualiza a data. Se já passou dos +10, o GET do guard atualiza na hora.  
- **Guard sem GET antes dos +10 dias:** bloqueio de OS **não** pode ocorrer nesse período. Tirar VIP no painel só aparece no cron (até 24 h). Webhook **não entra** neste plano.

---

## Como saber que funcionou

- Deploy: app abre sem Ctrl+F5.  
- Owner no dia 10, vencimento dia 5 do mês seguinte: Network **sem** `/api/cobranca/status` ao trocar de tela.  
- Abrir `/fiscal` no meio do ciclo: lista **sem** esperar `/api/cobranca/guard`.  
- Até 9 dias depois do vencimento: criar OS / emitir **sem** GET de bloqueio.  
- A partir do 10º dia de atraso: o guard volta a consultar até pagar.  
- 3 dias antes (só banner): QR, se mantivermos o aviso.  
- Cron: `paid_until` no BD igual ao do gateway.
