(() => {
  "use strict";

  const ID = "com.arpan.quickview";
  const ICON_CLASS = "quickview-browser-icon";
  let quickViewPage;
  let sideButton;
  let commands;
  let destroyed = false;

  const ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="black" stroke-width="2"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="black" stroke-width="1.5"/></svg>'
  );

  const CSS = `
    #quickview {
      height:100%; min-height:0; display:flex; flex-direction:column;
      color:var(--primary-text-color,#202431);
      background:var(--background-color,#f5f6fa);
      font-family:system-ui,-apple-system,sans-serif; overflow:hidden;
    }
    #quickview * { box-sizing:border-box; }
    #quickview button { font:inherit; cursor:pointer; }
    .qv-head { display:flex; align-items:center; justify-content:space-between; padding:12px; }
    .qv-brand { display:flex; align-items:center; gap:9px; font-weight:750; }
    .qv-logo { width:29px;height:29px;display:grid;place-items:center;border-radius:9px;background:#3978ee;color:white;font-weight:800; }
    .qv-new { border:0;border-radius:9px;width:34px;height:34px;background:var(--secondary-background-color,#fff);color:inherit;font-size:22px; }
    .qv-tabs { display:flex;gap:7px;padding:0 12px 10px; }
    .qv-tab { flex:1;min-width:0;padding:10px;border:1px solid var(--border-color,#e4e7ef);border-radius:10px;background:var(--secondary-background-color,#fff);color:var(--secondary-text-color,#758096);text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px; }
    .qv-tab.active { color:var(--primary-text-color,#202431);border-color:#3978ee;background:color-mix(in srgb,#3978ee 10%,var(--secondary-background-color,#fff));font-weight:700; }
    .qv-address { margin:0 12px 8px;display:flex;align-items:center;gap:8px;padding:5px 6px 5px 11px;border:1px solid var(--border-color,#e4e7ef);border-radius:12px;background:var(--secondary-background-color,#fff); }
    .qv-address span { color:var(--secondary-text-color,#758096); }
    .qv-address input { flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--primary-text-color,#202431);font-size:13px; }
    .qv-go { border:0;border-radius:8px;padding:8px 13px;background:#3978ee;color:#fff;font-size:12px;font-weight:700; }
    .qv-tools { display:flex;align-items:center;gap:4px;padding:0 10px 9px;border-bottom:1px solid var(--border-color,#e4e7ef); }
    .qv-tool { width:34px;height:32px;border:0;border-radius:8px;background:transparent;color:inherit;font-size:21px; }
    .qv-tool:active { background:var(--border-color,#e4e7ef); }
    .qv-spacer { flex:1; }
    .qv-stage { position:relative;flex:1;min-height:0;background:white;overflow:hidden;touch-action:pan-y; }
    .qv-frame { position:absolute;inset:0;width:100%;height:100%;border:0;background:white; }
    .qv-frame.hidden { display:none; }
    .qv-desktop .qv-frame:not(.hidden) { width:1280px;max-width:none;transform-origin:top left; }
    .qv-note { position:absolute;z-index:2;left:9px;right:9px;bottom:9px;padding:9px 10px;border-radius:8px;background:#fff2ce;color:#654c17;font-size:11px;line-height:1.4; }
    .qv-drawer { display:none;position:absolute;z-index:5;left:0;right:0;bottom:0;max-height:48%;overflow:auto;padding:11px;background:var(--secondary-background-color,#fff);border-top:1px solid var(--border-color,#e4e7ef);box-shadow:0 -8px 22px #0002; }
    .qv-drawer.open { display:block; }
    .qv-drawer-title { display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;margin-bottom:8px; }
    .qv-drawer button { border:0;border-radius:8px;padding:7px 10px;background:#3978ee;color:white;font-size:11px; }
    .qv-console-output,.qv-local-results { font:11px/1.5 ui-monospace,monospace;overflow-wrap:anywhere; }
    .qv-line { padding:4px 2px;border-bottom:1px solid var(--border-color,#e4e7ef); }
    .qv-muted { color:var(--secondary-text-color,#758096);font-size:11px; }
    .qv-status { display:flex;justify-content:space-between;padding:7px 12px;border-top:1px solid var(--border-color,#e4e7ef);color:var(--secondary-text-color,#758096);font-size:10px; }
  `;

  const MARKUP = `
    <div id="quickview">
      <header class="qv-head">
        <div class="qv-brand"><span class="qv-logo">Q</span> QuickView</div>
        <button class="qv-new" id="qv-new" aria-label="Open second tab">＋</button>
      </header>

      <div class="qv-tabs">
        <button class="qv-tab active" data-tab="0">Tab 1 · Start</button>
        <button class="qv-tab" data-tab="1">Tab 2 · New tab</button>
      </div>

      <form class="qv-address" id="qv-form">
        <span>◎</span>
        <input id="qv-url" type="text" inputmode="url" autocomplete="url"
          placeholder="Search or enter website address" aria-label="Website address">
        <button class="qv-go" type="submit">Go</button>
      </form>

      <div class="qv-tools">
        <button class="qv-tool" id="qv-back" title="Back">‹</button>
        <button class="qv-tool" id="qv-forward" title="Forward">›</button>
        <button class="qv-tool" id="qv-reload" title="Reload">↻</button>
        <button class="qv-tool" id="qv-home" title="Home">⌂</button>
        <span class="qv-spacer"></span>
        <button class="qv-tool" id="qv-desktop" title="Desktop viewport">▣</button>
        <button class="qv-tool" id="qv-console" title="Console">⌘</button>
        <button class="qv-tool" id="qv-local" title="Localhost finder">⌕</button>
      </div>

      <main class="qv-stage" id="qv-stage">
        <iframe class="qv-frame" id="qv-frame-0" title="QuickView tab 1"
          sandbox="allow-scripts allow-forms allow-popups allow-downloads"></iframe>
        <iframe class="qv-frame hidden" id="qv-frame-1" title="QuickView tab 2"
          sandbox="allow-scripts allow-forms allow-popups allow-downloads"></iframe>
        <div class="qv-note" id="qv-note">
          Some websites block embedded browsers. If a site refuses to appear, this iframe-based version cannot display it.
        </div>
        <section class="qv-drawer" id="qv-console-drawer">
          <div class="qv-drawer-title"><span>Developer console</span><button id="qv-clear">Clear</button></div>
          <div class="qv-console-output" id="qv-console-output">Console is ready. Cross-origin page logs cannot be inspected.</div>
        </section>
        <section class="qv-drawer" id="qv-local-drawer">
          <div class="qv-drawer-title"><span>Localhost Finder</span><button id="qv-scan">Scan ports</button></div>
          <p class="qv-muted">Checks common ports on this device. Detection may be blocked by Android WebView network rules.</p>
          <div class="qv-local-results" id="qv-local-results">Tap Scan ports to check.</div>
        </section>
      </main>

      <footer class="qv-status"><span id="qv-status">Ready</span><span id="qv-mode">Mobile viewport</span></footer>
    </div>
  `;

  class QuickView {
    constructor(page) {
      this.page = page;
      this.active = 0;
      this.desktop = false;
      this.tabs = [
        { url: "https://example.com", history: ["https://example.com"], pos: 0 },
        { url: "", history: [], pos: -1 }
      ];
      this.touchX = null;
      this.destroyFns = [];
    }

    init() {
      this.page.innerHTML = `<style>${CSS}</style>${MARKUP}`;
      this.$ = id => this.page.querySelector("#" + id);
      this.frames = [this.$("qv-frame-0"), this.$("qv-frame-1")];
      this.tabButtons = [...this.page.querySelectorAll(".qv-tab")];
      this.bind();
      this.updateTabUI();
      this.$("qv-url").value = this.tabs[0].url;
      this.load(0);
    }

    updateTabUI() {
      this.tabButtons.forEach((button, i) => {
        const tab = this.tabs[i];
        const label = tab.url ? (() => {
          try { return new URL(tab.url).hostname; } catch (_) { return "New tab"; }
        })() : "New tab";
        button.textContent = `Tab ${i + 1} · ${label}`;
        button.classList.toggle("active", i === this.active);
      });

      this.frames.forEach((frame, i) => {
        frame.classList.toggle("hidden", i !== this.active);
      });

      this.$("qv-url").value = this.tabs[this.active].url || "";
      this.$("qv-desktop").classList.toggle("active", this.desktop);
      this.$("qv-mode").textContent = this.desktop
        ? "Desktop width (simulated)"
        : "Mobile viewport";
    }

    on(el, event, fn, options) {
      el.addEventListener(event, fn, options);
      this.destroyFns.push(() => el.removeEventListener(event, fn, options));
    }

    bind() {
      this.tabButtons.forEach(button => this.on(button, "click", () => this.switchTab(+button.dataset.tab)));
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
      this.on(this.$("qv-home"), "click", () => this.navigate("https://example.com"));
      this.on(this.$("qv-desktop"), "click", () => this.toggleDesktop());
      this.on(this.$("qv-console"), "click", () => this.drawer("console"));
      this.on(this.$("qv-local"), "click", () => this.drawer("local"));
      this.on(this.$("qv-clear"), "click", () => this.$("qv-console-output").textContent = "Console cleared.");
      this.on(this.$("qv-scan"), "click", () => this.scanLocalhost());

      const stage = this.$("qv-stage");
      this.on(stage, "touchstart", e => this.touchX = e.changedTouches[0].clientX, {passive:true});
      this.on(stage, "touchend", e => {
        if (this.touchX === null) return;
        const dx = e.changedTouches[0].clientX - this.touchX;
        if (Math.abs(dx) > 65) this.switchTab(dx < 0 ? 1 : 0);
        this.touchX = null;
      }, {passive:true});
    }

    normalize(raw) {
      let value = String(raw || "").trim();
      if (!value) return null;
      if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) value = "http://" + value;
      else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        value = value.includes(".") && !value.includes(" ")
          ? "https://" + value
          : "https://www.google.com/search?q=" + encodeURIComponent(value);
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
      if (!tab.url) {
        this.frames[index].srcdoc = "<!doctype html><html><body style='font-family:system-ui;padding:28px;color:#667085'><h2>New tab</h2><p>Enter a website address above to get started.</p></body></html>";
        this.setStatus("New tab");
        return;
      }
      this.frames[index].src = tab.url;
      this.setStatus("Loading " + tab.url);
      this.$("qv-note").style.display = "block";
      this.frames[index].onload = () => {
        if (this.active === index) this.setStatus("Page loaded (embedding permitted)");
        this.$("qv-note").style.display = "none";
      };
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
      this.$("qv-url").value = tab.url;
      this.load(this.active);
    }

    reload() {
      const frame = this.frames[this.active];
      try {
        if (this.tabs[this.active].url) frame.src = this.tabs[this.active].url;
        else this.load(this.active);
      } catch (_) { this.setStatus("Reload unavailable"); }
    }

    toggleDesktop() {
      this.desktop = !this.desktop;
      this.$("qv-desktop").classList.toggle("active", this.desktop);
      this.$("qv-mode").textContent = this.desktop ? "Desktop width (simulated)" : "Mobile viewport";
      this.resizeDesktop();
    }

    resizeDesktop() {
      this.frames.forEach((frame, i) => {
        if (!this.desktop || i !== this.active) {
          frame.style.transform = "";
          frame.style.height = "100%";
          return;
        }
        const width = 1280;
        const scale = Math.min(1, this.$("qv-stage").clientWidth / width);
        frame.style.transform = `scale(${scale})`;
        frame.style.height = `${100 / scale}%`;
      });
    }

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
      found.sort((a,b) => a-b).forEach(port => {
        const row = document.createElement("div");
        row.className = "qv-line";
        const open = document.createElement("button");
        open.textContent = "Open";
        open.style.float = "right";
        open.addEventListener("click", () => {
          this.switchTab(1);
          this.$("qv-url").value = `http://127.0.0.1:${port}`;
          this.navigate(`http://127.0.0.1:${port}`);
          this.drawer("local");
        });
        row.append(`http://127.0.0.1:${port} `, open);
        output.append(row);
      });
    }

    setStatus(text) {
      this.$("qv-status").textContent = text;
    }

    destroy() {
      this.destroyFns.forEach(fn => { try { fn(); } catch (_) {} });
      this.frames?.forEach(frame => { frame.src = "about:blank"; });
    }
  }

  let instance;

  if (!window.acode) return;

  acode.setPluginInit(ID, async (_baseUrl, $page) => {
    quickViewPage = $page;
    instance = new QuickView($page);
    instance.init();

    // Acode's supported Side Buttons API creates a persistent floating button
    // on the right edge of the editor screen, independent of the active file.
    try {
      acode.addIcon(ICON_CLASS, ICON, { monochrome: true });
    } catch (_) {}

    try {
      const SideButton = acode.require("sideButton");
      sideButton = SideButton({
        text: "QuickView",
        icon: ICON_CLASS,
        onclick: () => {
          if (quickViewPage && typeof quickViewPage.show === "function") {
            quickViewPage.show();
          }
        },
        backgroundColor: "#3978ee",
        textColor: "#ffffff"
      });
      sideButton.show();
    } catch (error) {
      console.warn("QuickView: side button API unavailable", error);
    }

    try {
      commands = acode.require("commands");
      commands.addCommand({
        name: "quickview.open",
        description: "Open QuickView browser",
        exec: () => {
          quickViewPage?.show?.();
          return true;
        }
      });
    } catch (_) {}
  });

  acode.setPluginUnmount(ID, () => {
    destroyed = true;
    try { sideButton?.hide(); } catch (_) {}
    try { commands?.removeCommand("quickview.open"); } catch (_) {}
    try { instance?.destroy(); } catch (_) {}
    sideButton = null;
    commands = null;
    instance = null;
    quickViewPage = null;
  });
})();
