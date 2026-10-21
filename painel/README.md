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
yarn e2e          # Playwright contra o wrangler dev, API mockada na 8790 (build com NEXT_PUBLIC_MAP_STYLE_URL=http://localhost:8790/style.json)
yarn size:login   # JS do login (teto 220 KiB gz) e da página /r/ (teto 30 KiB gz); rode depois do build
yarn check-error-codes   # códigos da API (../../motoka-api) sem texto no catálogo
```

Variáveis de build (todas públicas, validadas no `next.config.ts`; nenhuma é segredo):

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `dev` (padrão), `e2e`, `preview` ou `prod`. Só `prod` emite HSTS e `upgrade-insecure-requests` |
| `NEXT_PUBLIC_API_URL` | origem da API, sem `/v1`. Padrão `http://localhost:8000` fora de prod; obrigatória e https em `*.motokadriver.com` em prod |
| `MAP_EXTRA_ORIGINS` | opcional, só no build: origens https extras para a CSP do mapa (lista separada por vírgula, sem caminho), para hosts que o build não enxerga. O pós-build já soma os hosts do estilo (tiles, glyphs, sprite) e os `tiles` de cada TileJSON |
| `NEXT_PUBLIC_MAP_STYLE_URL` | estilo do mapa (WN-3), opcional. Sem ele, o mapa mostra "Mapa não configurado" e a lateral funciona. https sempre; `http://localhost` só fora de prod (E2E). O pós-build baixa o estilo e põe os hosts de tiles, glyphs e sprite na CSP |

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

## Deploy (Cloudflare Workers Builds)

O deploy de prod é feito pela integração Git da Cloudflare (Workers Builds), sem GitHub Actions e
sem token no repositório: a cada push na `main` a Cloudflare builda o `painel/` e roda
`npx wrangler deploy` (Worker `motoka-painel`, `wrangler.jsonc`). O antigo `painel-deploy.yml`
(verify + deploy + smoke + rollback por token) foi removido para não haver dois caminhos de deploy.
O lint, os testes e o E2E continuam no `ci.yml` em todo PR; o smoke de prod e o rollback passam a
ser manuais (`npx wrangler rollback` ou pelo painel da Cloudflare).

Configuração do projeto na Cloudflare (Workers & Pages > motoka-painel > Settings > Build):

| Campo | Valor |
|---|---|
| Diretório raiz | `painel` |
| Comando de build | `yarn build` |
| Comando de deploy | `npx wrangler deploy` |
| Caminhos observados | incluir `painel/*` |
| Domínio | `painel.motokadriver.com` (Custom Domain do Worker) |

Variáveis de build (prod):

| Variável | Valor | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | `prod` | sim (sem ela o build sai como `dev`, sem HSTS e aceitando localhost) |
| `NEXT_PUBLIC_API_URL` | `https://api.motokadriver.com` (origem, **sem** `/v1`) | sim em prod |
| `NEXT_PUBLIC_MAP_STYLE_URL` | URL https do estilo do mapa | não (vazio: "Mapa não configurado") |
| `MAP_EXTRA_ORIGINS` | origens https extras para a CSP do mapa | não |
| `NODE_VERSION` | `22` (`engines.node >=22`) | recomendada |

O job `painel-preview` do `ci.yml` (preview por PR via `wrangler versions upload`) segue
desligado sem a variável de repositório `CLOUDFLARE_ENABLED=true`; a alternativa sem token são os
builds de branches que não são a de produção do próprio Workers Builds.

