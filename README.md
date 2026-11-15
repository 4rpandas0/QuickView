# QuickView 0.4.0 — Minimal browser for Acode

One line: address box, **Go**, and a three-dot menu.

## Install

1. Open Acode > Settings > Plugins.
2. Tap + > LOCAL.
3. Select QuickView.zip.

## Open

Tap the globe icon in Acode's top header, or run `quickview.open` from the command palette.
If the header icon can't be added, QuickView falls back to the floating side button.

## How pages load

QuickView picks the first display backend that exists:

1. **Native view** (`acode.require("webview")`): loads any site. Press back to return to QuickView.
2. **Acode in-app browser** (`system.inAppBrowser`): older Acode versions, any site.
3. **Embedded view** (an iframe in the plugin page): only sites that allow framing. If one is blocked, QuickView hands it to a native view automatically.

## Three-dot menu

Back, Forward, Reload, Home, View (Native or Embedded), Desktop site, Open in system browser, Console, Localhost finder.

## Files

| File | Purpose |
| --- | --- |
| `main.js` | Entry point: loads `src/`, plugin lifecycle, command |
| `src/styles.css` | All styling, with light and dark colour tokens |
| `src/template.js` | Page markup |
| `src/theme.js` | Light/dark detection (Acode theme, then system setting) |
| `src/browser.js` | Address bar, backends, menu, recent pages, console, localhost finder |
| `src/toolbar.js` | Header icon and side-button fallback |

## Notes

- Acode documents no API for adding buttons to its header, so the header icon is best effort.
- Desktop site: embedded view renders 1280px wide and scales down; the native view gets a 1280px viewport after the page loads.
- Console shows output from pages in the native WebView, plus any security-policy blocks.
- Localhost scanning is experimental; WebView network rules may prevent confirming open ports.

See `CHANGELOG.md` for version history.
