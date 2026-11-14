# QuickView 0.2.1 — Standalone browser shell

QuickView is independent of the active editor file and terminal.

## Install
1. Open Acode > Settings > Plugins.
2. Tap + > LOCAL.
3. Select QuickView.zip.

## Open
Use the QuickView floating side button, or run `quickview.open` from the command palette.

## Important platform notes
- Acode's documented Side Buttons API places plugin buttons vertically along the right edge of the editor screen. It is available independently of the active file. A public API for adding an arbitrary icon directly into Acode's top toolbar is not documented; editing Acode's private toolbar DOM would be fragile.
- The two-tab interface uses iframes. Websites that prohibit framing via X-Frame-Options or Content-Security-Policy will not render.
- The desktop option simulates a 1280px viewport; it does not change the iframe's user-agent.
- Localhost scanning is experimental. Browser/WebView network restrictions may prevent confirming open ports.
- Acode's native WebView API currently opens a fullscreen activity, not an embeddable view, so it cannot provide this custom two-tab chrome inside the plugin page.
