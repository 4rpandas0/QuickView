# QuickView 1.0.1 — Minimal browser for Acode

One line at the top of the screen: a tab button, an address box, and a menu. Pages open in an iframe inside the
plugin page, so the bar and the page live in the same place.

## Install

1. Open Acode > Settings > Plugins.
2. Tap + > LOCAL.
3. Select QuickView.zip.

## Open

Tap the globe icon in Acode's top header, or run `quickview.open` from the command palette.
If the header icon can't be added, QuickView falls back to the floating side button.

## Home and search

Home is Seekr, at `https://seekr-4t0mj3.v2.appdeploy.ai/`. It is the page you land on, the page a new tab opens,
and the search engine: anything typed into the address box that isn't a web address becomes a search there.

The query goes in as `?q=`. If Seekr reads a different parameter, change `SEARCH_URL` in `src/browser.js` — every
search goes through that one line.

## Top bar

The bar sits at the absolute top of the screen; Acode's own page header is hidden. The address box navigates on
Enter, and the keyboard's Go key submits it.

The button on the left is the tab button, with a badge showing how many tabs are open. There are **two tabs at
most**: tap it to swap to the other one, or to make a second one when you only have one.

## Tabs and caching

Only the tab you are looking at holds a live page. Switching frees the page you left and keeps its address and
history, so memory stays flat instead of growing with every tab.

The cache is made when QuickView closes, not while you browse: the page on screen at that moment is the one that
comes back. The other tab keeps only its URL, and a page that was still loading is not cached at all — reopening
then starts on the other tab, or Home.

What survives a close is the address, not a rendered copy of the page: a cross-origin page can't be snapshotted,
and Acode removes the plugin page from the DOM when you close it. The page comes back through the WebView's own
HTTP cache.

## Menu

Four icons along the top — back, forward, reload, home — and labelled rows below them:

- **Desktop site** — renders the frame 1280px wide and scales it down. A check box shows when it's on.
- **Open in system browser** — hands the current address to your browser.
- **Console** — injects eruda into the page. See below.
- **Localhost finder** — scans common dev ports on this device. Android WebView rules may block detection.
- **Close QuickView** — the way back to the editor, since the page header is hidden.

## Console

Toggling Console on fetches the current page, adds `<script src="https://cdn.jsdelivr.net/npm/eruda"></script>`
and `eruda.init()` to its markup, and loads the result as a same-origin document, so eruda inspects the site rather
than the plugin. Toggling it off puts the real page back.

This is only possible where the page can be fetched and rewritten, so the row is enabled for **localhost pages
only** and greyed out everywhere else. The dev server has to allow CORS — Vite does by default; if it doesn't,
you get a toast instead of silence.

Because that page is rendered as a same-origin document, its own scripts run with this plugin's origin and can
reach the plugin's DOM, storage and Acode's API. That is fine for a dev server you control; don't point it at a
page you don't trust.

## Pages that refuse to be framed

Some sites send `X-Frame-Options` or a `frame-ancestors` policy and cannot be shown in a frame. That is a rule of
the browser, not something a plugin can override. QuickView says so in place of the page and offers an
**Open in system browser** button. It never hands the page to another view.

## Files

| File | Purpose |
| --- | --- |
| `main.js` | Entry point: loads `src/`, plugin lifecycle, command |
| `src/styles.css` | Styling, with light and dark colour tokens |
| `src/template.js` | Page markup: top bar, menu, notice |
| `src/theme.js` | Light/dark detection (Acode theme, then system setting) |
| `src/browser.js` | Tabs, caching, address handling, iframe control, console |
| `src/toolbar.js` | Header icon and side-button fallback |

## Notes

- Acode documents no API for adding buttons to its header, so the header icon is best effort. It only reacts to
  taps that land on the icon itself, never on another header icon that happens to sit in the same place.
- Tabs, their history and the cached page are kept in `localStorage` under `quickview.tabs`.

See `CHANGELOG.md` for version history.
