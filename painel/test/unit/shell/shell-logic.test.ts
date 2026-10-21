import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAvailable, parseCapabilities } from "@/features/shell/capabilities";
import { isChunkLoadError, recoverFromChunkError } from "@/features/shell/chunkErrors";
import { ShortcutRegistry, isEditable } from "@/features/shell/shortcuts";
import { overlayClosed, overlayOpened, resetOverlays } from "@/ui/overlays";

function key(init: KeyboardEventInit & { target?: EventTarget }): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  if (init.target) Object.defineProperty(event, "target", { value: init.target });
  return event;
}

describe("atalhos (D-W5-22)", () => {
  beforeEach(() => {
    resetOverlays();
    document.body.innerHTML = "";
  });

  it("dispara pelo caractere, sem diferenciar maiúscula", () => {
    const registry = new ShortcutRegistry();
    const action = vi.fn();
    registry.register({ key: "t", description: "x", action });
    expect(registry.handle(key({ key: "T" }), true)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("não dispara desligado, com Ctrl/Alt/Meta, repetido, em campo ou com dialog aberto", () => {
    const registry = new ShortcutRegistry();
    const action = vi.fn();
    registry.register({ key: "?", description: "ajuda", action });
    expect(registry.handle(key({ key: "?" }), false)).toBe(false);
    expect(registry.handle(key({ key: "?", ctrlKey: true }), true)).toBe(false);
    expect(registry.handle(key({ key: "?", altKey: true }), true)).toBe(false);
    expect(registry.handle(key({ key: "?", metaKey: true }), true)).toBe(false);
    expect(registry.handle(key({ key: "?", repeat: true }), true)).toBe(false);
    const input = document.createElement("input");
    expect(registry.handle(key({ key: "?", target: input }), true)).toBe(false);
    overlayOpened();
    expect(registry.handle(key({ key: "?" }), true)).toBe(false);
    overlayClosed();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    expect(registry.handle(key({ key: "?" }), true)).toBe(false);
    dialog.remove();
    expect(registry.handle(key({ key: "?" }), true)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("campo editável: input de texto, textarea, contenteditable; checkbox não", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const area = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    expect(isEditable(text)).toBe(true);
    expect(isEditable(area)).toBe(true);
    expect(isEditable(editable)).toBe(true);
    expect(isEditable(checkbox)).toBe(false);
    expect(isEditable(document.createElement("button"))).toBe(false);
  });

  it("desregistrar remove o atalho e a lista é estável", () => {
    const registry = new ShortcutRegistry();
    const off = registry.register({ key: "c", description: "x", action: vi.fn() });
    const snapshot = registry.list();
    expect(registry.list()).toBe(snapshot);
    off();
    expect(registry.list()).toEqual([]);
  });
});

describe("capabilities", () => {
  it("lê o formato real da API", () => {
    expect(parseCapabilities({ teams: true, deliveries: true, tracking: false })).toEqual({
      teams: true,
      deliveries: true,
      tracking: false,
    });
  });
  it("corpo estranho deixa tudo desconhecido, e desconhecido é disponível", () => {
    const caps = parseCapabilities({ teams: "sim" });
    expect(caps).toEqual({});
    expect(isAvailable(caps, "teams")).toBe(true);
    expect(isAvailable({ tracking: false }, "tracking")).toBe(false);
    expect(isAvailable({ tracking: false }, undefined)).toBe(true);
  });
});

describe("ChunkLoadError (DN-24)", () => {
  beforeEach(() => sessionStorage.clear());

  it("reconhece os formatos de erro de chunk e só eles", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "x" })).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /_next/a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 123 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it("uma recarga só; na segunda falha, pede para recarregar", () => {
    const reload = vi.fn();
    expect(recoverFromChunkError(reload)).toBe("reloaded");
    expect(recoverFromChunkError(reload)).toBe("ask");
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
