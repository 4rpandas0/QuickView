/* Launcher: a small icon in Acode's top header, with the floating side button as a fallback. */
(function (Q) {
  "use strict";

  const ICON_CLASS = "quickview-browser-icon";
  const ICON = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke-width="1.5"/></svg>'
  );

  // Acode documents editorManager.header as the editor header tile, but has no API for adding buttons to it.
  function addHeaderIcon(onOpen) {
    let header = null;
    try { header = window.editorManager && window.editorManager.header; } catch (_) {}
    if (!(header instanceof HTMLElement)) return null;

    const button = document.createElement("span");
    button.className = "icon " + ICON_CLASS;
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "QuickView");
    button.title = "QuickView";
    button.style.cursor = "pointer";

    const last = header.lastElementChild;
    if (last && last.classList.contains("icon")) header.insertBefore(button, last);
    else header.append(button);
    if (!button.isConnected) return null;

    // Acode's header handles touches itself, so a listener on the button may never run. Listen on the
    // document in the capture phase instead and hit-test the tap against the button's on-screen box.
    let lastFired = 0;
    const onTap = event => {
      if (!button.isConnected) return;
      const point = (event.changedTouches && event.changedTouches[0]) || event;
      const box = button.getBoundingClientRect();
      if (!box.width || !box.height) return;
      if (point.clientX < box.left || point.clientX > box.right) return;
      if (point.clientY < box.top || point.clientY > box.bottom) return;

      event.stopPropagation();
      event.preventDefault();
      const now = Date.now();
      if (now - lastFired < 500) return;
      lastFired = now;
      onOpen();
    };
    document.addEventListener("click", onTap, true);
    document.addEventListener("touchend", onTap, true);

    return {
      destroy() {
        document.removeEventListener("click", onTap, true);
        document.removeEventListener("touchend", onTap, true);
        button.remove();
      }
    };
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

    const header = addHeaderIcon(onOpen);
    const side = header ? null : addSideButton(onOpen);

    return {
      mode: header ? "header" : side ? "side" : "none",
      destroy() {
        try { header && header.destroy(); } catch (_) {}
        try { side && side.hide(); } catch (_) {}
      }
    };
  };
})(window.__QuickView = window.__QuickView || {});
