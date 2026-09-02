/**
 * Applies the viewer's stored (or OS-preferred) dark/light mode before
 * first paint, to avoid a flash of the wrong mode.
 *
 * Previously inline in app/templates/themes/_layout.html's <head>; moved to
 * an external file in Phase 8 so the Content-Security-Policy's script-src
 * does not need 'unsafe-inline' (see docs/DECISIONS.md). Loading it as a
 * normal blocking <script src> in <head>, before the stylesheets, keeps the
 * same before-first-paint timing this had inline.
 *
 * static/js/theme-toggle.js handles the toggle button after this.
 */
(function () {
  "use strict";
  try {
    var stored = window.localStorage.getItem("portfolio-color-mode");
    var mode =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-bs-theme", mode);
  } catch (e) {
    /* localStorage unavailable (e.g. blocked); fall back to CSS media query defaults. */
  }
})();
