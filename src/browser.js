/* QuickView browser: one bar (tabs, address, menu), three display backends, console and the localhost
 * finder. A page is always loaded: the frame never falls back to a start screen.
 *
 * Display backends, best first:
 *   1. Acode's native WebView API  (acode.require("webview"))   loads any site, reports page events
 *   2. Acode's in-app browser       (system.inAppBrowser)        loads any site, no events
 *   3. An iframe inside this page                                only works for sites that allow framing
 */
(function (Q) {
  "use strict";

  // Seekr is the home page, the new-tab page and the search engine. If its query parameter is not "q", change
  // SEARCH_URL here and nothing else: everything that searches goes through it.
  const HOME = "https://seekr-4t0mj3.v2.appdeploy.ai/";
  const DEFAULT_PAGE = HOME;
  const SEARCH_URL = HOME + "?q=";

  // Console: eruda, injected into the framed page itself. That is only possible when the page can be fetched and
  // rewritten here, which in practice means a localhost dev server that allows CORS. Any other site is cross-origin
  // and the browser forbids reaching into it.
  const ERUDA_URL = "https://cdn.jsdelivr.net/npm/eruda";
  const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;
  const LOAD_HINT_MS = 15000;
  const KEY_TABS = "quickview.tabs";
  const MAX_TABS = 2;
  const VERSION = "1.0.1";

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  };

  function webviewModule() {
    try { return acode.require("webview") || null; } catch (_) { return null; }
  }
  // Runs inside the page shown by the native WebView: forwards console output and applies desktop width.
  class QuickView {
    constructor(page) {
      this.page = page;
      // One iframe per tab. A tab's frame is created the first time the tab is shown and kept alive afterwards, so
      // swapping tabs shows the page already loaded instead of reloading it. Only the active frame is visible.
      this.tabs = [this.newTab()];
      this.activeTab = 0;
      this.forceReload = false;
      this.cachedTab = -1;
      this.consoleOn = false;
      this.desktop = false;
      this.loading = false;
      this.menuOpen = false;
      this.embedBlocked = false;
      this.loadTimer = null;
      this.toastTimer = null;
      this.probeCache = new Map(); // url -> did anything answer at that address
      this.destroyFns = [];
      this.loadedOnce = false;
    }

    // ---- active tab -----------------------------------------------------

    get tab() { return this.tabs[this.activeTab]; }
    get frame() { return this.tab && this.tab.frame ? this.tab.frame : null; }
    get url() { return this.tab.url; }
    set url(value) { this.tab.url = value; }
    get history() { return this.tab.history; }
    set history(value) { this.tab.history = value; }
    get pos() { return this.tab.pos; }
    set pos(value) { this.tab.pos = value; }

    newTab() {
      return { url: "", history: [], pos: -1, frame: null, loadedUrl: null, loading: false };
    }

    swapTab() {
      this.closeMenu();
      this.closeDrawers();
      if (this.tabs.length < 2) {
        if (this.tabs.length >= MAX_TABS) { this.toast("Tab limit reached"); return; }
        this.tabs.push(this.newTab());
        this.activeTab = this.tabs.length - 1;
        this.toast("New tab");
      } else {
        this.activeTab = (this.activeTab + 1) % this.tabs.length;
      }
      this.activateTab();
    }

    // Bring the active tab on screen. Its page is only loaded the first time: after that the same frame is shown.
    activateTab() {
      const tab = this.tab;
      if (!tab.url) tab.url = DEFAULT_PAGE;
      // The console is per tab: switching tabs turns it off rather than leaving a tick on a page that has no eruda.
      this.consoleOn = false;
      this.embedBlocked = false;
      this.hideNotice();
      this.setUrl(tab.url);
      this.renderMenu();
      if (!tab.frame || tab.loadedUrl !== tab.url) this.openEmbedded(tab.url);
      else {
        this.showTabFrames();
        this.setLoading(false);
        this.log("Cached page shown: " + tab.url);
      }
      // One page in memory at a time: the other tab keeps its address and nothing else.
      this.freeInactiveFrames();
      this.saveTabs();
    }

    // Free every frame except the one on screen. This is the memory saving: a tab you are not looking at keeps
    // its address and its history, not a live page.
    freeInactiveFrames() {
      this.tabs.forEach(t => {
        if (t === this.tab) return;
        if (t.frame) { try { t.frame.remove(); } catch (_) {} }
        t.frame = null;
        t.loadedUrl = null;
        t.loading = false;
      });
    }

    // Only the active tab's frame is on screen.
    showTabFrames() {
      this.tabs.forEach(t => {
        if (!t.frame) return;
        const active = t === this.tab;
        t.frame.classList.toggle("hidden", !active);
        t.frame.style.display = active ? "block" : "none";
      });
      this.layout();
    }

    // ---- tabs that survive a restart -------------------------------------

    saveTabs() {
      try {
        const data = {
          active: this.activeTab,
          cached: typeof this.cachedTab === "number" ? this.cachedTab : -1,
          tabs: this.tabs.map(t => ({
            url: t.url || "",
            history: (t.history || []).slice(-30),
            pos: typeof t.pos === "number" ? t.pos : -1
          }))
        };
        localStorage.setItem(KEY_TABS, JSON.stringify(data));
      } catch (_) {}
    }

    loadTabs() {
      try {
        const raw = store.get(KEY_TABS);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.tabs) || !data.tabs.length) return false;
        this.tabs = data.tabs.slice(0, MAX_TABS).map(t => ({
          url: typeof t.url === "string" ? t.url : "",
          history: Array.isArray(t.history) ? t.history.filter(u => typeof u === "string") : [],
          pos: typeof t.pos === "number" ? t.pos : -1,
          frame: null,
          loadedUrl: null
        }));
        // Restore the page that was cached at close. If the last close happened mid-load there is no cache, so
        // the other tab (or Home) is what you come back to.
        const cached = typeof data.cached === "number" ? data.cached : -1;
        if (cached >= 0 && cached < this.tabs.length && this.tabs[cached].url) {
          this.activeTab = cached;
        } else {
          this.activeTab = 0;
          const first = this.tabs[0];
          if (!first || !first.url) this.tabs = [this.newTab()];
        }
        return true;
      } catch (_) { return false; }
    }

    // ---- setup ----------------------------------------------------------

    init() {
      // Acode puts its own header, with a back arrow, above the page body. QuickView brings its own bar, so the
      // header is hidden and the bar takes the top of the screen. "Close QuickView" in the menu is the way out.
      try {
        if (this.page.header) this.page.header.style.display = "none";
      } catch (_) {}

      // Acode pages keep their own scroll area, so write into the page body.
      this.host = this.page.body || this.page;
      try {
        const setTitle = this.page.settitle || this.page.setTitle;
        if (setTitle) setTitle.call(this.page, "QuickView");
      } catch (_) {}
      this.host.innerHTML = Q.markup;

      this.$ = id => this.host.querySelector("#" + id);
      this.root = this.$("quickview");
      this.menu = this.$("qv-menu");

      this.theme = Q.createTheme({ host: this.host, root: this.root });
      this.destroyFns.push(() => this.theme.destroy());

      this.loadTabs();          // tabs from the last session, if there are any
      this.bind();
      this.renderMenu();
      this.logEnvironment();

      // Something is always on screen: the active tab loads its page (the default page on a first run).
      this.activateTab();

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

      this.on(this.$("qv-tab"), "click", () => this.swapTab());

      const more = this.$("qv-more");
      this.on(more, "click", e => { e.stopPropagation(); this.toggleMenu(); });
      this.on(this.menu, "click", e => {
        const button = e.target.closest("[data-act]");
        if (button && !button.disabled) this.onMenu(button.dataset.act);
      });
      this.on(this.root, "click", e => {
        if (this.menuOpen && !this.menu.contains(e.target)) this.closeMenu();
      });

      this.on(this.$("qv-clear"), "click", () => { this.$("qv-console-output").replaceChildren(); });
      this.on(this.$("qv-scan"), "click", () => this.scanLocalhost());

      this.on(document, "securitypolicyviolation", e => this.onPolicyViolation(e));
      this.on(window, "resize", () => this.layout());
    }

    // ---- sizing ---------------------------------------------------------

    // An iframe is a replaced element: it keeps its intrinsic 300x150 size unless width and height are set, so
    // left/right alone never stretch it. Everything here is explicit pixels, measured from #quickview, which is
    // the one box we know is the size of the screen.
    layout() {
      const bar = this.$("qv-form");
      if (!bar || !this.root) return;

      const top = Math.round(bar.getBoundingClientRect().height);
      const width = Math.round(this.root.clientWidth) || window.innerWidth;
      const height = Math.round(this.root.clientHeight - top) || (window.innerHeight - top);
      const notice = this.$("qv-notice");
      if (notice && top > 0) notice.style.top = top + "px";

      // Every tab's frame is sized, so a hidden tab is ready the moment it is shown.
      this.tabs.forEach(t => {
        const frame = t.frame;
        if (!frame) return;
        if (top > 0) frame.style.top = top + "px";
        if (this.desktop) {
          const scale = Math.min(1, width / 1280);
          frame.style.width = "1280px";
          frame.style.height = Math.round(height / scale) + "px";
          frame.style.transform = "scale(" + scale + ")";
          frame.style.transformOrigin = "top left";
        } else {
          frame.style.width = width + "px";
          frame.style.height = height + "px";
          frame.style.transform = "";
          frame.style.transformOrigin = "";
        }
      });
    }

    onShow() {
      if (this.theme) this.theme.apply();
      this.layout();
      requestAnimationFrame(() => this.layout());
      setTimeout(() => this.layout(), 350);
      this.renderMenu();
    }

    // ---- address handling -----------------------------------------------

    normalize(raw) {
      let value = String(raw || "").trim();
      if (!value) return null;
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) value = "http://" + value;
      else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        value = value.includes(".") && !/\s/.test(value)
          ? "https://" + value
          : this.searchFor(value);
      }
      try {
        const u = new URL(value);
        return ["http:", "https:"].includes(u.protocol) ? u.href : null;
      } catch (_) { return null; }
    }

    // Anything that isn't an address is a search, and every search goes to Seekr.
    searchFor(query) {
      const text = String(query || "").trim();
      if (!text) return null;
      return SEARCH_URL + encodeURIComponent(text);
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

    open(raw, push) {
      const url = raw || DEFAULT_PAGE;
      this.closeMenu();
      this.closeDrawers();
      if (push) this.pushHistory(url);
      this.setUrl(url);
      this.renderMenu();
      this.openEmbedded(url);
    }

    go(delta) {
      const next = this.pos + delta;
      if (next < 0 || next >= this.history.length) {
        this.toast(delta < 0 ? "No earlier page" : "No later page");
        return;
      }
      this.pos = next;
      this.renderMenu();
      this.open(this.history[next], false);
    }

    // Reload means reload: skip the cache this one time.
    reload() {
      const tab = this.tab;
      const url = tab.loadedUrl || tab.url || DEFAULT_PAGE;
      this.forceReload = true;
      this.openEmbedded(url);
      this.forceReload = false;
    }

    // ---- embedded backend -----------------------------------------------

    setLoading(on) {
      this.loading = on;
      this.root.classList.toggle("loading", on);
    }

    // A no-cors request resolves as soon as the server answers, whatever it answers. That is enough to tell
    // "nothing is listening" apart from "the page refuses to be framed", which the frame itself can't report.
    async probe(url, ms = 4000) {
      if (!url) return false;
      if (this.probeCache.has(url)) return this.probeCache.get(url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      let answered = false;
      try {
        await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: controller.signal });
        answered = true;
      } catch (_) { answered = false; }
      finally { clearTimeout(timer); }
      this.probeCache.set(url, answered);
      return answered;
    }

    // A tab gets its frame once, the first time it is shown, and keeps it. That is what makes swapping tabs
    // instant: the other tab is still loaded, just hidden.
    ensureFrame(tab) {
      if (tab.frame) return tab.frame;
      const frame = document.createElement("iframe");
      frame.className = "qv-frame hidden";
      frame.title = "QuickView page";
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      frame.setAttribute("allowfullscreen", "");
      frame.style.display = "none";
      frame.addEventListener("load", () => this.onFrameLoad(tab, frame));
      tab.frame = frame;
      this.root.appendChild(frame);
      return frame;
    }

    openEmbedded(url) {
      const tab = this.tab;
      const frame = this.ensureFrame(tab);
      this.embedBlocked = false;
      this.hideNotice();
      this.showTabFrames();

      // The cache: if this tab already holds this page, show it rather than fetching it again.
      if (!this.forceReload && tab.loadedUrl === url && frame.getAttribute("src")) {
        this.setLoading(false);
        this.layout();
        this.saveTabs();
        this.log("Cached page shown: " + url);
        return;
      }

      this.setLoading(true);
      clearTimeout(this.loadTimer);
      this.loadTimer = setTimeout(() => {
        if (this.loading && tab === this.tab && tab.loadedUrl === url) {
          this.setLoading(false);
          this.showNotice("Nothing has loaded from " + this.hostOf(url) + " yet.\n\n" +
            "The site may be slow, or it may be refusing to be embedded.",
            { label: "Open in system browser", run: () => this.openExternal(url) });
        }
      }, LOAD_HINT_MS);
      frame.removeAttribute("srcdoc");   // a leftover srcdoc would win over src
      tab.loadedUrl = url;
      tab.loading = true;
      tab.injected = false;
      frame.src = url;
      this.layout();
      this.saveTabs();
      this.log("Embedded view loading " + url);
    }

    onFrameLoad(tab, frame) {
      if (!tab.loadedUrl) return;        // the frame's own empty document, before we asked for anything
      tab.loading = false;
      if (tab !== this.tab) return;      // a background tab finished: nothing on screen changes
      clearTimeout(this.loadTimer);
      this.setLoading(false);
      // A blocked frame stays on about:blank, which is readable because that document inherits this origin.
      // A real cross-origin page throws here, and that throw is the success case.
      let href = "";
      try { href = frame.contentWindow.location.href; } catch (_) { href = ""; }
      if (href === "about:blank") { this.onEmbedBlocked("blank frame"); return; }
      this.loadedOnce = true;
      this.hideNotice();
      this.log("Embedded view loaded " + (href || tab.loadedUrl));
    }

    onPolicyViolation(event) {
      this.log("CSP blocked " + (event.blockedURI || "a resource") + " by " + event.violatedDirective);
      if (this.frame && !this.frame.classList.contains("hidden") &&
          /^(frame|child|default)-src/.test(event.violatedDirective || "")) {
        this.onEmbedBlocked("security policy");
      }
    }

    // The embedded frame can't show this page, so hand it to a native view when one exists.
    async onEmbedBlocked(reason) {
      if (this.embedBlocked) return;
      this.embedBlocked = true;
      this.setLoading(false);
      const url = this.url;
      this.log("Embedded view blocked (" + reason + "): " + url);
      const answered = await this.probe(url);
      this.log("Probe " + url + ": " + (answered ? "the server answered" : "no answer"));
      if (!answered) {
        this.showNotice("Nothing answered at " + this.hostOf(url) + ".\n\n" +
          "Either the server is down, or this app blocked the request.",
          { label: "Open in system browser", run: () => this.openExternal(url) });
        return;
      }
      // No handoff to the native view. That view is a fullscreen activity: it covered the browser, so tapping a
      // search result looked like the page had jumped somewhere else. The address stays in the bar, so Back works.
      this.showNotice(this.hostOf(url) + " won't open inside QuickView.\n\n" +
        "The site refuses to be framed, which a plugin can't override.\n" +
        "You can open it in your browser instead.",
        { label: "Open in system browser", run: () => this.openExternal(url) });
    }

    // ---- native backends ------------------------------------------------

    // ---- console (eruda, inside the framed page) --------------------------

    isLocal(url) {
      try { return LOCAL_HOSTS.test(new URL(url).hostname); } catch (_) { return false; }
    }

    // Console only means anything on a page we can fetch and rewrite, which is a localhost dev server. For any
    // other site the frame is cross-origin, and a page cannot script another origin's document.
    toggleConsole() {
      this.closeMenu();
      if (this.consoleOn) { this.disableEruda(); this.renderMenu(); return; }

      const url = this.url || this.tab.loadedUrl;
      if (!this.isLocal(url)) {
        this.toast("The console injects into localhost pages only", 4000);
        this.renderMenu();
        return;
      }
      this.enableEruda();
    }

    // Fetch the page, add the eruda tags to its markup, and load the result as a same-origin document, which is
    // what lets the script actually run inside it.
    async enableEruda() {
      const tab = this.tab;
      const frame = tab.frame;
      const url = this.url || tab.loadedUrl;
      if (!frame || !url) return;

      this.consoleOn = true;
      this.renderMenu();
      this.toast("Adding the console to the page…", 2500);

      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const html = await response.text();
        tab.injected = true;
        frame.removeAttribute("src");
        frame.srcdoc = this.withEruda(html, url);
        this.log("eruda injected into " + url);
      } catch (error) {
        this.consoleOn = false;
        this.renderMenu();
        this.log("eruda injection failed: " + (error && error.message));
        this.toast("Couldn't read " + this.hostOf(url) + ". The dev server has to allow CORS.", 5000);
      }
    }

    withEruda(html, url) {
      const tags = '<base href="' + url + '">' +
        '<script src="' + ERUDA_URL + '"><\/script>' +
        '<script>eruda.init();<\/script>';
      if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, match => match + tags);
      if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, match => match + "<head>" + tags + "</head>");
      return tags + html;
    }

    disableEruda() {
      this.consoleOn = false;
      const tab = this.tab;
      if (tab && tab.injected) {
        tab.injected = false;
        this.openEmbedded(tab.loadedUrl || tab.url);   // back to the real page
      }
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
      // Back and forward live in the menu, and the tab button carries the tab count.
      const back = this.menu.querySelector('[data-act="back"]');
      const forward = this.menu.querySelector('[data-act="forward"]');
      if (back) back.disabled = this.pos <= 0;
      if (forward) forward.disabled = this.pos >= this.history.length - 1;
      const count = this.$("qv-tab-count");
      if (count) count.textContent = String(this.tabs.length);
      const tab = this.$("qv-tab");
      if (tab) {
        tab.setAttribute("aria-label", this.tabs.length < 2
          ? "New tab"
          : "Switch tab, " + (this.activeTab + 1) + " of " + this.tabs.length);
      }
      const desktopCheck = this.$("qv-desktop-check");
      if (desktopCheck) desktopCheck.dataset.on = this.desktop ? "true" : "false";
      const consoleCheck = this.$("qv-console-check");
      if (consoleCheck) consoleCheck.dataset.on = this.consoleOn ? "true" : "false";
      const consoleRow = this.menu.querySelector('[data-act="console"]');
      if (consoleRow) {
        consoleRow.dataset.disabled = this.isLocal(this.url || this.tab.loadedUrl) ? "false" : "true";
      }
    }

    onMenu(action) {
      switch (action) {
        case "back": this.closeMenu(); this.go(-1); break;
        case "forward": this.closeMenu(); this.go(1); break;
        case "close": this.close(); break;
        case "reload": this.closeMenu(); this.reload(); break;
        case "home": this.navigate(HOME); break;
        case "desktop": this.toggleDesktop(); break;
        case "external": this.openExternal(); break;
        case "console": this.toggleConsole(); break;
        case "local": this.closeMenu(); this.drawer("local"); break;
      }
    }

    // The page header is hidden, so the menu carries the way back to the editor.
    close() {
      this.closeMenu();
      this.closeDrawers();
      // Only the page on screen is worth remembering, and only once it has finished loading. Closing mid-load
      // leaves nothing cached, so reopening starts at Home rather than on a half-loaded page.
      const tab = this.tab;
      this.cachedTab = (tab && !tab.loading && tab.loadedUrl) ? this.activeTab : -1;
      this.saveTabs();
      this.freeFrames();
      try {
        if (this.page && typeof this.page.hide === "function") this.page.hide();
        else if (this.page) this.page.remove();
      } catch (error) {
        this.log("Could not close the page: " + (error && error.message));
      }
    }

    toggleDesktop() {
      this.closeMenu();
      this.desktop = !this.desktop;
      this.layout();
      this.renderMenu();
      this.toast(this.desktop ? "Desktop site on (applies when a page loads)" : "Desktop site off");
    }

    openExternal(target) {
      this.closeMenu();
      const url = target || this.url || this.normalize(this.$("qv-url").value);
      if (!url) { this.toast("Enter an address first"); return; }
      try {
        if (window.system && typeof window.system.openInBrowser === "function") window.system.openInBrowser(url);
        else window.open(url, "_blank");
      } catch (error) {
        this.toast("Could not open the system browser");
        this.log("openInBrowser failed: " + (error && error.message));
      }
    }

    // ---- toast, log, drawers --------------------------------------------

    // A blank frame used to look like nothing at all. Anything that goes wrong now says so in the frame's place.
    showNotice(text, action) {
      const el = this.$("qv-notice");
      if (!el) return;
      const bar = this.$("qv-form");
      el.style.top = (bar ? bar.getBoundingClientRect().height : 56) + "px";
      el.textContent = text;
      el.onclick = () => this.hideNotice();
      if (action && action.label) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "qv-notice-action";
        button.textContent = action.label;
        button.onclick = e => {
          e.stopPropagation();
          this.hideNotice();
          try { action.run(); } catch (_) {}
        };
        el.appendChild(button);
      }
      el.classList.remove("hidden");
    }

    hideNotice() {
      const el = this.$("qv-notice");
      if (el) el.classList.add("hidden");
    }

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

    // Loads a page that needs no network into the frame. If it appears, frames work in this app and the problem
    // is the remote site or a policy; if it doesn't, this Acode build is refusing frames outright.

    logEnvironment() {
      let csp = "";
      try {
        const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
        csp = meta ? meta.getAttribute("content") : "";
      } catch (_) {}
      this.log("QuickView v" + VERSION + " · embedded view · tabs " + this.tabs.length);
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
      const ports = [3000, 3001, 4173, 4321, 5000, 5173, 5174, 5500, 8000, 8080, 8888];
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

    // Frees the memory the pages hold. Called when QuickView is closed; the tab addresses stay in storage.
    freeFrames() {
      this.tabs.forEach(t => {
        if (t.frame) { try { t.frame.remove(); } catch (_) {} }
        t.frame = null;
        t.loadedUrl = null;
      });
    }

    // ---- teardown -------------------------------------------------------

    destroy() {
      clearTimeout(this.loadTimer);
      clearTimeout(this.toastTimer);
      try { if (this.page && this.page.header) this.page.header.style.display = ""; } catch (_) {}
      this.destroyFns.forEach(fn => { try { fn(); } catch (_) {} });
      this.saveTabs();
      this.freeFrames();
    }
  }

  Q.QuickView = QuickView;
})(window.__QuickView = window.__QuickView || {});
