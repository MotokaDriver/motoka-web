import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBuildEnv, tileOriginsFor } from "../../../scripts/build-env.mjs";
import { renderHeaders } from "../../../scripts/build-headers.mjs";
import { copyMaplibreWorker, maplibreVersion } from "../../../scripts/map-assets.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

describe("ativos do mapa (WN-3, WN-3b, DN-11)", () => {
  it("a origem dos tiles do Google entra em connect-src e img-src da CSP, sem blob em worker-src", () => {
    const template = fs.readFileSync(path.join(root, "headers.template"), "utf8");
    const headers = renderHeaders(template, { appEnv: "prod", apiUrl: "https://api.motokadriver.com", tileOrigins: ["https://tile.googleapis.com"] });
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy")) ?? "";
    expect(csp).toMatch(/connect-src [^;]*https:\/\/tile\.googleapis\.com;/);
    expect(csp).toMatch(/img-src [^;]*https:\/\/tile\.googleapis\.com;/);
    // Nada do Maps JS (D-W3b-01): nem script nem estilo de fora.
    expect(csp).not.toContain("maps.googleapis.com");
    expect(csp).toContain("style-src 'self';");
    expect(csp).toMatch(/worker-src 'self'(;|$)/);
    expect(csp).not.toMatch(/worker-src[^;]*blob:/);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
  });

  it("chave do Google: vazia desliga o mapa; formato fechado (20–80 de [A-Za-z0-9_-])", () => {
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e" }).googleMapsKey).toBe("");
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: " e2e-fake-key-0000000000 " }).googleMapsKey).toBe("e2e-fake-key-0000000000");
    for (const bad of ["curta", "a".repeat(81), "chave com espaço 0000000000", "AIza\"><script>0000000000"]) {
      expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: bad })).toThrow(/formato/);
    }
  });

  it("base dos tiles: fixa no Google em prod; http://localhost só fora de prod; só a origem", () => {
    const prod = { NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com" };
    expect(resolveBuildEnv(prod).googleTilesUrl).toBe("https://tile.googleapis.com");
    expect(resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_TILES_URL: "https://tile.googleapis.com/" }).googleTilesUrl).toBe("https://tile.googleapis.com");
    expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_TILES_URL: "http://localhost:8790" })).toThrow(/prod/);
    expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_TILES_URL: "https://tiles.evil.test" })).toThrow(/prod/);
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_TILES_URL: "http://localhost:8790" }).googleTilesUrl).toBe("http://localhost:8790");
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e" }).googleTilesUrl).toBe("https://tile.googleapis.com");
    for (const bad of ["https://tiles.evil.test", "http://tiles.test", "http://localhost:8790/v1", "http://u:p@localhost:8790", "http://localhost:8790/?x=1", "nada"]) {
      expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_TILES_URL: bad })).toThrow(/NEXT_PUBLIC_GOOGLE_TILES_URL/);
    }
  });

  it("CSP sem chave (preview de PR): nenhum host de tiles em img-src nem connect-src, e nenhum marcador sobra", () => {
    const template = fs.readFileSync(path.join(root, "headers.template"), "utf8");
    const headers = renderHeaders(template, { appEnv: "prod", apiUrl: "https://api.motokadriver.com", tileOrigins: [] });
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy")) ?? "";
    expect(csp).toMatch(/img-src 'self' data: blob:;/);
    expect(csp).toMatch(/connect-src 'self' https:\/\/api\.motokadriver\.com https:\/\/viacep\.com\.br;/);
    expect(csp).not.toContain("googleapis");
    expect(headers).not.toMatch(/[{}]/);
  });

  it("base dos tiles em prod: credenciais, http, fragmento, porta e host parecido são recusados; maiúsculas e :443 normalizam", () => {
    const prod = { NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com" };
    for (const bad of [
      "https://u:p@tile.googleapis.com",
      "https://:p@tile.googleapis.com",
      "http://tile.googleapis.com",
      "https://tile.googleapis.com/#x",
      "https://tile.googleapis.com.evil.test",
      "https://tile.googleapis.com:8443",
      "//tile.googleapis.com",
    ]) {
      expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_TILES_URL: bad }), bad).toThrow(/NEXT_PUBLIC_GOOGLE_TILES_URL/);
    }
    for (const ok of ["HTTPS://TILE.GOOGLEAPIS.COM", "https://tile.googleapis.com:443", "  https://tile.googleapis.com  "]) {
      expect(resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_TILES_URL: ok }).googleTilesUrl, ok).toBe("https://tile.googleapis.com");
    }
  });

  it("chave em prod: formato real do Google aceito; vazia é permitida (mapa desligado, não quebra o build)", () => {
    const prod = { NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com" };
    const real = "AIzaSyA1b2C3d4E5f6G7h8I9j0K_lMnOpQrStU-v";
    expect(resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: real }).googleMapsKey).toBe(real);
    expect(resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "   " }).googleMapsKey).toBe("");
    for (const bad of ["a".repeat(19), "AIza\n0000000000000000000", "AIza.0000000000000000000", "key=AIza000000000000000000"]) {
      expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: bad }), JSON.stringify(bad)).toThrow(/formato/);
    }
    expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "a".repeat(20) })).not.toThrow();
    expect(() => resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "a".repeat(80) })).not.toThrow();
  });

  it("CSP com a origem do mock (E2E): http://localhost:8790 entra em img-src, sem upgrade-insecure-requests", () => {
    const template = fs.readFileSync(path.join(root, "headers.template"), "utf8");
    const headers = renderHeaders(template, { appEnv: "e2e", apiUrl: "http://localhost:8790", tileOrigins: ["http://localhost:8790"] });
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy")) ?? "";
    expect(csp).toMatch(/img-src [^;]*http:\/\/localhost:8790;/);
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("tileOriginsFor: a base dos tiles entra na CSP só com chave (prod, E2E e preview sem chave)", () => {
    const prod = { NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com" };
    expect(tileOriginsFor(resolveBuildEnv({ ...prod, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaSyA-real_formato_0123456789abcd" }))).toEqual(["https://tile.googleapis.com"]);
    expect(tileOriginsFor(resolveBuildEnv(prod))).toEqual([]);
    expect(tileOriginsFor(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "e2e-fake-key-0000000000", NEXT_PUBLIC_GOOGLE_TILES_URL: "http://localhost:8790" }))).toEqual(["http://localhost:8790"]);
    // Base local sem chave: nada na CSP (o mapa nem sobe).
    expect(tileOriginsFor(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_TILES_URL: "http://localhost:8790" }))).toEqual([]);
  });

  it("copia o worker para out/_maplibre/<versão>/ e a versão bate com a travada", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "motoka-out-"));
    const version = copyMaplibreWorker(root, out);
    expect(version).toBe(maplibreVersion(root));
    expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies["maplibre-gl"]).toBe(version);
    expect(fs.existsSync(path.join(out, "_maplibre", version, "maplibre-gl-worker.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(out, "_maplibre", version, "maplibre-gl-shared.mjs"))).toBe(true);
    fs.rmSync(out, { recursive: true, force: true });
  });
});
