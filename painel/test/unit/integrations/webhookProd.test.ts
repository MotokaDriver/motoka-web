import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ APP_ENV: "prod", API_BASE: "https://api.motokadriver.com/v1", API_ORIGIN: "https://api.motokadriver.com" }));

const { validateWebhook } = await import("@/features/integrations/logic");

describe("URL de eventos em produção", () => {
  it("só https, porta 443 ou 8443, sem usuário e senha", () => {
    expect(validateWebhook("http://pdv.exemplo.com/eventos")).toBe("Use um endereço https.");
    expect(validateWebhook("http://localhost:8000/x")).toBe("Use um endereço https.");
    expect(validateWebhook("https://pdv.exemplo.com:8080/x")).toBe("Use a porta 443 ou 8443.");
    expect(validateWebhook("https://pdv.exemplo.com/eventos")).toBeNull();
  });
});
