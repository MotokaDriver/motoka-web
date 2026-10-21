import { expect, test } from "./guard";
import { API } from "./mockApi";

const OK = "AbCdEfGhIjKlMnOpQrStUv";
const GONE = "goneAAAAAAAAAAAAAAAAAA";
const NONE = "noneAAAAAAAAAAAAAAAAAA";

test.describe("Acompanhar pedido /r/ (WN-6)", () => {
  test("mostra etapas, motoboy e código; cabeçalhos de privacidade; nada vai para terceiros", async ({ page, api }) => {
    const hosts = new Set<string>();
    page.on("request", (request) => hosts.add(new URL(request.url()).host));
    const response = await page.goto(`/r/#${OK}`);
    const headers = response?.headers() ?? {};
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["x-robots-tag"]).toMatch(/noindex/);
    expect(headers["content-security-policy"]).toContain("script-src 'self'");

    await expect(page.getByRole("heading", { name: "O seu pedido está a caminho" })).toBeVisible();
    await expect(page.getByText("Diego está com o seu pedido.")).toBeVisible();
    await expect(page.locator("#code")).toHaveText("4821");
    await expect(page.getByRole("list", { name: "Etapas do pedido" }).locator("li.current")).toHaveText("A caminho");
    await expect(page.locator("#position")).toContainText("Posição do motoboy atualizada há");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");

    // Só a origem da página e a API; o token vai no fragmento (nunca no Referer nem em terceiros).
    expect([...hosts].sort()).toEqual(["localhost:8787", "localhost:8790"]);
    expect(api.publicRequests.length).toBeGreaterThan(0);
    for (const request of api.publicRequests) expect(request.referer ?? "").not.toContain(OK);
    expect(page.url()).toContain(`#${OK}`);
  });

  test("/r/<token> vira /r/#<token>", async ({ page }) => {
    await page.goto(`/r/${OK}`);
    await expect(page.getByRole("heading", { name: "O seu pedido está a caminho" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/r/#${OK}$`));
  });

  test("410, 404 e link incompleto", async ({ page, guard }) => {
    guard.expectResponse(/\/public\/deliveries\/gone/, 410);
    guard.expectResponse(/\/public\/deliveries\/none/, 404);
    await page.goto(`/r/#${GONE}`);
    await expect(page.getByRole("heading", { name: "Acompanhamento encerrado" })).toBeVisible();
    await page.goto(`/r/#${NONE}`);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
    await page.goto("/r/#curto");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Link incompleto" })).toBeVisible();
  });

  test("o pin envelhece sozinho depois de 120 s sem position", async ({ page }) => {
    await page.clock.install();
    await page.goto(`/r/#${OK}`);
    await expect(page.locator("#position")).toContainText("Posição do motoboy atualizada há");
    await page.clock.fastForward(125_000);
    await expect(page.locator("#position")).toHaveText("Atualizando a posição…");
  });

  test("com a API fora: avisa e tenta de novo @smoke", async ({ page, guard }) => {
    guard.expectResponse("/public/deliveries/", 0);
    await page.route(`${API}/v1/public/deliveries/**`, (route) => route.abort("connectionrefused"));
    await page.goto(`/r/#${OK}`);
    await expect(page.locator("#status")).toContainText("Sem conexão");
  });
});
