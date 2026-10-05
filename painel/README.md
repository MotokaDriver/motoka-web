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
yarn e2e          # Playwright contra o wrangler dev, API mockada na 8790
yarn check-error-codes   # códigos da API (../../motoka-api) sem texto no catálogo
```

Variáveis de build (todas públicas, validadas no `next.config.ts`; nenhuma é segredo):

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `dev` (padrão), `e2e`, `preview` ou `prod`. Só `prod` emite HSTS e `upgrade-insecure-requests` |
| `NEXT_PUBLIC_API_URL` | origem da API, sem `/v1`. Padrão `http://localhost:8000` fora de prod; obrigatória e https em `*.motokadriver.com` em prod |
| `NEXT_PUBLIC_MAP_STYLE_URL` | estilo do mapa (WN-3), opcional |

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

## Deploy (H-1)

O pipeline (`.github/workflows/ci.yml` e `painel-deploy.yml`) fica pronto, mas os jobs da
Cloudflare só rodam depois que o usuário configurar:

- secrets do repositório: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit) e `CLOUDFLARE_ACCOUNT_ID`;
- variáveis do repositório: `CLOUDFLARE_ENABLED=true`, `PAINEL_API_URL`, `PAINEL_PREVIEW_API_URL`,
  `PAINEL_MAP_STYLE_URL`;
- o Worker `motoka-painel` com o domínio custom `painel.motokadriver.com` e o subdomínio
  `workers.dev` ligado (o preview por PR depende dele);
- o environment `painel-prod`, com o usuário como revisor obrigatório.

Sem isso, `painel-preview` e `deploy` aparecem como *skipped*.
