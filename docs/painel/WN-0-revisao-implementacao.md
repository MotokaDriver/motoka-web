# WN-0: revisão adversarial da implementação

Alvo: working tree de `motoka-web` na branch `feat/login-painel`, sem commit, cobrindo `painel/`, as
mudanças na raiz e `.github/`. Os desvios E-1..E-11 estão na §15 do `WN-plano.md`. Revisor
independente (devil's advocate). Data: 2026-10-05.

> **VEREDITO: APROVADO COM RESSALVAS**: 0 bloqueadores, 3 ressalvas, 7 notas.

## O que eu rodei (2026-10-05, nesta máquina)

| Verificação | Resultado |
|---|---|
| `yarn lint` (painel) | exit 0 |
| `yarn typecheck` (app + `static-pages` com `checkJs`) | exit 0 |
| `yarn test` (Vitest) | 161/161, 9 arquivos |
| `yarn build` prod (`NEXT_PUBLIC_API_URL=https://api.motokadriver.com`) | ok: "28 scripts inline externalizados em 14 páginas; 12 payloads de segmento; 16 HTML verificados" |
| `yarn build` dev + `playwright -c playwright.devenv.config.ts` contra a **API real** (dev-env na 8000, painel no `wrangler dev` :3001) | **4/4**: login real, motoboy recusado, `?de=` hostil e duas abas |
| `yarn build` e2e + `yarn e2e` (mock HTTP na 8790, `wrangler dev` :8787, Chromium + smoke WebKit) | **49/49** |
| Landing: `yarn lint` + `next build` | exit 0. CSS de 48.063 bytes, a mesma lista de arquivos em `out/` (sem contar o `buildId`) |
| `check-error-codes` contra a API atual | 204 na API e 203 no painel (ver a nota 6) |

Uma sondagem manual confirmou o contrato real da guarda: `POST /v1/web/auth/refresh` com
`Origin: http://localhost:3001` + `X-Motoka-Client: painel` responde 401 com `set-cookie: mk_rt="";
… Path=/v1/web/auth; SameSite=strict; Secure` e `access-control-allow-credentials: true`.

## Conferido sem achado

- **Sessão** (`src/lib/session/store.ts`, `refresher.ts`, `crossTab.ts`):
  - **Geração:** toda operação incrementa a geração (`store.ts:101,138,158,175,222`), e o resultado
    antigo é descartado.
  - **Lock:** o W2 roda dentro de `navigator.locks.request('motoka-panel-refresh')`, que segura o lock
    até a `Promise` acabar (`crossTab.ts:76-83`). O `sub` é lido **dentro** do lock
    (`refresher.ts:44-48`).
  - **Single-flight na aba:** `store.ts:193-208`.
  - **401 atrasado no "Sair" (E-9):** o `expire()` só age com a sessão em `authenticated`
    (`store.ts:174`), e o `refreshForRetry` devolve `unavailable` fora desse estado
    (`store.ts:186-189`). Um 401 que chega durante o `leaving` não sobrescreve o logout.
  - **Troca de conta:** não publica `signed-out` (`store.ts:178`). Está correto: o cookie agora é da
    outra conta.
  - **Classificação do W2:** `refresher.ts:20-25` bate com o WS-04. O 400 `WEB_AUTH_ORIGIN_NOT_ALLOWED`
    dá `misconfigured`; 429, 5xx e rede dão `unavailable`.
  - **Contrato do `GET /users/{id}`:** `user.ts` confere com `users/presentation/schemas.py:135-188`
    (`type` em minúsculas `UserTypeEnum`, `address.street` e `number:int`, `corporate_reason`).
- **HTTP** (`src/lib/api/client.ts`):
  - Bearer com `credentials: 'omit'` fora de `/web/auth`;
  - `credentials: 'include'` e `X-Motoka-Client` só em `authApi.ts:46-60`;
  - uma repetição só; o segundo 401 chama `expire` (`client.ts:100-104`);
  - o `detail` nunca é guardado (`errors.ts`).
- **CSP:**
  - zero script inline no `out/` de prod;
  - `<script src="/_csp/…">` síncronos no fim do `<body>`;
  - `theme-init.js` síncrono no `<head>`;
  - nenhum `<style>` em `entrar/index.html` e `404.html`;
  - `CSPProvider disableStyleElements` em `app/layout.tsx`.
- **Zod jitless (E-6):** `z.config({ jitless: true })` é executado no import de `src/lib/zod.ts:187`,
  antes de qualquer `parse`. O core só consulta o `allowsEval` com `jitless` desligado. O E2E não
  registrou violação. O custo do zod está na ressalva 1.
- **Headers, `_redirects` e `/_static/`:**
  - o `out/_headers` de prod sai com HSTS e `upgrade-insecure-requests`;
  - `! Cache-Control` em `/_next/static/*`, `/_csp/*`, `/_maplibre/*` e `/.well-known/*`;
  - `! Referrer-Policy` em `/convite/*` e `/r/*`;
  - `_redirects` com duas regras;
  - assets em `/_static/` fora da reescrita (E-2), com o E2E "assets do convite fora da reescrita"
    verde.
- **`?de=`** (`safeNext.ts`):
  - barra dupla, `\`, controle e `%2f`/`%5c` remanescentes são recusados;
  - o `URL` sonda a origem;
  - `de` aninhado é recusado;
  - lista fechada `KNOWN_PATHS`.
  `/equipe/../conta/` normaliza para uma rota interna, o que é inofensivo.
- **Convite e `.well-known`:**
  - `assetlinks.json` e `apple-app-site-association` são **idênticos** aos do `motoka_app/web/.well-known`
    (`diff` vazio);
  - o appID `9D92T4ZS2F.com.app.motoka` bate com o `PRODUCT_BUNDLE_IDENTIFIER = com.app.motoka`;
  - o convite usa a meta da API (`convite.js:32`), `textContent` em todo dado e `credentials:
    'omit'` com `referrerPolicy: 'no-referrer'` no preview (`convite.js:208`).
- **Landing:**
  - exclusões em `tsconfig.json`, `eslint.config.mjs` e `@source not` (E-10);
  - `paths-ignore` no `nextjs.yml`;
  - build e lint verdes, e o CSS não cresce.

## Ressalvas

### 1. [RESSALVA] O zod/mini não tirou o peso do zod: o login carrega ~290 KB gz, e um chunk de 101 KB gz traz o gerador de JSON Schema e as locales

- **Onde:** `src/lib/zod.ts:1` (`import * as z from "zod/mini"`) e `:189` (`export { z }`); chunk
  `out/_next/static/chunks/3f8kn3b-3qoo9.js`, com 101.072 bytes gz e 400 KB sem compressão. É o maior
  chunk do `entrar/index.html`.
- **Evidência:** o chunk contém `toJSONSchema` (5 ocorrências, com o código do gerador:
  `schemaPath`, `sharedDefsExtractedFor`) e `locales`. O login não usa nenhum dos dois.
  - O E-6 justificou o `zod/mini` por "o zod clássico pesava ~100 KB gz no login". O tamanho voltou
    ao mesmo patamar: o total do login é 289.839 bytes gz, contra 286 KB citados na §15.3.
  - A causa provável (PLAUSÍVEL) é o reexport do *namespace* inteiro, que impede o tree-shaking. O
    chunk também tem código do React Query, então os 101 KB não são só zod.
- **Correção:** medir com o analisador do Turbopack.
  - Trocar o reexport do namespace por exports nomeados do que o painel usa (`object`, `string`,
    `optional`, `nullish`, `union`, `boolean`, `number`, `minLength`, `trim`, `config`).
  - Registrar o tamanho do login como número de aceite do WN-1.

### 2. [RESSALVA] O deploy de prod publica sem rodar os testes do commit

- **Onde:** `.github/workflows/painel-deploy.yml`, passos `yarn install` → `yarn build` → `deploy` →
  smoke.
- **Evidência:** não há lint, Vitest nem Playwright nesse workflow.
  - O `workflow_dispatch` (restrito a `main`) e um push direto em `main` publicam sem passar pelo
    `ci.yml`, que só roda em PR e em branches que não são `main` (`ci.yml:6-9`).
  - O build de prod só tem o smoke de headers contra o `wrangler dev`, no subconjunto do `painel-check`
    (`-g "página /|Referrer-Policy…"`).
  - O `wrangler rollback` do primeiro deploy não tem versão anterior para onde voltar.
- **Correção:** um job `verify` (lint + test + build e2e + `yarn e2e`) como `needs` do `deploy`, ou
  branch protection exigindo o `CI` verde no merge (registrar na H-1). Documentar que o rollback não
  cobre o primeiro deploy.

### 3. [RESSALVA] A guarda de CSP do E2E só lê o último documento de cada página

- **Onde:** `test/e2e/guard.ts:23-32` (o hook grava em `window.__cspViolations`) e `:95-99` (leitura
  no fim do teste).
- **Evidência:** o `addInitScript` recria o array a cada carregamento. Uma violação antes de um F5,
  de um `router.replace` com recarga ou do `<a>` do 404 se perde.
  - No Chromium e no WebKit, a violação também vai para o console como erro, e o `onConsole` a pega.
    Por isso o risco hoje é baixo.
  - A regra "CSP falha dura, sem exceção" (DN-12), porém, depende de um efeito colateral do console.
- **Correção:** `context.exposeBinding("__reportCsp", …)` no hook, para empurrar cada violação na
  hora. Remover o `failedResponses`, que é coletado e nunca lido (`guard.ts:62,84-86`).

## Notas

1. **Saída concorrente:** um `signed-out` de outra aba que chega durante o próprio "Sair" grava
   `keepReturn: true` (`store.ts:220-225`). O `logout()` então retorna cedo (`:162`), e o login abre
   com `?de=` depois de uma saída explícita. É cosmético: a nota 7 do WS-04 revisão de implementação
   pedia login puro depois de "Sair".
2. **Repetição depois de troca de geração:**
   - O `refreshForRetry` devolve `renewed` mesmo quando a geração mudou (`store.ts:197-202`).
   - O `apiFetch` então repete a requisição com `session.getAccessToken()` (`client.ts:97-100`), que
     pode ser o token de um login novo feito nesse intervalo.
   - A janela é de no máximo 15 s e a API barra por ABAC, então o risco é baixo.
   - Correção sugerida: o `refreshForRetry` devolve `unavailable` quando a geração mudou.
3. **`verify-out` e tipos de script:**
   - o `inspectHtml` só lê `type="…"` entre aspas duplas (`verify-out.mjs:125`);
   - `importmap` e `speculationrules` inline não são externalizados nem acusados
     (`csp-externalize.mjs:11`), e a CSP os bloquearia.

   O Next 16.3.6 não os emite hoje. Vale cobrir antes de um upgrade.
4. **Comentário mentiroso:** `playwright.config.ts:4` ainda diz "API mockada (`page.route`)". O E-4
   trocou por um servidor HTTP na 8790.
5. **`painel/AGENTS.md` e `painel/CLAUDE.md`** (gerados pelo `next dev`): não estão no `.gitignore` e
   entram no PR. É preciso decidir: commitar com intenção, ou ignorar.
6. **O catálogo já defasou:** a API ganhou `AUTH_TOKEN_EXPIRING` (`core/exceptions.py:175`, 401 do
   stream do WS-03) e `TRACKING_STREAM_UNAVAILABLE` depois da §15.3.
   - Não afeta o WN-0.
   - No WN-3, o `AUTH_TOKEN_EXPIRING` precisa de tratamento próprio. Ele não está em
     `REFRESHABLE_401` (`client.ts:25`), e isso está correto, porque o stream renova antes de conectar.
7. **`/r/` em prod:** o WN-0 publica a página-reserva, e a API (working tree) já gera links
   `painel.motokadriver.com/r/#…`. Se a API subir antes do WN-6, o cliente vê "ainda não disponível".
   Isso é aceitável, mas a ordem precisa estar no rastreio.

## O que eu não consegui verificar

- Deploy real na Cloudflare: `versions upload`, `rollback` e o domínio custom (dependem da H-1).
- Lighthouse e axe: não rodei de novo; confiei na §15.3.
- A causa exata do chunk de 101 KB (ressalva 1): falta rodar o analisador de bundle.
- WebKit além do smoke; Firefox não roda no E2E.
