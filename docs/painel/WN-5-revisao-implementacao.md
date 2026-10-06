# WN-5 (Acertos): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `e9ddc1b` (sem commit), §20 do `WN-plano.md`. Contrato da API em
`43e988d` (WS-11a/b).
**Lentes:** devil-advocate, hm-designer e hm-qa.
**Data:** 2026-10-05.

> **VEREDITO: REPROVADO.** 1 bloqueador (o CI, que vem do WN-3 e não do código do WN-5), 2 ressalvas e 4 notas.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| lint, typecheck | exit 0 |
| Vitest | 314/314 |
| Build e2e **com** `NEXT_PUBLIC_MAP_STYLE_URL=http://localhost:8790/style.json` + Playwright | **70/70**: 67 do WN-3 + 3 de acertos |
| Build e2e **sem** a variável do estilo + Playwright | **52 passaram, 18 falharam** (mapa e headers/CSP de `public.spec.ts`) |

**Pergunta 1: a queda de 67 para 50 é regressão?** Não. O código do WN-5 não quebrou nada. Com o build
certo, a suíte inteira passa (70). Os "50/50" da §20 só podem ter saído de um build ou de um
subconjunto que não é o do E2E completo. A suíte inteira depende do build com o estilo do mapa
(exigência criada no WN-3, §18.3). É isso que leva ao bloqueador.

## Bloqueador

### B-1. [BLOQUEADOR] O CI roda o E2E sem o estilo do mapa: 18 testes vermelhos no PR

- **Onde:** `.github/workflows/ci.yml:85-88`. O `painel-check` define só `NEXT_PUBLIC_APP_ENV: e2e` e
  `NEXT_PUBLIC_API_URL: http://localhost:8790`, sem `NEXT_PUBLIC_MAP_STYLE_URL`.
- **Evidência:**
  - `test/e2e/public.spec.ts` espera a CSP com o host do estilo.
  - `test/e2e/live.spec.ts` espera o mapa.
  - Reproduzido aqui: o build sem a variável dá 18 falhas.
- **Correção:**
  1. Pôr `NEXT_PUBLIC_MAP_STYLE_URL: http://localhost:8790/style.json` no `env` do `painel-check`.
  2. Alternativa: fazer o `playwright.config.ts` falhar cedo, com mensagem clara, se o `out/` não tiver
     o host do estilo no `_headers`.

## Contrato S5–S9: conferido sem achado

### Rotas e corpos

- **Rotas** (`teams/presentation/routers.py:318-411`): batem com `features/settlements/api.ts`.
- **S5:** `status` em CSV, `week_start`, `driver_id` e `needs_action`.
- **S6:** detalhe por id.
- **S7:** PATCH com `version` e só os campos alterados.
- **S8:** `version` + `expected_total` (`schemas.py:75-80`).
- **S9:** `note` opcional.

### S7 com o conjunto inteiro

- `excluded_delivery_ids` é o conjunto inteiro (`schemas.py:89-98`, `domain/settlement.py:649-653`).
- O painel manda `excluded + id` para retirar e `excluded − id` para desfazer
  (`SettlementPanel.tsx:45-47,116,161`).
- "Retirar" só aparece com `reason === "return_receipt"` e `canAdjust`. Bate com o `receipt` do domínio
  (`settlement.py:464-470`).
- A lista `excluded` que a API devolve já vem filtrada (`excluded_lines`), então não há id obsoleto que
  dê 400.

### `version` e `expected_total`

- **S8:** o diálogo de confirmação guarda `version` e `total` no clique e mostra esse total no título
  (`SettlementPanel.tsx:199-205`). Se o polling mudar o acerto por baixo, o servidor devolve 409, e o
  painel recarrega e avisa (`hooks.ts:77-81`).
- **S9:** a API não pede `version`. A frase "em toda escrita" da §20 vale para o S7 e o S8.

### Erros e estados

- **Catálogo:** os 13 `error_code` de acerto e Pix da API estão no catálogo do painel.
- **`TEAM_SETTLEMENT_HAS_PENDING_LINES`:** os `errors[]` (`field` = id, `message` = motivo, conforme
  `settlement.py:711-713`) viram a lista de bloqueio.
- **Disputa:** o painel mostra a nota da contestação e oferece "Confirmar mesmo assim".
  `confirmed_over_dispute` diz que o Motoka não arbitra.
- **D-18:** "O Motoka registra e confere o acerto, mas não movimenta dinheiro…" aparece na lista, no
  painel e nos diálogos de confirmar e pagar. Não existe botão de pagar, só "Marcar como pago".

### Chave Pix

- Aparece só em `confirmed` e `paid` (`SettlementPanel.tsx:176`).
- A query usa `gcTime: 0` (`hooks.ts:32-41`).
- Sem `console`, sem `localStorage`/`sessionStorage` em `features/settlements`.
- O toast diz só "Chave Pix copiada.".
- Sem `value`, a tela mostra só a máscara.

## Ressalvas

### 1. [RESSALVA] O S7 usa a `version` do momento de salvar, não a do momento de abrir o ajuste

- **Onde:** `SettlementPanel.tsx:248`, `adjustSettlement(id, { version: detail.version, ...input })`.
- **Evidência:**
  - O `detail` é renovado a cada 30 s (`hooks.ts:38`), inclusive com o diálogo aberto.
  - O formulário nasce com os valores da abertura (`Dialogs.tsx:60-62`).
  - Se o motoboy confirmar ou contestar, ou o E7 mudar o acerto enquanto o diálogo está aberto, o PATCH
    sai com a versão nova. O servidor aceita um ajuste calculado sobre valores que a pessoa não viu.
  - Isso anula a proteção de concorrência que a §20 promete. O S8 está correto, porque guarda a versão
    no clique.
- **Correção:** guardar `detail.version` quando o `AdjustDialog` abre (estado ou `ref`) e mandar essa
  versão. O 409 recarrega e avisa. Escrever um teste unitário com a versão mudando no meio.

### 2. [RESSALVA] O E2E real se pula, mas dá para prepará-lo só pela API

**Pergunta 2: dá para preparar o E2E real só pela API?** Sim.

1. O seed já cria o turno e abre a sessão pela API (`test/e2e-devenv/seed.ts:52-98`).
2. `POST /v1/teams/mine/sessions/{id}/end` encerra a sessão e **cria o acerto na mesma transação**
   (`application/sessions/shift_sessions.py:93-102`, `OpenSettlementService.open_for`). Sem entrega
   retirada aberta, `ensure_can_end_session` não bloqueia (`deliveries/application/release.py:28-32`).
3. `POST /v1/teams/mine/settlements/{id}/confirm` com `{version, expected_total}` (o motoboy) muda
   para `pending_store` (`domain/settlement.py:546-558`).

**Cuidado:** a ocorrência encerrada continua na série, e um turno novo no mesmo horário dá
`TEAM_SHIFT_DRIVER_BUSY`. O seed precisa usar janelas curtas e sem sobreposição, por exemplo começando
em 1 min e com 30 min de duração, deslocadas a cada rodada. Também pode remover a série
(`DELETE /teams/me/shifts/{id}`) depois de encerrar.

**Correção:** transformar o `test.skip` em preparo determinístico (passos 1 a 3). Cobrir confirmar →
marcar como pago contra a API real.

## Notas

1. **O S6 manda o `value` da chave Pix em qualquer status** quando o motoboy é membro ativo
   (`application/settlements/views.py:330-334`, `payout_value_visible`). O painel só a mostra em
   `confirmed`/`paid`, mas a chave trafega e fica na memória durante `pending_*`, renovada a cada 30 s.
   Pedir à lane da API: `value` só com `status in {confirmed, paid}`, como diz a regra do plano.
2. **Sem design no Claude Design** para Acertos (registrado na §20).
   - **hm-designer:** a tela segue o DS e o padrão da aba Escala, com hierarquia clara (total, linhas e
     ações), D-18 legível e tons de status coerentes. Não fiz comparação visual.
3. **"Retirar do acerto" não pede confirmação.** O "Desfazer" fica na mesma tela, então isso é
   aceitável.
4. **WN-3 B-1** (stream preso com a aba oculta) está corrigido em `e9ddc1b` (`stream.ts:101-102`).

## O que não foi verificado

- O E2E real: pula sem acerto `pending_store`. Não fabriquei dados no dev-env.
- Comparação visual.
- axe da `/acertos/`.
