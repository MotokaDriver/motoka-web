"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "@/lib/zod";
import type { Capability } from "@/lib/routing/routes";
import { apiFetch } from "@/features/session/runtime";

const capabilitiesSchema = z.object({
  teams: z.optional(z.boolean()),
  deliveries: z.optional(z.boolean()),
  tracking: z.optional(z.boolean()),
});

export type Capabilities = Partial<Record<Capability, boolean>>;

export const CAPABILITIES_KEY = ["capabilities"] as const;

/** Lê o corpo de `GET /v1/web/capabilities`. Um campo ausente ou de outro tipo fica "desconhecido". */
export function parseCapabilities(body: unknown): Capabilities {
  const parsed = capabilitiesSchema.safeParse(body);
  return parsed.success ? parsed.data : {};
}

/**
 * Features ligadas na API, pedidas no boot com `staleTime` de 5 min (§5.4). Uma falha deixa tudo
 * desconhecido, e desconhecido conta como disponível: o primeiro uso decide.
 */
export function useCapabilities(): Capabilities {
  const query = useQuery({
    queryKey: CAPABILITIES_KEY,
    queryFn: async ({ signal }) => parseCapabilities(await apiFetch<unknown>("/web/capabilities", { signal })),
    staleTime: 5 * 60_000,
  });
  return query.data ?? {};
}

/** Disponível a menos que a API tenha dito `false`. */
export function isAvailable(capabilities: Capabilities, capability: Capability | undefined): boolean {
  return capability === undefined || capabilities[capability] !== false;
}
