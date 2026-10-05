import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveBuildEnv } from "../../../scripts/build-env.mjs";
import { renderHeaders, validateHeaders } from "../../../scripts/build-headers.mjs";
import { injectApiMeta } from "../../../scripts/copy-static.mjs";
import { externalizeScripts } from "../../../scripts/csp-externalize.mjs";
import { inspectHtml } from "../../../scripts/verify-out.mjs";

const root = path.resolve(__dirname, "../../..");
const template = fs.readFileSync(path.join(root, "headers.template"), "utf8");

describe("csp-externalize (DN-05)", () => {
  it("troca cada script inline por um src síncrono na mesma posição, na mesma ordem", () => {
    const html =
      '<html><head><script src="/a.js" async=""></script></head><body><p>x</p>' +
      "<script>(self.__next_f=self.__next_f||[]).push([0])</script>" +
      '<script>self.__next_f.push([1,"</p>"])</script>' +
      '<script type="application/json" id="d">{"a":1}</script></body></html>';
    const { html: out, files } = externalizeScripts(html);
    expect(files.size).toBe(2);
    const [first, second] = [...files.keys()];
    expect(out).toContain(`<p>x</p><script src="/_csp/${first}"></script><script src="/_csp/${second}"></script>`);
    expect(out).toContain('<script src="/a.js" async=""></script>');
    expect(out).toContain('<script type="application/json" id="d">{"a":1}</script>');
    expect(files.get(first!)).toBe("(self.__next_f=self.__next_f||[]).push([0])");
    expect(inspectHtml(out)).toEqual([]);
  });

  it("o nome é o hash do conteúdo (cache imutável seguro)", () => {
    const a = externalizeScripts("<script>x()</script>");
    const b = externalizeScripts("<script>x()</script><script>x()</script>");
    expect([...a.files.keys()]).toEqual([...b.files.keys()]);
    expect([...a.files.keys()][0]).toMatch(/^[0-9a-f]{32}\.js$/);
  });
});

describe("verify-out", () => {
  it("acusa script inline, on*= e javascript:", () => {
    expect(inspectHtml("<script>alert(1)</script>")).toEqual(["script inline"]);
    expect(inspectHtml('<img src="x" onerror="alert(1)">')).toEqual(["atributo on*="]);
    expect(inspectHtml('<a href="javascript:alert(1)">x</a>')).toEqual(["URL javascript:"]);
    expect(inspectHtml('<script type="application/json">{}</script><script src="/a.js"></script>')).toEqual([]);
  });
});

describe("build-headers (§6.1)", () => {
  const e2e = renderHeaders(template, { appEnv: "e2e", apiUrl: "http://localhost:8000" });
  const prod = renderHeaders(template, { appEnv: "prod", apiUrl: "https://api.motokadriver.com" });

  it("prod tem HSTS e upgrade-insecure-requests; e2e não", () => {
    expect(prod).toContain("Strict-Transport-Security: max-age=31536000; includeSubDomains");
    expect(prod).toMatch(/object-src 'none'; upgrade-insecure-requests\n/);
    expect(e2e).not.toContain("Strict-Transport-Security");
    expect(e2e).not.toContain("upgrade-insecure-requests");
  });

  it("CSP sem unsafe-inline em script, com a API no connect-src", () => {
    const csp = /Content-Security-Policy: (.*)/.exec(prod)![1]!;
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toContain("connect-src 'self' https://api.motokadriver.com https://viacep.com.br;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(/Content-Security-Policy: (.*)/.exec(e2e)![1]).toContain("connect-src 'self' http://localhost:8000 ");
  });

  it("cada bloco que sobrescreve Cache-Control ou Referrer-Policy remove o herdado", () => {
    const blocks = prod.split(/\n(?=\S)/);
    for (const block of blocks) {
      for (const header of ["Cache-Control", "Referrer-Policy"]) {
        if (block.startsWith("/*")) continue;
        if (block.includes(`  ${header}:`)) expect(block).toContain(`  ! ${header}`);
      }
    }
  });

  it("sem comentário, sem marcador e dentro dos limites", () => {
    expect(prod).not.toContain("#");
    expect(() => validateHeaders(prod)).not.toThrow();
    expect(() => validateHeaders(`/*\n  X: ${"a".repeat(2001)}\n`)).toThrow();
    expect(() => validateHeaders(Array.from({ length: 101 }, (_, i) => `/r${i}\n  X: y`).join("\n"))).toThrow();
  });

  it("sem interest-cohort (o Chrome loga erro em toda página)", () => {
    expect(prod).not.toContain("interest-cohort");
  });
});

describe("build-env (DN-14)", () => {
  it("dev usa a API local por padrão", () => {
    expect(resolveBuildEnv({})).toMatchObject({ appEnv: "dev", apiUrl: "http://localhost:8000" });
  });

  it("prod exige https em *.motokadriver.com", () => {
    expect(resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com" }).apiUrl).toBe(
      "https://api.motokadriver.com",
    );
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod" })).toThrow();
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "http://localhost:8000" })).toThrow();
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://evil.com" })).toThrow();
    expect(() =>
      resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://u:p@api.motokadriver.com" }),
    ).toThrow();
    expect(() =>
      resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "prod", NEXT_PUBLIC_API_URL: "https://api.motokadriver.com/v1" }),
    ).toThrow();
    expect(() => resolveBuildEnv({ NEXT_PUBLIC_APP_ENV: "staging" })).toThrow();
  });
});

describe("páginas estáticas (porte de invite_static_files_test.dart)", () => {
  const html = fs.readFileSync(path.join(root, "static-pages/convite/index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "static-pages/convite/convite.js"), "utf8");
  const rHtml = fs.readFileSync(path.join(root, "static-pages/r/index.html"), "utf8");

  it("convite e /r/ sem script inline, sem on*=, com noindex e no-referrer", () => {
    for (const page of [html, rHtml]) {
      expect(inspectHtml(page)).toEqual([]);
      expect(page).toContain('<meta name="robots" content="noindex">');
      expect(page).toContain('<meta name="referrer" content="no-referrer">');
      expect(page).not.toMatch(/<link[^>]+fonts\.googleapis/);
    }
  });

  it("assets do convite fora de /convite/ (senão a reescrita devolve o HTML)", () => {
    expect(html).toContain('src="/_static/convite/convite.js"');
    expect(html).toContain('href="/_static/convite/convite.css"');
    expect(rHtml).toContain('href="/_static/r/r.css"');
  });

  it("a API entra pela meta no pós-build", () => {
    expect(html).toContain('<meta name="motoka-api" content="__MOTOKA_API__">');
    expect(injectApiMeta(html, "https://api.motokadriver.com/v1")).toContain(
      '<meta name="motoka-api" content="https://api.motokadriver.com/v1">',
    );
    expect(() => injectApiMeta(html, 'x" onload="alert(1)')).toThrow();
  });

  it("regex do token, textos por error_code e lojas", () => {
    expect(js).toContain("/^[A-Za-z0-9_-]{16,64}$/");
    for (const code of ["TEAM_INVITE_NOT_FOUND", "TEAM_INVITE_EXPIRED", "TEAM_INVITE_ALREADY_USED", "TEAM_INVITE_REVOKED"]) {
      expect(js).toContain(code);
    }
    expect(js).toContain("id6759629174");
    expect(js).toContain("com.app.motoka_app");
    expect(js).toContain('credentials: "omit"');
    expect(js).not.toMatch(/\.detail\b/);
  });

  it(".well-known copiado literalmente do motoka_app", () => {
    const links = JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/assetlinks.json"), "utf8"));
    expect(links[0].target.package_name).toBe("com.app.motoka_app");
    expect(links[0].target.sha256_cert_fingerprints[0]).toMatch(/^B8:7B:54:/);
    const aasa = JSON.parse(fs.readFileSync(path.join(root, "public/.well-known/apple-app-site-association"), "utf8"));
    expect(aasa.applinks.details[0].appIDs).toEqual(["9D92T4ZS2F.com.app.motoka"]);
    expect(aasa.applinks.details[0].components[0]["/"]).toBe("/convite/*");
  });

  it("_redirects tem só as duas reescritas, sem catch-all de SPA", () => {
    const rules = fs
      .readFileSync(path.join(root, "_redirects"), "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
    expect(rules.map((line) => line.trim().split(/\s+/))).toEqual([
      ["/convite/*", "/convite/", "200"],
      ["/r/*", "/r/", "200"],
    ]);
  });
});

describe("flatten-segments", () => {
  it("grava o payload de segmento com o nome que o cliente pede", async () => {
    const os = await import("node:os");
    const { flattenSegments } = await import("../../../scripts/flatten-segments.mjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "painel-out-"));
    const nested = path.join(dir, "ao-vivo", "__next.!KGFwcCk", "!KHNoZWxsKQ", "ao-vivo");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, "__PAGE__.txt"), "payload");
    fs.mkdirSync(path.join(dir, "_next", "__next.x"), { recursive: true });
    fs.writeFileSync(path.join(dir, "_next", "__next.x", "a.txt"), "ignorado");
    expect(flattenSegments(dir)).toBe(1);
    expect(fs.readFileSync(path.join(dir, "ao-vivo", "__next.!KGFwcCk.!KHNoZWxsKQ.ao-vivo.__PAGE__.txt"), "utf8")).toBe("payload");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
