import { expect, test } from "./guard";
import { API } from "./mockApi";

/**
 * Headers efetivos do `wrangler dev` (critério 2), 404, `.well-known`, convite e `/r/`.
 * A variante (prod com HSTS/UIR, e2e sem) é a do build servido: `E2E_VARIANT=prod` depois de um
 * `NEXT_PUBLIC_APP_ENV=prod yarn build` (o CI faz os dois builds).
 */
const PROD = process.env.E2E_VARIANT === "prod";
const API_ORIGIN = process.env.E2E_API_ORIGIN ?? (PROD ? "https://api.motokadriver.com" : API);

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; " +
  `font-src 'self'; connect-src 'self' ${API_ORIGIN} https://viacep.com.br; worker-src 'self'; manifest-src 'self'; ` +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'" +
  (PROD ? "; upgrade-insecure-requests" : "");

const BASE: Record<string, string> = {
  "content-security-policy": CSP,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "cache-control": "no-cache",
};

async function headersOf(request: import("@playwright/test").APIRequestContext, path: string) {
  const response = await request.get(path, { maxRedirects: 0 });
  return { status: response.status(), headers: response.headers(), body: await response.text(), all: response.headersArray() };
}

function single(all: Array<{ name: string; value: string }>, name: string): string[] {
  return all.filter((h) => h.name.toLowerCase() === name).map((h) => h.value);
}

test.describe("headers efetivos @smoke", () => {
  for (const path of ["/entrar/", "/ao-vivo/", "/"]) {
    test(`página ${path}`, async ({ request }) => {
      const { status, all } = await headersOf(request, path);
      expect(status).toBe(200);
      for (const [name, value] of Object.entries(BASE)) {
        expect(single(all, name), name).toEqual([value]);
      }
      expect(single(all, "strict-transport-security")).toEqual(
        PROD ? ["max-age=31536000; includeSubDomains"] : [],
      );
    });
  }

  test("/_next/static e /_csp são imutáveis, sem Cache-Control duplicado", async ({ request, page, guard }) => {
    guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
    await page.goto("/entrar/");
    const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((el) => el.getAttribute("src")!));
    const next = scripts.find((src) => src.startsWith("/_next/static/"))!;
    const csp = scripts.find((src) => src.startsWith("/_csp/"))!;
    for (const path of [next, csp]) {
      const { status, all } = await headersOf(request, path);
      expect(status).toBe(200);
      expect(single(all, "cache-control")).toEqual(["public, max-age=31536000, immutable"]);
    }
  });

  for (const path of ["/convite/abcdefghijklmnop1234", "/convite/", "/r/abcdefghijklmnop1234", "/r/"]) {
    test(`${path} com Referrer-Policy no-referrer exato e noindex`, async ({ request }) => {
      const { status, all, body } = await headersOf(request, path);
      expect(status).toBe(200);
      expect(single(all, "referrer-policy")).toEqual(["no-referrer"]);
      expect(single(all, "x-robots-tag")).toEqual(["noindex, nofollow"]);
      expect(single(all, "content-security-policy")).toEqual([CSP]);
      expect(body).toContain('<meta name="robots" content="noindex">');
    });
  }

  test("assets do convite fora da reescrita", async ({ request }) => {
    const js = await headersOf(request, "/_static/convite/convite.js");
    expect(js.status).toBe(200);
    expect(js.headers["content-type"]).toContain("javascript");
    expect(js.body).toContain("TEAM_INVITE_NOT_FOUND");
  });

  for (const path of ["/.well-known/assetlinks.json", "/.well-known/apple-app-site-association"]) {
    test(`${path} é JSON, 200 e sem redirect`, async ({ request }) => {
      const { status, all, body } = await headersOf(request, path);
      expect(status).toBe(200);
      expect(single(all, "content-type")).toEqual(["application/json"]);
      expect(single(all, "cache-control")).toEqual(["public, max-age=300"]);
      expect(() => JSON.parse(body)).not.toThrow();
    });
  }

  test("/qualquer dá 404 com a página do painel", async ({ page, guard }) => {
    guard.expectResponse("/qualquer", 404);
    guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
    const response = await page.goto("/qualquer");
    expect(response?.status()).toBe(404);
    expect(response?.headers()["content-security-policy"]).toBe(CSP);
    await expect(page.getByRole("heading", { name: "Página não encontrada." })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("link", { name: "Ir para o Mapa ao vivo" }).click();
    await expect(page).toHaveURL(/\/(ao-vivo|entrar)\//);
  });
});

test.describe("convite (4 estados) @smoke", () => {
  const TOKEN = "abcdefghijklmnop1234";

  test("convite válido mostra a loja e o combinado, sem Referer e sem cookie", async ({ page, api }) => {
    api.invite = {
      status: 200,
      body: {
        establishment: { name: "Pizzaria do Zé", initials: "PZ", address_line: "Rua das Flores, 220", neighborhood: "Centro" },
        deal: { pay_type: "fixed_value_with_delivery", daily_rate: "90.00", per_delivery_rate: "6.00" },
      },
    };
    await page.goto(`/convite/${TOKEN}`);
    await expect(page.getByRole("heading", { name: "Pizzaria do Zé quer você na equipe de entregas" })).toBeVisible();
    await expect(page.getByText("Diária R$ 90 + R$ 6 por entrega")).toBeVisible();
    await expect(page.locator("#invite-code")).toHaveText(TOKEN);
    expect(api.inviteRequests).toHaveLength(1);
    expect(api.inviteRequests[0]!.url).toBe(`/v1/teams/invites/${TOKEN}?mark_opened=true`);
    expect(api.inviteRequests[0]!.referer).toBeUndefined();
    expect(api.inviteRequests[0]!.cookie).toBeUndefined();
  });

  for (const [status, code, text] of [
    [404, "TEAM_INVITE_NOT_FOUND", "Convite não encontrado. Confira o link com a loja."],
    [409, "TEAM_INVITE_EXPIRED", "Este convite expirou. Peça um novo para a loja."],
  ] as const) {
    test(`${code} mostra o texto fixo`, async ({ page, guard, api }) => {
      guard.expectResponse("/v1/teams/invites/", status);
      api.invite = { status, body: { error_code: code, detail: "detalhe interno" } };
      await page.goto(`/convite/${TOKEN}`);
      await expect(page.locator("#error-text")).toHaveText(text);
      await expect(page.getByText("detalhe interno")).toHaveCount(0);
    });
  }

  test("sem rede mostra a mensagem e Tentar de novo", async ({ page, guard, api }) => {
    guard.expectResponse("/v1/teams/invites/", 0);
    api.invite = null;
    await page.goto(`/convite/${TOKEN}`);
    await expect(page.locator("#error-text")).toHaveText("Sem conexão com a internet. Verifique e tente de novo.");
    api.invite = { status: 200, body: { establishment: { name: "Loja" } } };
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByRole("heading", { name: "Loja quer você na equipe de entregas" })).toBeVisible();
  });

  test("token inválido não chama a API", async ({ page, api }) => {
    await page.goto("/convite/curto");
    await expect(page.locator("#error-text")).toHaveText("Este link de convite está incompleto. Confira o link com a loja.");
    expect(api.inviteRequests).toHaveLength(0);
  });
});

test("login visual sem violação de CSP e com o tema aplicado antes da hidratação @smoke", async ({ page, context, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
  await context.addInitScript(() => localStorage.setItem("motoka.panel.theme", "light"));
  await page.goto("/entrar/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "Painel do estabelecimento" })).toBeVisible();
});

test("autoteste da guarda: a violação de CSP antes de um F5 não se perde @smoke", async ({ page, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
  await page.goto("/entrar/");
  await page.evaluate(() => {
    const img = document.createElement("img");
    img.src = "https://evil.example/pixel.png";
    document.body.append(img);
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Painel do estabelecimento" })).toBeVisible();
  const taken = guard.takeViolations();
  expect(taken.map((v) => v.directive)).toEqual(["img-src"]);
  expect(taken[0]!.blocked).toContain("evil.example");
});
