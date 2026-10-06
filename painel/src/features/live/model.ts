import { ApiError } from "@/lib/api/errors";

/**
 * Modelos do mapa ao vivo (L1 `GET /v1/tracking/live` e os eventos do L2), de
 * `tracking/application/dto.py`. Tolerante a campo novo e a estado desconhecido.
 */

export type DriverState = "not_started" | "no_signal" | "delivering" | "returning" | "at_store" | "unknown";

export interface LivePosition {
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number;
  readonly heading: number | null;
  readonly speedMps: number | null;
  readonly recordedAt: string;
}

export interface LiveStop {
  readonly deliveryId: string;
  readonly number: number;
  readonly origin: string;
  readonly status: string;
  readonly destination: { readonly lat: number; readonly lng: number } | null;
  readonly customerName: string | null;
  readonly addressLine: string | null;
}

export interface LiveDriver {
  readonly driverId: string;
  readonly fullName: string;
  readonly shortName: string;
  readonly initials: string;
  readonly phone: string | null;
  readonly membershipId: string;
  readonly shift: { readonly startsAt: string; readonly endsAt: string } | null;
  readonly state: DriverState;
  readonly position: LivePosition | null;
  readonly doneToday: { readonly deliveries: number; readonly returns: number };
  readonly lastDeliveredAt: string | null;
  readonly current: { readonly deliveryId: string; readonly number: number; readonly status: string } | null;
  readonly stops: readonly LiveStop[];
}

export interface LiveSnapshot {
  readonly serverTime: string;
  readonly noSignalAfterSeconds: number;
  readonly atStoreRadiusM: number;
  readonly establishment: { readonly id: string; readonly name: string; readonly location: { readonly lat: number; readonly lng: number } | null };
  readonly doneToday: { readonly deliveries: number; readonly returns: number };
  readonly drivers: readonly LiveDriver[];
}

type Raw = Record<string, unknown>;

function unreadable(): never {
  throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
}

const obj = (value: unknown): Raw => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : unreadable());
const maybe = (value: unknown): Raw | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter((v): v is Raw => v !== null && typeof v === "object") : []);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const numOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

const STATES: readonly DriverState[] = ["not_started", "no_signal", "delivering", "returning", "at_store"];
export const parseDriverState = (value: unknown): DriverState => {
  const text = str(value).toLowerCase();
  return (STATES as readonly string[]).includes(text) ? (text as DriverState) : "unknown";
};

function loc(value: unknown): { lat: number; lng: number } | null {
  const raw = maybe(value);
  if (!raw) return null;
  const lat = numOrNull(raw.lat);
  const lng = numOrNull(raw.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

export function parsePosition(value: unknown): LivePosition | null {
  const raw = maybe(value);
  const point = loc(raw);
  if (!raw || !point) return null;
  return {
    ...point,
    accuracyM: num(raw.accuracy_m),
    heading: numOrNull(raw.heading),
    speedMps: numOrNull(raw.speed_mps),
    recordedAt: str(raw.recorded_at),
  };
}

function parseDriver(raw: Raw): LiveDriver {
  const driver = obj(raw.driver);
  const shift = maybe(raw.shift);
  const current = maybe(raw.current);
  const done = maybe(raw.done_today) ?? {};
  const fullName = str(driver.full_name);
  const id = str(driver.id);
  if (id === "") return unreadable();
  return {
    driverId: id,
    fullName,
    shortName: str(driver.short_name) || fullName,
    initials: str(driver.initials),
    phone: strOrNull(driver.phone),
    membershipId: str(raw.membership_id),
    shift: shift ? { startsAt: str(shift.starts_at), endsAt: str(shift.ends_at) } : null,
    state: parseDriverState(raw.state),
    position: parsePosition(raw.position),
    doneToday: { deliveries: num(done.deliveries), returns: num(done.returns) },
    lastDeliveredAt: strOrNull(raw.last_delivered_at),
    current: current ? { deliveryId: str(current.delivery_id), number: num(current.number), status: str(current.status) } : null,
    stops: list(raw.stops).map((stop) => {
      const customer = maybe(stop.customer) ?? {};
      return {
        deliveryId: str(stop.delivery_id),
        number: num(stop.number),
        origin: str(stop.origin),
        status: str(stop.status),
        destination: loc(stop.destination),
        customerName: strOrNull(customer.name),
        addressLine: strOrNull(customer.address_line),
      };
    }),
  };
}

export function parseSnapshot(value: unknown): LiveSnapshot {
  const raw = obj(value);
  const establishment = obj(raw.establishment);
  const counts = maybe(raw.counts) ?? {};
  const done = maybe(counts.done_today) ?? {};
  const serverTime = str(raw.server_time);
  if (Number.isNaN(Date.parse(serverTime))) return unreadable();
  return {
    serverTime,
    noSignalAfterSeconds: num(raw.no_signal_after_seconds) || 120,
    atStoreRadiusM: num(raw.at_store_radius_m),
    establishment: { id: str(establishment.id), name: str(establishment.name), location: loc(establishment.location) },
    doneToday: { deliveries: num(done.deliveries), returns: num(done.returns) },
    drivers: list(raw.drivers).map(parseDriver),
  };
}

/** Evento `position` do L2. */
export interface PositionEvent {
  readonly driverId: string;
  readonly position: LivePosition;
  readonly state: DriverState;
}

export function parsePositionEvent(value: unknown): PositionEvent | null {
  const raw = maybe(value);
  const position = parsePosition(raw);
  if (!raw || !position || str(raw.driver_id) === "") return null;
  return { driverId: str(raw.driver_id), position, state: parseDriverState(raw.state) };
}
