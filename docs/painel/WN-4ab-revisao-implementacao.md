# WN-4a (aceite) e WN-4b (Integrações): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `890f640` (sem commit), §22 do `WN-plano.md`.
**Contrato da API:** `3fd9185` (WS-13) e `c0972f9` (WS-14, já commitado). O working tree da API agora
traz o WN-4c (Cardápio Web), fora deste alvo.
**Lentes:** devil-advocate, hm-designer (leitura do `WebIntegrations.jsx`) e hm-qa.
**Data:** 2026-10-06.

> **VEREDITO: REPROVADO.** 1 bloqueador, 3 ressalvas e 3 notas.

## Verificações executadas (sem Docker)

| Verificação | Resultado |
|---|---|
| lint e typecheck | exit 0 |
| Vitest | 396/396 |
| Build e2e com estilo | ok |
| Playwright com API mockada | **85/85** |
| `size:login` | `entrar` 219,1 KiB gz, dentro do teto de 220 |
| E2E real | não existe (decisão do usuário) |

## Bloqueador

### B-1. [BLOQUEADOR] A guarda nova do `verify-out.mjs` não pega vazamento real no RSC nem na URL

- **Onde:** `scripts/verify-out.mjs:12-14`.
- **O que mudou:** a regra deixou de barrar qualquer ocorrência de `client_secret` e passou a barrar só
  o padrão `client_secret["']?\s*[:=]\s*["'`][^"'`\s]{8,}["'`]`.
- **Evidência:** testei a regra nova com node contra sete entradas.

  | Entrada | Pega? |
  |---|---|
  | `{client_secret:"…"}` | sim |
  | `{"client_secret":"…"}` | sim |
  | Payload RSC escapado, como sai no `self.__next_f.push` e nos `__next.*.txt`: `{\"client_secret\":\"s3cr3t…\"}` | **não** |
  | `?client_secret=s3cr3t…` (query de URL) | **não** |
  | `CLIENT_SECRET=s3cr3t…` | **não** |
  | `o.client_secret` | não (é o falso positivo que motivou a mudança) |

- **Por que isso importa:** num export do Next, o vazamento plausível é um server component passar um
  valor de env como prop. O valor sai **escapado** no payload de voo (HTML, `/_csp/*.js` e `.txt`). A
  regra antiga pegava esse caso, a nova não.
- **Contexto:** a única ocorrência legítima no `out/` é o acesso por propriedade no parser,
  `t.client_secret`, em `_next/static/chunks/3m_9x_h5e69is.js`.
- **Testes:** nenhum teste cobre o `SECRET_RES`, nem antes nem depois da mudança
  (`test/unit/build/scripts.test.ts` só testa `inspectHtml`).
- **Correção:**
  1. Voltar a barrar `client_secret` em qualquer forma e liberar só o acesso por propriedade, com
     `/(?<![.\w])client_secret/i`. Isso libera `t.client_secret` e continua pegando `"client_secret"`,
     `\"client_secret\"`, `?client_secret=` e `client_secret:`.
  2. Escrever um teste unitário com os 6 casos da tabela.

## Ressalvas

### 1. [RESSALVA] Com a aba oculta, o aceite pausa, e o pedido pode ser recusado sem ninguém ver

- **Onde:** `src/features/acceptance/hooks.ts:11-19`. A query usa o padrão do painel,
  `refetchIntervalInBackground: false` (`runtime.ts`).
- **Evidência:**
  - O prazo de aceite é curto (o design mostra "recusa sozinho em 1:40").
  - Com o painel numa aba de fundo, que é o uso normal de uma loja com o PDV na frente, o polling para.
  - Não há título piscando, som nem `Notification`.
  - O pedido chega ao zero e é recusado sem a loja saber.
- **Correção:**
  - Na query de aceite, ligar `refetchIntervalInBackground: true` (os navegadores limitam a 1/min em
    abas de fundo, o que basta como aviso).
  - Pôr a contagem no `document.title`, por exemplo "(1) Pedido esperando aceite · Motoka".
  - Avaliar `Notification` com permissão explícita.
  - Registrar a decisão.

### 2. [RESSALVA] Uma integração recém-conectada leva até 5 min para ligar o banner fora de `/pedidos/`

- **Onde:** `hooks.ts:26-37`, `useOdConnected` com `staleTime: 60_000` e `refetchInterval` de 300 s
  (`POLLING.badge * 10`).
- **Falha:** a loja conecta o Open Delivery numa aba e continua no mapa noutra. O primeiro pedido pode
  expirar antes de essa aba descobrir que há integração.
- **Correção:**
  - Invalidar `["integrations"]` ao salvar ou conectar (já é a mesma aba).
  - Baixar o intervalo para 60 s.
  - Ou consultar o `awaiting-acceptance` sempre que `capabilities.deliveries` for verdadeiro. O endpoint
    é barato e devolve lista vazia.

### 3. [RESSALVA] Testes do risco de segurança

- Falta teste do `SECRET_RES` (B-1).
- O teste do secret confere cache e storage (`integrations.test.tsx:162`), mas não confere que o
  secret some ao trocar de conector.
- O `issued` vive no `IntegrationPanel`: falta testar que o estado é zerado quando o `type` muda, ou
  pôr `key={type}` explícito.

## Conferido sem achado

### Contrato

- **Integrações** (`/v1/integrations`, `integrations/presentation/routers.py:45-152`):
  - `GET` (cards), `/activity?cursor=`, `GET/PUT/DELETE /{type}`, `POST /{type}/credentials` (201,
    `no-store`) e `POST /{type}/test`;
  - corpo do `PUT`: `external_merchant_id`, `webhook_url` e `delivery_price`, com `extra=forbid`.
- **Aceite** (`deliveries/presentation/routers.py:165,317-326`):
  - `GET /deliveries/awaiting-acceptance`;
  - `accept` com `action_id` e `driver_id` opcional (`AcceptDeliveryRequest`);
  - `reject` com `StoreActionRequest`.

### Secret exibido uma vez

- `CredentialsIssuedDTO` é a única resposta com `client_secret`.
- No painel, o secret fica no estado do componente: fora do Query, de storage, de log, de toast e de
  URL.
- Aparece escondido por padrão, com "Mostrar" e "Copiar". Depois disso, só a dica `secret_hint`.

### Polling, contagem e recusa no zero

- **Intervalo:** 5 s em `/pedidos/` e 10 s nas outras telas.
- **Contagem:** usa o relógio do servidor (`countdown.ts:4-9`), e o `secondsLeft` nunca fica negativo.
- **No zero:** os botões somem e aparece "Recusando…" (`AcceptanceDrawer.tsx:36,75`), com teste em
  `acceptance.test.tsx:143`.
- **Erros:** `DELIVERY_ACCEPT_DEADLINE_PASSED` e o 409 viram texto do catálogo.

### `origin_unconfirmed`

- O campo existe no DTO (`deliveries/application/dto.py:181`) e entra em "precisa de atenção"
  (`domain/attention.py:40`).
- A API não restringe o cancelamento por origem: `cancel` só recusa entrega terminada. Então liberar o
  "Cancelar" no pedido de integração não confirmado (`logic.ts`, `mayCancel`) bate com o B4 do WS-13.

### hm-designer

A tela segue a estrutura do `WebIntegrations.jsx`:

- grade de conectores com o painel de 400 px;
- campos do operador (URL, Client ID, Client secret, preço; Saipos só com o Merchant ID);
- "Gerar novo secret" e "Testar conexão"/"Desconectar".

Os desvios estão registrados:

- **Regra de aceite só leitura:** a WS-13d ainda não existe.
- **Cardápio Web e iFood ficam para o WN-4c.**
- **Secret que não fica sempre "mascarado e visível":** a segurança vence o mock, porque o secret só
  existe uma vez.

Não fiz a comparação visual pixel a pixel.

## Notas

1. **`useOdConnected` só reconhece `status === "connected"`.** Se a API tiver um estado de "conectado
   com atenção", confira o `CardStatus`. Hoje só o valor `connected` liga o banner.
2. **Escopo do contrato.** O working tree da API já tem o WN-4c (`cardapio_web.py`, `inbox.py`,
   `tokens.py`). O painel não o consome, e isso está correto para este escopo.
3. **Login perto do teto.** `entrar` está em 219,1 KiB, com 0,9 KiB de folga. O WN-4c precisa manter os
   imports dinâmicos.
