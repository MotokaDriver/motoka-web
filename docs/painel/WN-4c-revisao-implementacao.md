# WN-4c (Cardápio Web): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `5ab45ed` (sem commit), §23 do `WN-plano.md`.
**Contrato da API:** `f12805d` (WS-15a/b) mais o working tree (R4 em andamento).
**Lentes:** devil-advocate e hm-qa.
**Data:** 2026-10-06.

> **VEREDITO: APROVADO COM RESSALVAS.** 0 bloqueadores, 3 ressalvas, 3 notas.

## Verificações executadas (sem Docker)

| Verificação | Resultado |
|---|---|
| lint e typecheck | exit 0 |
| Vitest | 424/424 |
| Build e2e | ok |
| Playwright com mock | **89/89** (4 novos de Cardápio Web) |
| Tamanho do login | 219,4 KiB gz, abaixo do teto de 220 |
| E2E real | não houve (decisão do usuário) |

Os achados do WN-4ab foram resolvidos em `5ab45ed`:

- `verify-out.mjs:14` volta a usar `/(?<![.\w])client_secret/i`;
- o aceite alerta pelo `document.title` (`acceptance/alerts.ts`).

## PKCE e retorno: conferido sem achado

- **`state`:**
  - fica em `sessionStorage`, e só pelo `prefs.ts`;
  - expira em 10 min;
  - é de uso único: `takePendingOauth` remove o valor antes de ler (`prefs.ts:79-87`).
- **Retorno** (`OauthReturn.tsx:36-45`):
  - lê `code`, `state` e `error` e limpa a URL e o histórico na hora com `history.replaceState`;
  - se o `state` falta, difere do guardado ou é de outro tipo, a tela recusa **sem chamar a API**;
  - a API confere de novo o `state` com hash, o prazo e o uso único (`provider_panel.py:150-157`).
- **`code_verifier`:** fica só no cofre da API (`provider_panel.py:96-97`).
- **Open redirect pelo `?de=`:** não acontece.
  - O retorno não está em `KNOWN_PATHS` (`routes.ts`).
  - Com a sessão vencida, o `ShellGate` manda para `/entrar/` puro, e o `code` não vai para o `?de=`.
- **Portal:**
  - só abre por https, sem usuário e senha (`OauthPanel.tsx:24-30,59-68`);
  - abre na mesma aba (`location.assign`), o que preserva o `sessionStorage`.
- **Vínculo motoboy ↔ entregador:** `GET /drivers`, `PUT` e `DELETE /driver-links/{driver_id}` usam o
  `driver_id` do motoboy (user), igual à API (`routers.py:194-235`, `provider_panel.py:360-385`).
  - O 409 `EXTERNAL_DRIVER_TAKEN` vira texto fixo.
  - O painel desabilita entregadores já vinculados a outro membro.

## Ressalvas

### 1. [RESSALVA] O status `incomplete` da API não existe no painel, e a volta diz "conectado" mesmo sem conectar

- **Onde:**
  - `model.ts:9,108`: o `CardStatus` só tem `connected | available | soon`, e qualquer outro valor
    vira `soon`;
  - `OauthReturn.tsx:47-51`: o toast "Cardápio Web conectado." aparece sem olhar a resposta.
- **Evidência:**
  - A API tem `CardStatus = Literal["connected", "available", "soon", "incomplete"]` (`dto.py:13`).
  - Quando o OAuth termina sem `merchant_id`, a API grava `incomplete = "merchant_id"` e
    `state = DISCONNECTED` (`provider_panel.py:160-168`, R1).
  - O painel pinta "Configuração incompleta" só por coincidência, pela regra
    `cardapio_web + soon` (`logic.ts:49`).
  - Essa regra mistura dois casos diferentes:
    - **`soon`:** o ambiente não tem a configuração do parceiro. A loja não resolve isso.
    - **`incomplete`:** a conexão desta loja ficou sem merchant. A loja precisa reconectar.
- **Falha:** a loja conecta, vê "Cardápio Web conectado." e nenhum pedido entra, porque sem o merchant
  os webhooks não acham a loja.
- **Correção:**
  1. Modelar o `incomplete`.
  2. Na volta, reler o detalhe ou o card. Se vier `incomplete`, mostrar "A conexão ficou incompleta:
     o Cardápio Web não informou a loja. Conecte de novo." em vez do toast de sucesso.
  3. Separar os rótulos: `soon` no Cardápio Web vira "Indisponível neste ambiente"; `incomplete` vira
     "Configuração incompleta".

### 2. [RESSALVA] Os vínculos órfãos (`orphans`) são ignorados

- **Onde:** `api.ts:95-96`. O painel lê só `team` e `external`.
- **Evidência:** a API devolve `orphans` (o R2: "vínculos de quem já saiu aparecem para a loja
  remover", `provider_panel.py:311-320`). A loja não vê nem remove esses vínculos.
- **Correção:** listar "Vínculos de quem saiu da equipe", com "Remover" (`DELETE …/driver-links/{driver_id}`).

### 3. [RESSALVA] Testes

- **Falta caso no Playwright:** a volta com `incomplete` (ressalva 1).
- **Falta teste de unidade:**
  - aba nova sem `state` (outra aba);
  - `state` vencido (mais de 10 min);
  - segunda leitura do mesmo `state` (uso único no cliente).
  Confirme se o `cardapioweb.test.tsx` cobre esses três. O Playwright cobre só o "state diferente".
- **Sem E2E contra o portal real:** a configuração do parceiro não existe no ambiente.

## O que o painel precisa consumir quando o R4 da WS-15 entrar ("sem entregador vinculado" no DTO/atenção)

Hoje o aviso vem só do log de atividade (`driver_not_linked` em `cardapio_web.py:355-371`), e o painel
monta o bloco "Atenção" de Integrações a partir dele.

Quando o DTO da entrega ganhar o sinal (flag ou motivo de atenção):

1. **Modelo:** `deliveries/model.ts`, ler o campo novo de forma tolerante (lista e detalhe).
2. **Alerta do pedido:** `deliveries/logic.ts`, no `deliveryAlerts`, texto fixo "O Cardápio Web está sem
   o entregador deste pedido. Vincule o motoboy em Integrações." com link para `/integracoes/`.
3. **Mapa ao vivo:** `live/attention.ts`, uma categoria no bloco de atenção (o
   `needs_attention` do servidor já conta).
4. **Badge da sidebar:** vem do `summary.needs_attention` e muda sozinho. Conferir se o motivo entra
   no `summary`.
5. **Integrações:** trocar a fonte do bloco "Atenção" do log para o DTO (ou deduplicar), para o mesmo
   pedido não aparecer duas vezes. Usar o `needs_attention` do card, que já tem o chip.
6. **Catálogo:** se vier `error_code` novo, rodar o `check-error-codes`.

## Notas

1. **O host do portal não está fixado.** Qualquer https que a API mandar abre. Como a API é confiável,
   isso é aceitável, mas uma allowlist do host do Cardápio Web (defesa em profundidade) custa uma
   linha.
2. **`CARDAPIO_WEB_REDIRECT_URI` vem vazio por padrão** (`config.py:283`). Ele precisa ser exatamente
   `https://painel.motokadriver.com/integracoes/cardapio-web/retorno/`, com a barra final por causa do
   `trailingSlash`. Registrar no README do painel e na H-1.
3. **Para a lane da API:** o `PutDriverLink` transfere o entregador de um membro **pausado** sem
   avisar (`owner.is_active` é falso para pausado, `provider_panel.py:376-381`), e o R2 falava de
   ex-membro. O painel é mais conservador e desabilita a opção.
