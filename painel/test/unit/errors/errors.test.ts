import { describe, expect, it } from "vitest";
import { ApiError, apiErrorFromResponse, isRouteMissing, isUuid } from "@/lib/api/errors";
import { API_ERROR_MESSAGES } from "@/lib/errors/catalog";
import { NETWORK_MESSAGE, UNKNOWN_MESSAGE, catalogMessage, errorText, messageForStatus } from "@/lib/errors/messages";

describe("catálogo de erros", () => {
  it("todo código conhecido tem texto pt-BR não vazio", () => {
    const entries = Object.entries(API_ERROR_MESSAGES);
    expect(entries.length).toBeGreaterThanOrEqual(200);
    for (const [code, text] of entries) {
      expect(code).toMatch(/^[A-Z0-9_]+$/);
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it("tem os códigos da sessão e do login", () => {
    expect(catalogMessage("AUTH_REFRESH_REUSED")).toBe("Sua sessão foi encerrada por segurança. Entre novamente.");
    expect(catalogMessage("AUTH_REFRESH_REVOKED")).toBe("Sua sessão foi encerrada. Entre novamente.");
    expect(catalogMessage("AUTH_SESSION_EXPIRED")).toBe("Sua sessão expirou. Entre novamente.");
    expect(catalogMessage("LOGIN_INVALID_CREDENTIALS")).toBe("CPF/CNPJ, e-mail ou senha incorretos.");
    expect(catalogMessage("WEB_AUTH_ACCOUNT_NOT_ALLOWED")).toBe("O painel é só para estabelecimentos.");
    expect(catalogMessage("ROUTE_NOT_FOUND")).toBe("Recurso não disponível.");
  });

  it("código desconhecido cai no texto por status, e propriedade herdada não vaza", () => {
    expect(catalogMessage("NAO_EXISTE")).toBeUndefined();
    expect(catalogMessage("constructor")).toBeUndefined();
    expect(errorText({ status: 409, code: "NAO_EXISTE" })).toBe(messageForStatus(409));
    expect(errorText({ status: 418, code: null })).toBe(UNKNOWN_MESSAGE);
    expect(errorText({ status: null, code: null })).toBe(NETWORK_MESSAGE);
  });

  it("o override da tela vence só para o próprio código", () => {
    const overrides = { DELIVERY_CANCELLED: "Este pedido foi cancelado. A tela foi atualizada." };
    expect(errorText({ status: 409, code: "DELIVERY_CANCELLED" }, overrides)).toBe(overrides.DELIVERY_CANCELLED);
    expect(errorText({ status: 401, code: "AUTH_TOKEN_EXPIRED" }, overrides)).toBe(
      "Sua sessão expirou. Entre novamente.",
    );
  });
});

describe("ApiError", () => {
  it("lê o envelope sem guardar o detail nem a mensagem do Pydantic", async () => {
    const response = new Response(
      JSON.stringify({
        error_code: "VALIDATION_ERROR",
        detail: "texto interno <b>x</b>",
        errors: [{ field: "username", message: "Field required" }],
      }),
      { status: 422, headers: { "Retry-After": "30" } },
    );
    const error = await apiErrorFromResponse(response);
    expect(error.status).toBe(422);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors).toEqual([{ field: "username" }]);
    expect(error.retryAfter).toBe(30);
    expect(JSON.stringify(error)).not.toContain("texto interno");
    expect(error.text()).toBe("Confira os dados preenchidos e tente novamente.");
  });

  it("sem envelope fica só o status", async () => {
    const error = await apiErrorFromResponse(new Response("<html>502</html>", { status: 502 }));
    expect(error.code).toBeNull();
    expect(error.text()).toBe(messageForStatus(502));
    expect(error.isUnavailable).toBe(true);
  });

  it("isRouteMissing só para 404 ROUTE_NOT_FOUND", () => {
    expect(isRouteMissing(new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" }))).toBe(true);
    expect(isRouteMissing(new ApiError({ status: 404, code: "DELIVERY_NOT_FOUND" }))).toBe(false);
    expect(isRouteMissing(new ApiError({ status: 404, code: "HTTP_ERROR" }))).toBe(false);
    expect(isRouteMissing(new ApiError({ status: 405, code: "ROUTE_NOT_FOUND" }))).toBe(false);
    expect(isRouteMissing(new ApiError({ status: 422, code: null }))).toBe(false);
    expect(isRouteMissing(new Error("x"))).toBe(false);
  });

  it("isUuid", () => {
    expect(isUuid("5b6acbe2-9c52-4a61-945b-9aae70c59fdc")).toBe(true);
    expect(isUuid("5B6ACBE2-9C52-4A61-945B-9AAE70C59FDC")).toBe(true);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("5b6acbe2-9c52-4a61-945b-9aae70c59fdc/../x")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
