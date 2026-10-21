This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Botão "Entrar" (painel do estabelecimento)

O botão "Entrar" leva ao painel web (app Next em `painel/`, publicado no Cloudflare Workers, fora da landing; ver `painel/README.md`). A URL vem de variáveis de **build**:

| Variável | Uso | Default |
|---|---|---|
| `NEXT_PUBLIC_PAINEL_URL` | URL do painel (pública, não é segredo; nunca colocar segredo em `NEXT_PUBLIC_*`) | `https://painel.motokadriver.com` (placeholder, domínio ainda não definido) |
| `PAINEL_ALLOWED_HOSTS` | domínios extras permitidos, separados por vírgula (só build) | vazio |

`next.config.ts` valida em build e **falha o build** se a URL não for `https` (exceto `http://localhost` em dev), tiver credenciais ou estiver fora da allowlist (`motokadriver.com` e subdomínios + `PAINEL_ALLOWED_HOSTS`). Em produção, definir as variáveis em Settings > Variables do repositório (o workflow as repassa). O link abre na mesma aba; motoboys são orientados a usar o app. Detalhes em `docs/WS-08-plano.md`.
