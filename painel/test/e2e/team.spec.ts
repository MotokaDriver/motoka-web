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

test.describe("Pedidos para entrar (API mockada)", () => {
  test("aprova com combinado e recusa com confirmação; a aba mostra o contador", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.team.addJoinRequest("Paulo Souza");
    const rejected = api.team.addJoinRequest("Caio Mendes");

    await page.goto("/entrar/");
    await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
    await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/ao-vivo\/$/);
    await openTeam(page);

    const section = page.getByRole("region", { name: "Pedidos para entrar (2)" });
    await expect(section).toBeVisible();
    await expect(section.getByText("(41) 98888-7766").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Escala, 2 pedidos para entrar" })).toBeVisible();

    await section.getByRole("button", { name: "Aprovar o pedido de Paulo Souza" }).click();
    const approve = page.getByRole("dialog", { name: "Aprovar Paulo Souza" });
    await approve.getByLabel("Por entrega", { exact: true }).fill("700");
    await approve.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(page.getByText("Paulo Souza entrou na equipe.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Pedidos para entrar (1)" })).toBeVisible();

    await page.getByRole("button", { name: "Recusar o pedido de Caio Mendes" }).click();
    await page.getByRole("dialog", { name: "Recusar o pedido de Caio Mendes?" }).getByRole("button", { name: "Recusar", exact: true }).click();
    await expect(page.getByText("Pedido de Caio Mendes recusado.")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Pedidos para entrar/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Escala", exact: true })).toBeVisible();

    expect(api.team.calls).toEqual(expect.arrayContaining(["GET members", expect.stringMatching(/^POST members\/.+\/approve$/), `POST members/${rejected}/reject`]));
    expect(api.team.joinRequests[0]?.deal).toMatchObject({ pay_type: "per_delivery", per_delivery_rate: "7.00" });
  });
});
