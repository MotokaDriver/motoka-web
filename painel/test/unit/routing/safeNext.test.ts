import { describe, expect, it } from "vitest";
import { destinationFor, KNOWN_PATHS } from "@/lib/routing/routes";
import { loginUrlFor, nextAfterLogin, safeNext } from "@/lib/routing/safeNext";

/** O `?de=` como o navegador entrega a `URLSearchParams.get`: decodificado uma vez. */
function de(rawQueryValue: string): string | null {
  return new URLSearchParams(`de=${rawQueryValue}`).get("de");
}

describe("safeNext (?de=, porte de panel_redirect_test.dart)", () => {
  it("aceita uma rota conhecida, mantendo a query", () => {
    expect(safeNext("/equipe/?semana=2026-10-05")).toBe("/equipe/?semana=2026-10-05");
    expect(safeNext(de("%2Fequipe%2F%3Fsemana%3D2026-10-05"))).toBe("/equipe/?semana=2026-10-05");
  });

  it("aceita a rota sem a barra final e devolve com ela", () => {
    expect(safeNext("/pedidos")).toBe("/pedidos/");
    expect(safeNext("/servicos/novo")).toBe("/servicos/novo/");
  });

  it.each([
    ["//evil.com", "//evil.com"],
    ["/\\evil.com", "/\\evil.com"],
    ["https://evil.com", "https://evil.com"],
    ["/%2F%2Fevil.com (já decodificado: //evil.com)", de("%2F%2Fevil.com")],
    ["%2F%2Fevil.com (duplo encode)", de("%252F%252Fevil.com")],
    ["https%3A%2F%2Fevil.com", de("https%3A%2F%2Fevil.com")],
    ["%2F%5Cevil", de("%2F%5Cevil")],
    ["/equipe/ com tab", de("%2Fequipe%2F%09")],
    ["/equipe/%0d%0a", de("%2Fequipe%2F%0d%0a")],
    ["/equipe/%0d%0a literal", "/equipe/%0d%0a"],
    ["rota desconhecida", "/rota-inexistente/"],
    ["de aninhado", "/equipe/?de=%2F%2Fevil.com"],
    ["sem barra inicial", "equipe"],
    ["vazio", ""],
    ["nulo", null],
    ["javascript:", "javascript:alert(1)"],
    ["/entrar/ não é destino", "/entrar/"],
  ])("recusa %s", (_label, value) => {
    expect(safeNext(value)).toBeNull();
    expect(nextAfterLogin(value)).toBe("/ao-vivo/");
  });

  it("monta o login guardando só rota conhecida", () => {
    expect(loginUrlFor("/equipe/", "?semana=2026-10-05")).toBe("/entrar/?de=%2Fequipe%2F%3Fsemana%3D2026-10-05");
    expect(loginUrlFor("/", "")).toBe("/entrar/");
    expect(loginUrlFor("/qualquer/", "")).toBe("/entrar/");
  });

  it("a lista fechada tem os destinos da sidebar e /servicos/novo/", () => {
    expect([...KNOWN_PATHS].sort()).toEqual(
      [
        "/acertos/",
        "/ao-vivo/",
        "/avisos/",
        "/conta/",
        "/equipe/",
        "/integracoes/",
        "/pedidos/",
        "/servicos/",
        "/servicos/novo/",
      ].sort(),
    );
  });

  it("/servicos/novo/ acende Contratar motoboys", () => {
    expect(destinationFor("/servicos/novo/")?.label).toBe("Contratar motoboys");
    expect(destinationFor("/entrar/")).toBeUndefined();
  });
});
