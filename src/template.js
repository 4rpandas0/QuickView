/* QuickView markup: one bar (address, Go, menu), a stage, and two small drawers. */
(function (Q) {
  "use strict";

  const FRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-downloads allow-same-origin allow-modals";

  Q.markup = `
    <div id="quickview">
      <form class="qv-bar" id="qv-form">
        <input class="qv-url" id="qv-url" type="text" inputmode="url" autocomplete="off"
          autocapitalize="off" spellcheck="false" placeholder="Search or enter address"
          aria-label="Website address">
        <button class="qv-go" type="submit">Go</button>
        <button class="qv-more" id="qv-more" type="button" aria-label="More options"
          aria-haspopup="true" aria-expanded="false">⋮</button>
      </form>
      <div class="qv-progress" aria-hidden="true"></div>

      <main class="qv-stage" id="qv-stage">
        <section class="qv-start" id="qv-start">
          <div class="qv-start-title">QuickView</div>
          <p class="qv-start-sub" id="qv-start-sub"></p>
          <div class="qv-recent" id="qv-recent"></div>
        </section>
        <iframe class="qv-frame hidden" id="qv-frame" title="QuickView page" sandbox="${FRAME_SANDBOX}"></iframe>

        <section class="qv-drawer" id="qv-console-drawer">
          <div class="qv-drawer-title"><span>Console</span><button type="button" id="qv-clear">Clear</button></div>
          <div class="qv-console-output" id="qv-console-output"></div>
        </section>
        <section class="qv-drawer" id="qv-local-drawer">
          <div class="qv-drawer-title"><span>Localhost finder</span><button type="button" id="qv-scan">Scan ports</button></div>
          <p class="qv-muted">Checks common ports on this device. Android WebView rules may block detection.</p>
          <div class="qv-local-results" id="qv-local-results">Tap Scan ports to check.</div>
        </section>

        <div class="qv-toast" id="qv-toast" role="status"></div>
      </main>

      <nav class="qv-menu" id="qv-menu" aria-label="QuickView menu">
        <div class="qv-menu-row">
          <button type="button" class="qv-icon" data-act="back" aria-label="Back">‹</button>
          <button type="button" class="qv-icon" data-act="forward" aria-label="Forward">›</button>
          <button type="button" class="qv-icon" data-act="reload" aria-label="Reload">↻</button>
          <button type="button" class="qv-icon" data-act="home" aria-label="Home">⌂</button>
        </div>
        <button type="button" class="qv-item" data-act="view"><span id="qv-view-label">View</span></button>
        <button type="button" class="qv-item" data-act="desktop"><span>Desktop site</span><span class="qv-check" id="qv-desktop-check"></span></button>
        <button type="button" class="qv-item" data-act="external"><span>Open in system browser</span></button>
        <button type="button" class="qv-item" data-act="console"><span>Console</span></button>
        <button type="button" class="qv-item" data-act="local"><span>Localhost finder</span></button>
      </nav>
    </div>
  `;
})(window.__QuickView = window.__QuickView || {});
