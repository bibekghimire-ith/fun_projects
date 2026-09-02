/**
 * Small unobtrusive-JS helpers for the admin CMS pages.
 *
 * Replaces the inline `onsubmit="return confirm(...)"` /
 * `onclick="this.select()"` attributes admin templates used before Phase 8
 * so the Content-Security-Policy's script-src does not need
 * 'unsafe-inline' (see docs/DECISIONS.md). Behavior is identical - a
 * destructive form with `data-confirm="..."` asks for confirmation before
 * submitting, and any input with class `select-on-click` selects its
 * contents on click (used for the read-only "copy this URL" field on
 * /admin/media).
 */
(function () {
  "use strict";

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (
      form instanceof HTMLFormElement &&
      form.hasAttribute("data-confirm") &&
      !window.confirm(form.getAttribute("data-confirm"))
    ) {
      event.preventDefault();
    }
  });

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.classList.contains("select-on-click")
    ) {
      target.select();
    }
  });
})();
