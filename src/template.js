/* QuickView markup and the "New tab" page. */
(function (Q) {
  "use strict";

  const FRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-downloads allow-same-origin allow-modals";

  Q.markup = `
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
        <button class="qv-tool" id="qv-external" title="Open in browser">↗</button>
        <button class="qv-tool" id="qv-desktop" title="Desktop viewport">▣</button>
        <button class="qv-tool" id="qv-console" title="Console">⌘</button>
        <button class="qv-tool" id="qv-local" title="Localhost finder">⌕</button>
      </div>
      <div class="qv-progress" aria-hidden="true"></div>

      <main class="qv-stage" id="qv-stage">
        <iframe class="qv-frame" id="qv-frame-0" title="QuickView tab 1" sandbox="${FRAME_SANDBOX}"></iframe>
        <iframe class="qv-frame hidden" id="qv-frame-1" title="QuickView tab 2" sandbox="${FRAME_SANDBOX}"></iframe>
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

  // The blank page shown in a tab that has no address yet (it sits in an iframe, so it needs its own colours).
  Q.newTabDoc = function (dark) {
    const bg = dark ? "#16181d" : "#ffffff";
    const fg = dark ? "#e6e9f0" : "#202431";
    const muted = dark ? "#9aa4b8" : "#667085";
    return "<!doctype html><html><head><meta name='color-scheme' content='" + (dark ? "dark" : "light") +
      "'></head><body style='margin:0;padding:28px;font-family:system-ui;background:" + bg +
      ";color:" + muted + "'><h2 style='color:" + fg +
      "'>New tab</h2><p>Enter a website address above to get started.</p></body></html>";
  };
})(window.__QuickView = window.__QuickView || {});
