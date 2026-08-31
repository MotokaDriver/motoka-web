# Página de convite do pedido (`/pedido`)

Landing pública que o motoboy abre por um link compartilhado, mostrando o detalhe
de uma solicitação feita por um estabelecimento e dois botões (**Fazer
contraproposta** / **Aceitar**) que direcionam para o app Motoka Driver.

## URL

```
/pedido?id=<UUID-do-pedido>
```

Usa **query param** (não rota dinâmica `[id]`) porque o projeto é `output: 'export'`
(exportação estática): rotas dinâmicas exigiriam pré-gerar os ids no build.

## Configuração

- `NEXT_PUBLIC_API_URL` — base da API. Default: `http://localhost:8000`.
  Definir a URL de produção no ambiente de build.
- A API precisa liberar a origem do web em `CORS_ORIGINS` (já inclui
  `http://localhost:3000`; adicionar o domínio de produção).

## Dados (endpoint público)

`GET {API}/v1/orders/{id}/public` — **sem autenticação**. Retorna um subconjunto
seguro: dados operacionais do pedido + identidade comercial do estabelecimento
(nome fantasia, avaliação, logo, **cidade/bairro/UF apenas**). Nunca telefone,
endereço exato, razão social, motoboys ou negociações.

## ⚠️ Deep link — pendência no app (Flutter)

Hoje o app **não registra nenhum deep link**, então os botões:

- **Android**: abrem o app pelo pacote (`intent://` com `browser_fallback_url`) —
  se instalado, abre na tela inicial; se não, vai para a Play Store.
- **iOS**: tentam `motoka://…` e caem para a App Store por timeout (sem esquema
  registrado, sempre vão para a loja).

Para abrir **direto na tela do pedido** (com a ação `accept`/`counter`
pré-selecionada), o app precisa registrar um deep link e roteá-lo. O alvo já é
montado como `order/{id}?action=accept|counter` (ver `app/lib/appRedirect.ts`).

O que registrar no app:

- **Android** (`android/app/src/main/AndroidManifest.xml`): um `intent-filter` na
  `MainActivity` com `action.VIEW` + `category.DEFAULT`/`BROWSABLE` e
  `<data android:scheme="motoka" android:host="order"/>` (esquema custom) **ou**
  App Links `https` com `android:autoVerify="true"` + `assetlinks.json`.
- **iOS**: `CFBundleURLTypes` com o esquema `motoka` no `Info.plist` (custom
  scheme) **ou** Associated Domains (`applinks:`) para Universal Links.
- **Flutter**: um pacote de deep link (ex.: `app_links`/`go_router`) lendo o link
  inicial e navegando para a tela do pedido com a ação.

Assim que isso existir, `app/lib/appRedirect.ts` já funciona de ponta a ponta —
basta o esquema/host baterem com `APP_SCHEME` e o caminho `order/{id}`.
