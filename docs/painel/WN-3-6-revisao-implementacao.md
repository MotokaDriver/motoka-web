# WN-3 (Mapa ao vivo) e WN-6 (`/r/`): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `e5b0335` (sem commit), §18 e §19 do `WN-plano.md`.
**Lentes usadas:** devil-advocate, hm-designer e hm-qa.
**Data:** 2026-10-05.

> **VEREDITO: REPROVADO.** 1 bloqueador, 5 ressalvas, 3 notas. O bloqueador tem correção de poucas linhas.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| lint, typecheck (app + `static-pages`) | exit 0 |
| Vitest | 295/295 (19 arquivos) |
| Build de **prod** com `NEXT_PUBLIC_MAP_STYLE_URL=https://demotiles.maplibre.org/style.json` | ok: `MapLibre 6.12.0; tiles https://demotiles.maplibre.org`. CSP de prod com o host em `img-src` e `connect-src`, `worker-src 'self'`, sem `blob:` e sem `unsafe-eval` |
| Build e2e (estilo `http://localhost:8790/style.json`) + Playwright mock | **67/67** (mapa, worker de `'self'`, 0 violação de CSP, stale, 429 → polling, `/r/`) |
| E2E contra a API real do dev-env | **não verificado**: a API do dev-env saiu do ar durante a revisão (`curl localhost:8000` deu timeout), e os 9 testes falharam no login. Não é defeito do código. Vale o relato da §18/§19 |

O `out/` ficou com o build dev. Refazer o build e2e com o estilo antes de rodar `yarn e2e`.

## Bloqueador

### B-1. [BLOQUEADOR] O stream morre sem volta quando falha com a aba oculta e a pessoa volta antes de 20 s

- **Onde:**
  - `src/features/live/stream.ts:131`: `connect()` faz `if (!this.attached || this.hidden) return;` sem
    agendar nada e sem mudar o status.
  - `stream.ts:97-99`: `setHidden(false)` só reconecta se `status === "paused"`.
- **Evidência:** `fail()` (`:262-278`) põe `reconnecting` e agenda `connect()` para 1 a 30 s.
  1. Se esse timer dispara com a aba oculta, `connect()` sai sem nada.
  2. Se a pessoa volta antes dos 20 s, o `hiddenTimer` é cancelado e o status continua `reconnecting`.
  3. Não sobra timer nem watchdog.
  4. A query do L1 não tem `refetchInterval` (`useLive.ts:63`).
- **Falha:** uma oscilação de rede durante uma troca rápida de aba (menos de 20 s) faz o mapa e a
  lateral pararem de atualizar até sair da tela. A pílula fica cinza ("Sem atualização · tentando"),
  mas nada é tentado.
  - Nenhum teste cobre esse caso. `stream.test.ts` só tem "oculta por mais de 20 s" (`:239`) e "troca
    rápida não fecha" (`:255`), sem falha no meio.
- **Correção:**
  1. Em `setHidden(false)`, reconectar sempre que o status não for `streaming`, `connecting` nem
     `polling`.
  2. Ou, em `connect()` com `hidden`, marcar `paused` em vez de sair calado.
  3. Teste com relógio falso: falha → oculta → timer do backoff dispara → visível em 5 s → espera um
     `fetch` novo.

## Ressalvas

### 1. [RESSALVA] "Fim natural" sem tempo mínimo pode virar laço de refresh

- **Onde:** `stream.ts:256-259`.
- **Evidência:** qualquer `done` vira `connect(true)`, que chama `renew()` → `refreshForRetry` (W2), sem
  backoff. Um proxy que responde 200 e fecha logo (buffering, corte da Cloudflare) gera reconexão e
  rotação de refresh em laço.
- **Correção:** só tratar como fim natural se a conexão viveu mais de N s, ou depois de um `reauth`.
  Senão, chamar `fail(gen)`.

### 2. [RESSALVA] A pílula com `aria-live` anuncia a cada minuto

- **Onde:** `LiveScreen.tsx` (`role="status" aria-live="polite"`) e `LiveSide.tsx:42` (`Ao vivo · {dia},
  {hora}`).
- **Evidência:** o texto muda com o relógio. O leitor de tela fala "Ao vivo · seg 5, 18:07" a cada
  minuto, em cima da tarefa do usuário.
- **Correção:** deixar na região viva só a parte de estado ("Ao vivo", "Atualização a cada 10 s",
  "Sem atualização"). A hora fica fora dela, com `aria-hidden` ou num `<time>` irmão.

### 3. [RESSALVA] Fidelidade ao `WebLive.jsx`: dois desvios sem registro

O `WebLive.jsx` foi lido do projeto no Claude Design:

- **Pins das paradas do motoboy selecionado:** a referência desenha as paradas no mapa (ícones `home` e
  `location_on`). O `LiveStopDTO.destination` existe (`motoka-api/.../tracking/application/dto.py`,
  `LiveStopDTO`), mas o `MapView.tsx` não desenha as paradas. Só a rota tracejada está registrada como
  desvio (§18.2).
- **Controles de zoom:** a referência usa botões 36×36 escuros (`rgba(5,5,5,.82)`, borda `--border`,
  raio `--radius-md`). A implementação usa o `NavigationControl` padrão do MapLibre, branco, sem nenhuma
  regra `.maplibregl-ctrl` no `globals.css`. Em dark-first, isso destoa (barra do hm-designer).
- **Correção:**
  1. Desenhar os pins das paradas com `destination` do selecionado.
  2. Sobrescrever `.maplibregl-ctrl-group` com o fundo do design: `background: rgb(5 5 5 / .82);
     border: 1px solid var(--border); border-radius: var(--radius-md)`, botões de 36 px e ícone em
     `--text-secondary`.
  3. Ou registrar os dois como desvio.

### 4. [RESSALVA] CSP do mapa: um TileJSON aponta para hosts que o build não vê (PLAUSÍVEL)

- **Onde:** `scripts/map-assets.mjs:63-67`.
- **Evidência:** para uma fonte com `url` (TileJSON), só o host do TileJSON entra no `{TILES}`. Os `tiles`
  de dentro dele não entram. Com um provedor que serve os tiles por outro CDN, o mapa fica sem tiles e
  gera violação de CSP só em prod. No demotiles, o host é o mesmo.
- **Correção:** no pós-build, baixar também cada TileJSON e somar os hosts dos `tiles`, ou falhar o build
  se o host for diferente.

### 5. [RESSALVA] Lacunas de teste (hm-qa)

Faltam:

1. o teste do B-1;
2. o laço da ressalva 1;
3. o perfil com 100 motoboys (WS-10 §11: "contagem de builds da camada com 100 motoboys", "perfil com 100
   pins");
4. tiles reais no E2E. O mock serve um estilo vazio, e só o build de prod prova os hosts.

## Conferido sem achado

- **Worker do MapLibre** (`map-assets.mjs:26-38`):
  - `worker` e `shared` são copiados para `/_maplibre/6.12.0/`, com a versão travada conferida no build;
  - `setWorkerUrl` aponta para `/_maplibre/` (`MapView.tsx:11`);
  - os pins usam CSSOM, permitido pela CSP.
- **Cliente SSE:** cobre o que a §18 promete, salvo o B-1:
  - watchdog de 45 s rearmado por pedaço, inclusive `: hb`;
  - geração por conexão;
  - `reauth` sem backoff;
  - `AUTH_TOKEN_EXPIRING` uma vez;
  - backoff de 1 a 30 s com jitter;
  - 429, 503 e 404 `ROUTE_NOT_FOUND` caem no polling, com retentativa em 60 s;
  - 403 não reconecta;
  - aba oculta por mais de 20 s fecha.
- **`stale` e remoção do pin** (`state.ts:9,68-76`):
  - 120 s viram `stale`;
  - depois de `no_signal_after_seconds` (180 s), o motoboy aparece como "sem sinal" e perde o pin;
  - o relógio é o do servidor (`offsetMs`);
  - posição fora de ordem não volta no tempo.
- **`/r/` (WN-6):**
  - o token fica no fragmento; `/r/<token>` vira `/r/#<token>` (`r.js:182-187`);
  - `<meta name="referrer" content="no-referrer">` + header;
  - `fetch` com `credentials: 'omit'` e `referrerPolicy: 'no-referrer'` (`r.js:279`);
  - 410 e 404 são finais, e o 429 respeita o `Retry-After`;
  - todo dado entra por `textContent`;
  - só o primeiro nome do motoboy; a posição pública é a da API, já arredondada
    (`PublicPositionDTO`, cerca de 110 m);
  - 6,8 KiB gz.
  - O token também vai no **caminho da API** (`/v1/public/deliveries/{token}`). Isso é o contrato do
    WS-02b, não defeito do painel.
- **Acessibilidade:**
  - pins com `aria-hidden`, com a lateral como alternativa;
  - cartões são `<button aria-pressed>` com rótulo grosso (`coarseAge`, por minuto);
  - filtros em `role="group"` com `aria-pressed`.

## Notas

1. **Duas regras para "Sem sinal".** O `countsOf.noSignal` soma `not_started`, de propósito (pílula do
   WS-10). O `LiveCountsDTO` da API não soma. As duas regras precisam ficar escritas, para ninguém
   "corrigir" uma delas.
2. **"Novo pedido" no rodapé da lateral vai para `/pedidos/`.** O design abre o drawer direto. Um
   `?novo=1` resolveria.
3. **E17 ("Lembrar de ativar localização") e ETA** estão registrados como pendência da WS-03d. Está
   correto.

## O que não foi verificado

- O E2E real: a API do dev-env caiu durante a revisão.
- O screenshot lado a lado com o `render_preview`: só li o `WebLive.jsx`.
- Leitor de tela real.
- Tiles de um provedor comercial.
