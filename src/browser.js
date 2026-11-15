/* The QuickView browser shell: tabs, navigation, loading state, desktop mode, console and localhost finder. */
(function (Q) {
  "use strict";

  const HOME = "https://example.com";
  const SEARCH_URL = "https://www.google.com/search?q=";
  const LOAD_HINT_MS = 15000;

  class QuickView {
    constructor(page) {
      this.page = page;
      this.active = 0;
      this.desktop = false;
      this.tabs = [
        { url: HOME, history: [HOME], pos: 0, loading: false },
        { url: "", history: [], pos: -1, loading: false }
      ];
      this.timers = [null, null];
      this.touchX = null;
      this.destroyFns = [];
    }

    init() {
      // Acode pages keep their own header and scroll area; write into the page body, not the page element itself.
      this.host = this.page.body || this.page;
      try {
        const setTitle = this.page.settitle || this.page.setTitle;
        if (setTitle) setTitle.call(this.page, "QuickView");
      } catch (_) {}
      this.host.innerHTML = Q.markup;

      this.$ = id => this.host.querySelector("#" + id);
      this.root = this.$("quickview");
      this.frames = [this.$("qv-frame-0"), this.$("qv-frame-1")];
      this.tabButtons = [...this.host.querySelectorAll(".qv-tab")];

      this.theme = Q.createTheme({
        host: this.host,
        root: this.root,
        onChange: () => this.refreshNewTabs()
      });
      this.destroyFns.push(() => this.theme.destroy());

      this.bind();
      this.logEnvironment();
      this.updateTabUI();
      this.fit();
      this.load(0);
      this.load(1);
    }

    on(el, event, fn, options) {
      el.addEventListener(event, fn, options);
      this.destroyFns.push(() => el.removeEventListener(event, fn, options));
    }

    bind() {
      this.tabButtons.forEach(button => this.on(button, "click", () => this.switchTab(+button.dataset.tab)));
      this.frames.forEach((frame, i) => this.on(frame, "load", () => this.onFrameLoad(i)));

      this.on(this.$("qv-form"), "submit", e => {
        e.preventDefault();
        this.navigate(this.$("qv-url").value);
      });
      this.on(this.$("qv-new"), "click", () => {
        this.switchTab(1);
        this.$("qv-url").focus();
      });
      this.on(this.$("qv-back"), "click", () => this.go(-1));
      this.on(this.$("qv-forward"), "click", () => this.go(1));
      this.on(this.$("qv-reload"), "click", () => this.reload());
      this.on(this.$("qv-home"), "click", () => this.navigate(HOME));
      this.on(this.$("qv-external"), "click", () => this.openExternal());
      this.on(this.$("qv-desktop"), "click", () => this.toggleDesktop());
      this.on(document, "securitypolicyviolation", e => this.onPolicyViolation(e));
      this.on(this.$("qv-console"), "click", () => this.drawer("console"));
      this.on(this.$("qv-local"), "click", () => this.drawer("local"));
      this.on(this.$("qv-clear"), "click", () => this.$("qv-console-output").textContent = "Console cleared.");
      this.on(this.$("qv-scan"), "click", () => this.scanLocalhost());

      const stage = this.$("qv-stage");
      this.on(stage, "touchstart", e => this.touchX = e.changedTouches[0].clientX, { passive: true });
      this.on(stage, "touchend", e => {
        if (this.touchX === null) return;
        const dx = e.changedTouches[0].clientX - this.touchX;
        if (Math.abs(dx) > 65) this.switchTab(dx < 0 ? 1 : 0);
        this.touchX = null;
      }, { passive: true });

      this.on(window, "resize", () => { this.fit(); this.resizeDesktop(); });

      // Keep desktop mode scaled correctly when the stage changes size (rotation, keyboard, drawers).
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => this.resizeDesktop());
        ro.observe(stage);
        this.destroyFns.push(() => ro.disconnect());
      }
    }

    // ---- Sizing ---------------------------------------------------------

    // The Acode page body can collapse to zero height, which makes height:100% show a blank page.
    // Size the root from the space left between its top edge and the bottom of the screen instead.
    fit() {
      if (!this.root || !this.root.isConnected) return;
      const height = Math.round(window.innerHeight - this.root.getBoundingClientRect().top);
      if (height > 120) this.root.style.height = height + "px";
    }

    // Called each time the page is opened (layout isn't final until the page animation ends).
    onShow() {
      this.fit();
      requestAnimationFrame(() => this.fit());
      setTimeout(() => { this.fit(); this.resizeDesktop(); }, 350);
    }

    // ---- UI state -------------------------------------------------------

    updateTabUI() {
      this.tabButtons.forEach((button, i) => {
        const tab = this.tabs[i];
        let label = "New tab";
        if (tab.url) {
          try { label = new URL(tab.url).hostname; } catch (_) {}
        }
        button.textContent = `Tab ${i + 1} · ${label}`;
        button.classList.toggle("active", i === this.active);
      });

      this.frames.forEach((frame, i) => frame.classList.toggle("hidden", i !== this.active));

      this.$("qv-url").value = this.tabs[this.active].url || "";
      this.$("qv-stage").classList.toggle("qv-desktop", this.desktop);
      this.$("qv-desktop").classList.toggle("active", this.desktop);
      this.$("qv-mode").textContent = this.desktop ? "Desktop width (simulated)" : "Mobile viewport";
      this.syncLoading();
    }

    syncLoading() {
      this.root.classList.toggle("loading", !!this.tabs[this.active].loading);
    }

    setStatus(text) {
      this.$("qv-status").textContent = text;
    }

    refreshNewTabs() {
      this.tabs.forEach((tab, i) => { if (!tab.url) this.load(i); });
    }

    // ---- Navigation -----------------------------------------------------

    normalize(raw) {
      let value = String(raw || "").trim();
      if (!value) return null;
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) value = "http://" + value;
      else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        value = value.includes(".") && !value.includes(" ")
          ? "https://" + value
          : SEARCH_URL + encodeURIComponent(value);
      }
      try {
        const u = new URL(value);
        if (!["http:", "https:"].includes(u.protocol)) return null;
        return u.href;
      } catch (_) { return null; }
    }

    navigate(raw) {
      const url = this.normalize(raw);
      if (!url) { this.setStatus("Enter a valid web address"); return; }
      const tab = this.tabs[this.active];
      tab.history = tab.history.slice(0, tab.pos + 1);
      tab.history.push(url);
      tab.pos = tab.history.length - 1;
      tab.url = url;
      this.updateTabUI();
      this.load(this.active);
    }

    load(index) {
      const tab = this.tabs[index];
      const frame = this.frames[index];
      clearTimeout(this.timers[index]);

      if (!tab.url) {
        tab.loading = false;
        frame.srcdoc = Q.newTabDoc(this.theme ? this.theme.isDark() : false);
        this.syncLoading();
        if (index === this.active) this.setStatus("New tab");
        return;
      }

      tab.loading = true;
      // An iframe ignores `src` while a `srcdoc` is set, so clear it first or navigation from a new tab never happens.
      frame.removeAttribute("srcdoc");
      frame.src = tab.url;
      this.syncLoading();

      if (index === this.active) {
        this.setStatus("Loading " + tab.url);
        this.$("qv-note").style.display = "block";
      }
      this.timers[index] = setTimeout(() => {
        if (tab.loading && index === this.active) {
          this.setStatus("Still loading. The site may be slow or may block embedding.");
        }
      }, LOAD_HINT_MS);
    }

    onFrameLoad(index) {
      clearTimeout(this.timers[index]);
      const tab = this.tabs[index];
      tab.loading = false;
      if (index !== this.active) return;
      this.syncLoading();

      // A frame that was blocked (by Acode's security policy or by the site) stays on about:blank, which is
      // readable because the frame is same-origin. A real cross-origin page throws here, which means it loaded.
      let href = "";
      try { href = this.frames[index].contentWindow.location.href; } catch (_) { href = ""; }
      if (tab.url && href === "about:blank") {
        this.log("Frame stayed blank for " + tab.url);
        this.setStatus("Nothing loaded: the app's security policy or the site blocked it. Try ↗ to open it in a browser.");
        return;
      }

      this.$("qv-note").style.display = "none";
      this.setStatus(tab.url ? "Loaded " + tab.url : "New tab");
    }

    switchTab(index) {
      this.active = index === 1 ? 1 : 0;
      this.updateTabUI();
      this.setStatus(this.tabs[this.active].url ? "Tab " + (this.active + 1) : "New tab");
      this.$("qv-console-drawer").classList.remove("open");
      this.$("qv-local-drawer").classList.remove("open");
      this.resizeDesktop();
    }

    go(delta) {
      const tab = this.tabs[this.active];
      const next = tab.pos + delta;
      if (next < 0 || next >= tab.history.length) return;
      tab.pos = next;
      tab.url = tab.history[next];
      this.updateTabUI();
      this.load(this.active);
    }

    reload() {
      this.load(this.active);
    }

    // ---- Desktop viewport ----------------------------------------------

    toggleDesktop() {
      this.desktop = !this.desktop;
      this.updateTabUI();
      this.resizeDesktop();
    }

    resizeDesktop() {
      if (!this.frames) return;
      const stageWidth = this.$("qv-stage").clientWidth;
      this.frames.forEach((frame, i) => {
        if (!this.desktop || i !== this.active) {
          frame.style.transform = "";
          frame.style.height = "100%";
          return;
        }
        const scale = Math.min(1, (stageWidth || 1280) / 1280);
        frame.style.transform = `scale(${scale})`;
        frame.style.height = `${100 / scale}%`;
      });
    }

    // ---- Diagnostics ----------------------------------------------------

    log(text) {
      const out = this.$("qv-console-output");
      if (!out) return;
      const line = document.createElement("div");
      line.className = "qv-line";
      line.textContent = new Date().toLocaleTimeString() + "  " + text;
      out.append(line);
    }

    logEnvironment() {
      let csp = "";
      try {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
        csp = meta ? meta.getAttribute("content") : "";
      } catch (_) {}
      this.log("App CSP meta: " + (csp || "none in page (a header may still apply)"));
      this.log("Frame sandbox: " + this.frames[0].getAttribute("sandbox"));
    }

    onPolicyViolation(event) {
      this.log("CSP blocked " + (event.blockedURI || "a resource") + " by " + event.violatedDirective);
      if (/^(frame|child|default)-src/.test(event.violatedDirective || "")) {
        this.tabs[this.active].loading = false;
        this.syncLoading();
        this.setStatus("Blocked by Acode's security policy (" + event.violatedDirective + "). Try ↗ to open it in a browser.");
      }
    }

    openExternal() {
      const url = this.tabs[this.active].url;
      if (!url) { this.setStatus("Nothing to open yet"); return; }
      try {
        const iab = window.cordova && window.cordova.InAppBrowser;
        if (iab && iab.open) iab.open(url, "_system");
        else window.open(url, "_blank");
        this.log("Opened externally: " + url);
      } catch (error) {
        this.log("Could not open externally: " + error.message);
        this.setStatus("Could not open in a browser");
      }
    }

    // ---- Drawers --------------------------------------------------------

    drawer(which) {
      this.$("qv-console-drawer").classList.toggle("open", which === "console");
      this.$("qv-local-drawer").classList.toggle("open", which === "local");
    }

    async scanLocalhost() {
      const ports = [3000, 5173, 8080, 5500, 8000, 8888, 4173, 3001];
      const output = this.$("qv-local-results");
      output.textContent = "Checking common ports…";
      const found = [];
      await Promise.all(ports.map(async port => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 850);
        try {
          await fetch(`http://127.0.0.1:${port}/`, {
            method: "GET", mode: "no-cors", cache: "no-store", signal: controller.signal
          });
          found.push(port);
        } catch (_) {
          // A timeout or WebView network restriction cannot confirm that a port is open.
        } finally { clearTimeout(timer); }
      }));

      output.replaceChildren();
      if (!found.length) {
        output.textContent = "No ports could be confirmed. Network restrictions may prevent scanning.";
        return;
      }
      found.sort((a, b) => a - b).forEach(port => {
        const row = document.createElement("div");
        row.className = "qv-line";
        const open = document.createElement("button");
        open.textContent = "Open";
        open.style.float = "right";
        open.addEventListener("click", () => {
          this.switchTab(1);
          this.navigate(`http://127.0.0.1:${port}`);
          this.drawer("local");
        });
        row.append(`http://127.0.0.1:${port} `, open);
        output.append(row);
      });
    }

    destroy() {
      this.timers.forEach(clearTimeout);
      this.destroyFns.forEach(fn => { try { fn(); } catch (_) {} });
      this.frames && this.frames.forEach(frame => { frame.removeAttribute("srcdoc"); frame.src = "about:blank"; });
    }
  }

  Q.QuickView = QuickView;
})(window.__QuickView = window.__QuickView || {});
