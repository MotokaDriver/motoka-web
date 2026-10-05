import { expect, test } from "../e2e/guard";
import { addShiftFlow, inviteFlow, openTeam, pauseResumeRemoveFlow } from "../e2e/teamFlow";
import { API, STORE, ensureDriverInTeam } from "./seed";

/**
 * "Minha equipe" contra a API REAL do dev-env (API em http://localhost:8000, painel na 3001): convidar,
 * adicionar turno, pausar com turno suspenso, retomar e remover. O motoboy do seed entra na equipe pelo
 * link que o painel mostra (ou por convite nominal, se a loja já o removeu: o telefone do seed precisa
 * estar verificado, ver `seed.ts`) e sai no fim, pelo painel. O build precisa de
 * `NEXT_PUBLIC_API_URL=http://localhost:8000` e `NEXT_PUBLIC_APP_ENV=e2e`.
 */
test("convidar, adicionar turno, pausar com turno suspenso, retomar e remover", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401); // primeira visita, sem cookie

  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);

  await openTeam(page);
  const linkUrl = await inviteFlow(page, `Joca E2E ${Date.now() % 100000}`);

  const joined = await ensureDriverInTeam(request, linkUrl);
  test.skip(!joined, "o motoboy do seed não voltou à equipe: verifique o telefone dele (seed.ts)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Opções de / }).first()).toBeVisible();

  await addShiftFlow(page);
  await pauseResumeRemoveFlow(page);
});
