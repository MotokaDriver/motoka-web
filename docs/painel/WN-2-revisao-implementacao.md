# WN-2 (Pedidos): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `0fe2d4f` (sem commit), §17 do `WN-plano.md`.
**Data:** 2026-10-05.

> **VEREDITO: APROVADO COM RESSALVAS.** 0 bloqueadores, 2 ressalvas, 3 notas.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| lint, typecheck | exit 0 |
| Vitest | 241/241 |
| Build e2e | 0 script inline |
| Playwright com mock | **56/56** |
| Playwright contra a **API real** (dev-env, painel na 3001) | **6/6**, inclusive `orders.spec.ts` ("pedido manual de ponta a ponta com motoboy em turno", 13 s, sem *skip*) e `team.spec.ts` |
| Login: soma gz dos `_next/*.js` sem `noModule` do `entrar/index.html` | **217,6 KiB** (222,9 kB), igual ao WN-1 (217,6). Medido pelo mesmo método do WN-1: o WN-2 não acrescenta nada ao login |
| `/pedidos/` | 267,4 KiB |

Sobre a divergência de medida: o 220,5 do implementador não bate nem em KiB nem em kB com a soma
acima. A diferença provável é que ele somou arquivos que eu não somei (`theme-init.js`, `/_csp/*`).
Para os próximos WN, o número precisa sair de um script versionado.

Depois do E2E real, o `out/` ficou com o build dev. Refazer o build e2e antes de rodar `yarn e2e`.

## Conferido sem achado

### Contrato `src/apps/deliveries` (commits `9f878a3` e `65c5257`)

- **Rotas** (`presentation/routers.py:84-350`): batem com `features/deliveries/api.ts`.
- **Corpos** (`presentation/schemas.py:20-131`): `CreateDeliveryRequest`, `StoreActionRequest` e
  `CancelDeliveryRequest` (`reason` obrigatório) conferem com o painel. Também conferem:
  - `ConfirmDeliveryByStoreRequest`, com os 4 motivos do enum (`OrderDialogs.tsx:16-19`);
  - `AssignDriverRequest`;
  - `AfterCancelAckRequest`, sem `action_id`, como na API.
- **DTOs** (`application/dto.py:100-321`): `DeliveryListItemDTO`, `DeliveryDetailDTO`, `FlagsDTO`,
  `AfterCancelDTO`, `DeliveryCountsDTO` e `CustomerLookupDTO` conferem com `model.ts:200-312`.
- **Enums:** status, origem, ator, motivo de problema, `tracking.mode` e `geocode_status` conferem.
- **Telefone:** sai sem o `55`, e a API aceita (`domain/values.py:25-27`).

### Matriz de ações

`logic.ts:31-61` reproduz a tabela do `WS-05-plano.md:569-579` linha a linha:

- "Pronto" e "Cancelar" só aparecem em pedido manual. Nos outros, aparece a nota da origem.
- `RETURNING` sem cancelamento oferece "Tentar de novo".
- Com `late_pickup`, a ação primária vira o retorno.
- `canWhatsApp` nunca é verdadeiro para iFood (`logic.ts:96-97`).

### `action_id` e `client_request_id`

- **`action_id`:** nasce por toque e é reaproveitado só depois de falha de rede, na mesma ação e no
  mesmo pedido (`hooks.ts:66-81`).
- **`client_request_id`:** um por abertura do drawer. O `Body` é desmontado ao fechar
  (`NewOrderDrawer.tsx:58-64`), e o 200 da repetição conta como sucesso.

### Lookup do cliente

- Usa `POST /customers/lookup` com o telefone no corpo (`api.ts:46-47`).
- Debounce de 300 ms, com `AbortController` a cada mudança. A resposta de um telefone antigo é
  descartada.
- 429 e erro não aparecem para o usuário.
- Editar o endereço ou o complemento descarta `lat` e `lng` (`newOrder.ts:74-78`).

### D-13, E15, `needs_attention` e geocode

- **D-13:** a ordem dos campos e o 460 px conferem.
- **E15:** o cartão "Houve cobrança?" depende de `flags.delivered_after_cancel`.
- **`needs_attention`:** o marcador por item e o badge vêm de `summary.needs_attention`, que existe no
  `DeliverySummaryDTO` (`dto.py:306`).
- **Geocode:** `not_configured` não alerta, só `failed` (`logic.ts:114,155-158`).

### Achados do WS-05

- **B-1 (atalhos):** os atalhos novos (N, J/K, 1/2) passam pelo mesmo registro com guarda de overlay.
- **WN-1 R1 (`trustedUrl`):** resolvido com `checkedOwnUrl` (`lib/links/ownUrl.ts`), aplicado ao
  convite e ao rastreio.
- **`?pedido=` inválido:** não chama a API (`hooks.ts:34-41`).

## Ressalvas

### 1. [RESSALVA] O plano exige "Corrigir endereço" (E10), e a rota já existe

- **Onde:** §17.2 ("fora do escopo pedido").
- **Evidência:**
  - O WN-2 é "conforme o WS-05 §5.3", e o `WS-05-plano.md:528` pede o alerta de geocode com
    "Corrigir endereço" (E10) atrás da capacidade.
  - Pela D-W5-12 (`WS-05-plano.md:934`), sem flag própria em `/web/capabilities`
    (`capabilities.py`, que só tem teams, deliveries e tracking), o primeiro uso decide.
  - O E10 está commitado (`routers.py:322-337`, commit `65c5257`). A condição do plano está
    cumprida, então o botão faz parte do escopo.
- **Falha:** o alerta "Não encontramos este endereço no mapa." aparece sem nenhuma ação. A loja não
  consegue corrigir pelo painel até a retirada.
- **Correção:** implementar o E10 no painel. O `UpdateAddressRequest` é o `AddressIn` mais um
  `action_id` opcional, o que permite reaproveitar os campos e as regras do drawer. Se a decisão for
  adiar, registrar como decisão do orquestrador e não como "fora do escopo pedido".
- **O que está corretamente fora:**
  - o banner de aceite, que é do WS-13 (`WS-05-plano.md:77`);
  - o mini-mapa, que é do WN-3 (`WS-05-plano.md:75`). Ver a nota 2.

### 2. [RESSALVA] O `action_id` é descartado em 5xx

- **Onde:** `hooks.ts:81`, `if (!failure.isNetwork) actionId.current = null`. O `isNetwork` só cobre
  `status === null`.
- **Evidência:** a API de prod fica atrás da Cloudflare (memória do projeto). Um 502 ou 504 do edge
  pode chegar depois de o origin já ter gravado a transição.
- **Falha:** a segunda tentativa vai com um `action_id` novo. Dependendo da ação, isso dá
  `DELIVERY_INVALID_TRANSITION` ("Pronto" já aplicado) ou um evento duplicado, em vez da resposta
  idempotente.
- **Correção:** manter o `action_id` também em `isUnavailable` (5xx e 429), como já faz o
  `client_request_id` do drawer.

## Notas

1. **Host do link próprio.** O `checkedOwnUrl` compara com `window.location.host`
   (`ownUrl.ts:10-11`). No dev-env, a API gera links para a 3001 (`local.env`, A-4 pendente), e o
   painel servido pelo `wrangler dev` na 8787 esconde o link do rastreio e o do convite. Um host de
   marca (H-6) também cairia. O comportamento é correto, mas precisa ficar registrado.
2. **Mini-mapa sem espaço reservado.** O plano previa um *slot* vazio para o mini-mapa (§8 WN-2:
   "slot do minimapa (vazio até o WN-3)"), e o `OrderPanel.tsx` não tem nenhum. O impacto é zero hoje;
   o WN-3 o cria.
3. **Pouco E2E de pedidos com mock.** Só 3 cenários novos. As regras finas (matriz, lookup e alertas)
   estão em unidade (39 testes), e o fluxo completo roda contra a API real.

## O que não foi verificado

- O design lado a lado com o `render_preview`.
- axe da `/pedidos/`.
- Origem de integração real (não existe antes do WS-13).
