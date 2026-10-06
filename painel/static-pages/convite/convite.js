// @ts-check
// Página do convite de equipe (WS-06 §7.5; porte de motoka_app/web/convite para o painel Next,
// DN-16). Sem framework e sem script inline: a CSP do painel é `script-src 'self'`. Chama o T1
// público (GET /v1/teams/invites/{token}). A URL da API vem de <meta name="motoka-api">, gravada
// no pós-build a partir de NEXT_PUBLIC_API_URL.
(function () {
  "use strict";

  var PACKAGE = "com.app.motoka_app";
  var PLAY_URL = "https://play.google.com/store/apps/details?id=" + PACKAGE;
  // Mesmo link da landing (app/lib/appRedirect.ts).
  var APP_STORE_URL = "https://apps.apple.com/br/app/motoka-driver/id6759629174";
  var TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

  // Textos fixos por error_code, iguais aos do app (api_error_messages.dart). O `detail` do
  // backend nunca aparece.
  /** @type {Record<string, string>} */
  var MESSAGES = {
    TEAM_INVITE_NOT_FOUND: "Convite não encontrado. Confira o link com a loja.",
    TEAM_INVITE_EXPIRED: "Este convite expirou. Peça um novo para a loja.",
    TEAM_INVITE_ALREADY_USED: "Este convite já foi usado.",
    TEAM_INVITE_REVOKED: "Este convite foi cancelado pela loja.",
    TEAM_INVITE_LINK_LIMIT_REACHED: "Este link atingiu o limite de entradas de hoje. Peça um convite à loja.",
    RATE_LIMIT_EXCEEDED: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
    TOO_MANY_REQUESTS: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.",
  };
  var INVALID_LINK = "Este link de convite está incompleto. Confira o link com a loja.";
  var NETWORK = "Sem conexão com a internet. Verifique e tente de novo.";
  var GENERIC = "Não foi possível abrir o convite agora. Tente de novo.";

  /** @returns {string | null} base `.../v1`, ou null se o build não gravou uma URL válida. */
  function apiBase() {
    var meta = document.querySelector('meta[name="motoka-api"]');
    var value = meta ? meta.getAttribute("content") || "" : "";
    if (!/^https?:\/\/[^\s/]+\/v1$/.test(value)) return null;
    return value;
  }

  /** @returns {string | null} */
  function readToken() {
    /** @type {Array<string | null>} */
    var candidates = [];
    var parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "convite" && parts[1]) candidates.push(parts[1]);
    try {
      candidates.push(new URLSearchParams(window.location.search).get("t"));
    } catch (e) {
      /* navegador antigo: segue para o fragmento */
    }
    candidates.push(window.location.hash.replace(/^#/, ""));
    for (var i = 0; i < candidates.length; i++) {
      var value = candidates[i];
      if (!value) continue;
      try {
        value = decodeURIComponent(value);
      } catch (e) {
        continue;
      }
      if (TOKEN_RE.test(value)) return value;
    }
    return null;
  }

  /** @returns {"android" | "ios" | "unknown"} */
  function platform() {
    var ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      return "ios";
    }
    return "unknown";
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

  /** @param {string} id */
  function show(id) {
    ["loading", "invite", "error"].forEach(function (section) {
      $(section).hidden = section !== id;
    });
  }

  /**
   * @param {unknown} value
   * @returns {string | null}
   */
  function money(value) {
    if (value === null || value === undefined || value === "") return null;
    var number = Number(value);
    if (!isFinite(number)) return null;
    var cents = Math.round(number * 100) % 100 !== 0;
    return (
      "R$ " +
      number.toLocaleString("pt-BR", {
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: 2,
      })
    );
  }

  /**
   * @param {any} deal
   * @returns {string | null}
   */
  function dealLabel(deal) {
    if (!deal) return null;
    var daily = money(deal.daily_rate);
    var perDelivery = money(deal.per_delivery_rate);
    var type = String(deal.pay_type || "").toLowerCase();
    var parts = [];
    if (type !== "per_delivery" && daily) parts.push("Diária " + daily);
    if (type !== "fixed_value" && perDelivery) parts.push(perDelivery + " por entrega");
    if (!parts.length) return "A combinar";
    var text = parts.join(" + ");
    if (deal.rain_bonus_percent) text += " · +" + deal.rain_bonus_percent + "% na chuva";
    return text;
  }

  /** @param {string} token */
  function intentUrl(token) {
    // O host do App Link é o domínio onde a página está publicada (o do painel).
    return (
      "intent://" +
      window.location.host +
      "/convite/" +
      encodeURIComponent(token) +
      "#Intent;scheme=https;package=" +
      PACKAGE +
      ";S.browser_fallback_url=" +
      encodeURIComponent(PLAY_URL) +
      ";end"
    );
  }

  /**
   * @param {string} token
   * @param {any} data
   */
  function renderInvite(token, data) {
    var store = data.establishment || {};
    var name = typeof store.name === "string" && store.name ? store.name : "A loja";
    $("store-avatar").textContent = store.initials || name.slice(0, 2).toUpperCase();
    $("store-title").textContent = name + " quer você na equipe de entregas";
    var address = [store.address_line, store.neighborhood].filter(Boolean).join(" — ");
    $("store-address").textContent = address;
    $("store-address").hidden = !address;

    var deal = dealLabel(data.deal);
    if (deal) {
      $("deal-text").textContent = deal;
      $("deal").hidden = false;
    }

    $("invite-code").textContent = token;

    var os = platform();
    var openApp = /** @type {HTMLAnchorElement} */ ($("open-app"));
    var play = /** @type {HTMLAnchorElement} */ ($("play-store"));
    var appStore = /** @type {HTMLAnchorElement} */ ($("app-store"));
    play.href = PLAY_URL;
    appStore.href = APP_STORE_URL;

    if (os === "android") {
      // Chrome não entrega ao App Link uma navegação no mesmo domínio da página aberta:
      // o intent:// abre o app e, sem ele instalado, vai para a Play Store.
      openApp.href = intentUrl(token);
      openApp.hidden = false;
      play.hidden = false;
    } else if (os === "ios") {
      // No iOS a ação principal é copiar o código (o Universal Link não abre do mesmo domínio).
      $("copy-code").className = "btn primary";
      appStore.hidden = false;
    } else {
      play.hidden = false;
      appStore.hidden = false;
    }

    show("invite");
  }

  /**
   * @param {string} text
   * @param {boolean} canRetry
   */
  function renderError(text, canRetry) {
    $("error-text").textContent = text;
    $("retry").hidden = !canRetry;
    show("error");
  }

  /** @param {string} token */
  function load(token) {
    var base = apiBase();
    if (!base) {
      renderError(GENERIC, false);
      return;
    }
    show("loading");
    var url = base + "/teams/invites/" + encodeURIComponent(token) + "?mark_opened=true";
    fetch(url, { headers: { Accept: "application/json" }, credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return null;
          })
          .then(function (/** @type {any} */ body) {
            if (response.ok && body && body.establishment) {
              renderInvite(token, body);
              return;
            }
            var code = body && typeof body.error_code === "string" ? body.error_code : "";
            if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
              renderError(MESSAGES[code], false);
            } else if (response.status === 404) {
              renderError(MESSAGES.TEAM_INVITE_NOT_FOUND, false);
            } else if (response.status === 429) {
              renderError(MESSAGES.RATE_LIMIT_EXCEEDED, true);
            } else {
              renderError(GENERIC, true);
            }
          });
      })
      .catch(function () {
        renderError(NETWORK, true);
      });
  }

  /** @param {string} token */
  function copyCode(token) {
    var feedback = $("copy-feedback");
    /** @param {boolean} ok */
    function done(ok) {
      feedback.textContent = ok ? "Código copiado." : "Selecione o código e copie.";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(token).then(
        function () {
          done(true);
        },
        function () {
          done(false);
        },
      );
    } else {
      done(false);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var token = readToken();
    if (!token) {
      renderError(INVALID_LINK, false);
      return;
    }
    var current = token;
    $("copy-code").addEventListener("click", function () {
      copyCode(current);
    });
    $("retry").addEventListener("click", function () {
      load(current);
    });
    load(current);
  });
})();
