/* QuickView browser: one address bar, three display backends, recent pages, console and localhost finder.
 *
 * Display backends, best first:
 *   1. Acode's native WebView API  (acode.require("webview"))   loads any site, reports page events
 *   2. Acode's in-app browser       (system.inAppBrowser)        loads any site, no events
 *   3. An iframe inside this page                                only works for sites that allow framing
 */
(function (Q) {
  "use strict";

  const HOME = "https://example.com";
  const SEARCH_URL = "https://www.google.com/search?q=";
  const MAX_RECENT = 8;
  const LOAD_HINT_MS = 15000;
  const KEY_MODE = "quickview.mode";
  const KEY_RECENT = "quickview.recent";

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  };

  function webviewModule() {
    try { return acode.require("webview") || null; } catch (_) { return null; }
  }
  function inAppBrowser() {
    try { return window.system && typeof window.system.inAppBrowser === "function" ? window.system : null; }
    catch (_) { return null; }
  }
  function nativeBackend() {
    if (webviewModule()) return "webview";
    if (inAppBrowser()) return "inapp";
    return null;
  }

  // Runs inside the page shown by the native WebView: forwards console output and applies desktop width.
  function pageHook(opts) {
    try {
      if (!window.__qvHooked) {
        window.__qvHooked = true;
        ["log", "info", "warn", "error"].forEach(function (level) {
          var original = console[level];
          console[level] = function () {
            try {
              var text = Array.prototype.map.call(arguments, function (a) {
                if (typeof a === "string") return a;
                try { return JSON.stringify(a); } catch (_) { return String(a); }
              }).join(" ");
              window.webview.postMessage({ qv: "console", level: level, text: text });
            } catch (_) {}
            return original.apply(console, arguments);
          };
        });
        window.addEventListener("error", function (e) {
          try {
            window.webview.postMessage({ qv: "console", level: "error",
              text: e.message + " (" + (e.filename || "") + ":" + (e.lineno || 0) + ")" });
          } catch (_) {}
        });
      }
      if (opts.desktop) {
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "viewport";
          (document.head || document.documentElement).appendChild(meta);
        }
        meta.setAttribute("content", "width=1280");
      }
    } catch (_) {}
  }

  class QuickView {
    constructor(page) {
      this.page = page;
      this.url = "";
      this.history = [];
      this.pos = -1;
      this.recent = [];
      this.desktop = false;
      this.loading = false;
      this.menuOpen = false;
      this.mode = "embedded";
      this.native = null;          // live WebView instance (webview backend only)
      this.nativeBroken = false;   // set after a native failure so fallbacks can't loop
      this.embedBlocked = false;
      this.loadTimer = null;
      this.toastTimer = null;
      this.destroyFns = [];
    }

    // ---- setup ----------------------------------------------------------

    init() {
      // Acode pages keep their own header and scroll area, so write into the page body.
      this.host = this.page.body || this.page;
      try {
        const setTitle = this.page.settitle || this.page.setTitle;
        if (setTitle) setTitle.call(this.page, "QuickView");
      } catch (_) {}
      this.host.innerHTML = Q.markup;

      this.$ = id => this.host.querySelector("#" + id);
      this.root = this.$("quickview");
      this.frame = this.$("qv-frame");
      this.menu = this.$("qv-menu");

      this.theme = Q.createTheme({ host: this.host, root: this.root });
      this.destroyFns.push(() => this.theme.destroy());

      this.recent = this.loadRecent();
      this.mode = nativeBackend() && store.get(KEY_MODE) !== "embedded" ? "native" : "embedded";

      this.bind();
      this.renderStart();
      this.renderMenu();
      this.logEnvironment();
      this.fit();
    }

    on(el, event, fn, options) {
      el.addEventListener(event, fn, options);
      this.destroyFns.push(() => el.removeEventListener(event, fn, options));
    }

    bind() {
      const input = this.$("qv-url");
      this.on(this.$("qv-form"), "submit", e => {
        e.preventDefault();
        input.blur();
        this.navigate(input.value);
      });
      this.on(input, "focus", () => setTimeout(() => { try { input.select(); } catch (_) {} }, 0));

      const more = this.$("qv-more");
      this.on(more, "click", e => { e.stopPropagation(); this.toggleMenu(); });
      this.on(this.menu, "click", e => {
        const button = e.target.closest("[data-act]");
        if (button && !button.disabled) this.onMenu(button.dataset.act);
      });
      this.on(this.root, "click", e => {
        if (this.menuOpen && !this.menu.contains(e.target)) this.closeMenu();
      });

      this.on(this.$("qv-recent"), "click", e => {
        const item = e.target.closest("[data-url]");
        if (item) this.navigate(item.dataset.url);
      });
      this.on(this.$("qv-clear"), "click", () => { this.$("qv-console-output").replaceChildren(); });
      this.on(this.$("qv-scan"), "click", () => this.scanLocalhost());

      this.on(this.frame, "load", () => this.onFrameLoad());
      this.on(document, "securitypolicyviolation", e => this.onPolicyViolation(e));
      this.on(window, "resize", () => { this.fit(); this.applyDesktop(); });

      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => this.applyDesktop());
        ro.observe(this.$("qv-stage"));
        this.destroyFns.push(() => ro.disconnect());
      }
    }

    // ---- sizing ---------------------------------------------------------

    // The Acode page body can collapse to zero height, so size from the space left on screen.
    fit() {
      if (!this.root || !this.root.isConnected) return;
      const height = Math.round(window.innerHeight - this.root.getBoundingClientRect().top);
      if (height > 120) this.root.style.height = height + "px";
    }

    // Called each time the page is opened (layout isn't final until the page animation ends).
    onShow() {
      if (this.theme) this.theme.apply();
      this.fit();
      requestAnimationFrame(() => this.fit());
      setTimeout(() => { this.fit(); this.applyDesktop(); }, 350);
    }

    // ---- address handling -----------------------------------------------

    normalize(raw) {
      let value = String(raw || "").trim();
      if (!value) return null;
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) value = "http://" + value;
      else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        value = value.includes(".") && !/\s/.test(value)
          ? "https://" + value
          : SEARCH_URL + encodeURIComponent(value);
      }
      try {
        const u = new URL(value);
        return ["http:", "https:"].includes(u.protocol) ? u.href : null;
      } catch (_) { return null; }
    }

    hostOf(url) {
      try { return new URL(url).hostname || url; } catch (_) { return url; }
    }

    navigate(raw) {
      const url = this.normalize(raw);
      if (!url) { this.toast("Enter a valid web address"); return; }
      this.open(url, true);
    }

    pushHistory(url) {
      this.history = this.history.slice(0, this.pos + 1);
      if (this.history[this.history.length - 1] !== url) this.history.push(url);
      this.pos = this.history.length - 1;
    }

    setUrl(url) {
      this.url = url;
      this.$("qv-url").value = url;
    }

    open(url, push) {
      this.closeMenu();
      this.closeDrawers();
      if (push) this.pushHistory(url);
      this.setUrl(url);
      this.addRecent(url);
      if (this.mode === "native" && nativeBackend()) this.openNative(url);
      else this.openEmbedded(url);
    }

    go(delta) {
      const next = this.pos + delta;
      if (next < 0 || next >= this.history.length) {
        this.toast(delta < 0 ? "No earlier page" : "No later page");
        return;
      }
      this.pos = next;
      this.open(this.history[next], false);
    }

    // ---- embedded backend -----------------------------------------------

    showFrame(on) {
      this.frame.classList.toggle("hidden", !on);
      this.$("qv-start").classList.toggle("hidden", on);
      this.applyDesktop();
    }

    setLoading(on) {
      this.loading = on;
      this.root.classList.toggle("loading", on);
    }

    openEmbedded(url) {
      this.embedBlocked = false;
      this.showFrame(true);
      this.setLoading(true);
      this.frame.removeAttribute("srcdoc");
      this.frame.src = url;
      clearTimeout(this.loadTimer);
      this.loadTimer = setTimeout(() => {
        if (this.loading) this.toast("Still loading. The site may be slow or may block embedding.", 4500);
      }, LOAD_HINT_MS);
    }

    onFrameLoad() {
      clearTimeout(this.loadTimer);
      if (this.mode !== "embedded" || !this.url || this.frame.classList.contains("hidden")) return;
      this.setLoading(false);
      // A blocked frame stays on about:blank, which is readable because the frame is same-origin.
      // A real cross-origin page throws here, which means it loaded.
      let href = "";
      try { href = this.frame.contentWindow.location.href; } catch (_) { href = ""; }
      if (href === "about:blank") this.onEmbedBlocked("blank frame");
    }

    onPolicyViolation(event) {
      this.log("CSP blocked " + (event.blockedURI || "a resource") + " by " + event.violatedDirective);
      if (this.mode === "embedded" && !this.frame.classList.contains("hidden") &&
          /^(frame|child|default)-src/.test(event.violatedDirective || "")) {
        this.onEmbedBlocked("security policy");
      }
    }

    // The embedded frame can't show this page, so hand it to a native view when one exists.
    onEmbedBlocked(reason) {
      if (this.embedBlocked) return;
      this.embedBlocked = true;
      this.setLoading(false);
      this.log("Embedded view blocked (" + reason + "): " + this.url);
      if (nativeBackend() && !this.nativeBroken) {
        this.toast("This site can't be embedded. Opening it in the native view.", 3500);
        this.showFrame(false);
        this.openNative(this.url);
      } else {
        this.toast("This site blocks embedding. Use ⋮ › Open in system browser.", 5000);
      }
    }

    // ---- native backends ------------------------------------------------

    async openNative(url) {
      this.setLoading(false);
      this.showFrame(false);
      if (this.frame.getAttribute("src")) this.frame.src = "about:blank";
      this.renderStart();

      if (nativeBackend() === "webview") {
        try { await this.openWebview(url); return; }
        catch (error) { this.log("WebView API failed: " + (error && error.message)); }
      }
      if (inAppBrowser()) {
        try { this.openInApp(url); return; }
        catch (error) { this.log("In-app browser failed: " + (error && error.message)); }
      }

      this.nativeBroken = true;
      this.mode = "embedded";
      this.renderMenu();
      this.toast("Native view isn't available. Using the embedded view.", 4000);
      this.openEmbedded(url);
    }

    async openWebview(url) {
      if (this.native && !this.native.dead) {
        try {
          await this.native.loadURL(url);
          await this.native.show();
          return;
        } catch (_) { this.destroyNative(); }
      }

      const view = await webviewModule().create({
        mode: "fullscreen",
        title: this.hostOf(url),
        allowDownloads: true
      });
      view.dead = false;
      view.on("pageFinished", (_event, data) => this.onNativeFinished(view, data || {}));
      view.on("closed", () => {
        view.dead = true;
        if (this.native === view) this.native = null;
      });
      view.onMessage(message => this.onNativeMessage(message));
      this.native = view;
      await view.loadURL(url);
    }

    openInApp(url) {
      const browser = window.system.inAppBrowser(url, this.hostOf(url), true, false);
      if (browser) {
        browser.onOpenExternalBrowser = opened => this.log("Opened externally: " + opened);
        browser.onError = error => this.log("In-app browser error: " + error);
      }
    }

    onNativeFinished(view, data) {
      if (view !== this.native) return;
      if (data.url && data.url !== this.url) {
        this.pushHistory(data.url);
        this.setUrl(data.url);
        this.addRecent(data.url);
      }
      this.injectHooks(view);
    }

    onNativeMessage(message) {
      if (message && message.qv === "console") this.log("[" + message.level + "] " + message.text);
    }

    injectHooks(view) {
      try {
        const script = "(" + pageHook.toString() + ")(" + JSON.stringify({ desktop: this.desktop }) + ")";
        const result = view.evaluate(script);
        if (result && result.catch) result.catch(() => {});
      } catch (_) {}
    }

    destroyNative() {
      try { this.native && this.native.destroy(); } catch (_) {}
      this.native = null;
    }

    // ---- menu -----------------------------------------------------------

    toggleMenu() {
      if (this.menuOpen) this.closeMenu();
      else {
        this.renderMenu();
        this.menuOpen = true;
        this.menu.classList.add("open");
        this.$("qv-more").setAttribute("aria-expanded", "true");
      }
    }

    closeMenu() {
      this.menuOpen = false;
      this.menu.classList.remove("open");
      this.$("qv-more").setAttribute("aria-expanded", "false");
    }

    renderMenu() {
      this.menu.querySelector('[data-act="back"]').disabled = this.pos <= 0;
      this.menu.querySelector('[data-act="forward"]').disabled = this.pos >= this.history.length - 1;
      this.$("qv-desktop-check").textContent = this.desktop ? "✓" : "";
      this.$("qv-view-label").textContent = !nativeBackend()
        ? "View: Embedded (native not available)"
        : "View: " + (this.mode === "native" ? "Native" : "Embedded");
    }

    onMenu(action) {
      switch (action) {
        case "back": this.closeMenu(); this.go(-1); break;
        case "forward": this.closeMenu(); this.go(1); break;
        case "reload":
          this.closeMenu();
          if (this.url) this.open(this.url, false); else this.toast("Nothing to reload");
          break;
        case "home": this.navigate(HOME); break;
        case "view": this.toggleMode(); break;
        case "desktop": this.toggleDesktop(); break;
        case "external": this.openExternal(); break;
        case "console": this.closeMenu(); this.drawer("console"); break;
        case "local": this.closeMenu(); this.drawer("local"); break;
      }
    }

    toggleMode() {
      this.closeMenu();
      if (!nativeBackend()) { this.toast("Native view isn't available in this Acode version"); return; }
      this.nativeBroken = false;
      this.mode = this.mode === "native" ? "embedded" : "native";
      store.set(KEY_MODE, this.mode);
      this.renderStart();
      this.toast("Next page opens in the " + (this.mode === "native" ? "native" : "embedded") + " view");
    }

    toggleDesktop() {
      this.closeMenu();
      this.desktop = !this.desktop;
      this.applyDesktop();
      if (this.native && !this.native.dead) this.injectHooks(this.native);
      this.toast(this.desktop ? "Desktop site on (applies when a page loads)" : "Desktop site off");
    }

    // Embedded view: render the frame 1280px wide and scale it down to fit.
    applyDesktop() {
      if (!this.frame) return;
      const stage = this.$("qv-stage");
      const on = this.desktop && !this.frame.classList.contains("hidden");
      stage.classList.toggle("qv-desktop", on);
      if (!on) {
        this.frame.style.transform = "";
        this.frame.style.height = "100%";
        return;
      }
      const scale = Math.min(1, (stage.clientWidth || 1280) / 1280);
      this.frame.style.transform = "scale(" + scale + ")";
      this.frame.style.height = (100 / scale) + "%";
    }

    openExternal() {
      this.closeMenu();
      const url = this.url || this.normalize(this.$("qv-url").value);
      if (!url) { this.toast("Enter an address first"); return; }
      try {
        if (window.system && typeof window.system.openInBrowser === "function") window.system.openInBrowser(url);
        else window.open(url, "_blank");
      } catch (error) {
        this.toast("Could not open the system browser");
        this.log("openInBrowser failed: " + (error && error.message));
      }
    }

    // ---- start view and recents -----------------------------------------

    loadRecent() {
      try {
        const list = JSON.parse(store.get(KEY_RECENT) || "[]");
        return Array.isArray(list) ? list.filter(u => typeof u === "string").slice(0, MAX_RECENT) : [];
      } catch (_) { return []; }
    }

    addRecent(url) {
      this.recent = [url].concat(this.recent.filter(u => u !== url)).slice(0, MAX_RECENT);
      store.set(KEY_RECENT, JSON.stringify(this.recent));
      this.renderStart();
    }

    renderStart() {
      const native = this.mode === "native" && nativeBackend();
      this.$("qv-start-sub").textContent = native
        ? "Pages open in Acode's native browser view and work on any site. Press back there to return here."
        : "Pages open inside this panel. Sites that block embedding open in the native view when it's available.";

      const list = this.$("qv-recent");
      list.replaceChildren();
      this.recent.forEach(url => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "qv-recent-item";
        item.dataset.url = url;
        const host = document.createElement("span");
        host.className = "qv-recent-host";
        host.textContent = this.hostOf(url);
        const path = document.createElement("span");
        path.className = "qv-recent-path";
        path.textContent = url;
        item.append(host, path);
        list.append(item);
      });
    }

    // ---- toast, log, drawers --------------------------------------------

    toast(text, ms) {
      const el = this.$("qv-toast");
      if (!el) return;
      el.textContent = text;
      el.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.remove("show"), ms || 2600);
    }

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
      this.log("Native backend: " + (nativeBackend() || "none") + ", view: " + this.mode);
      this.log("App CSP meta: " + (csp || "none in page (a header may still apply)"));
    }

    closeDrawers() {
      this.$("qv-console-drawer").classList.remove("open");
      this.$("qv-local-drawer").classList.remove("open");
    }

    drawer(which) {
      const el = this.$("qv-" + which + "-drawer");
      const willOpen = !el.classList.contains("open");
      this.closeDrawers();
      el.classList.toggle("open", willOpen);
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
          await fetch("http://127.0.0.1:" + port + "/", {
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
        open.type = "button";
        open.textContent = "Open";
        open.style.float = "right";
        open.addEventListener("click", () => {
          this.closeDrawers();
          this.navigate("http://127.0.0.1:" + port);
        });
        row.append("http://127.0.0.1:" + port + " ", open);
        output.append(row);
      });
    }

    // ---- teardown -------------------------------------------------------

    destroy() {
      clearTimeout(this.loadTimer);
      clearTimeout(this.toastTimer);
      this.destroyFns.forEach(fn => { try { fn(); } catch (_) {} });
      this.destroyNative();
      try { this.frame.removeAttribute("srcdoc"); this.frame.src = "about:blank"; } catch (_) {}
    }
  }

  Q.QuickView = QuickView;
})(window.__QuickView = window.__QuickView || {});
