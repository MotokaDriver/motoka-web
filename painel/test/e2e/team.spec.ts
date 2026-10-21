import { expect, test } from "./guard";
import { API } from "./mockApi";
import { addShiftFlow, inviteFlow, openTeam, pauseResumeRemoveFlow } from "./teamFlow";

const REFRESH = `${API}/v1/web/auth/refresh`;

test.describe("Minha equipe (API mockada)", () => {
  test("convidar, adicionar turno, pausar com turno suspenso, retomar e remover", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401); // primeira visita, sem cookie

    await page.goto("/entrar/");
    await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
    await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/ao-vivo\/$/);

    await openTeam(page);
    await expect(page.getByText("Diego Ramos")).toBeVisible();
    await expect(page.getByText("Só equipe · sem KYC")).toBeVisible();
    await expect(page.getByText("Almoço sem ninguém")).toHaveCount(0);

    await inviteFlow(page, "Joca Teste");
    await addShiftFlow(page);
    await pauseResumeRemoveFlow(page);
    await expect(page.getByText("Sua equipe ainda está vazia")).toBeVisible();

    expect(api.team.calls).toEqual(
      expect.arrayContaining([
        "GET invite-link",
        "POST invites",
        expect.stringMatching(/^POST invites\/.+\/revoke$/),
        "POST shifts",
        expect.stringMatching(/^POST members\/.+\/pause$/),
        expect.stringMatching(/^POST members\/.+\/resume$/),
        expect.stringMatching(/^DELETE shifts\/.+/),
        expect.stringMatching(/^POST members\/.+\/remove$/),
      ]),
    );
  });

  test("semana inválida na URL cai na semana atual e [ ] navegam", async ({ page, guard }) => {
    guard.expectResponse(REFRESH, 401);
    await page.goto("/entrar/");
    await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
    await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/ao-vivo\/$/);
    await openTeam(page);
    await expect(page.getByText("Esta semana", { exact: true })).toBeVisible();
    await page.keyboard.press("]");
    await expect(page).toHaveURL(/\/equipe\/\?semana=\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText("Próxima semana", { exact: true })).toBeVisible();
    await page.goto("/equipe/?semana=2026-10-06");
    await expect(page.getByText("Esta semana", { exact: true })).toBeVisible();
  });
});
