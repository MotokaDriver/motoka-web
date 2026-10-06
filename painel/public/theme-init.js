// Aplica o tema antes da primeira pintura (DN-05, DN-13). Externo e síncrono no <head>: a CSP
// do painel não aceita script inline. Mesma regra de src/lib/prefs/prefs.ts.
(function () {
  "use strict";
  var theme = "dark";
  try {
    var stored = window.localStorage.getItem("motoka.panel.theme");
    if (stored === "light" || stored === "system") theme = stored;
  } catch (e) {
    // Sem storage: tema padrão.
  }
  var media = null;
  try {
    media = window.matchMedia("(prefers-color-scheme: light)");
  } catch (e) {
    media = null;
  }
  function apply() {
    var resolved = theme === "system" ? (media && media.matches ? "light" : "dark") : theme;
    document.documentElement.setAttribute("data-theme", resolved);
  }
  apply();
  if (media && typeof media.addEventListener === "function") {
    media.addEventListener("change", function () {
      var current = "dark";
      try {
        current = window.localStorage.getItem("motoka.panel.theme") || "dark";
      } catch (e) {
        current = theme;
      }
      if (current === "system") {
        theme = "system";
        apply();
      }
    });
  }
})();
