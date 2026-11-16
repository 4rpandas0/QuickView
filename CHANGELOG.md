# Changelog

## 1.0.3
- README rewritten for people using the plugin rather than reading its code: how to install and open it, how to set up Seekr with a SerpApi key, how searching works, the two tabs, the menu, the console and what happens on sites that refuse to open.

## 1.0.2
- Author details in `plugin.json`: name, email (`4rpandas0@gmail.com`) and GitHub account (`4rpandas0`), so the marketplace listing links back to the source.

## 1.0.1
- Added an icon: a blue browser window with tabs behind it and a globe inside, on a dark rounded tile. It ships as `icon.png` and is declared in `plugin.json`.

## 1.0.0
- First release. One bar at the top of the screen with a tab button, an address box and a menu, and pages rendered in an iframe inside the plugin page.
- Home and search are Seekr (`https://seekr-4t0mj3.v2.appdeploy.ai/`); anything typed that isn't an address becomes a search there.
- Two tabs at most, and only the one on screen holds a live page. The page you were viewing is cached when QuickView closes; the other tab keeps only its URL.
- Console injects eruda into the framed page, for localhost pages only, and resets when you switch tabs.
- Removed the unused native WebView backend: the plugin no longer carries a second rendering path nothing can reach.
- Added LICENSE and .gitignore, and rewrote this README to describe what the plugin actually does.

## 0.9.5
- Console now injects eruda into the framed page instead of this page. QuickView fetches the page, adds `<script src="https://cdn.jsdelivr.net/npm/eruda"></script>` and `eruda.init()` to its markup, and loads the result as a same-origin document, so the console inspects the site.
- That is only possible where the page can be fetched and rewritten, so the Console row is enabled for localhost pages only and greyed out elsewhere. Toggling it off puts the real page back.
- If the dev server doesn't allow CORS, the console says so instead of failing silently.

## 0.9.4
- Console is a switch with a check box instead of a launcher. Turning it on inserts `<script src="https://cdn.jsdelivr.net/npm/eruda"></script>` into the page and calls `eruda.init()`; turning it off destroys eruda and removes the tag.
- Desktop site gets the same check box styling, so both switches look alike: an empty outline when off, a filled box with a tick when on.
- The log drawer no longer opens by itself when a frame is blocked; that looked like the console misbehaving.

## 0.9.3
- Fixed the globe icon not opening QuickView. The previous guard demanded positive proof that the tap was on the icon, and Acode's header often hands the event over as the header element instead, so every tap was refused. A tap is now ignored only when another header icon is actually under the finger; anything else counts as ours, as before.

## 0.9.2
- Two tabs at most, and only the tab you are looking at keeps a live page. Switching tabs frees the page you left and keeps its address, so memory stays flat instead of growing with every tab.
- The page is cached at close, not while browsing: the page on screen when you close QuickView is the one that comes back. The other tab keeps only its URL.
- A page that is still loading when you close is not cached; reopening starts on the other tab, or Home.
- Header icon: a tap on a different header icon that happens to sit where the QuickView icon used to be (on the Files page, for example) no longer opens QuickView. The tap has to land on the icon itself, checked against the event target and against what is under the finger.

## 0.9.1
- The menu is a hybrid again: the four you reach for most — back, forward, reload, home — sit in an icon row at the top, and everything else stays a labelled row underneath: Desktop site (with its check mark), Open in system browser, Console, Localhost finder, Close QuickView.

## 0.9.0
- Tapping a search result no longer throws you into the native view. QuickView used to hand a page that refuses framing to Acode's fullscreen WebView, which covered the browser and looked like the page had jumped somewhere else. It now stays put: the address stays in the bar, Back still works, and the message offers "Open in system browser" as a button.
- The menu is a compact grid of icons instead of a list of text buttons: back, forward, reload, home, desktop site, open in system browser, console, close. Desktop site lights up while it is on.
- Diagnostics is gone, along with its menu entry, the five-second report and the sizes in the menu footer.
- The View (native/embedded) toggle is gone: QuickView always renders in the embedded view.

## 0.8.1
- Seekr (`https://seekr-4t0mj3.v2.appdeploy.ai/`) is the home page, the new-tab page and the search engine. Typing anything that isn't an address searches it; `Home` in the menu returns to it.
- Console opens eruda, loaded from `https://cdn.jsdelivr.net/npm/eruda` on first use, instead of the built-in log drawer. The drawer stays as a fallback if the CDN can't be reached.
- The query is sent as `?q=`. If Seekr uses a different parameter, change `SEARCH_URL` in `src/browser.js`; every search goes through it.

## 0.8.0
- Each tab now keeps its own iframe, created the first time the tab is shown and left loaded afterwards. Swapping tabs shows the page you left, with its scroll position and state, instead of reloading it.
- Only the active tab's frame is visible; the others stay loaded but hidden.
- Opening an address a tab already holds shows that page rather than fetching it again. Reload still forces a fresh load.
- Tab addresses, their back/forward history and which tab was active are saved, so closing QuickView and even restarting Acode brings the same tabs back. Only the active tab loads immediately; the others load when first shown.
- Closing QuickView frees the pages themselves, so the memory goes back, and keeps the addresses.

## 0.7.7
- Fixed the blank page area for real. An iframe is a replaced element: it keeps its intrinsic 300x150 size unless width and height are set, so `left:0; right:0` never stretched it, and inside the old stage it measured 0 wide. The frame is now a direct child of `#quickview` and gets explicit pixel width and height measured from the root.
- The stage element is gone; nothing about the frame's size depends on a flex child resolving.
- Desktop site scales from the same measurement instead of a percentage height.
- Diagnostics and the menu footer now report root, bar and frame sizes.

## 0.7.5
- The stage now gets an explicit pixel height instead of relying on `flex:1`. A collapsed stage makes the frame, the notice and the console all zero pixels tall, which looks like a blank page while the bar and menu still work.
- The notice and both drawers moved out of the stage and onto the root, so they are visible even when the stage isn't.
- Diagnostics now writes the numbers on screen: version, view, root/stage/frame sizes, the frame's computed display, its src and what its document holds. The green offline test page is still loaded into the frame.
- The menu carries the same numbers in a footer line, so they can be read even if nothing else renders.
- If nothing has loaded after five seconds, the report appears on its own.

## 0.7.4
- A frame that shows nothing now says why, in the frame's own place: nothing answered at that host, the site refuses framing, or it is still loading. A silent blank area was impossible to diagnose.
- The view mode is no longer remembered between sessions (0.7.3) and the Diagnostics menu item is in place: it opens the console, logs the window, root, stage and frame sizes and the frame's document, and loads a page that needs no network into the frame.
- The console opens by itself when a frame comes up blank.

## 0.7.3
- The view mode is no longer remembered between sessions. A `native` value left in storage by an earlier build kept opening the fullscreen native view, which covers the page and hides the bar and the frame. Embedded is now always the starting view; the View menu only changes it for the current session.
- New Diagnostics item in the menu: it opens the console, logs the window, root, stage and frame sizes plus the frame's document, and loads a page that needs no network into the frame. If that page appears, frames work and a site is refusing them; if it doesn't, this Acode build is refusing frames.
- The console opens by itself when a frame comes up blank, and every frame load logs its diagnostics.
- The version is logged, so it's obvious which build is installed.

## 0.7.2
- Fixed the embedded view never appearing. QuickView picked the native view by default whenever Acode offered one, and that view is a fullscreen activity: it covered the plugin page, so the bar and the frame were behind it and the browser looked broken. Embedded is now the default, and the native view is only used when you pick it from the View menu.
- The View menu line now ends in a chevron so it reads as a setting you can change.
- `#quickview` keeps a `100vh` fallback under `100dvh`, for a WebView that doesn't know `dvh`.

## 0.7.1
- A page is always loaded. The start view with the recent pages list is gone, along with the code that hid the frame to show it.
- The first tab opens a default page: a 2048 clone on GitHub Pages (`https://kwrush.github.io/react-2048/`), chosen because GitHub Pages sends no `X-Frame-Options`, so it loads inside the frame. Change `DEFAULT_PAGE` in `src/browser.js` to point somewhere else.
- A new tab also opens that page rather than an empty panel, and it becomes the tab's first history entry.
- Opening an empty address falls back to the default page instead of doing nothing.

## 0.7.0
- The bar now sits at the absolute top of the screen. Acode's own page header is hidden, and "Close QuickView" in the menu is the way back to the editor.
- The back and forward arrows are gone from the bar. One standalone button replaces them: it swaps to the next tab, and creates a tab when there is only one. A small badge on the button shows how many tabs are open.
- Tabs keep their own address and back/forward history, so switching tabs returns you where you were. Back and Forward moved into the menu.
- The page now defines `show()`, which Acode's page object lacks. The launcher used to fail with "this Acode page has no show()" and the page could not be reopened after being closed.
- `#quickview` is pinned with `inset:0`, so the measuring code that sized the page is gone.

## 0.6.0
- Back, Forward and the menu moved into the top bar, either side of the address box, with icon buttons. Back and Forward grey out when there is nowhere to go.
- The Go button is gone; the address box navigates on Enter and carries the keyboard's Go key.
- The dropdown is now Reload, Home, View, Desktop site, Open in system browser, Console and Localhost finder.

## 0.5.0
- Embedded view now behaves like the other Acode preview plugins: a bare iframe, no `sandbox` attribute, so cookies, storage, forms and popups work.
- Fixed the false "this site blocks embedding" that appeared on nearly every URL: an iframe that already held `about:blank` could fire a load event for that empty document, which was read as a blocked page. Each navigation now gets a fresh frame and a sequence number, so stale load events are ignored.
- When a frame does come up blank, QuickView first probes the address with a `no-cors` request. No answer means the server is down; an answer means the site refused framing. Only the second case hands off to the native view.
- `View` now re-opens the current page in the chosen view and tears down a live native WebView, which used to stay on top of the page and make the toggle look broken.
- The stage falls back to `100dvh` and measures with `visualViewport`, so a collapsed page body or an open keyboard can't leave the frame zero pixels tall.
- Localhost finder scans 3001, 4173, 4321, 5000, 5174 and the ports the live preview plugins use.

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
