# WN-3b — Mapa ao vivo com tiles do Google

Pedido do usuário em 2026-10-20: trocar o provedor de tiles (MapTiler/Stadia, pendência H-3) pelo Google.

## Por quê

- A API geocodifica com o Google (`GOOGLE_MAPS_API_KEY`). Os termos do Google Maps Platform restringem exibir
  resultado da Geocoding API em mapa que não seja do Google. Tiles do Google no painel fecham essa brecha.
- Uma conta e um faturamento só (Google Cloud), em vez de Google + MapTiler.

## Decisões

| ID | Decisão | Por quê |
|----|---------|---------|
| D-W3b-01 | **Google Map Tiles API (2D, roadmap, raster) dentro do MapLibre**, não o Maps JavaScript API. | A CSP do painel é estrita (`script-src 'self'`, `style-src 'self'`, `worker-src 'self'`, `headers.template:7`) e o site é export estático no Cloudflare: não há nonce por resposta. O Maps JS exige script de `maps.googleapis.com`, `unsafe-eval`, `blob:` em worker e `<style>` injetado (doc "Content Security Policy" do Maps JS). A Map Tiles API é feita para renderizador de terceiro (a página de políticas trata de "third-party renderers"); mantém pins, testes, worker e CSP atuais. |
| D-W3b-02 | Chave de navegador `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (pública por natureza), restrita por referrer a `painel.motokadriver.com` e à Map Tiles API. Separada da `GOOGLE_MAPS_API_KEY` da API, que é de servidor. | Chave do navegador vaza por definição; a restrição é o controle. Com `Referrer-Policy: strict-origin-when-cross-origin` o Google recebe a origem, que basta para a restrição. |
| D-W3b-03 | Base dos tiles configurável por `NEXT_PUBLIC_GOOGLE_TILES_URL` só fora de prod (`http://localhost` para o E2E); em prod é fixa em `https://tile.googleapis.com`. | O E2E roda sem rede (mock na 8790). Prod não pode apontar para outro host. |
| D-W3b-04 | Visual escuro por `styles` na sessão (formato de estilo do Google: `featureType`/`elementType`/`stylers`), `scale: scaleFactor2x` + `highDpi: true`, `language: pt-BR`, `region: BR`. | O design pede mapa escuro (WebLive.jsx). Raster 512 px em `tileSize` 256 fica nítido em tela retina. |
| D-W3b-05 | Atribuição própria: logo do Google Maps (arquivo oficial, variante para fundo escuro/contornada, sem alteração, em `public/`, 16–19 px de altura, `alt="Google Maps"`, canto inferior esquerdo com área livre) e texto `copyright` do endpoint `viewport`, buscado no `load` do mapa e depois a cada `moveend` com debounce de 500 ms, no canto inferior direito. O `AttributionControl` do MapLibre sai. | Políticas da Map Tiles API: logo sem alteração, rótulo acessível "Google Maps", copyright completo, sem sobreposição com outro logo. |
| D-W3b-06 | Sessão em cache no módulo: guarda a promise **em voo** (dois pedidos simultâneos dividem um fetch) e a apaga no `catch`, então rejeição nunca fica em cache; o fetch compartilhado não é abortado (o unmount só descarta o resultado no componente, por causa do efeito duplo do StrictMode, `next.config.ts:15`). Reaproveitada enquanto faltar mais de 1 h para `expiry`. Renovação: timer com `Math.min(expiry − 1 h − agora, 24 h)`, conferência no `visibilitychange` (notebook suspenso) e no erro 401/403 de tile; renova uma vez e troca só a URL com `getSource().setTiles()`. O status de sessão vencida (401/403/400) vai ser conferido no curl do aceite. `refreshExpiredTiles` fica no padrão (`true`): com `false` o raster vai por `<img>` e o `status` do erro some. O `easeTo` da seleção também depende de `ready`. | Página aberta o dia todo, ou depois de suspensão, não pode ficar com tiles 403. `setTiles` evita o diff do estilo inteiro; markers HTML não são afetados. |
| D-W3b-07 | Falha no `createSession` (chave errada, API não habilitada, 403/400, rede), ou 401/403 de tile que persiste depois de renovar → `onFailed("error")` → "Não foi possível carregar o mapa". Tile 429 (cota) → `onFailed("quota")` → "O mapa atingiu o limite de uso por agora". A lateral segue nos dois. Sem chave → "Mapa não configurado" (D-19 vale), inclusive no preview de PR, que não recebe chave. | Mesma degradação de hoje, sem mapa em branco mudo. |
| D-W3b-09 | Cota padrão da Map Tiles API: 15.000 tiles 2D por projeto por dia e 6.000 por minuto (doc usage-and-billing; aumento pedido no console). Estimativa: 40–60 tiles por carga a 1600×900 e mais a cada pan, zoom ou `easeTo`, ou seja, cerca de 300 cargas por dia somando todas as lojas. Mitigação no código: `maxzoom` 20, sem pré-busca, cache HTTP do navegador respeitado (padrão do `fetch`). O resto é pendência humana. | Sem isso, o mapa some com 429 no meio do dia. |
| D-W3b-08 | Sai o pipeline de estilo externo: `NEXT_PUBLIC_MAP_STYLE_URL`, `MAP_EXTRA_ORIGINS`, `styleOrigins`, `loadTileOrigins`, `parseExtraOrigins`. O `{TILES}` da CSP passa a ser só a origem dos tiles (img-src e connect-src). | Com o host fixo, baixar estilo no build é peso morto. Menos superfície. |

## Contratos externos

- `POST {base}/v1/createSession?key=KEY` — corpo `{mapType:"roadmap", language:"pt-BR", region:"BR", scale:"scaleFactor2x", highDpi:true, styles:[…]}`; resposta `{session, expiry (segundos epoch, string), tileWidth, tileHeight, imageFormat}`.
- `GET {base}/v1/2dtiles/{z}/{x}/{y}?session=S&key=KEY` — tile raster.
- `GET {base}/tile/v1/viewport?session=S&key=KEY&zoom=Z&north=…&south=…&east=…&west=…` — `{copyright, maxZoomRects}`.
- API do Motoka: nenhuma mudança.

Conferido na revisão: os caminhos batem com a doc, e o preflight do `createSession` volta com
`access-control-allow-origin` igual à origem do painel. O MapLibre 6.12 baixa raster por `fetch` ou `<img crossOrigin>`,
por isso `{TILES}` entra em `img-src` e `connect-src`.

## Passos e arquivos (motoka-web, `feat/login-painel`)

1. `painel/scripts/build-env.mjs`: troca `mapStyleUrl` por `googleMapsKey` (validação `^[A-Za-z0-9_-]{20,80}$`) e
   `googleTilesUrl` (https fixo em prod; `http://localhost` permitido fora de prod; sem credenciais/caminho).
2. `painel/next.config.ts`: expõe `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e `NEXT_PUBLIC_GOOGLE_TILES_URL` validadas; sai
   `NEXT_PUBLIC_MAP_STYLE_URL`.
3. `painel/scripts/map-assets.mjs`: fica só a cópia do worker. `postbuild.mjs`: `tileOrigins = key ? [tilesOrigin] : []`.
4. `painel/src/features/live/googleTiles.ts` (novo): `createSession`, `getSession` (cache + margem de 1 h),
   `buildStyle(session)` (fonte raster + camada), `fetchCopyright(bounds, zoom)`, estilo escuro `DARK_STYLES`.
5. `painel/src/features/live/MapView.tsx`: recebe `tiles: { key, base }` em vez de `styleUrl`. Cria o mapa depois da
   sessão (flag `cancelled` no unmount, sem abortar o fetch compartilhado). Um estado `ready` (`useState`) vira `true`
   depois do `new Map`, e entra nas dependências dos efeitos de loja, pins e paradas (`MapView.tsx:99`, `:111`, `:159`),
   que hoje rodam uma vez com `map.current === null` e não voltam sem evento novo. `attributionControl: false`,
   overlay de logo e copyright, renovação conforme a D-W3b-06, erros conforme a D-W3b-07 (`onFailed(reason)`).
6. `painel/src/features/live/LiveScreen.tsx`: "configurado" passa a ser `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` não vazia;
   `mapFailed` guarda o motivo (`"error" | "quota"`) e escolhe o texto.
7. `painel/public/google-maps-logo.svg` (arquivo oficial, sem alteração) e `app/globals.css` (overlay; sai o estilo de
   `.maplibregl-ctrl-attrib`).
8. Testes:
   - `test/unit/build/map.test.ts`: saem estilo, TileJSON e extras; entram a validação de env e a CSP.
   - `test/unit/live/googleTiles.test.ts`: corpo da sessão, cache, rejeição não cacheada, dois pedidos simultâneos
     num fetch só, expiry, estilo e copyright.
   - `pins.test.tsx`: mock de `googleTiles`. Caso novo: a sessão resolve depois do mount e os pins aparecem sem evento
     novo, o que prova o `ready`. Caso de StrictMode, dois mounts seguidos: o mapa sobe.
   - `screen.test.tsx`: textos dos três fallbacks.
   - `test/e2e/mockApi.ts`: `createSession` confere o corpo (campos e `styles` presentes, senão 400), `2dtiles` com
     PNG 1×1 e `viewport` no lugar de `/style.json`.
   - `test/e2e/public.spec.ts`: a CSP.
   - `test/e2e/live.spec.ts`: o logo com nome acessível "Google Maps" e o copyright visíveis.
   - `test/e2e-devenv/live.spec.ts`: sem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no build, espera "Mapa não configurado" e
     os cartões. Com chave real de dev (precisa de rede), espera os markers. O README diz qual é qual.
9. CI e docs:
   - `.github/workflows/ci.yml`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=e2e-fake-key-0000000000` (20 ou mais caracteres,
     passa no regex) e `NEXT_PUBLIC_GOOGLE_TILES_URL=http://localhost:8790`.
   - `painel-deploy.yml`: `vars.PAINEL_GOOGLE_MAPS_API_KEY`.
   - `painel/README.md`: tabela de env, preview sem mapa, dev-env, e a pendência H-3 nova.

## Critério de aceite

- `yarn lint && yarn typecheck && yarn test && yarn build && yarn e2e` verdes.
- `grep -rn "MAP_STYLE_URL\|MAP_EXTRA_ORIGINS\|loadTileOrigins\|styleOrigins\|style.json"` em `painel/src`,
  `painel/scripts`, `painel/test` e `.github` sem resultado.
- Antes do merge, com a chave real (pendência humana), `curl` com `Referer: https://painel.motokadriver.com/`:
  - `createSession` → 200 com `tileWidth` 512;
  - `2dtiles` → 200 `image/png` com ACAO;
  - `viewport` → `copyright` não vazio.

  Em seguida, smoke em prod: mapa escuro (estilo grande demais é ignorado em silêncio pelo Google) e zero violações
  de CSP no console.

## Fora do escopo

- Maps JavaScript API, Advanced Markers e Map ID.
- Geocodificação da API (continua Google) e qualquer mudança no motoka-api.
- A página `/r/` (não tem mapa) e o app mobile (D-06: sem mapa).

## Pendência humana (substitui a H-3)

No Google Cloud do projeto da API: habilitar a **Map Tiles API**, criar uma chave de navegador restrita por referrer
(`https://painel.motokadriver.com/*`, e `http://localhost:3001/*` numa chave separada de dev) e por API (só Map Tiles),
e definir `PAINEL_GOOGLE_MAPS_API_KEY` nas variables do repo. Cobrança por tile (ver a tabela de preços da Map Tiles
API); colocar alerta de orçamento. Pedir aumento da cota diária de 2D tiles (padrão 15.000/dia, D-W3b-09) antes de
abrir o mapa para muitas lojas, e travar um teto de cota que caiba no orçamento. Texto de privacidade: o navegador do lojista faz requisições ao Google.

## Pendências pós-implementação

Ressalvas da revisão final (devil's advocate), a fechar com a chave real antes do merge:

- **Status de sessão vencida**: confirmar no `curl` o que o `2dtiles` devolve com uma sessão vencida. O painel renova em
  401/403 (D-W3b-06). Se o Google devolver **400**, incluí-lo na renovação do `MapView` (o `error` do mapa) e no teste.
- **Status de cota estourada**: confirmar no `curl` (ou no console, baixando o teto) que cota estourada é **429** no
  `2dtiles` e no `createSession`. O painel trata 429 como "quota" (D-W3b-07), com volta em 1, 2, 5, 10 e 15 min.
- **`maxZoomRects` ignorado**: a resposta do `viewport` traz o zoom máximo por área, e o painel usa só o teto fixo de
  20 (D-W3b-09). Avaliar com a chave real se zoom alto dá 404 de tile em alguma área atendida (fora das capitais). Se
  der, limitar o `maxzoom` pela área visível com o `maxZoomRects`.
