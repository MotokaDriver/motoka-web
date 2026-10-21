# Revisão adversarial do plano WN (painel Next.js), rodada 1

Alvo: `docs/painel/WN-plano.md` (v1, 2026-10-05). Revisor independente (devil's advocate). Data: 2026-10-05.

> **VEREDITO: REPROVADO**: 4 bloqueadores, 13 ressalvas, 7 notas.

A arquitetura de base se sustenta: SPA estática, sessão na API e Workers Static Assets. A análise do
cookie também se sustenta. O plano tem quatro problemas que impedem a aprovação: um critério de aceite
inalcançável, um teste que não testa o que promete, uma rota 404 que não funciona com dois layouts
raiz e um pipeline de deploy que contradiz o próprio plano e a ordem do WS-17. Isso piora agora que o
WN-7 entra no ciclo.

---

## Bloqueadores

### 1. [BLOQUEADOR] O 404 global não funciona com dois layouts raiz

- **Onde:** `WN-plano.md:171-186` (`(painel)/layout.tsx`, `(publico)/` com "layout raiz próprio",
  `(painel)/not-found.tsx`), DN-17 `:157`, critério 2 do WN-0 `:541` ("`/qualquer` dá 404 com a
  página do painel") e `not_found_handling: "404-page"` `:465`.
- **Evidência:** a doc do Next 16.3 (file-conventions/not-found) diz que só `app/not-found.js` e
  `app/global-not-found.js` tratam URL sem rota. Diz também que, com "multiple root layouts (e.g.
  `app/(admin)/layout.tsx` and `app/(shop)/layout.tsx`)", é preciso o `global-not-found.js`, que ainda
  é **experimental** (`experimental.globalNotFound`) e tem de devolver `<html>`/`<body>` próprios. Um
  `not-found.tsx` dentro de um route group só atende `notFound()` daquele segmento.
- **Falha:** o `out/404.html` sai com a UI padrão do Next, ou o build falha. O Workers serve esse 404
  em `/qualquer`. Sem tema, sem tokens e sem o link "Mapa ao vivo", o critério 2 não fecha.
- **Correção:** `app/global-not-found.tsx` com a flag experimental, importando o CSS e o `/theme-init.js`.
  Incluir isso no spike do WN-0 e registrar o risco de usar uma API experimental. A alternativa é um
  layout raiz único com dois sub-layouts, mas aí a página `/r/` paga o provider do painel. Avaliar junto
  com o achado 3.

### 2. [BLOQUEADOR] O E2E de "duas abas" usa contexts separados, que não compartilham BroadcastChannel nem Web Locks

- **Onde:** `WN-plano.md:578` ("duas abas (contexts com `storageState` compartilhado)"), critérios 4 e
  5 do WN-0 (`:546-549`).
- **Evidência:** cada `BrowserContext` do Playwright é um perfil isolado. `BroadcastChannel` e
  `navigator.locks` têm escopo na partição de armazenamento do perfil. Copiar o `storageState` copia
  cookies e localStorage, não o canal nem o gerenciador de locks. O comportamento que se quer provar é o
  de `cross_tab_web.dart:17` e `cross_tab.dart:27`, que só existe entre abas do **mesmo** perfil.
- **Falha:** o "logout em uma desloga a outra" nunca dispara (teste vermelho). Pior: o "um W2 por vez"
  passa sem que o lock tenha sido exercitado. Também não há cookie compartilhado depois da cópia, então a
  troca de conta (critério 5) não reproduz a sobrescrita do `mk_rt`.
- **Correção:** duas `page` no **mesmo** `context` (`context.newPage()`). Asserção observável: contar
  os W2 em `page.route` e a ordem de início e fim de cada um.

### 3. [BLOQUEADOR] O critério "≤ 120 KB gz" do WN-6 é inalcançável com uma página Next

- **Onde:** `WN-plano.md:805`, contra o argumento da própria DN-16 (`:156`: "uma rota Next levaria o
  runtime do React e do Next (~100 KB gz)").
- **Evidência (medida neste repo, Next 16.3.6, `out/excluir-conta.html`):** é uma página estática com
  Header e Footer, sem `motion` (`motion` só aparece em `app/page.tsx`). Os scripts não-`noModule` somam
  **~144 KB gz**: 71,3 + 44,0 + 8,9 + 8,6 + 5,2 + 3,9 + 2,4. O CSS soma mais 9,7 KB gz. Só a base do
  framework já passa do teto, antes do zod e do código da página.
- **Falha:** o WN-6 não fecha, ou fecha com o critério afrouxado em silêncio.
- **Correção:** escolher uma das duas.
  - (a) Fazer `/r/` como o convite: HTML estático com JS puro (`static/r/`, `// @ts-check`). Isso dá
    coerência com a DN-16 e resolve o achado 1, porque sobra um layout raiz só.
  - (b) Manter Next e trocar o teto por um número medido no spike (≈150 KB gz), justificado.

  Recomendo (a). A página é um card com polling.

### 4. [BLOQUEADOR] O pipeline de deploy contradiz os critérios, o hand-off do WS-17 e agora o WN-7

- **Onde:**
  - `WN-plano.md:516`: "`deploy` só em `main`";
  - critério 11 `:559`: preview em `*.workers.dev` no WN-0;
  - DN-21 `:161`: um PR só, com os WN dependentes de API futura entrando nele;
  - `:862-864` e `:974`: o WS-17 só roda depois que o convite e o `.well-known` estiverem publicados no
    domínio;
  - `:812-818`: WN-7 "fora deste ciclo", H-7.
- **Evidência:**
  - Com deploy só em `main` e PR único, nada é publicado até o merge.
  - O merge depende do WN-5 (WS-11) e, pela decisão do orquestrador, do **WN-7, que entra por último**.
  - O WN-4 depende das WS-12/13/15, que ainda não têm contrato (`:743-757`).
  - Enquanto isso, `painel.motokadriver.com` não serve `/.well-known`, mas o mobile já declara
    `autoVerify` para esse host (`motoka_app/android/app/src/main/AndroidManifest.xml`, citado em
    `:461`; o arquivo está modificado no working tree).
  - No Android 12+, a verificação do App Link roda na instalação ou atualização. Um release do mobile
    antes de o domínio responder fica sem verificação até o próximo update.
- **Falha:**
  - o critério 11 é impossível de cumprir;
  - o WS-17 fica bloqueado por meses;
  - um release mobile com WS-06 pode sair com App Links quebrados.
- **Correção:**
  1. Job de preview em `pull_request` com `wrangler versions upload` (URL de preview), ou um
     `workflow_dispatch` de deploy a partir da branch.
  2. Resolver a H-8 **agora**: merge depois do WN-0+WN-1 (no máximo WN-2), com WN-3..WN-7 em PRs
     seguintes. A H-8 deixa de ser opcional.
  3. Escrever a regra de ordem: o release do mobile com App Links (WS-06) só sai depois de
     `/.well-known` responder 200 em prod.
  4. Atualizar o WN-7 para a decisão do orquestrador: escopo, posição na ordem (depois de
     WN-0..WN-5), CSP e pagamento (ver nota 5). A H-7 deixa de ser pendência de prioridade.

---

## Ressalvas

### 1. [RESSALVA] O `.gitignore` da raiz é ancorado: `painel/node_modules`, `painel/.next` e `painel/out` não ficam ignorados

- **Onde:** `motoka-web/.gitignore` (`/node_modules`, `/.next/`, `/out/`); a árvore da §4 (`:168-210`)
  não tem `painel/.gitignore`.
- **Falha:**
  - `git status` mostra milhares de arquivos;
  - risco de commitar o build;
  - o Tailwind 4 da landing (`app/globals.css:1`, `@import "tailwindcss"`, detecção automática de
    fontes que respeita o `.gitignore`) passa a varrer `painel/src`, `painel/.next` e `painel/out`, e
    as classes do painel vão parar no CSS da landing.
- **Correção:**
  - criar `painel/.gitignore` (ou desancorar as regras da raiz);
  - pôr `@source not "../painel";` no `globals.css` da landing;
  - verificar que o CSS da landing não muda de tamanho.

### 2. [RESSALVA] Raiz do Turbopack com vários lockfiles (PLAUSÍVEL na 16.3.6)

- A raiz do repo tem `yarn.lock` **e** `package-lock.json`, e o painel terá o próprio `yarn.lock`. O
  Next infere a raiz do workspace pelos lockfiles. As notas da 16.3.0-canary.100 (PR #96159) citam a
  correção da detecção com "stray lockfiles".
- Se a raiz inferida for `motoka-web/`, uma dependência ausente no painel pode resolver em silêncio pelo
  `node_modules` da landing no ambiente local. O CI, que instala só `painel/`, pega a falha. O local não.
- **Correção:** `turbopack: { root: __dirname }` (e `outputFileTracingRoot`) no `painel/next.config.ts`,
  e um build de CI sem o `node_modules` da raiz.

### 3. [RESSALVA] A landing não tem CI de PR, e o PR único mexe em arquivos dela

- `nextjs.yml:8-13` dispara só em `push` para `main`.
- O WN-0 altera `tsconfig.json` (`exclude`), `eslint.config.mjs`, `next.config.ts` (comentário) e o
  `README`, e o `globals.css` vai mudar pela ressalva 1. Nada disso é validado antes do merge. O
  `paths-ignore` não resolve isso.
- **Correção:** um job `landing-check` (lint + `next build`) em `pull_request`, quando houver arquivo
  fora de `painel/**`.

### 4. [RESSALVA] A Base UI injeta `<style>`, um fato documentado, e não uma dúvida para o spike

- **Onde:** spike item 3 (`:523`), DN-09 e o risco em `:1008`.
- **Evidência:** a doc do `CSPProvider` da Base UI diz que `ScrollArea.Viewport` e
  `Select.Popup`/`Select.List` (com `alignItemWithTrigger`) "inject a style tag to disable native
  scrollbars". Com `style-src 'self'`, isso vira violação e derruba o E2E (DN-12).
- **Correção:** `<CSPProvider disableStyleElements>` no layout e o CSS equivalente em classe. Trocar o
  item 3 do spike por "conferir que nenhum outro componente usado injeta".

### 5. [RESSALVA] "Todo E2E falha em erro de console" conflita com erros esperados

- **Onde:** DN-12 `:152`.
- **Evidência:**
  - A primeira visita sem cookie gera um 401 do W2 que o navegador registra no console como erro
    (`WS-04-revisao-implementacao.md` nota 12). O mesmo vale para o 404 `ROUTE_NOT_FOUND` do badge
    (`:327-328`), o 429 do lembrete e o 401 forçado do teste de expiração.
  - `Permissions-Policy: … interest-cohort=()` (`:378`) faz o Chrome logar "Unrecognized feature:
    'interest-cohort'" em todas as páginas.
- **Correção:**
  - tirar `interest-cohort`;
  - fazer a regra do console ignorar "Failed to load resource" das URLs da API que o teste espera, por
    allowlist explícita por teste;
  - manter falha dura para `securitypolicyviolation`.

### 6. [RESSALVA] `Referrer-Policy` duplicado em `/convite/*` e `/r/*`

- **Onde:** `:385-390`. Esses caminhos também casam com `/*` (`:377`), e o plano não usa
  `! Referrer-Policy`.
- O próprio `motoka_app/web/_headers` registra que dois blocos casando o mesmo caminho concatenam
  valores. É o achado 5 da `WS-04-revisao-plano.md`, que volta por esta porta.
- O resultado é `strict-origin-when-cross-origin, no-referrer`. Funciona por acaso, porque o navegador
  usa o último valor válido.
- **Correção:** `! Referrer-Policy` antes do valor novo, e o E2E conferindo o valor **exato**.

### 7. [RESSALVA] `upgrade-insecure-requests` e HSTS em build não-prod (PLAUSÍVEL)

- O `_headers` é o mesmo para o build de E2E e o de dev-env, servido em `http://localhost` contra
  `http://localhost:8000`.
- `upgrade-insecure-requests` pode promover as chamadas à API para https e quebrar o job real.
- **Correção:** emitir UIR e HSTS só quando `NEXT_PUBLIC_APP_ENV=prod`.

### 8. [RESSALVA] O E2E contra o dev-env real via `wrangler dev` esbarra no `Origin` exato

- O `wrangler dev` sobe na 8787 por padrão. A API aceita só a origem exata (`web_routers.py:99-104`),
  e a A-1 libera só `localhost:3001`.
- **Correção:** `wrangler dev --port 3001` no `webServer` do Playwright (e nunca rodar `next dev` ao
  mesmo tempo), ou incluir a origem do E2E no `local.env`.

### 9. [RESSALVA] Polling com TanStack Query: falta a política de `retry`

- O padrão do v5 é `retry: 3` com backoff próprio. Isso:
  - repete 403 `FORBIDDEN`, 404 e 409;
  - atrasa o `fetchFailureCount` que alimenta o `refetchInterval`;
  - soma o backoff do retry ao backoff do polling, de modo que um 429 recebe três tiros a mais, contra
    o `Retry-After`.
- **Correção:**
  - `retry` como função: nunca em 4xx; em rede e 5xx, no máximo 1 nas queries de polling;
  - nunca repetir no 401, que já é tratado pelo `apiFetch`;
  - teste com relógio falso provando 10→20→40→60 s.
- O resto da DN-07 bate com a doc: `refetchIntervalInBackground: false` usa o `focusManager`
  (`visibilitychange`).

### 10. [RESSALVA] Deploy com abas abertas: chunks antigos somem (PLAUSÍVEL)

- O painel fica aberto o dia inteiro. O Workers Static Assets serve só a versão atual dos assets.
- Um `import()` tardio depois de um deploy dá `ChunkLoadError` ou tela quebrada. Exemplos: MapLibre em
  `/ao-vivo` (`:151`), o drawer de novo pedido.
- **Correção:** tratar `ChunkLoadError` com recarga única e aviso, ou checar `/_next/static/<buildId>`
  em segundo plano. Os `/_csp/<sha>.js` devem ser `immutable` (hoje caem em `no-cache`).

### 11. [RESSALVA] O worker do MapLibre v6 precisa estar em `out/`, e o plano não diz como

- O v6 é ESM-only. Com bundler, o `setWorkerUrl()` é obrigatório (guia de migração v5→v6), apontando
  para um `maplibre-gl-worker.mjs` servido pelo site. O Turbopack não emite esse arquivo sozinho.
- **Correção:**
  - copiar o worker de `node_modules/maplibre-gl/dist/` no pós-build, com a versão travada igual à do
    pacote;
  - E2E conferindo `worker-src 'self'` sem `blob:`;
  - incluir no `{TILES}` os hosts de `glyphs` e `sprite` do estilo, além dos tiles.

### 12. [RESSALVA] `isRouteMissing` com `{id:uuid}`: um `?pedido=` inválido parece "feature ausente"

- `deliveries/presentation/routers.py:2` documenta que um segmento que não é UUID não casa com a rota e
  devolve 404 `ROUTE_NOT_FOUND`. A URL do painel leva `?pedido=` (`:656`).
- **Correção:** validar o UUID antes de chamar e tratar o inválido como "Pedido não encontrado". Usar
  `isRouteMissing` só nos *probes* de feature (badge, lembrete).

### 13. [RESSALVA] Lista do WS-17 com contradição e testes do mobile esquecidos

- **Contradição:** o critério 2 da §10.4 (`:972-973`) diz que o grep por `kIsWeb` só acha
  `firebase_options`/`app_check`. A §10.3 (`:964`) mantém `EnvironmentFlavor.isWeb`, e
  `lib/src/core/flavor/environment_flavor.dart:35` usa `kIsWeb`. O critério falha como escrito.
- **Testes do mobile que importam candidatos à remoção:**
  - `test/unit/core/money_format_test.dart:3` (`phone_format.dart`);
  - `test/unit/core/sao_paulo_clock_test.dart:2` (`client_request_id.dart`);
  - `test/unit/shared/teams/team_deal_test.dart:4-5` (`delivery_payment`, `delivery_status`);
  - `test/unit/shared/deliveries/delivery_problem_reason_test.dart`.

  A condição "se o grep confirmar zero uso" é ambígua: o grep em `lib/` dá zero, e o de `test/` não.
- **Correção:**
  - incluir `environment_flavor.dart` no critério;
  - listar esses testes (cortar os casos ou manter os arquivos);
  - pôr a regra de ordem do release mobile (bloqueador 4).

---

## Notas

### 1. [NOTA] Citações erradas da API

- `cors.py:217-247`: o arquivo tem 120 linhas. O certo é `cors.py:29-89`.
- `capabilities.py:310-337`: o arquivo tem 42 linhas. O certo é `capabilities.py:30-42`.
- O CORS em `main.py` está em `:51-56`.
- As citações do Flutter conferidas estão corretas:
  - `cross_tab.dart:27`;
  - `cross_tab_web.dart:17`;
  - `route_missing.dart:15-18`;
  - `polling_live_source.dart:7-11`;
  - `WS-05-plano.md:719-724`;
  - os 12 fixtures.

### 2. [NOTA] Partes da §2.2 e da §9 estão defasadas em relação ao working tree da API

- `config.py` (diff local) já tem `DELIVERY_TRACKING_BASE_URL = "https://painel.motokadriver.com/r/#"`
  e `DELIVERY_TRACKING_PAGE_ORIGINS` sem `localhost:3000`. Com isso, A-5 e A-6 já estão feitas e a frase
  "forma antiga que a API gera hoje" (DN-17) deixou de valer.
- A-1, A-2 e A-4 continuam valendo: `local.env` ainda tem `WEB_AUTH_ORIGINS=["http://localhost:8080"]`
  e `TEAM_INVITE_BASE_URL=http://localhost:8080/convite/`.

### 3. [NOTA] A H-2 está praticamente respondida

- O flavor prod do mobile usa `https://api.motokadriver.com/v1` (`environment_flavor.dart:49`), e a
  memória do projeto confirma que esse host fica atrás da Cloudflare. A DN-04 vale.
- Incluir na H-2 o `curl -4` contra `curl -6`. Em 2026-08 o registro A apontava para um nginx errado, e
  um navegador só em IPv4 veria a API "fora", sem CORS.

### 4. [NOTA] Cookie e SameSite conferidos

- O cookie é `secure=True, httponly=True, samesite="strict", path=/v1/web/auth`, sem `Domain`
  (`web_routers.py:56-63`).
- `painel.` → `api.motokadriver.com` é o mesmo site. `localhost:3001` → `localhost:8000` também, porque
  a porta não entra no "site". O esquema é http nos dois lados, então o schemeful same-site passa.
- O nome `mk_rt` sem prefixo em dev é derivado (`web_routers.py:47-51`). A ressalva do Safari no plano
  está correta.

### 5. [NOTA] Pagamento no web (WN-7): PIX sim, cartão novo não

- **PIX** cabe na CSP atual: a resposta traz `copy_paste` e `qr_code_base64`
  (`payments/presentation/schemas.py:36-37`), que vira `data:` em `img-src`.
- **Cartão já salvo pelo app** também cabe, sem tokenizar: o pagamento recebe só
  `payment_metadata.bank_card_id` (`orders/presentation/schemas.py:255-259`), e a API resolve o
  `payment_token` guardado (`create_payment.py:99-106`).
- **Cadastrar cartão novo** no web exigiria o tokenizador JS da Efí. Isso põe o PAN digitado no DOM do
  painel (escopo PCI SAQ A-EP, não SAQ A) e hosts da Efí em `script-src`/`connect-src`. O detalhe exato
  do SDK JS é PLAUSÍVEL: não li.
- **Recomendação para o WN-7:** PIX + "cartão salvo no app". O cadastro de cartão fica só no app.

### 6. [NOTA] Externalização dos scripts inline: mecanismo conferido, risco aceitável com o gate do CI

- O `out/excluir-conta.html` deste repo (16.3.6) tem **2** scripts inline:
  - `(self.__next_f=self.__next_f||[]).push([0])`;
  - um `self.__next_f.push([1,"…"])` de 16,8 KB.
- Além deles, há 8 externos (`async` e `noModule`) e **nenhum** `<style>`. Os 2 atributos `style`
  justificam a DN-06.
- Trocar o inline por um `<script src>` síncrono preserva a ordem do parser. O runtime aceita o
  `__next_f` antes ou depois de carregar.
- A navegação no cliente busca `*.txt` (RSC) por `fetch`, coberto por `connect-src 'self'`.
- O gate "falha se sobrar inline" é o que torna isso seguro em upgrades do Next. O spike deve incluir
  uma página com `Suspense`/`useSearchParams`, que pode gerar `$RC` inline.

### 7. [NOTA] Pontos menores

- O Trusted Types em Report-Only (`:404-406`) registra no console e esbarra na ressalva 5. O chunk
  loader (`script.src`) e o `new Worker(url)` do MapLibre são sinks de TT, então a premissa "não usam
  sinks" é PLAUSÍVEL-falsa.
- O `/theme-init.js` síncrono esbarra em `@next/next/no-sync-scripts` do `core-web-vitals`, e o
  disable precisa ficar justificado.
- O `yarn audit` do yarn 1 depende do endpoint legado do npm. Confirmar no spike que ele ainda responde,
  ou usar `osv-scanner`.
- Workers em vez de Pages está correto: `_headers` tem 100 regras e 2.000 caracteres por linha, `!` e
  proxy 200 com splat. A doc **não** diz qual caminho casa o `_headers` num rewrite 200, só que
  "redirects execute before headers". A frase da DN-16 é suposição, e o E2E de headers no `wrangler dev`
  precisa cobrir `/convite/<token>` e `/r/<token>`.

---

## O que eu não consegui verificar

- Não rodei `next build` com dois layouts raiz, nem a externalização, nem o `wrangler dev`. O achado 1
  vem da doc, não de build.
- Não li o SDK JS da Efí nem o Chromium sobre `upgrade-insecure-requests` em `localhost`, e não conferi
  o comportamento atual do `yarn audit`. Esses itens estão marcados PLAUSÍVEL.
- Não verifiquei a regra de detecção de raiz do Turbopack na 16.3.6 especificamente.
- Não abri os `.jsx` do Claude Design, nem os planos WS-03/WS-11 da API.

## Fontes

- Next.js, not-found / global-not-found: https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- Next.js, discussão de nonce/CSP no App Router: https://github.com/vercel/next.js/discussions/54907
- Next.js, Turbopack (`turbopack.root`): https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack
- Next 16.3.0-canary.100 (detecção de raiz): https://releases.sh/release/rel_F0oqqLl6wpg1mWXm1Iz1K
- Base UI `CSPProvider`: https://base-ui.com/react/utils/csp-provider
- Cloudflare `_headers`: https://developers.cloudflare.com/workers/static-assets/headers/
- Cloudflare `_redirects`: https://developers.cloudflare.com/workers/static-assets/redirects/
- MapLibre v5→v6: https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/

---

# Rodada 2 (plano v2)

> **VEREDITO: APROVADO COM RESSALVAS**: 0 bloqueadores, 3 ressalvas, 4 notas.

Conferi a §14 do plano v2 contra o texto do próprio plano, o working tree da API e o `motoka_app`. Os 4
bloqueadores e as 13 ressalvas da rodada 1 estão resolvidos no corpo do plano, e não só na tabela de
resposta. Os achados novos abaixo não pedem uma nova rodada. Podem ser corrigidos no `WN-0-plano.md` e
no plano do WS-17.

## Conferência da rodada 1

| # | Situação | Evidência no v2 |
|---|---|---|
| B1 | Resolvido | Layout raiz único com `app/not-found.tsx` (DN-23, §4:183-184). O export grava o `404.html` raiz, como já acontece na landing (`out/404.html`). Sem API experimental. |
| B2 | Resolvido | Duas `page` no mesmo context, com intervalos do W2 e controle negativo sem `navigator.locks` (WN-0 critérios 4 e 5, `:654-668`). |
| B3 | Resolvido | `/r/` estático (DN-17, §7.2, WN-6). Um layout raiz só. |
| B4 | Resolvido | §8.0 tem CI de PR, preview com `wrangler versions upload`, deploy com smoke e rollback, e tudo condicionado a `CLOUDFLARE_ENABLED`. A DN-26 trata a ordem com o mobile, e o WN-7 virou a última fase. Ver a ressalva R2-2 sobre o custo. |
| R1–R13 | Resolvidas | DN-01 (quatro cuidados), §8.0 `landing-check`, DN-06, DN-12, §6.1 (`! Referrer-Policy`, `{UIR}`/`{HSTS}`, sem `interest-cohort`), DN-18 com A-1/A-4/A-6, DN-07 com §5.5, DN-24, DN-11, §5.1 (`isUuid`), §10.2 a §10.4. |
| N1–N7 | Tratadas | As citações conferem: `cors.py:29-89`, `capabilities.py:30-42`, `main.py:51-56`. |

## Decisão do planejador: manter o domínio de entregas e o `client_request_id` no mobile

**Correta**, com evidência no plano aprovado do WS-07:

- `WS-07-plano.md:157` (D-W7-01): "Enums e valores comuns ao painel (`DeliveryOrigin`,
  `DeliveryStatus`, `DeliveryPayment`, `DeliveryProblemReason`) ficam em `lib/src/shared/deliveries/`".
- `WS-07-plano.md:159` (D-W7-03): o `action_id` vem de `newClientRequestId()`
  (`core/ids/client_request_id.dart`).
- `WS-07-plano.md:506,608`: o WS-07 estende e testa o `delivery_payment.dart`.
- O `delivery_channel.dart` também precisa ficar, porque o WS-07 usa `AppSourceBadge(origin, channel)`
  (`:310`).

O que a decisão não cobriu está na R2-1.

## Ressalvas

### R2-1. [RESSALVA] O `app_source_badge.dart` está na lista de remoção, mas o WS-07 usa

- **Onde:** §10.2, tabela de código compartilhado, linha `design_system/widgets/{app_icon_button,
  app_section_label,app_shift_pill,app_source_badge}.dart` com a ação "remover".
- **Evidência:**
  - `WS-07-plano.md:39` lista `design_system/widgets/{otp_code_input, app_elevated_button,
    app_source_badge}.dart` como peças reaproveitadas;
  - `:310`, `:327` e `:384` usam `AppSourceBadge` na fila, no detalhe e no cancelamento da entrega;
  - o widget importa `delivery_origin.dart` e `app_domain_colors.dart`, que o plano mantém.
- **Falha:** se o WS-17 rodar antes do WS-07, o grep em `lib/` dá zero e o widget é apagado. O WS-07
  então recria ou restaura um componente já aprovado.
- **Correção:**
  - mover o `app_source_badge.dart` para "manter (WS-07)";
  - mudar o critério da tabela para: grep em `lib/` + `test/` **e** nos planos aprovados ainda não
    implementados (`docs/equipe-escala/WS-0[6-9]*`, `WS-1*`).

### R2-2. [RESSALVA] A DN-26 e a H-9 escondem o custo: o release mobile do WS-06 fica preso ao merge de um PR que inclui o WN-4

- **Onde:** §8.0 `:577-579` ("Até lá, o mobile segura o release do WS-06"), DN-21, H-9 e o risco
  `:1231`.
- **Evidência:**
  - o PR único acumula WN-0..WN-7 (DN-21);
  - o WN-4 depende das WS-12/13/15, que ainda não têm contrato (`:885-905`);
  - o `painel-deploy` só roda a partir de `main` (§8.0 `:557`).
- **Falha:** o convite de equipe do motoboy, que é o núcleo do WS-06, fica sem release por tempo
  indeterminado. A regra da DN-26 está certa. O que falta é o usuário saber que é essa a troca.
- **Correção:** sem reabrir o PR único, a H-9 precisa dizer o custo e oferecer as duas saídas.
  - (a) Mergear quando o WN-1 fechar e seguir num PR novo. Isso continua sendo "um PR aberto por
    repo".
  - (b) Um `workflow_dispatch` de deploy de prod a partir da branch do PR, com o mesmo environment de
    aprovação, só para publicar `/.well-known` e `/convite`.

  A escolha é do usuário. O plano não pode deixar isso implícito.

### R2-3. [RESSALVA] O teto de 30 KB gz do `/r/` "com fonte" não cabe com a Inter

- **Onde:** WN-6, aceite `:954`.
- **Evidência:**
  - o woff2 já vem comprimido e o gzip não reduz;
  - um peso da Inter com subset latino já ocupa boa parte do teto, e a página usa pelo menos dois
    pesos;
  - o convite, que o plano cita como referência, **não carrega fonte**: usa a pilha
    `Inter, system-ui, …` (`motoka_app/web/convite/convite.css:27`), com um total de ~15 KB sem
    compressão.
- **Correção:** usar a pilha de fonte do sistema em `/r/`, igual ao convite, ou tirar a fonte do teto e
  limitar à parte "HTML + JS + CSS".

## Notas

### N2-1. [NOTA] Portas de dev: a lane da API escreveu 3001 de propósito, e a A-4 desfaz isso

- `local.env:53-57` e os comentários em `config.py:78` e `config.py:100` apontam os links de dev para a
  3001 ou para a 8080.
- A A-4 está certa (DN-18: o `next dev` não serve `static/` nem aplica `_redirects`). Como mexe em
  trabalho recém-feito por outra lane, o pedido precisa ir com o motivo e incluir os comentários do
  `config.py`.
- A 8787 precisa entrar também em `CORS_ORIGINS`, e não só em `WEB_AUTH_ORIGINS`. O preview do convite
  (`/v1/teams/invites/*`) não fica em `/v1/public/*` e passa pela instância pública de CORS
  (`cors.py:79-89`). A A-1 já diz isso. Fica o reforço.

### N2-2. [NOTA] Os critérios 4 e 5 do WN-0 dependem de o mock modelar a rotação

- Com `page.route`, "nenhuma aba recebe `AUTH_REFRESH_REUSED`" só significa algo se o mock recusar o
  cookie antigo fora da janela de graça.
- O critério 5 ("cookie sobrescrito de fato") depende de o `route.fulfill` gravar o `Set-Cookie` no
  Chromium. Isso é PLAUSÍVEL; não verifiquei.
- Recomendação: o mock decide o `sub` pelo **valor do cookie recebido**, e não por um contador. Assim o
  teste prova a sobrescrita.

### N2-3. [NOTA] O critério 12 do WN-0 ("os mesmos arquivos em `out/`") falha por construção

- O `next build` gera um `buildId` novo a cada build (`out/_next/static/<buildId>/`).
- Comparar a lista de arquivos ignorando esse diretório, ou fixar `generateBuildId` só no
  `landing-check`.

### N2-4. [NOTA] O preview depende do `workers.dev` (PLAUSÍVEL)

- As preview URLs dependem do subdomínio `workers.dev` habilitado.
- Se a H-1 desligar o `workers_dev` para que o prod responda só no domínio custom, o
  `painel-preview` quebra.
- Registrar na H-1: manter `workers_dev: true` com `preview_urls: true`, ou aceitar que não haverá
  preview.

## O que eu não consegui verificar (rodada 2)

- Não rodei o build nem o `wrangler versions upload`.
- Não verifiquei se o Playwright grava cookies vindos de `route.fulfill`, nem a relação entre
  `workers_dev` e `preview_urls` na versão atual do wrangler.
- Não li os planos WS-06 e WS-09 inteiros. Busquei apenas os nomes de arquivo da lista de remoção.
