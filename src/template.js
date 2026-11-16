/* QuickView markup: one bar (tabs, address, menu), a stage, and two small drawers. */
(function (Q) {
  "use strict";

  // No sandbox attribute: the plugins that render local projects successfully (Acode Live Preview, Live Server)
  // use a bare iframe. A sandboxed frame drops cookies, storage and form submission in ways that break most
  // sites, and it can't fix the real problem anyway, which is a site refusing to be framed at all.
  Q.markup = `
    <div id="quickview">
      <form class="qv-bar" id="qv-form">
        <button class="qv-tab" id="qv-tab" type="button" aria-label="Switch tab">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="8" width="13" height="13" rx="3"/>
            <path d="M8 4h9a3 3 0 0 1 3 3v9"/>
          </svg>
          <span class="qv-tab-count" id="qv-tab-count">1</span>
        </button>
        <input class="qv-url" id="qv-url" type="text" inputmode="url" autocomplete="off"
          autocapitalize="off" spellcheck="false" placeholder="Search or enter address"
          aria-label="Website address" enterkeyhint="go">
        <button class="qv-more" id="qv-more" type="button" aria-label="Menu"
          aria-haspopup="true" aria-expanded="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </form>
      <div class="qv-progress" aria-hidden="true"></div>

      <!-- One iframe per tab is created by src/browser.js and appended here. Keeping them all in the DOM is what
           makes a tab swap instant instead of a reload. -->
      <div class="qv-toast" id="qv-toast" role="status"></div>

      <!-- Anchored to #quickview, not to the stage: if the stage collapses these must still be visible. -->
      <section class="qv-drawer" id="qv-console-drawer">
        <div class="qv-drawer-title"><span>Console</span><button type="button" id="qv-clear">Clear</button></div>
        <div class="qv-console-output" id="qv-console-output"></div>
      </section>
      <section class="qv-drawer" id="qv-local-drawer">
        <div class="qv-drawer-title"><span>Localhost finder</span><button type="button" id="qv-scan">Scan ports</button></div>
        <p class="qv-muted">Checks common ports on this device. Android WebView rules may block detection.</p>
        <div class="qv-local-results" id="qv-local-results">Tap Scan ports to check.</div>
      </section>

      <div class="qv-notice hidden" id="qv-notice"></div>

      <nav class="qv-menu" id="qv-menu" aria-label="QuickView menu">
        <div class="qv-icon-row">
          <button type="button" class="qv-icon-btn" data-act="back" aria-label="Back" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
          </button>
          <button type="button" class="qv-icon-btn" data-act="forward" aria-label="Forward" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
          </button>
          <button type="button" class="qv-icon-btn" data-act="reload" aria-label="Reload">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20 4v5h-5"/></svg>
          </button>
          <button type="button" class="qv-icon-btn" data-act="home" aria-label="Home">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>
          </button>
        </div>

        <button type="button" class="qv-item" data-act="desktop">
          <span>Desktop site</span>
          <span class="qv-checkbox" id="qv-desktop-check" aria-hidden="true"></span>
        </button>
        <button type="button" class="qv-item" data-act="external"><span>Open in system browser</span></button>
        <button type="button" class="qv-item" data-act="console">
          <span>Console</span>
          <span class="qv-checkbox" id="qv-console-check" aria-hidden="true"></span>
        </button>
        <button type="button" class="qv-item" data-act="local"><span>Localhost finder</span></button>
        <button type="button" class="qv-item" data-act="close"><span>Close QuickView</span></button>
      </nav>
    </div>
  `;
})(window.__QuickView = window.__QuickView || {});
