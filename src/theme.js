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

    // Brightness of Acode's --background-color, or "" if it can't be read.
    function acodeTheme() {
      const raw = getComputedStyle(host).getPropertyValue("--background-color").trim();
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
