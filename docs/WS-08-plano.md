# WS-08 — Botão "Entrar" (landing → painel web do estabelecimento)

## Escopo
- Botão "Entrar" na landing (`app/page.tsx`, header fixo) e no `app/components/Header.tsx` (usado por páginas legais e `/pedido`), no desktop **e** no mobile.
- Dentro de escopo: helper de URL (`app/lib/painel.ts`), validação em build, documentação (README), este plano.
- Fora de escopo: o painel Flutter web, o domínio definitivo, deep link, qualquer login dentro da landing.

## Pesquisa (resumo)
- Landing Next 16 + React 19 + Tailwind 4, `output: 'export'`, `basePath /motoka-web` em produção, deploy por `.github/workflows/nextjs.yml` (só `NEXT_PUBLIC_API_URL` entra no build).
- Header da home: `<nav className="hidden md:flex">` com âncoras e CTA "Contato" (pill preto). **Não existe menu mobile** hoje: no mobile a nav some. `Header.tsx` idem (`hidden md:flex`).
- Footer: links internos para termos/privacidade/excluir conta (`Footer.tsx` e rodapé escuro em `page.tsx`).
- Site estático no GitHub Pages: não dá para definir headers HTTP/CSP; só `<meta>`. Não se adiciona CSP por meta (risco de quebrar GA/next inline scripts) — registrado como pendência.
- Design: Tailwind, cor `primary #3756A9`, pill `rounded-full`, texto cinza-600 uppercase no header da home. Projeto Claude Design "Motoka App": `ui_kits/team_schedule` mostra o painel (telas), não há referência da landing; segue-se o padrão atual da landing.

## Decisões
1. **URL**: `NEXT_PUBLIC_PAINEL_URL`, default `https://painel.motokadriver.com` (placeholder documentado; domínio real é pendência humana). `app/lib/painel.ts` apenas lê `process.env.NEXT_PUBLIC_PAINEL_URL`.
2. **Mesma aba** (sem `target="_blank"`): navegação para outro app, fluxo de login; sem `window.opener` por construção, então `rel` é desnecessário. Se virar nova aba, `rel="noopener noreferrer"` é obrigatório (comentado no helper).
3. **Validação em build, em `next.config.ts`** (falha o build, não degrada em silêncio; o resultado normalizado é injetado em `env.NEXT_PUBLIC_PAINEL_URL`, de modo que o bundle cliente nunca revalida nem depende de variável não pública): URL parseável, protocolo `https:` (exceção `http://localhost` apenas fora de produção), sem credenciais (`user:pass@`), host na allowlist (`motokadriver.com` e subdomínios; extras via `PAINEL_ALLOWED_HOSTS`, variável **sem** prefixo NEXT_PUBLIC, só build). Valor normalizado via `URL.href`.
4. **Sem segredos em NEXT_PUBLIC_***: a URL é pública por natureza; nada mais é exposto. Documentado no README.
5. **Texto**: "Entrar" no botão, `aria-label="Entrar na área do estabelecimento"`; `title` idem. Aviso ao motoboy: no mobile, linha curta sob o header/menu: "Motoboy? O acesso é pelo app." com link para `#download` (home) / `/#download` (Header). No desktop, `title` + texto auxiliar no mesmo bloco discreto.
6. **Mobile**: sem hambúrguer (não existe hoje; criar menu completo foge do escopo). Exibe-se, abaixo do md, um botão compacto "Entrar" no próprio header ao lado do logo (sempre visível) ; a nota do motoboy fica no hero. Desktop: link secundário "Entrar" (borda, não compete com o CTA preto "Contato").
7. **Acessibilidade**: `focus-visible:outline` 2px `primary` com offset; alvo mínimo 44px de altura no mobile; contraste: texto `primary #3756A9` sobre branco (~7:1).
8. Footer: adicionar link "Área do estabelecimento" no `Footer.tsx` e no rodapé da home (dois pontos adicionais de acesso, baixo custo).

## Passos
1. `next.config.ts` (resolve + valida + injeta) e `app/lib/painel.ts` (constante de leitura).
2. Componente `app/components/EntrarButton.tsx` (variantes `desktop`/`mobile`) e `MotoboyNote`.
3. Integrar em `Header.tsx`, header de `page.tsx`, footers.
4. Workflow: repassar `NEXT_PUBLIC_PAINEL_URL: ${{ vars.NEXT_PUBLIC_PAINEL_URL }}` (string vazia deve cair no default).
5. README: seção do painel.
6. Segurança: `yarn audit` (yarn 1) e registro; `yarn lint`, `yarn build`; conferir `out/index.html` (href absoluto, sem basePath, pois é externo).

## Segurança
- URL externa absoluta: o basePath não se aplica; verificar no `out/`.
- Allowlist + https + sem credenciais evitam open-redirect/phishing por variável de build mal configurada.
- Variável vazia no workflow (`vars` inexistente) → default, não erro.
- Auditoria de dependências: ver resultados abaixo.

## Pendências humanas
- Definir o domínio real do painel e criar a variável de repositório `NEXT_PUBLIC_PAINEL_URL` (e, se fora de `motokadriver.com`, `PAINEL_ALLOWED_HOSTS`).
- CSP/headers: impossível no GitHub Pages; avaliar proxy (Cloudflare) se desejado.

## Resultados das revisões
### Devil's advocate do plano (feito pelo próprio autor seguindo o roteiro da skill; a skill é só um prompt, sem subagente)
- RESSALVA corrigida: validação com `PAINEL_ALLOWED_HOSTS` (variável não pública) em módulo importado por `page.tsx` ("use client") rodaria no navegador sem a variável e lançaria erro; movida para `next.config.ts`.
- RESSALVA corrigida: faixa do motoboy sob o header fixo (h-20) sobreporia o hero (`pt-32`); nota movida para o hero.
- Verificado: logo `w-48` + botão cabem em 320px; variável vazia do workflow cai no default; `rel` sem `target` é desnecessário.
- Veredito: APROVADO COM RESSALVAS (já incorporadas).


### Revisão da implementação (hm-engineer, hm-designer, hm-qa, devil-advocate)
As skills são prompts de roteiro, sem subagente próprio: a revisão equivalente foi feita pelo autor sobre o diff e registrada aqui.
- hm-engineer: validação concentrada em `next.config.ts` (uma fonte); `painel.ts` só lê a env; componente único `EntrarButton`; sem dependências novas. Sem achados.
- hm-designer: botão secundário (borda `primary`, pill) não compete com o CTA preto "Contato"; foco visível 2px; alvo `min-h-11` (44px); no mobile o botão fica ao lado do logo (`w-48` + botão cabem em 320px); nota "Motoboy? Seu acesso é pelo app" no hero. A versão `md:hidden` e a do `nav` nunca aparecem juntas (display:none sai da árvore de acessibilidade). Sem hambúrguer: não existia.
- hm-qa: `yarn build` OK; `out/index.html`, `out/pedido.html`, `out/termos-de-uso.html` com `href="https://painel.motokadriver.com/"` (externo, sem basePath, correto). Build falha, com mensagem clara, para `http://`, host fora da allowlist, `host.evil.com` (sufixo enganoso) e credenciais na URL. `tsc --noEmit` limpo.
- Devil's advocate da implementação: aprovado. Ressalva: `target` ausente de propósito (mesma aba), registrado.
- `yarn lint` NÃO roda: preexistente (`next lint` interativo + `.eslintrc.json` legado com eslint 9 gera erro de estrutura circular). Não corrigido (fora de escopo); a revisão de tipos foi feita com `tsc`.
- Auditoria (`yarn audit`): 20 achados, 19 em devDependencies (eslint-config-next etc.). Em dependências de produção: 1 crítico no `next` (RCE em `next/og ImageResponse`, corrigido em >=16.3.6). A landing é export estático e não usa `next/og`, mas convém subir o Next. Preexistente, fora do escopo, pendência.

## Pendências adicionais
- Subir `next` para >=16.3.6.
- Consertar o lint (migrar para `eslint.config.mjs` / `eslint .`).
