# Painel do estabelecimento (Next.js)

Painel web da loja, separado da landing (DN-01 de `docs/painel/WN-plano.md`). É um app Next.js
independente, exportado como site estático (`output: 'export'`) e publicado no Cloudflare Workers
Static Assets em `painel.motokadriver.com`. Não há servidor Next nem BFF: a sessão é a da API
(refresh em cookie httpOnly, access só em memória).

## Comandos

```bash
yarn install --frozen-lockfile
yarn dev          # next dev na 3001 (sem _headers, sem _redirects, sem /convite e /r/)
yarn build        # next build + pós-build (CSP, páginas estáticas, _headers, verificação do out/)
yarn serve        # wrangler dev na 8787, servindo out/ com os headers reais
yarn lint
yarn typecheck    # app + páginas estáticas (checkJs)
yarn test         # Vitest
yarn e2e          # Playwright contra o wrangler dev, API mockada na 8790 (build com NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=e2e-fake-key-0000000000 e NEXT_PUBLIC_GOOGLE_TILES_URL=http://localhost:8790)
yarn size:login   # JS do login (teto 220 KiB gz) e da página /r/ (teto 30 KiB gz); rode depois do build
yarn check-error-codes   # códigos da API (../../motoka-api) sem texto no catálogo
```

Variáveis de build (todas públicas, validadas no `next.config.ts`; nenhuma é segredo):

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `dev` (padrão), `e2e`, `preview` ou `prod`. Só `prod` emite HSTS e `upgrade-insecure-requests` |
| `NEXT_PUBLIC_API_URL` | origem da API, sem `/v1`. Padrão `http://localhost:8000` fora de prod; obrigatória e https em `*.motokadriver.com` em prod |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | chave de navegador do Google Maps Platform para a Map Tiles API (WN-3b), opcional. Pública por natureza: o controle é a restrição por referrer e por API no console. Formato `[A-Za-z0-9_-]{20,80}`. Sem ela, o mapa mostra "Mapa não configurado", a lateral funciona e a CSP sai sem tiles. Com ela, a origem dos tiles entra em `img-src` e `connect-src` |
| `NEXT_PUBLIC_GOOGLE_TILES_URL` | base dos tiles, só a origem. Em prod é sempre `https://tile.googleapis.com` (outro valor falha o build); fora de prod aceita `http://localhost` (o E2E usa o mock na 8790) |

## Portas de dev (DN-18)

- **3001**: `next dev`. É a origem que a API de dev aceita hoje (`WEB_AUTH_ORIGINS`/`CORS_ORIGINS`).
- **8787**: `wrangler dev`, que serve o `out/` com `_headers`, `_redirects`, `/convite/` e `/r/`. Para
  logar na 8787 contra a API local, a API precisa da origem `http://localhost:8787` nas duas listas
  (hand-off A-1/A-4 do plano). Os links de convite gerados pela API de dev só abrem na 8787.
- **Um servidor do painel por vez**: o cookie de refresh é do `localhost:8000` e não separa porta.

Para o E2E contra o dev-env real (`D:\dev\motoka\dev-env`, API na 8000), o `out/` é servido na 3001:

```bash
NEXT_PUBLIC_APP_ENV=e2e NEXT_PUBLIC_API_URL=http://localhost:8000 yarn build
npx playwright test -c playwright.devenv.config.ts
```

Sem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no build (e no shell do teste), o `test/e2e-devenv/live.spec.ts` espera
"Mapa não configurado" e os cartões. Com a chave de dev (restrita a `http://localhost:3001/*`, precisa de rede até o
Google), ele espera os markers no mapa.

Contas do seed: estabelecimento `11222333000181` / `NovaSenha@1`, motoboy `52998224725` / `Teste@123`.

## Safari

O cookie de refresh é `Secure`. Chromium e Firefox aceitam cookie `Secure` em `http://localhost`;
o Safari não. Use Chromium para o dev e para o E2E de sessão (o smoke de WebKit cobre só as
páginas sem sessão).

## Segurança

- CSP sem nonce e sem `unsafe-inline` em script: o pós-build (`scripts/csp-externalize.mjs`) grava os
  scripts inline do Next como `/_csp/<hash>.js` e o build falha se sobrar script inline, `on*=` ou
  `javascript:` (`scripts/verify-out.mjs`).
- O tema é aplicado por `/theme-init.js`, externo e síncrono.
- O zod é importado de `src/lib/zod.ts` (`jitless`, sem `new Function`).
- `localStorage`/`sessionStorage` só em `src/lib/prefs` (lint).
- As páginas sem framework ficam em `static-pages/` (não `static/`, que o Next copiaria para o
  export). Os assets delas vão para `/_static/<página>/`, fora da reescrita `/<página>/*`.

## Deploy (H-1)

O pipeline (`.github/workflows/ci.yml` e `painel-deploy.yml`) fica pronto, mas os jobs da
Cloudflare só rodam depois que o usuário configurar:

- secrets do repositório: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit) e `CLOUDFLARE_ACCOUNT_ID`;
- variáveis do repositório: `CLOUDFLARE_ENABLED=true`, `PAINEL_API_URL`, `PAINEL_PREVIEW_API_URL`,
  `PAINEL_GOOGLE_MAPS_API_KEY` (ver a pendência H-3 abaixo);
- o Worker `motoka-painel` com o domínio custom `painel.motokadriver.com` e o subdomínio
  `workers.dev` ligado (o preview por PR depende dele);
- o environment `painel-prod`, com o usuário como revisor obrigatório.

Sem isso, `painel-preview` e `deploy` aparecem como *skipped*. O preview por PR não recebe a chave do Google: lá o
mapa mostra "Mapa não configurado" e a lateral funciona.

## Mapa do Google (H-3, WN-3b)

Os tiles vêm da Map Tiles API do Google (raster 2D dentro do MapLibre; plano em `docs/painel/WN-3b-mapa-google-plano.md`).
Pendência humana, no Google Cloud do projeto da API:

- habilitar a **Map Tiles API**;
- criar uma chave de navegador restrita por referrer (`https://painel.motokadriver.com/*`; `http://localhost:3001/*`
  numa chave separada de dev) e por API (só Map Tiles), e gravá-la em `PAINEL_GOOGLE_MAPS_API_KEY`;
- cobrança por tile: colocar alerta de orçamento. A cota padrão é de 15.000 tiles 2D por dia (e 6.000 por minuto);
  pedir aumento antes de abrir o mapa para muitas lojas e travar um teto que caiba no orçamento. Com a cota estourada
  o mapa mostra "O mapa atingiu o limite de uso por agora";
- texto de privacidade: o navegador do lojista faz requisições ao Google;
- antes do merge, conferir com `curl` e `Referer: https://painel.motokadriver.com/`: `createSession` 200 com
  `tileWidth` 512, `2dtiles` 200 `image/png` com ACAO, `viewport` com `copyright` não vazio, e o status de sessão
  vencida (o painel renova a sessão em 401/403 de tile).
