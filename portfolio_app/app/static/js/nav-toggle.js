/**
 * Mobile navigation toggle for the public site header (progressive
 * enhancement, not required for the nav to work - `#site-nav` is plain,
 * always-in-the-DOM markup that is simply reflowed to a column via CSS on
 * narrow viewports; this script only adds a collapse/expand affordance so
 * a long nav list doesn't dominate small screens by default).
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("nav-toggle-btn");
    var nav = document.getElementById("site-nav");
    if (!button || !nav) {
      return;
    }

    button.addEventListener("click", function () {
      var expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("site-nav-open", !expanded);
    });
  });
})();
