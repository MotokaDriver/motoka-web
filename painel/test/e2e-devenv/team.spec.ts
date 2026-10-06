import { expect, test } from "../e2e/guard";
import { addShiftFlow, inviteFlow, openTeam, pauseResumeRemoveFlow } from "../e2e/teamFlow";
import { API, STORE, createDisposableDriver, deleteDisposableDriver, joinByLink } from "./seed";

/**
 * "Minha equipe" contra a API REAL do dev-env (API em http://localhost:8000, painel na 3001): convidar,
 * adicionar turno, pausar com turno suspenso, retomar e remover. Quem entra, recebe turno e é removido é um
 * **motoboy descartável** cadastrado pela API no próprio teste (e apagado no fim): o motoboy do seed e o motoboy do painel
 * nunca são alterados por E2E. O build precisa de `NEXT_PUBLIC_API_URL=http://localhost:8000` e
 * `NEXT_PUBLIC_APP_ENV=e2e`.
 */
test("convidar, adicionar turno, pausar com turno suspenso, retomar e remover", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401); // primeira visita, sem cookie
  const disposable = await createDisposableDriver(request, "Descartavel");
  try {
    await page.goto("/entrar/");
    await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
    await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/ao-vivo\/$/);

    await openTeam(page);
    const linkUrl = await inviteFlow(page, `Joca E2E ${Date.now() % 100000}`);

    expect(await joinByLink(request, disposable, linkUrl), "o motoboy descartável entrou pelo link").toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^Opções de ${disposable.short}`) })).toBeVisible();

    await addShiftFlow(page, disposable.name);
    await pauseResumeRemoveFlow(page, disposable.short);
  } finally {
    await deleteDisposableDriver(request, disposable);
  }
});
