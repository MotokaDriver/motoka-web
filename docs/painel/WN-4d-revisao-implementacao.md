# WN-4d (Nuvemshop): revisão adversarial da implementação

**Alvo:** working tree de `motoka-web` sobre `c253bc5`, sem commit. Registro na §24 do `WN-plano.md`.
**Contrato:** API em `de69675` (WS-16).
**Lentes:** devil-advocate e hm-qa.
**Data:** 2026-10-06.

> **VEREDITO: APROVADO COM RESSALVAS.** 0 bloqueadores, 2 ressalvas e 3 notas.

## Verificações executadas (sem Docker)

| Verificação | Resultado |
|---|---|
| lint e typecheck | exit 0 |
| Vitest | 446/446 |
| Build e2e | ok |
| Playwright mockado | **93/93**, dos quais 3 são da Nuvemshop |
| Login | 219,4 KiB gz |
| E2E real | não existe: o app Nuvemshop ainda não está cadastrado (H-N1..N4) |

## Conferido sem achado

### Conexão amarrada ao parceiro certo

- A volta compara o `type` guardado com o da página: `pending.type !== type` (`OauthReturn.tsx:55`).
  O `state` de outro parceiro é recusado sem chamar a API.
- A API guarda o hash do `state` na linha da integração daquele `type`.
- O `authorize/complete` sai com o `type` da rota.

Para a Nuvemshop **não existe PKCE**. A API monta só `…/apps/{app_id}/authorize?state=`
(`nuvemshop.py:154-155`) e troca o `code` com o `NUVEMSHOP_CLIENT_SECRET` no servidor. É um cliente
confidencial, então a segurança fica igual. Só o texto da §24 ("o mesmo fluxo PKCE") precisa ser
corrigido.

### Cotação contra os limites reais

O `NuvemshopSettingsRequest` (`presentation/schemas.py:31-58`) define:

- preço de 0 a 9.999,99;
- `eta` de 1 a 600;
- até 200 faixas de CEP, cada uma com 8 dígitos e início menor ou igual ao fim;
- até 200 cidades, cortadas em 120 caracteres.

O `validateSettings` e o `parseCities` (`NuvemshopSettings.tsx:60-77`) aplicam os mesmos limites. O
painel é mais restrito no horário: exige início e fim juntos e recusa início depois do fim. A API não
tem esse validador, mas o `covers()` só atende com `open_from ≤ hora ≤ open_until`
(`nuvemshop.py:107`), então uma janela que vira a meia-noite nunca cotaria. O painel evita esse
silêncio.

O preço só aceita dígitos (`currencyInput`). Em branco, o preço é 0, conforme a dica "Deixe em branco
para frete grátis".

### "Gerar novo endereço de cotação"

Chama `POST …/shipping-settings/route-token` depois de uma confirmação. O `route_token` nunca vai para
a tela.

### `incomplete` e "Refazer cadastro"

- `POST …/setup` lê o resultado da resposta: `connected` mostra "Cadastro refeito." e `incomplete`
  mantém o aviso.
- Na volta da autorização, o painel lê o status: `connected` ou `incomplete` com texto próprio. A R1 do
  WN-4c foi atendida.
- `soon` virou "Indisponível neste ambiente".

## Ressalvas

### 1. [RESSALVA] A instalação feita pela loja de apps da Nuvemshop vai falhar

- **Evidência:**
  - O retorno exige o `state` guardado na aba (`OauthReturn.tsx:55`). O `state` só existe quando a
    conexão começa pelo "Conectar" do painel.
  - Na Nuvemshop, o caminho comum é instalar o app pela loja de apps ou pelo admin. A Nuvemshop então
    redireciona para a URL cadastrada com `?code=` e **sem o nosso `state`**.
  - Se a loja não estiver logada no painel, o `ShellGate` manda para `/entrar/` e o `code` se perde. O
    retorno não está em `KNOWN_PATHS`, então não há `?de=`. Do ponto de vista da segurança, isso está
    correto.
- **Falha:** a loja instala o app na Nuvemshop e vê "Não foi possível confirmar a conexão. Comece de
  novo pelo painel."
- **Correção:** decidir e registrar uma das duas.
  - **(a) Fluxo só pelo painel (recomendado):** a descrição do app na Nuvemshop diz "conecte pelo
    painel Motoka". A mensagem de recusa ganha um botão "Conectar a Nuvemshop", que leva direto a
    `/integracoes/?conector=nuvemshop`.
  - **(b) Instalação iniciada pela Nuvemshop:** exige que a API amarre o `code` à loja de outro jeito,
    sem `state`, o que traz risco de CSRF de login. Não recomendado.

### 2. [RESSALVA] O `redirect_uri` depende de configuração manual, sem nenhuma verificação

- **Evidência:**
  - A Nuvemshop não recebe `redirect_uri` na URL. Ele é o cadastrado no app (H-N1).
  - O painel serve `/integracoes/nuvemshop/retorno/` com barra final (`trailingSlash`).
  - Sem a barra, o `html_handling: auto-trailing-slash` do Workers redireciona com 307. A query deve
    ser preservada, mas isso não foi testado.
  - O mesmo vale para o `CARDAPIO_WEB_REDIRECT_URI`, que tem o default `""` em `config.py:283`.
- **Correção:**
  1. Registrar as duas URLs exatas no README do painel e na H-1, como a §24 já indica.
  2. Escrever um E2E no `wrangler dev` que pede `/integracoes/nuvemshop/retorno?code=x&state=y`, sem a
     barra, e confere que chega à página com a query intacta.

## Notas

1. **Parser de preço frágil.** O `parseShippingSettings` (`api.ts:145-148`) aceita `"15"` sem casas
   decimais, e o formulário faz `price.replace(".", "")` seguido de `currencyInput`, que lê dígitos como
   centavos. Hoje a API devolve `str(row.price)` de uma coluna `numeric(10,2)` (`"15.00"`), então
   funciona. Se um dia vier `"15"`, a tela mostra R$ 0,15 e um "Salvar" sem mudanças grava 0,15.
   Normalizar com `Number(price).toFixed(2)` antes da máscara.
2. **LGPD.** Os três webhooks de LGPD são só da API. Correto não haver tela.
3. **Casos de teste que faltam:**
   - a volta com `state` de outro parceiro, em E2E (hoje só em unidade);
   - a volta sem `state` (o caso da ressalva 1);
   - "Refazer cadastro" voltando `incomplete` de novo.

## O que não foi verificado

- O fluxo real com a Nuvemshop.
- O comportamento do Workers com a URL sem barra final.
