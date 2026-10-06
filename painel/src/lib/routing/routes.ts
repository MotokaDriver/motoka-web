/** Rotas do painel. Com `trailingSlash: true`, todo caminho termina em "/" (DN-15). */
export const Paths = {
  login: "/entrar/",
  home: "/ao-vivo/",
  live: "/ao-vivo/",
  team: "/equipe/",
  deliveries: "/pedidos/",
  settlements: "/acertos/",
  services: "/servicos/",
  newService: "/servicos/novo/",
  integrations: "/integracoes/",
  integrationsReturn: "/integracoes/cardapio-web/retorno/",
  integrationsReturnNuvemshop: "/integracoes/nuvemshop/retorno/",
  notices: "/avisos/",
  account: "/conta/",
} as const;

export type NavIcon =
  | "map"
  | "groups"
  | "receipt_long"
  | "payments"
  | "two_wheeler"
  | "hub"
  | "notifications"
  | "person";

export type Capability = "teams" | "deliveries" | "tracking";

export interface Destination {
  readonly label: string;
  readonly subtitle: string;
  readonly icon: NavIcon;
  readonly path: string;
  /** Item que depende de uma feature da API (`/v1/web/capabilities`). */
  readonly capability?: Capability;
}

/** A sidebar, na ordem do design e do §5.4 (Acertos entra no WN-5). */
export const DESTINATIONS: readonly Destination[] = [
  {
    label: "Mapa ao vivo",
    subtitle: "Acompanhe sua equipe e as entregas em andamento",
    icon: "map",
    path: Paths.live,
    capability: "tracking",
  },
  {
    label: "Minha equipe",
    subtitle: "Escala, turnos e convites dos seus motoboys",
    icon: "groups",
    path: Paths.team,
    capability: "teams",
  },
  {
    label: "Pedidos",
    subtitle: "Pedidos da loja, atribuição e rastreio",
    icon: "receipt_long",
    path: Paths.deliveries,
    capability: "deliveries",
  },
  {
    label: "Acertos",
    subtitle: "O que cada motoboy tem a receber na semana",
    icon: "payments",
    path: Paths.settlements,
  },
  {
    label: "Contratar motoboys",
    subtitle: "Períodos avulsos com motoboys de fora da sua equipe",
    icon: "two_wheeler",
    path: Paths.services,
  },
  {
    label: "Integrações",
    subtitle: "Conecte o PDV e os apps de delivery da loja",
    icon: "hub",
    path: Paths.integrations,
  },
  {
    label: "Avisos",
    subtitle: "Novidades e alertas da sua operação",
    icon: "notifications",
    path: Paths.notices,
  },
  {
    label: "Conta",
    subtitle: "Dados da loja, preferências e sessão",
    icon: "person",
    path: Paths.account,
  },
];

/** Garante a barra final (o `usePathname` já vem com ela, um `?de=` digitado pode não vir). */
export function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

/** Destino dono do caminho (`/servicos/novo/` acende "Contratar motoboys"), ou `undefined`. */
export function destinationFor(pathname: string): Destination | undefined {
  const path = withTrailingSlash(pathname);
  return DESTINATIONS.find((d) => path === d.path || path.startsWith(d.path));
}

/** Lista fechada de caminhos aceitos no `?de=` (§5.3). */
export const KNOWN_PATHS: ReadonlySet<string> = new Set([
  ...DESTINATIONS.map((d) => d.path),
  Paths.newService,
]);
