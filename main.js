/* QuickView entry point. Loads the files in src/ and wires up the Acode plugin lifecycle. */
(() => {
  "use strict";

  if (!window.acode) return;

  const ID = "com.arpan.quickview";
  const NS = "__QuickView";
  const STYLES = ["src/styles.css"];
  const SCRIPTS = ["src/template.js", "src/theme.js", "src/browser.js", "src/toolbar.js"];

  const injected = [];
  let instance;
  let launcher;
  let commands;
  let openPage = () => {};

  function inject(tag, attrs) {
    return new Promise((resolve, reject) => {
      const el = document.createElement(tag);
      Object.assign(el, attrs);
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load " + (attrs.src || attrs.href)));
      injected.push(el);
      document.head.append(el);
    });
  }

  const loadStyle = href => inject("link", { rel: "stylesheet", href });
  const loadScript = src => inject("script", { src, async: false });

  acode.setPluginInit(ID, async (baseUrl, $page) => {
    const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

    try {
      for (const file of STYLES) await loadStyle(base + file);
      for (const file of SCRIPTS) await loadScript(base + file);

      const Q = window[NS];
      $page.id = "quickview-page";
      instance = new Q.QuickView($page);
      instance.init();

      openPage = () => {
        try {
          if (typeof $page.show !== "function") throw new Error("this Acode page has no show()");
          if (!$page.isConnected) $page.show();
          instance.onShow();
        } catch (error) {
          console.error("QuickView could not open", error);
          try { window.toast("QuickView could not open: " + error.message, 4000); } catch (_) {}
        }
      };

      launcher = Q.mountLauncher({ onOpen: () => openPage() });
    } catch (error) {
      console.error("QuickView failed to start", error);
      try { window.toast("QuickView failed to start: " + error.message, 4000); } catch (_) {}
      return;
    }

    try {
      commands = acode.require("commands");
      commands.addCommand({
        name: "quickview.open",
        description: "Open QuickView browser",
        exec: () => {
          openPage();
          return true;
        }
      });
    } catch (_) {}
  });

  acode.setPluginUnmount(ID, () => {
    try { launcher && launcher.destroy(); } catch (_) {}
    try { commands && commands.removeCommand("quickview.open"); } catch (_) {}
    try { instance && instance.destroy(); } catch (_) {}
    injected.forEach(el => { try { el.remove(); } catch (_) {} });
    injected.length = 0;
    delete window[NS];
    launcher = commands = instance = null;
    openPage = () => {};
  });
})();
