/* Launcher: a small icon in Acode's top header, with the floating side button as a fallback. */
(function (Q) {
  "use strict";

  const ICON_CLASS = "quickview-browser-icon";
  const ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke-width="1.5"/></svg>'
  );

  // Acode has no documented API for the top header, so this uses editorManager.header when it exists.
  function addHeaderIcon(onOpen) {
    let header = null;
    try { header = window.editorManager && window.editorManager.header; } catch (_) {}
    if (!(header instanceof HTMLElement)) return null;

    const button = document.createElement("span");
    button.className = "icon " + ICON_CLASS;
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "QuickView");
    button.title = "QuickView";
    // Acode's header can swallow plain clicks on touch screens, so listen for touch as well and de-duplicate.
    let lastFired = 0;
    const fire = event => {
      const now = Date.now();
      if (now - lastFired < 500) return;
      lastFired = now;
      try { event.preventDefault(); event.stopPropagation(); } catch (_) {}
      onOpen();
    };
    button.addEventListener("click", fire);
    button.addEventListener("touchend", fire);
    button.style.cursor = "pointer";

    const last = header.lastElementChild;
    if (last && last.classList.contains("icon")) header.insertBefore(button, last);
    else header.append(button);

    return button.isConnected ? button : null;
  }

  // Acode's documented floating button on the right edge of the editor.
  function addSideButton(onOpen) {
    try {
      const SideButton = acode.require("sideButton");
      const side = SideButton({
        text: "QuickView",
        icon: ICON_CLASS,
        onclick: onOpen,
        backgroundColor: "#3978ee",
        textColor: "#ffffff"
      });
      side.show();
      return side;
    } catch (error) {
      console.warn("QuickView: side button API unavailable", error);
      return null;
    }
  }

  Q.mountLauncher = function ({ onOpen }) {
    try { acode.addIcon(ICON_CLASS, ICON, { monochrome: true }); } catch (_) {}

    const headerButton = addHeaderIcon(onOpen);
    const sideButton = headerButton ? null : addSideButton(onOpen);

    return {
      mode: headerButton ? "header" : sideButton ? "side" : "none",
      destroy() {
        try { headerButton && headerButton.remove(); } catch (_) {}
        try { sideButton && sideButton.hide(); } catch (_) {}
      }
    };
  };
})(window.__QuickView = window.__QuickView || {});
