# Changelog

## 0.4.0
- New minimal UI: a single bar with address box, Go and a three-dot menu. Tabs, brand row, tool row and status bar are gone.
- Pages now load through Acode's native WebView (any site), then the in-app browser, with the embedded iframe as the last option. Blocked iframes open natively on their own.
- Start screen lists recent pages.
- Header icon taps are detected at document level, so Acode's header can't swallow them.
- Theme detection works before the page is first shown.
- Open in system browser uses `system.openInBrowser`.

## 0.3.2
- Detects pages that failed to load (blank frame or a Content-Security-Policy block) and says so in the status bar instead of "loaded".
- Console drawer now logs the app's CSP, the frame sandbox and any security-policy violations.
- New ↗ button opens the current page in the system browser.

## 0.3.1
- Header icon: reacts to touch as well as click, so taps on Acode's header are no longer swallowed.
- Opening the page now shows a toast with the reason if it fails, instead of failing silently.
- The page is sized to the screen each time it opens, so a collapsed page body can't leave it blank.

## 0.3.0
- Light and dark colour scheme support (follows Acode's theme, then the system setting).
- Small icon in Acode's top header; the side button is now only a fallback.
- Split into separate files: `main.js` plus `src/styles.css`, `template.js`, `theme.js`, `browser.js`, `toolbar.js`.
- Page loading fixes:
  - UI is now written into the Acode page body instead of replacing the whole page element.
  - A tab that started as "New tab" can now navigate (its `srcdoc` was overriding `src`).
  - Desktop viewport mode now actually widens the frame to 1280px.
  - Frames can keep cookies and storage (`allow-same-origin`), which many sites need to load.
  - Loading bar and clearer status messages.

## 0.2.1
- Initial version in the repo.
