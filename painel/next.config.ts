import type { NextConfig } from "next";
import { resolveBuildEnv } from "./scripts/build-env.mjs";

// Painel web do estabelecimento (DN-01, DN-02): app Next independente da landing, exportado como
// site estático e servido pelo Cloudflare Workers Static Assets. Não há servidor Next nem BFF.
//
// As variáveis públicas são validadas aqui (DN-14): um valor inválido falha o build, e os mesmos
// valores montam a CSP no pós-build (scripts/build-headers.mjs).
const env = resolveBuildEnv(process.env);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: { unoptimized: true },
  // O repo tem yarn.lock e package-lock.json na raiz (da landing): sem isto o Next infere a raiz
  // errada pelos lockfiles (DN-01, ressalva 2).
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  env: {
    NEXT_PUBLIC_API_URL: env.apiUrl,
    NEXT_PUBLIC_APP_ENV: env.appEnv,
    NEXT_PUBLIC_MAP_STYLE_URL: env.mapStyleUrl,
  },
};

export default nextConfig;
