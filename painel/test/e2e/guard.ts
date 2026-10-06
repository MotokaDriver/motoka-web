import { test as base, expect, type BrowserContext, type ConsoleMessage, type Page } from "@playwright/test";
import { MockApi } from "./mockApi";

/**
 * Guarda de todo E2E (DN-12):
 * - qualquer `securitypolicyviolation` reprova, sem exceção. Cada violação vai na hora para o
 *   processo do teste (`exposeBinding`), então uma violação antes de um F5 ou de uma navegação
 *   com recarga não se perde (ressalva 3 da revisão do WN-0);
 * - erro de console reprova, exceto o "Failed to load resource" das respostas que o teste
 *   declarou esperar (URL + status), como o 401 do W2 na primeira visita.
 */
export interface ExpectedResponse {
  readonly url: string | RegExp;
  readonly status: number;
}

interface Guard {
  /** Declara uma resposta não-2xx esperada (o navegador loga no console). */
  expectResponse(url: string | RegExp, status: number): void;
  /** Liga a guarda numa página extra do mesmo context. */
  watch(page: Page): void;
  /** Só para o autoteste da guarda: devolve e limpa as violações (e os erros de console de CSP). */
  takeViolations(): CspViolation[];
}

export interface CspViolation {
  readonly directive: string;
  readonly blocked: string;
  readonly url: string;
}

const CSP_HOOK = `
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__reportCsp({
      directive: event.violatedDirective,
      blocked: event.blockedURI,
      url: location.href,
    });
  });
`;

function matches(expected: ExpectedResponse, url: string, status: number): boolean {
  if (expected.status !== status) return false;
  return typeof expected.url === "string" ? url.includes(expected.url) : expected.url.test(url);
}

export const test = base.extend<{ guard: Guard; api: MockApi }, { mockServer: MockApi }>({
  mockServer: [
    async ({}, use) => {
      const server = new MockApi();
      await server.start();
      await use(server);
      await server.stop();
    },
    { scope: "worker" },
  ],
  api: [
    async ({ mockServer }, use) => {
      mockServer.reset();
      await use(mockServer);
    },
    { auto: true },
  ],
  guard: [
    async ({ context, page }, use) => {
      const expected: ExpectedResponse[] = [];
      const consoleErrors: string[] = [];
      const pages = new Set<Page>();
      const violations: CspViolation[] = [];

      await context.exposeBinding("__reportCsp", (_source, violation: CspViolation) => {
        violations.push(violation);
      });
      await context.addInitScript({ content: CSP_HOOK });

      const onConsole = (message: ConsoleMessage) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (text.startsWith("Failed to load resource")) {
          const url = message.location().url;
          const match = /status of (\d{3})/.exec(text);
          const status = match ? Number(match[1]) : 0;
          if (expected.some((e) => matches(e, url, status))) return;
          consoleErrors.push(`${text} (${url})`);
          return;
        }
        consoleErrors.push(text);
      };

      const watch = (target: Page) => {
        if (pages.has(target)) return;
        pages.add(target);
        target.on("console", onConsole);
        target.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
      };
      watch(page);
      context.on("page", watch);

      await use({
        expectResponse: (url, status) => expected.push({ url, status }),
        watch,
        takeViolations: () => {
          const taken = violations.splice(0);
          for (let i = consoleErrors.length - 1; i >= 0; i--) {
            if (consoleErrors[i]!.includes("Content Security Policy")) consoleErrors.splice(i, 1);
          }
          return taken;
        },
      });

      expect(violations, "violação de CSP").toEqual([]);
      expect(consoleErrors, "erro de console fora da allowlist").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Página extra no MESMO context (mesmo jar de cookies, BroadcastChannel e Web Locks). */
export async function newTab(context: BrowserContext): Promise<Page> {
  return context.newPage();
}
