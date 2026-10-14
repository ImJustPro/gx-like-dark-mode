(() => {
  "use strict";

  const ATTR = "data-gx-like-dark";

  // Same function exists in background.js, keep them in sync.
  function siteKey(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.hostname.replace(/^www\./, "");
      }
      if (url.protocol === "file:") return "file://";
    } catch {
      // not a URL we handle
    }
    return null;
  }

  function toMap(obj) {
    const map = Object.create(null);
    if (obj && typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "boolean") map[key] = value;
      }
    }
    return map;
  }

  const key = siteKey(location.href);
  if (!key) return;

  const incognito = chrome.extension && chrome.extension.inIncognitoContext === true;
  let global = false;
  let localSites = toMap(null);
  let sessionSites = toMap(null);
  let wanted = false;

  function explicitValue() {
    if (Object.hasOwn(sessionSites, key)) return sessionSites[key];
    if (Object.hasOwn(localSites, key)) return localSites[key];
    return undefined;
  }

  function parseColor(str) {
    const m = str && str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  // True when the page already paints a dark background on its own.
  function pageIsAlreadyDark() {
    const root = document.documentElement;
    if (!document.body || !root) return false;
    const had = root.hasAttribute(ATTR);
    if (had) root.removeAttribute(ATTR);
    let bg = parseColor(getComputedStyle(document.body).backgroundColor);
    if (!bg || bg.a < 0.5) bg = parseColor(getComputedStyle(root).backgroundColor);
    if (had) root.setAttribute(ATTR, "on");
    if (!bg || bg.a < 0.5) return false;
    return (0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b) / 255 < 0.5;
  }

  function apply() {
    const root = document.documentElement;
    if (!root) return;
    const explicit = explicitValue();
    let on = explicit ?? global;
    // The global switch leaves sites that are already dark alone.
    // A site switched on by hand is always darkened.
    if (on && explicit !== true && pageIsAlreadyDark()) on = false;
    wanted = on;
    if (on) {
      if (root.getAttribute(ATTR) !== "on") root.setAttribute(ATTR, "on");
    } else if (root.hasAttribute(ATTR)) {
      root.removeAttribute(ATTR);
    }
  }

  // Some sites rewrite attributes on <html> while loading, put ours back.
  new MutationObserver(() => {
    const root = document.documentElement;
    if (wanted && root && root.getAttribute(ATTR) !== "on") root.setAttribute(ATTR, "on");
  }).observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });

  chrome.storage.local.get(["global", "sites"], (data) => {
    global = data.global === true;
    localSites = toMap(data.sites);
    if (!incognito) return apply();
    chrome.storage.session.get("sites", (s) => {
      if (!chrome.runtime.lastError) sessionSites = toMap(s && s.sites);
      apply();
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.global) global = changes.global.newValue === true;
      if (changes.sites) localSites = toMap(changes.sites.newValue);
    } else if (area === "session" && incognito) {
      if (changes.sites) sessionSites = toMap(changes.sites.newValue);
    } else {
      return;
    }
    apply();
  });

  document.addEventListener("DOMContentLoaded", apply, { once: true });
  window.addEventListener("load", apply, { once: true });
})();
