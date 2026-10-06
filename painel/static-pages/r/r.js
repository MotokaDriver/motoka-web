// @ts-check
// "Acompanhar pedido" (/r/#<token>, WS-03c → WN-6, DN-17). Sem framework e sem script inline: a CSP do
// painel é `script-src 'self'`. Consome o P1 (GET /v1/public/deliveries/{token}) e, quando o navegador
// tem EventSource, o P2 (stream). A API vem de <meta name="motoka-api">. O token fica no fragmento e
// nunca vai para terceiros: a única requisição é para a API.
(function () {
  "use strict";

  var TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
  /** Sem `position` por mais que isso, o pin envelhece sozinho (requisito do cliente, WS-03c). */
  var STALE_AFTER_MS = 120000;
  var DEFAULT_POLL_S = 15;
  var TICK_MS = 5000;

  var STEPS = [
    { stage: "preparing", label: "Preparando o seu pedido" },
    { stage: "picked_up", label: "Saiu para entrega" },
    { stage: "on_the_way", label: "A caminho" },
    { stage: "arrived", label: "Chegou" },
  ];

  // Textos fixos por situação, iguais aos do app (api_error_messages.dart). O `detail` da API nunca aparece.
  var TEXT = {
    invalid: { title: "Link incompleto", text: "Este link de acompanhamento está incompleto. Confira o link com a loja." },
    notFound: { title: "Pedido não encontrado", text: "Link de acompanhamento não encontrado. Confira o link com a loja." },
    ended: { title: "Acompanhamento encerrado", text: "Este acompanhamento terminou. Se precisar de algo, fale com a loja." },
    rate: { title: "Muitas tentativas", text: "Muitas tentativas seguidas. Aguarde um pouco, que a página tenta de novo." },
    network: "Sem conexão com a internet. Tentando de novo.",
    generic: "Não foi possível atualizar agora. Tentando de novo.",
  };

  /**
   * Token do fragmento (`/r/#<token>`) ou do caminho (`/r/<token>`, links antigos). `null` se não parece
   * um token.
   * @param {string} pathname
   * @param {string} hash
   * @returns {{ token: string, fromPath: boolean } | null}
   */
  function parseToken(pathname, hash) {
    /** @type {Array<{ value: string, fromPath: boolean }>} */
    var candidates = [{ value: String(hash || "").replace(/^#/, ""), fromPath: false }];
    var parts = String(pathname || "").split("/").filter(Boolean);
    if (parts[0] === "r" && parts[1]) candidates.push({ value: parts[1], fromPath: true });
    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i].value;
      if (!value) continue;
      try {
        value = decodeURIComponent(value);
      } catch (e) {
        continue;
      }
      if (TOKEN_RE.test(value)) return { token: value, fromPath: candidates[i].fromPath };
    }
    return null;
  }

  /**
   * @param {number} n
   * @param {string} one
   * @param {string} many
   */
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  /**
   * Texto da posição do motoboy. Com o stream aberto o servidor não avisa quando os pontos param: quem
   * envelhece o pin é este cliente, pelo `recorded_at` e pelo relógio do servidor.
   * @param {{ recordedAt: string } | null} position
   * @param {number} serverNow instante do servidor em ms
   * @param {string} stage
   * @returns {{ text: string, stale: boolean }}
   */
  function positionView(position, serverNow, stage) {
    if (stage !== "on_the_way" && stage !== "arrived") return { text: "", stale: false };
    if (!position) return { text: "Aguardando a posição do motoboy.", stale: false };
    var recorded = Date.parse(position.recordedAt);
    if (isNaN(recorded)) return { text: "Aguardando a posição do motoboy.", stale: false };
    var age = Math.max(0, serverNow - recorded);
    if (age > STALE_AFTER_MS) return { text: "Atualizando a posição…", stale: true };
    var seconds = Math.round(age / 1000);
    if (seconds < 60) return { text: "Posição do motoboy atualizada há " + seconds + " s.", stale: false };
    var minutes = Math.round(seconds / 60);
    return { text: "Posição do motoboy atualizada há " + minutes + " " + plural(minutes, "minuto", "minutos") + ".", stale: false };
  }

  /**
   * Visão do pedido (função pura, testada em Vitest/jsdom).
   * @param {any} delivery P1 já validado
   * @param {{ recordedAt: string } | null} position
   * @param {number} serverNow
   */
  function orderView(delivery, position, serverNow) {
    var stage = String(delivery.stage || "preparing");
    var returning = stage === "returning";
    var current = 0;
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].stage === stage) current = i;
    var driver = delivery.driver && delivery.driver.first_name ? String(delivery.driver.first_name) : null;
    var title = returning
      ? "O pedido está voltando para a loja"
      : stage === "preparing"
        ? "A loja está preparando o seu pedido"
        : stage === "picked_up"
          ? "O seu pedido saiu para entrega"
          : stage === "arrived"
            ? "O motoboy chegou"
            : "O seu pedido está a caminho";
    var subtitle = driver && !returning && stage !== "preparing" ? driver + " está com o seu pedido." : "Pedido #" + delivery.number;
    var pos = positionView(position, serverNow, stage);
    return {
      store: String((delivery.establishment && delivery.establishment.name) || ""),
      title: title,
      subtitle: subtitle,
      steps: returning
        ? []
        : STEPS.map(function (step, index) {
            return { label: step.label, state: index < current ? "done" : index === current ? "current" : "todo" };
          }),
      code: delivery.code ? String(delivery.code) : null,
      position: pos.text,
      stale: pos.stale,
    };
  }

  /**
   * Situação de erro por status HTTP (o `error_code` fixo vem do P1: 404, 410, 429).
   * @param {number | null} status null = sem resposta (rede)
   * @returns {{ kind: "invalid" | "notFound" | "ended" | "rate" | "network" | "generic", final: boolean }}
   */
  function errorKind(status) {
    if (status === null) return { kind: "network", final: false };
    if (status === 404 || status === 422) return { kind: "notFound", final: true };
    if (status === 410) return { kind: "ended", final: true };
    if (status === 429) return { kind: "rate", final: false };
    return { kind: "generic", final: false };
  }

  /**
   * Próximo polling, em ms: `poll_after_seconds` da API (no mínimo 5 s), ou o `Retry-After` de um 429.
   * @param {number | undefined} pollAfter
   * @param {number | null} retryAfter
   */
  function nextDelay(pollAfter, retryAfter) {
    var base = Math.max(5, pollAfter || DEFAULT_POLL_S) * 1000;
    return retryAfter !== null && retryAfter > 0 ? Math.max(base, retryAfter * 1000) : base;
  }

  // --- DOM e rede (só no navegador) ---------------------------------------------------------------

  /** @returns {string | null} */
  function apiBase() {
    var meta = document.querySelector('meta[name="motoka-api"]');
    var value = meta ? meta.getAttribute("content") || "" : "";
    return /^https?:\/\/[^\s/]+\/v1$/.test(value) ? value : null;
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  function $(id) {
    var element = document.getElementById(id);
    if (!element) throw new Error("Elemento ausente: " + id);
    return element;
  }

  /** @param {"loading" | "order" | "error"} section */
  function show(section) {
    $("loading").hidden = section !== "loading";
    $("order").hidden = section !== "order";
    $("error").hidden = section !== "error";
    if (section !== "order") $("code-card").hidden = true;
  }

  /** @param {string} message */
  function status(message) {
    $("status").textContent = message;
  }

  function start() {
    var base = apiBase();
    var parsed = parseToken(window.location.pathname, window.location.hash);
    if (!parsed || !base) return fail("invalid");
    var token = parsed.token;
    // Link antigo `/r/<token>`: o token passa para o fragmento, que nunca chega ao servidor de assets.
    if (parsed.fromPath && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "/r/#" + token);
    }
    var url = base + "/public/deliveries/" + encodeURIComponent(token);

    /** @type {any} */
    var delivery = null;
    /** @type {{ recordedAt: string } | null} */
    var position = null;
    var offset = 0;
    var firstLoad = true;
    var finished = false;
    /** @type {EventSource | null} */
    var stream = null;
    /** @type {number | undefined} */
    var pollTimer;
    /** @type {number | undefined} */
    var tickTimer;

    function serverNow() {
      return Date.now() + offset;
    }

    function render() {
      if (!delivery) return;
      var view = orderView(delivery, position, serverNow());
      $("store").textContent = view.store;
      $("title").textContent = view.title;
      $("subtitle").textContent = view.subtitle;
      var list = $("steps");
      list.textContent = "";
      view.steps.forEach(function (step) {
        var item = document.createElement("li");
        item.className = step.state === "todo" ? "" : step.state;
        if (step.state === "current") item.setAttribute("aria-current", "step");
        item.textContent = step.label;
        list.appendChild(item);
      });
      $("position").textContent = view.position;
      $("position").hidden = view.position === "";
      $("code-card").hidden = view.code === null;
      if (view.code !== null) $("code").textContent = view.code;
      show("order");
    }

    /** @param {any} body */
    function apply(body) {
      if (!body || typeof body !== "object") return;
      delivery = body;
      var updated = Date.parse(String(body.updated_at || ""));
      if (!isNaN(updated)) offset = updated - Date.now();
      var p = body.driver_position;
      position = p && typeof p.recorded_at === "string" ? { recordedAt: p.recorded_at } : null;
      status("");
      render();
    }

    /**
     * @param {number | undefined} seconds
     * @param {number | null} [retryAfter]
     */
    function schedulePoll(seconds, retryAfter) {
      window.clearTimeout(pollTimer);
      if (finished || stream) return;
      pollTimer = window.setTimeout(poll, nextDelay(seconds, retryAfter || null));
    }

    function stop() {
      finished = true;
      window.clearTimeout(pollTimer);
      window.clearInterval(tickTimer);
      closeStream();
    }

    /** @param {"invalid" | "notFound" | "ended" | "rate" | "network" | "generic"} kind */
    function showError(kind) {
      if (kind === "network" || kind === "generic") {
        // Com dado na tela, só avisa embaixo; sem dado, nada para mostrar ainda.
        if (delivery) return status(kind === "network" ? TEXT.network : TEXT.generic);
        $("loading").hidden = false;
        return status(kind === "network" ? TEXT.network : TEXT.generic);
      }
      var text = TEXT[kind];
      $("error-title").textContent = text.title;
      $("error-text").textContent = text.text;
      show("error");
      status("");
    }

    function poll() {
      if (finished) return;
      if (document.hidden) return; // volta no visibilitychange
      var query = firstLoad ? "?mark_opened=true" : "";
      fetch(url + query, { headers: { Accept: "application/json" }, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
        .then(function (response) {
          if (response.ok) {
            return response.json().then(function (body) {
              firstLoad = false;
              apply(body);
              openStream();
              schedulePoll(body && body.poll_after_seconds);
            });
          }
          var info = errorKind(response.status);
          showError(info.kind);
          if (info.final) return stop();
          var retry = Number(response.headers.get("Retry-After"));
          schedulePoll(DEFAULT_POLL_S, isNaN(retry) ? null : retry);
        })
        .catch(function () {
          showError("network");
          schedulePoll(DEFAULT_POLL_S);
        });
    }

    function closeStream() {
      if (stream) stream.close();
      stream = null;
    }

    function openStream() {
      if (stream || finished || typeof window.EventSource !== "function") return;
      var source = new window.EventSource(url + "/stream");
      stream = source;
      /** @param {string} name @param {(body: any) => void} handler */
      function on(name, handler) {
        source.addEventListener(name, function (event) {
          try {
            handler(JSON.parse(/** @type {MessageEvent} */ (event).data));
          } catch (e) {
            /* evento ilegível: ignora, o próximo ou o polling corrige */
          }
        });
      }
      on("snapshot", apply);
      on("stage", apply);
      on("position", function (body) {
        if (body && typeof body.recorded_at === "string") {
          position = { recordedAt: body.recorded_at };
          render();
        }
      });
      on("ended", function () {
        showError("ended");
        stop();
      });
      source.onerror = function () {
        // Erro antes de abrir (404/410/429/503) vem como JSON e o EventSource não reconecta: cai no
        // polling do P1, que também sabe tratar o 410. Queda no meio é reconectada pelo navegador.
        if (source.readyState === window.EventSource.CLOSED) {
          stream = null;
          schedulePoll(DEFAULT_POLL_S);
        }
      };
    }

    document.addEventListener("visibilitychange", function () {
      if (finished) return;
      if (document.hidden) {
        window.clearTimeout(pollTimer);
        closeStream();
        return;
      }
      firstLoad = false;
      window.clearTimeout(pollTimer);
      poll();
    });
    // O pin envelhece sozinho: reavalia o texto da posição sem esperar um evento.
    tickTimer = window.setInterval(function () {
      if (!document.hidden) render();
    }, TICK_MS);

    show("loading");
    poll();
  }

  /** @param {"invalid" | "notFound" | "ended" | "rate"} kind */
  function fail(kind) {
    $("error-title").textContent = TEXT[kind].title;
    $("error-text").textContent = TEXT[kind].text;
    show("error");
  }

  var api = { parseToken: parseToken, orderView: orderView, positionView: positionView, errorKind: errorKind, nextDelay: nextDelay, STALE_AFTER_MS: STALE_AFTER_MS, TEXT: TEXT };
  // Gancho de teste: o Vitest carrega o arquivo no jsdom e lê as funções puras, sem iniciar a página.
  // @ts-expect-error -- gancho de teste fora do tipo Window
  if (window.__MOTOKA_R_TEST__) {
    // @ts-expect-error -- gancho de teste fora do tipo Window
    window.__MOTOKA_R__ = api;
    return;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
