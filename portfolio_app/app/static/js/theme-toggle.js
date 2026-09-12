/**
 * Dark/light mode toggle, shared by every theme.
 *
 * Persists the viewer's choice in `localStorage` (key
 * "portfolio-color-mode", value "light" or "dark") so it survives reloads
 * and applies across every theme without a server round-trip. The inline
 * script in app/templates/themes/_layout.html applies the stored value
 * before first paint to avoid a flash of the wrong mode; this script only
 * needs to handle the toggle button click after that.
 *
 * Bootstrap 5's own dark-mode support reads `data-bs-theme` on <html>
 * natively, so this is the single attribute both Bootstrap's built-in
 * component styles and every theme's CSS variables key off of.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "portfolio-color-mode";

  function currentMode() {
    return document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";
  }

  function applyMode(mode) {
    document.documentElement.setAttribute("data-bs-theme", mode);
    var button = document.getElementById("theme-toggle");
    if (button) {
      button.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
    }
  }

  function persist(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      /* localStorage unavailable; the toggle still works for this page view. */
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyMode(currentMode());

    var button = document.getElementById("theme-toggle");
    if (!button) {
      return;
    }

    button.addEventListener("click", function () {
      var next = currentMode() === "dark" ? "light" : "dark";
      applyMode(next);
      persist(next);
    });
  });
})();
