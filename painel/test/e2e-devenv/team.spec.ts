import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "../e2e/guard";
import { addShiftFlow, inviteFlow, openTeam, pauseResumeRemoveFlow } from "../e2e/teamFlow";

/**
 * "Minha equipe" contra a API REAL do dev-env (API em http://localhost:8000, painel na 3001): convidar,
 * adicionar turno, pausar com turno suspenso, retomar e remover. O motoboy do seed entra na equipe
 * pelo link que o painel mostra (aceite pela API, como o app faria) e sai no fim, pelo painel.
 * O build precisa de `NEXT_PUBLIC_API_URL=http://localhost:8000` e `NEXT_PUBLIC_APP_ENV=e2e`.
 */
const API = "http://localhost:8000";
const STORE = { doc: "11222333000181", password: "NovaSenha@1" };
const DRIVER = { doc: "52998224725", password: "Teste@123" };

async function token(request: APIRequestContext, who: { doc: string; password: string }): Promise<{ bearer: string; sub: string }> {
  const response = await request.post(`${API}/token`, { form: { username: who.doc, password: who.password } });
  expect(response.ok(), `login de ${who.doc}`).toBe(true);
  const access = ((await response.json()) as { access_token: string }).access_token;
  const sub = JSON.parse(Buffer.from(access.split(".")[1] ?? "", "base64url").toString()).sub as string;
  return { bearer: `Bearer ${access}`, sub };
}

/**
 * O motoboy entra na equipe pelo link da loja. Se a loja já o removeu (o próprio fim deste teste), a API
 * exige convite nominal e o telefone do seed não é verificado: sem recriar o seed do dev-env, o teste
 * não tem como repetir. Devolve `false` nesse caso, e o teste se pula com o motivo.
 */
async function driverJoins(request: APIRequestContext, linkUrl: string): Promise<boolean> {
  const driver = await token(request, DRIVER);
  const linkToken = linkUrl.split("/").pop();
  const viaLink = await request.post(`${API}/v1/teams/invites/${linkToken}/accept`, { headers: { Authorization: driver.bearer } });
  if (viaLink.ok()) return true;
  const code = ((await viaLink.json()) as { error_code?: string }).error_code;
  if (code === "TEAM_ALREADY_MEMBER") return true;
  expect(code, "aceite pelo link").toBe("TEAM_REJOIN_REQUIRES_INVITE");
  return false;
}

test("convidar, adicionar turno, pausar com turno suspenso, retomar e remover", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401); // primeira visita, sem cookie

  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);

  await openTeam(page);
  const linkUrl = await inviteFlow(page, `Joca E2E ${Date.now() % 100000}`);

  const joined = await driverJoins(request, linkUrl);
  test.skip(!joined, "o motoboy do seed já foi removido da equipe e só volta por convite nominal com telefone verificado: recrie o seed do dev-env");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Opções de / }).first()).toBeVisible();

  await addShiftFlow(page);
  await pauseResumeRemoveFlow(page);
});
