/**
 * Estado de `/v1/orders`, `/v1/notifications` e `/v1/users/{id}/{address,bank-cards}` do mock (WN-7). O servidor faz as
 * contas (taxa, total), como na API real; o teste comanda o status do pagamento.
 */

interface Offer {
  id: string;
  created_at: string;
  created_by: "driver" | "establishment";
  status: "pending" | "accepted" | "rejected" | "superseded";
  value: string;
  value_per_delivery: string | null;
}

interface MockOrder {
  id: string;
  status: string;
  type: string;
  start_date: string;
  end_date: string;
  requested_drivers: number;
  assigned_drivers: number;
  value: string | null;
  price_per_delivery: string | null;
  internal_fee: string;
  cancellation_reason: string | null;
}

interface MockNegotiation {
  id: string;
  order_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  offers: Offer[];
}

interface MockPayment {
  id: string;
  status: string;
  payment_method: string;
  amount: number;
  copy_paste: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  paid_at: string | null;
  payment_metadata: Record<string, unknown> | null;
}

/** PNG de 1x1 em base64. */
const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export class MockServices {
  orders: MockOrder[] = [];
  negotiations: MockNegotiation[] = [];
  payments = new Map<string, MockPayment>();
  /** Taxa de serviço que o mock cobra; "0.00" simula o cupom de isenção. */
  fee = "5.00";
  cards = [{ id: "c0000001-0000-4000-8000-000000000001", mask: "•••• 4242", type: "credit", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", user_id: "x" }];
  notices: Array<Record<string, unknown>> = [];
  address = { postal_code: "80000000", street: "Rua A", number: 200, neighborhood: "Centro", city: "Curitiba", state: "PR", complement: null };
  phone = "11977776666";
  email = "loja@motoka.com";
  password = "NovaSenha@1";
  deleted = false;
  /** Código que o mock aceita na confirmação do e-mail. */
  emailCode = "123456";
  /** Próximo E17 responde este erro (uma vez). */
  nextReminderError: { status: number; code: string } | null = null;
  calls: string[] = [];
  bodies: Array<{ route: string; body: Record<string, unknown> }> = [];
  private counter = 0;

  private uuid(prefix: string): string {
    this.counter += 1;
    return `${prefix}${String(this.counter).padStart(7, "0")}-0000-4000-8000-000000000000`;
  }

  seedOrder(over: Partial<MockOrder> = {}): MockOrder {
    const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    const order: MockOrder = {
      id: this.uuid("a"),
      status: "waiting_for_drivers",
      type: "fixed_value",
      start_date: hours(24),
      end_date: hours(28),
      requested_drivers: 2,
      assigned_drivers: 0,
      value: "50.00",
      price_per_delivery: null,
      internal_fee: this.fee,
      cancellation_reason: null,
      ...over,
    };
    this.orders.push(order);
    return order;
  }

  seedProposal(orderId: string, value = "60.00"): MockNegotiation {
    const negotiation: MockNegotiation = {
      id: this.uuid("b"),
      order_id: orderId,
      status: "pending",
      offers: [{ id: this.uuid("f"), created_at: new Date().toISOString(), created_by: "driver", status: "pending", value, value_per_delivery: null }],
    };
    this.negotiations.push(negotiation);
    return negotiation;
  }

  seedNotice(over: Record<string, unknown> = {}): void {
    this.notices.push({
      id: this.uuid("e"),
      created_at: new Date().toISOString(),
      type: "negotiation_new_offer",
      title: "Nova proposta",
      body: "Um motoboy fez uma contraproposta",
      data: {},
      is_read: false,
      read_at: null,
      delivery_status: "sent",
      scheduled_for: new Date().toISOString(),
      ...over,
    });
  }

  private negotiationView(n: MockNegotiation) {
    return { ...n, driver: { id: "d1", full_name: "Diego Ramos", rating: 4.5, user_id: "u1" } };
  }

  route(path: string, method: string, query: URLSearchParams, json: Record<string, unknown>): [number, unknown] | null {
    this.calls.push(`${method} ${path}`);
    this.bodies.push({ route: `${method} ${path}`, body: json });
    const notFound = (code: string): [number, unknown] => [404, { error_code: code, detail: "x" }];

    // --- Lembrete de localização (E17) ---
    if (/^\/teams\/me\/members\/[^/]+\/remind-location$/.test(path) && method === "POST") {
      const failure = this.nextReminderError;
      this.nextReminderError = null;
      if (failure) return [failure.status, { error_code: failure.code, detail: "x" }];
      return [200, { sent_at: new Date().toISOString() }];
    }

    // --- Troca de e-mail (código) ---
    if (path === "/users/email-code" && method === "POST") return [204, null];
    if (path === "/users/confirm-email-code" && method === "POST") {
      return json.code === this.emailCode ? [200, null] : [400, { error_code: "CONFIRMATION_CODE_INVALID", detail: "x" }];
    }

    // --- Orders ---
    if (path === "/orders" && method === "GET") {
      const statuses = query.getAll("status");
      const items = this.orders.filter((o) => (statuses.length === 0 || statuses.includes(o.status)) && (!query.get("start_date") || o.start_date >= (query.get("start_date") ?? "")));
      return [200, { count: items.length, total: items.length, items }];
    }
    if (path === "/orders/review" && method === "POST") {
      const drivers = Number(json.requested_drivers);
      const value = Number(json.value ?? 0);
      return [200, { value: Number(value).toFixed(2), price_per_delivery: (json.price_per_delivery as string | undefined) ?? null, total_value: (value * drivers).toFixed(2), service_charge: this.fee, amount_to_pay: this.fee }];
    }
    if (path === "/orders" && method === "POST") {
      const order = this.seedOrder({
        status: Number(this.fee) === 0 ? "waiting_for_drivers" : "pending_payment",
        type: json.type as string,
        start_date: json.start_date as string,
        end_date: json.end_date as string,
        requested_drivers: Number(json.requested_drivers),
        value: (json.value as string | undefined) ?? null,
        price_per_delivery: (json.price_per_delivery as string | undefined) ?? null,
      });
      return [201, order];
    }
    const match = /^\/orders\/([^/]+)(?:\/(drivers|negotiations|payments)(?:\/([^/]+)(?:\/(offers|accept|reject|cancel))?)?)?$/.exec(path);
    if (match) {
      const order = this.orders.find((o) => o.id === match[1]);
      if (!order) return notFound("ORDER_NOT_FOUND");
      const [, , kind, negotiationId, action] = match;
      if (!kind && method === "GET") return [200, order];
      if (!kind && method === "DELETE") {
        order.status = "cancelled";
        return [204, null];
      }
      if (kind === "drivers") return [200, { count: 0, total: 0, items: [] }];
      if (kind === "negotiations") {
        const mine = this.negotiations.filter((n) => n.order_id === order.id);
        if (!negotiationId) return [200, { count: mine.length, total: mine.length, items: mine.map((n) => this.negotiationView(n)) }];
        const negotiation = mine.find((n) => n.id === negotiationId);
        if (!negotiation) return notFound("NEGOTIATION_NOT_FOUND");
        if (action === "accept") {
          negotiation.status = "accepted";
          negotiation.offers.forEach((o) => (o.status = o.status === "pending" ? "accepted" : o.status));
          order.assigned_drivers += 1;
        } else if (action === "reject") {
          negotiation.status = "rejected";
          negotiation.offers.forEach((o) => (o.status = o.status === "pending" ? "rejected" : o.status));
        } else if (action === "offers") {
          negotiation.offers.forEach((o) => (o.status = o.status === "pending" ? "superseded" : o.status));
          negotiation.offers.push({ id: this.uuid("f"), created_at: new Date().toISOString(), created_by: "establishment", status: "pending", value: json.value as string, value_per_delivery: (json.value_per_delivery as string | undefined) ?? null });
        }
        return [200, this.negotiationView(negotiation)];
      }
      if (kind === "payments" && method === "POST") {
        const pix = json.payment_method === "pix";
        const payment: MockPayment = {
          id: this.uuid("9"),
          status: pix ? "pending" : "processing",
          payment_method: pix ? "pix" : "credit_card",
          amount: Number(order.internal_fee),
          copy_paste: pix ? "00020126580014br.gov.bcb.pix0136mock-pix-code" : null,
          qr_code_base64: pix ? PIXEL : null,
          expires_at: pix ? new Date(Date.now() + 10 * 60_000).toISOString() : null,
          paid_at: null,
          payment_metadata: null,
        };
        this.payments.set(order.id, payment);
        return [201, payment];
      }
      if (kind === "payments" && method === "GET") {
        const payment = this.payments.get(order.id);
        return payment ? [200, payment] : notFound("ORDER_PAYMENT_NOT_FOUND");
      }
    }

    // --- Avisos ---
    if (path === "/notifications" && method === "GET") {
      const unreadOnly = query.get("is_read") === "false";
      const items = this.notices.filter((n) => !unreadOnly || n.is_read === false);
      return [200, { count: items.length, total: items.length, items }];
    }
    if (path === "/notifications/unread-count") return [200, { count: this.notices.filter((n) => n.is_read === false).length }];
    if (path === "/notifications/read-all" && method === "POST") {
      const updated = this.notices.filter((n) => n.is_read === false).length;
      this.notices.forEach((n) => (n.is_read = true));
      return [200, { updated }];
    }
    const read = /^\/notifications\/([^/]+)\/read$/.exec(path);
    if (read && method === "PATCH") {
      const notice = this.notices.find((n) => n.id === read[1]);
      if (!notice) return notFound("NOTIFICATION_NOT_FOUND");
      notice.is_read = true;
      return [200, notice];
    }

    // --- Conta ---
    const user = /^\/users\/([^/]+)(\/address|\/email|\/password|\/bank-cards(?:\/([^/]+))?)?$/.exec(path);
    if (user) {
      if (user[2] === "/address") {
        if (method === "PUT") this.address = { ...this.address, ...(json as typeof this.address) };
        return [200, this.address];
      }
      if (user[2]?.startsWith("/bank-cards")) {
        if (method === "DELETE") {
          this.cards = this.cards.filter((c) => c.id !== user[3]);
          return [204, null];
        }
        return [200, { count: this.cards.length, items: this.cards }];
      }
      if (!user[2] && method === "DELETE") {
        this.deleted = true;
        return [204, null];
      }
      if (user[2] === "/email" && method === "PUT") {
        this.email = String(json.email);
        return [204, null];
      }
      if (user[2] === "/password" && method === "PUT") {
        if (json.old_password !== this.password) return [400, { error_code: "USER_PASSWORD_INCORRECT", detail: "x" }];
        this.password = String(json.password);
        return [204, null];
      }
      if (method === "PATCH") {
        this.phone = String(json.phone ?? this.phone);
        return [200, { id: user[1], phone: this.phone }];
      }
    }
    return null;
  }
}
