import type { NextConfig } from "next";

// URL do painel web do estabelecimento (Flutter web, hospedado fora da landing).
// O domínio definitivo ainda não existe: o default é um placeholder documentado no README.
const DEFAULT_PAINEL_URL = "https://painel.motokadriver.com";
const BASE_ALLOWED_DOMAINS = ["motokadriver.com"];

function resolvePainelUrl(): string {
  const isProd = process.env.NODE_ENV === "production";
  const raw = (process.env.NEXT_PUBLIC_PAINEL_URL ?? "").trim() || DEFAULT_PAINEL_URL;
  const extra = (process.env.PAINEL_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const allowed = [...BASE_ALLOWED_DOMAINS, ...extra];

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_PAINEL_URL inválida: "${raw}"`);
  }

  const isLocalDev = !isProd && url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !isLocalDev) {
    throw new Error(`NEXT_PUBLIC_PAINEL_URL deve usar https: "${raw}"`);
  }
  if (url.username || url.password) {
    throw new Error("NEXT_PUBLIC_PAINEL_URL não pode conter credenciais.");
  }
  const host = url.hostname.toLowerCase();
  const hostAllowed = allowed.some((d) => host === d || host.endsWith(`.${d}`));
  if (!hostAllowed && !isLocalDev) {
    throw new Error(
      `NEXT_PUBLIC_PAINEL_URL: host "${host}" fora da allowlist (${allowed.join(", ")}). ` +
        `Use PAINEL_ALLOWED_HOSTS para autorizar outro domínio.`,
    );
  }
  return url.href;
}

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/motoka-web' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/motoka-web/' : '',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_PAINEL_URL: resolvePainelUrl(),
  },
};

export default nextConfig;
