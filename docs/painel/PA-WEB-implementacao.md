# PA-WEB: painel sem Firebase Phone Auth e com pedidos para entrar

Workstream PA-WEB do plano `motoka-api/docs/equipe-escala/PA-plano.md` (saída do Firebase Phone Auth).
Decisão que muda o painel: quem entra pelo **link multiuso** da loja fica `pending` até a loja aprovar;
o **convite pelo nome** continua entrando direto. O motoboy sem conta faz o cadastro normal no app
(sem SMS).

## Contrato usado

| Endpoint | Uso no painel |
|---|---|
| `GET /v1/teams/me/members?status=pending` (E1) | `fetchMembers("pending")`, polling de 60 s (`POLLING.teamJoinRequests`), chave `["team","members","pending"]` |
| `POST /v1/teams/me/members/{id}/approve`, corpo opcional `{"deal": Deal}` | `approveMember(id, deal \| null)`; sem combinado vai sem corpo |
| `POST /v1/teams/me/members/{id}/reject` | `rejectMember(id)`; o vínculo vira `removed` |
| Aviso `team_join_requested` (`{membership_id, driver_id}`) | leva a `/equipe/` (`notices/logic.ts`) |

Erros: `TEAM_MEMBER_NOT_FOUND` (404), `TEAM_MEMBER_NOT_PENDING` (409, novo no catálogo) e
`TEAM_DEAL_INVALID` (400). Em 404/409 de uma ação de equipe, o painel mostra o texto fixo e relê a
equipe (o pedido pode ter sido respondido em outra aba).

## O que mudou

- `team/model.ts`: `MemberStatus` ganha `pending`; `Member.joinedAt`; `parseMembers` (E1).
- `team/JoinRequests.tsx`: seção "Pedidos para entrar (N)" no topo da escala, com celular e "pediu há…".
  Aprovar abre `ApproveDialog` (`DealDialog.tsx`) com um só primário: "Aprovar" quando o combinado é
  válido, "Aprovar e combinar depois" (sem corpo) quando não; "Agora não" fecha. Recusar passa pelo
  `ConfirmDialog` (sem `window.confirm`). Falha na leitura sem lista anterior mostra um aviso discreto.
- Paridade de códigos conferida com `MOTOKA_API_DIR=<src de origin/feat/remove-phone-auth> yarn
  check-error-codes` (230 na API, 231 no painel, nenhum faltando).
- `TeamTabs`: contador de pedidos na aba Escala (também na tela de Acertos).
- Equipe vazia com pedido pendente mostra a seção, não o estado vazio.
- Textos: `InviteModal` ("Quem entrar por este link precisa da sua aprovação."; convite pelo nome entra
  direto), estado vazio da equipe, e `/convite/` (passos: instale, "Tenho um convite", crie sua conta ou
  entre; aviso de aprovação quando `kind` é `link`).
- Catálogo: saem os 12 códigos do Phone Auth (`PHONE_AUTH_*`, `PHONE_ACCOUNT_NOT_FOUND`,
  `PHONE_LOGIN_REINVITE_REQUIRED`, `PHONE_ALREADY_VERIFIED_ELSEWHERE`, `PHONE_VERIFY_NOT_ALLOWED`,
  `ACCOUNT_PHONE_CHANGE_REQUIRES_VERIFICATION`, `ACCOUNT_PHONE_ONLY`, `PHONE_ALREADY_REGISTERED`,
  `TEAM_INVITE_PHONE_MISMATCH`); `TEAM_REJOIN_REQUIRES_INVITE` e `ACCOUNT_RETIRED` ficam neutros.

## Conferência

```bash
grep -rnE "PHONE_AUTH_|PHONE_ACCOUNT_NOT_FOUND|PHONE_LOGIN_REINVITE_REQUIRED|PHONE_ALREADY_|PHONE_VERIFY_NOT_ALLOWED|ACCOUNT_PHONE_|TEAM_INVITE_PHONE_MISMATCH" painel/src   # vazio
grep -rn TEAM_MEMBER_NOT_PENDING painel/src/lib/errors/catalog.ts                                                                                         # presente
```

Testes: unitários de modelo, catálogo, aviso e tela (aprovar com e sem combinado, recusar com
confirmação, 409 já respondido, equipe vazia com pedido); E2E mockado (`team.spec.ts`, "Pedidos para
entrar") e o `/convite/` com `kind: "link"` (`public.spec.ts`).

## Fora do escopo

Selo/contador de pedidos no menu lateral; dropar `pending_invites`/M2 (fase 2 da API).
