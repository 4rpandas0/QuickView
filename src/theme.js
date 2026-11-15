/* Light/dark detection. Prefers Acode's own theme, falls back to the system setting. */
(function (Q) {
  "use strict";

  Q.createTheme = function ({ host, root, onChange }) {
    const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    const cleanups = [];

    function isDark() {
      const forced = root.dataset.theme;
      if (forced) return forced === "dark";
      return !!(mq && mq.matches);
    }

    // --background-color from Acode's theme. The page is detached until it is first shown, and a detached
    // element has no computed style, so fall back to the document root.
    function readBackground() {
      for (const el of [host, document.documentElement]) {
        try {
          const value = getComputedStyle(el).getPropertyValue("--background-color").trim();
          if (value) return value;
        } catch (_) {}
      }
      return "";
    }

    // "dark" or "light" from the brightness of that colour, or "" if it can't be read.
    function acodeTheme() {
      const raw = readBackground();
      if (!raw) return "";
      const probe = document.createElement("span");
      probe.style.color = raw;
      const nums = probe.style.color ? probe.style.color.match(/\d+(\.\d+)?/g) : null;
      if (!nums || nums.length < 3) return "";
      const [r, g, b] = nums.slice(0, 3).map(Number);
      return (0.299 * r + 0.587 * g + 0.114 * b) < 140 ? "dark" : "light";
    }

    function apply() {
      const before = isDark();
      const theme = acodeTheme();
      if (theme) root.dataset.theme = theme;
      else delete root.dataset.theme;
      if (before !== isDark() && onChange) onChange();
    }

    apply();

    if (mq) {
      mq.addEventListener("change", apply);
      cleanups.push(() => mq.removeEventListener("change", apply));
    }
    if (window.MutationObserver) {
      const observer = new MutationObserver(apply);
      const opts = { attributes: true, attributeFilter: ["style", "class", "data-theme"] };
      observer.observe(document.documentElement, opts);
      if (document.body) observer.observe(document.body, opts);
      cleanups.push(() => observer.disconnect());
    }

    return {
      isDark,
      apply,
      destroy() { cleanups.forEach(fn => { try { fn(); } catch (_) {} }); }
    };
  };
})(window.__QuickView = window.__QuickView || {});
