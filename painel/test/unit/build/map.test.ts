import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBuildEnv } from "../../../scripts/build-env.mjs";
import { renderHeaders } from "../../../scripts/build-headers.mjs";
import { copyMaplibreWorker, loadTileOrigins, maplibreVersion, parseExtraOrigins, styleOrigins } from "../../../scripts/map-assets.mjs";

const root = path.resolve(import.meta.dirname, "../../..");

describe("ativos do mapa (WN-3, DN-11)", () => {
  it("origens do estilo: próprio estilo, tiles, glyphs e sprite", () => {
    const style = {
      glyphs: "https://fonts.tiles.test/{fontstack}/{range}.pbf",
      sprite: "https://cdn.tiles.test/sprites/base",
      sources: {
        osm: { type: "vector", tiles: ["https://a.tiles.test/{z}/{x}/{y}.pbf", "https://b.tiles.test/{z}/{x}/{y}.pbf"] },
        tj: { type: "vector", url: "https://meta.tiles.test/tiles.json" },
        local: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      },
    };
    expect(styleOrigins(style, "https://api.tiles.test/style.json")).toEqual([
      "https://a.tiles.test",
      "https://api.tiles.test",
      "https://b.tiles.test",
      "https://cdn.tiles.test",
      "https://fonts.tiles.test",
      "https://meta.tiles.test",
    ]);
    expect(styleOrigins({ sprite: [{ id: "a", url: "https://s.tiles.test/x" }] }, "https://api.tiles.test/s.json")).toContain("https://s.tiles.test");
  });

  it("baixa o estilo no build e falha alto se ele não vier", async () => {
    const ok = async () => new Response(JSON.stringify({ sources: { a: { tiles: ["https://t.tiles.test/{z}.pbf"] } } }), { status: 200 });
    expect(await loadTileOrigins("https://api.tiles.test/style.json", ok as typeof fetch)).toEqual(["https://api.tiles.test", "https://t.tiles.test"]);
    await expect(loadTileOrigins("https://api.tiles.test/s.json", (async () => new Response("x", { status: 500 })) as typeof fetch)).rejects.toThrow(/500/);
    await expect(loadTileOrigins("https://api.tiles.test/s.json", (async () => new Response("<html>", { status: 200 })) as typeof fetch)).rejects.toThrow(/JSON/);
    // Estilo local (E2E) não precisa de rede no build.
    expect(await loadTileOrigins("http://localhost:8790/style.json", (async () => { throw new Error("sem rede"); }) as typeof fetch)).toEqual(["http://localhost:8790"]);
  });

  it("TileJSON: os tiles de dentro dele (outro CDN) entram na CSP; TileJSON que não baixa falha o build", async () => {
    const style = { sources: { osm: { type: "vector", url: "https://meta.tiles.test/osm.json" } } };
    const fetcher = (async (url: string) => {
      if (url === "https://api.tiles.test/style.json") return new Response(JSON.stringify(style), { status: 200 });
      if (url === "https://meta.tiles.test/osm.json") return new Response(JSON.stringify({ tiles: ["https://cdn.outro.test/{z}/{x}/{y}.pbf"] }), { status: 200 });
      return new Response("x", { status: 404 });
    }) as unknown as typeof fetch;
    expect(await loadTileOrigins("https://api.tiles.test/style.json", fetcher)).toEqual(["https://api.tiles.test", "https://cdn.outro.test", "https://meta.tiles.test"]);
    const broken = (async (url: string) => (url.endsWith("style.json") ? new Response(JSON.stringify(style), { status: 200 }) : new Response("x", { status: 500 }))) as unknown as typeof fetch;
    await expect(loadTileOrigins("https://api.tiles.test/style.json", broken)).rejects.toThrow(/TileJSON/);
  });

  it("MAP_EXTRA_ORIGINS: só origens https sem caminho", () => {
    expect(parseExtraOrigins("https://a.test, https://b.test/")).toEqual(["https://a.test", "https://b.test"]);
    expect(parseExtraOrigins(undefined)).toEqual([]);
    for (const bad of ["http://a.test", "https://a.test/x", "https://u:p@a.test", "a.test"]) expect(() => parseExtraOrigins(bad)).toThrow();
  });

  it("os hosts do estilo entram em connect-src e img-src da CSP, sem blob em worker-src", () => {
    const template = fs.readFileSync(path.join(root, "headers.template"), "utf8");
    const headers = renderHeaders(template, { appEnv: "prod", apiUrl: "https://api.motokadriver.com", tileOrigins: ["https://tiles.test", "https://fonts.test"] });
    const csp = headers.split("\n").find((line) => line.includes("Content-Security-Policy")) ?? "";
    expect(csp).toMatch(/connect-src [^;]*https:\/\/tiles\.test https:\/\/fonts\.test/);
    expect(csp).toMatch(/img-src [^;]*https:\/\/tiles\.test/);
    expect(csp).toMatch(/worker-src 'self'(;|$)/);
    expect(csp).not.toMatch(/worker-src[^;]*blob:/);
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
  });

  it("estilo http://localhost só fora de prod; https sempre", () => {
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_MAP_STYLE_URL: "http://localhost:8790/style.json" }).mapStyleUrl).toBe("http://localhost:8790/style.json");
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com", NEXT_PUBLIC_MAP_STYLE_URL: "http://localhost:8790/style.json" })).toThrow(/https/);
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_MAP_STYLE_URL: "http://tiles.test/style.json" })).toThrow(/https/);
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_MAP_STYLE_URL: "https://u:p@tiles.test/s.json" })).toThrow(/credenciais/);
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "e2e" }).mapStyleUrl).toBe("");
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
