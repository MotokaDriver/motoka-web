# WN-1 ("Minha equipe"): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` (`feat/login-painel`, sem commit), §16 do `WN-plano.md`.
**Data:** 2026-10-05.

> **VEREDITO: APROVADO COM RESSALVAS.** 0 bloqueadores, 2 ressalvas e 4 notas.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` | exit 0 |
| Vitest | 198/198 |
| `yarn build` e2e | 28 scripts externalizados, 0 inline |
| Playwright com mock (8790) | **53/53** |
| Playwright contra a API real do dev-env (`playwright.devenv.config.ts`) | **5/5**. O `team.spec.ts` rodou de verdade, sem *skip*: convidar, adicionar turno, pausar com turno suspenso, retomar e remover |
| Login: soma gz dos `_next/*.js` sem `noModule` em `entrar/index.html` | **217,6 KB**, dentro do teto de 220 |
| `/equipe/` | 279,2 KB |
| `qrcode` | chunk `2253jh6eu-tzr.js` (8,6 KB gz), referenciado só pelo chunk do modal e ausente do `equipe/index.html`: o import dinâmico funciona |

Depois do E2E real, o `out/` ficou com o build dev (API 8000). Refaça `yarn build` com
`NEXT_PUBLIC_APP_ENV=e2e` antes de rodar `yarn e2e`.

## Conferido sem achado

### Contrato `src/apps/teams`

Rotas (`presentation/routers.py:97-290`) e chamadas do painel (`features/team/api.ts`) conferem:

| Item | Status |
|---|---|
| Caminhos E1–E16 | ok |
| `DELETE /shifts/{shift_id}` com o `series_id` | ok: `series_id == shift_id`, conforme `dto.py:181-183` |
| `revoke` com resposta 204 | ok |

Corpo do `POST /shifts` (`schemas.py:54-63`):

| Item | Status |
|---|---|
| `weekdays` de 0 a 6, começando na segunda | ok |
| `start_time` e `end_time` | ok |
| `week_start` | ok |
| `repeat_weekly` | ok |
| `remind_location` | ok |
| `pay` opcional | ok |

Modelo de dados (`model.ts`):

| Item | Status |
|---|---|
| Valores de `DealSchema`: dinheiro como string, chuva em {5, 10, 20} (`DealFields.tsx:19`), tarifa não usada vai `null` (`model.ts:182-189`) | ok |
| Enums `TeamMembershipStatusEnum`, `TeamInviteListStatusEnum`, `TeamAccessEnum` e `OrderTypeEnum` | idênticos |
| `SessionDTO.ended_at` nulo = em andamento (`model.ts:246`) | ok |
| `FieldError` dos `weekdays`: `message=str(weekday)` (`create_shifts.py:44-46`), lido como dado e nunca exibido (`addShift.ts:164-174`) | ok |

### D-12 (turno suspenso)

- A pílula aparece tracejada, com `aria-label` próprio (`WeekGrid.tsx:253-267`).
- Membro pausado não recebe turno novo (`WeekGrid.tsx:189`).
- O menu mostra "Turno suspenso enquanto o motoboy está pausado." (`ShiftMenu.tsx:83`).
- O E2E real confirma a suspensão ao pausar.

### Atalhos com overlay aberto (B-1)

- `Dialog` e `ActionMenu` registram o overlay no contador (`ui/Dialog.tsx:10-14`, `ui/ActionMenu.tsx:32`).
- `handle` bloqueia o atalho com `isOverlayOpen() || hasOpenDialog()`, com foco em campo editável ou
  com modificador (`shortcuts.ts:43-53`).
- O ajuste com `ref` em `useShortcut` evita re-registro em loop.

### Achados do WS-05a: nenhum voltou

| Achado | Como ficou |
|---|---|
| B-2 | "sem ninguém" em linha própria e sem alarme em dia passado (`WeekGrid.tsx:341-361`) |
| R-2 | O cartão "Convite criado" some ao cancelar o mesmo convite (`InviteModal.tsx:148`) |
| R-3 | E15 e E16 são queries separadas, cada uma com o seu intervalo (`hooks.ts:19-37`) |
| R-6 | O link é truncado com reticências (`InviteModal.tsx:195`) |
| R-7 | Os botões de ícone têm 40 px |
| R-8 | O texto do clique só aparece com `canAdd`, que exige semana atual ou futura e membro ativo (`TeamScreen.tsx:66,236`) |

### Outros itens

- **Um id só vira caminho se passar por `isUuid`** (`api.ts:25-30`).
- **Toast com texto do catálogo**, sem `detail` (`hooks.ts:72`).

## Ressalvas

### 1. [RESSALVA] O link de convite da API não passa pelo `trustedUrl`, como pede a §6.2

- **Onde:** `InviteModal.tsx:172,194-201,252,341,382`. O `linkData.url` e o `created.url` vão direto
  para a tela, para a área de transferência, para o QR e para o texto do WhatsApp.
- **Evidência:**
  - `trustedUrl` existe em `lib/links/links.ts:31-47`, mas não tem nenhum uso no `src/`.
  - O plano (§6.2) manda validar o host da `url` do convite.
  - O desvio não está registrado na §16.2.
- **Falha:** uma API mal configurada (`TEAM_INVITE_BASE_URL` errado, como o host 8080 do Flutter
  antigo) faz o painel exibir, copiar e codificar em QR um link que não abre o convite. O usuário não
  recebe nenhum aviso.
- **Correção:**
  1. Passar o link por `trustedUrl(url, <host do painel>, { allowLocalhost: appEnv !== "prod" })`.
  2. Se o host for inválido, mostrar "Não foi possível gerar o link agora." sem copiar e sem QR.
  3. Escrever um teste unitário para isso.

### 2. [RESSALVA] "Remover turno" fica habilitado em ocorrência que já passou na semana atual

- **Onde:** `ShiftMenu.tsx:69`. Só a semana passada (`readOnly`) e o turno em andamento desabilitam o
  botão.
- **Evidência:** o `DeleteShiftUseCase` devolve `TEAM_SHIFT_ENDED` quando a série não tem ocorrência
  futura (`motoka-api/src/apps/teams/application/shifts/delete_shift.py`, `has_future_occurrence`).
- **Falha:** um turno "Só nesta semana" de segunda, aberto na quarta, oferece "Remover". O clique só
  produz o erro 409 em toast.
- **Correção:** desabilitar quando `!repeatsWeekly && date < today`, com o texto "Este turno já
  aconteceu.". A remoção corta a série inteira a partir de agora, sem opção "só nesta semana" na API.
  O texto da confirmação (`ShiftMenu.tsx:33-39`) já está correto.

## Notas

1. **QR sem retorno de erro.** O `import("qrcode")` não tem `.catch` (`QrCode.tsx:15`). Uma falha que
   não seja de chunk deixa o QR em branco e sem aviso. O `ChunkLoadError` cai na recarga da DN-24.
2. **O convite nominal não manda `deal`.** O `deal` é opcional no contrato
   (`schemas.py:CreateNominalInviteRequest`), e o combinado é definido depois, no "Combinado padrão".
   Falta confirmar com o design se o convite deveria levá-lo.
3. **Teto do login em 220 KB.** A medida de 217,6 KB passa, mas a folga é de 2,4 KB. O WN-2 precisa
   medir pelo mesmo script (a §16.3 já registra isso).
4. **O E2E real altera o seed do dev-env.** O teste se pula com motivo explícito quando o seed não
   permite rodar de novo, o que é aceitável. Nesta execução ele rodou.

## O que não foi verificado

- Fidelidade visual lado a lado com o `render_preview`.
- axe/Lighthouse da `/equipe/`.
- Leitor de tela real.
