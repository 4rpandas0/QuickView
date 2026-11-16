# QuickView

A small browser inside Acode. One bar at the top of the screen — a tab button, an address box and a menu — and
the page you're reading right below it. No switching apps to look something up while you're editing.

## Install

1. Open Acode › Settings › Plugins.
2. Tap **+**, then **LOCAL**.
3. Pick `QuickView.zip`.

## Open it

Tap the globe icon in Acode's top header, or run `quickview.open` from the command palette.

## Set up Seekr before you search

QuickView's home page and search engine is Seekr, and Seekr gets its results from Google through **SerpApi**. That
means Seekr needs your own SerpApi key before it will return anything:

1. Go to **serpapi.com** and sign in, or create a free account.
2. Open your SerpApi dashboard and copy your **API key**.
3. Open QuickView, let Seekr load, and paste the key into the field it asks for. It's kept for next time, so you
   only do this once.

SerpApi's free plan gives you a limited number of searches each month; if results stop coming back, check your
usage on their dashboard. The key stays with you — QuickView doesn't send it anywhere of its own.

## Searching

Type into the address box and press Enter, or tap the Go key on your keyboard.

- Type a **web address** — `github.com`, `localhost:3000` — and it opens that page.
- Type **anything else** — `how to center a div` — and it searches Seekr.

**Home** in the menu always takes you back to Seekr.

## Two tabs

Tap the tab button on the left of the bar to switch to your other tab, or to open a second one if you only have
one. The little badge on it shows how many tabs are open, and there are two at most.

Each tab remembers its own address and its own back/forward history, so switching back puts you where you left.
Only the tab you're looking at stays loaded in memory — that keeps QuickView light on a phone.

## The menu

The four icons across the top are **back**, **forward**, **reload** and **home**. Below them:

- **Desktop site** — shows the page at desktop width, scaled to fit your screen. Handy for sites that hide
  features on mobile. The check box shows when it's on.
- **Open in system browser** — sends the current address to Chrome or whatever browser you use.
- **Console** — a developer console for the page you're working on. See below.
- **Localhost finder** — looks for dev servers running on this device.
- **Close QuickView** — back to the editor.

## Console, for localhost pages

If you're previewing a dev server — `localhost:3000`, `127.0.0.1:5173` — turn on **Console** and QuickView adds
[eruda](https://github.com/liriliri/eruda) to that page, giving you console logs, network requests and the DOM for
the site itself rather than for the plugin. Turn it off and the real page comes back.

It only works for localhost pages, and your dev server has to allow cross-origin requests (Vite does by default).
If it doesn't, QuickView tells you instead of failing quietly.

One thing to keep in mind: while the console is on, the page is loaded in a way that lets its own scripts reach the
plugin. That's fine for a dev server you control — don't turn it on for a page you don't trust.

## Pages that won't open

A few sites refuse to be shown inside another app. When that happens QuickView says so in place of the page and
offers **Open in system browser**, so you can still get to it. Nothing is hidden or lost — the address stays in the
bar, so Back still works.

## Good to know

- Your tabs and the page you were last reading are saved when you close QuickView, and come back when you open it
  again — even after restarting Acode.
- If the globe icon can't be added to Acode's header, QuickView falls back to a floating button on the right edge.
