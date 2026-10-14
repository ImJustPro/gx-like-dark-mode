"use strict";

// GX-like Dark Mode, native engine.
//
// Turns on Chromium's own Auto Dark Mode (the engine behind
// chrome://flags/#enable-force-dark and Opera GX "Force dark pages") for
// single tabs, through the DevTools protocol command
// Emulation.setAutoDarkModeOverride. That is the only command this extension
// ever sends, and it only attaches to http(s) and file pages that you switched on.
//
// Stored state
//   chrome.storage.local   { global: boolean, sites: { [siteKey]: boolean } }
//   chrome.storage.session { sites: {...} (incognito only), suppressed: number[] }

const MENU_SITE = "gx-site";
const MENU_GLOBAL = "gx-global";
const PROTOCOL_VERSION = "1.3";

const msg = (key) => chrome.i18n.getMessage(key) || key;

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

// Copies stored data into an object without a prototype and keeps only
// boolean values, so keys like "constructor" or "__proto__" are harmless.
function toMap(obj) {
  const map = Object.create(null);
  if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "boolean") map[key] = value;
    }
  }
  return map;
}

function isOn(state, key) {
  if (!key) return false;
  return Object.hasOwn(state.sites, key) ? state.sites[key] : state.global;
}

async function readState(incognito) {
  const local = await chrome.storage.local.get(["global", "sites"]);
  const state = { global: local.global === true, sites: toMap(local.sites) };
  if (incognito) {
    const session = await chrome.storage.session.get("sites");
    Object.assign(state.sites, toMap(session.sites));
  }
  return state;
}

async function setSite(tab, key, value) {
  const area = tab.incognito ? chrome.storage.session : chrome.storage.local;
  const stored = await area.get("sites");
  const sites = toMap(stored.sites);
  sites[key] = value;
  await area.set({ sites: { ...sites } });
}

// Tabs where you pressed "Cancel" on Chrome's debugging banner. We leave them
// alone until you toggle again, so the banner does not keep coming back.
async function getSuppressed() {
  const { suppressed } = await chrome.storage.session.get("suppressed");
  return new Set(Array.isArray(suppressed) ? suppressed : []);
}
async function setSuppressed(set) {
  await chrome.storage.session.set({ suppressed: [...set] });
}

// detach() only ever ends this extension's own session, so calling it on a tab
// we never attached to (or one DevTools is using) is a harmless no-op.
// No in-memory bookkeeping: the service worker can restart at any time.
async function enableDark(tabId) {
  try {
    await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
  } catch {
    // Already attached by us, or the page cannot be debugged. sendCommand tells.
  }
  try {
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setAutoDarkModeOverride", { enabled: true });
  } catch {
    // Not attached, nothing to do.
  }
}

async function disableDark(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // We were not attached to this tab.
  }
}

async function syncTab(tab, cache) {
  if (!tab || tab.id === undefined || tab.id < 0) return;
  const key = siteKey(tab.url || tab.pendingUrl);
  const state = cache?.[tab.incognito ? "incognito" : "normal"] || (await readState(tab.incognito));
  const suppressed = cache?.suppressed || (await getSuppressed());
  if (isOn(state, key) && !suppressed.has(tab.id)) await enableDark(tab.id);
  else await disableDark(tab.id);
}

async function syncAll() {
  const cache = {
    normal: await readState(false),
    incognito: await readState(true),
    suppressed: await getSuppressed()
  };
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => syncTab(tab, cache)));
  await refresh();
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function refresh(tab) {
  tab = tab || (await activeTab());
  if (!tab) return;
  const key = siteKey(tab.url);
  const state = await readState(tab.incognito);
  const on = isOn(state, key);

  chrome.contextMenus.update(MENU_SITE, { checked: on, enabled: !!key }, () => void chrome.runtime.lastError);
  chrome.contextMenus.update(MENU_GLOBAL, { checked: state.global }, () => void chrome.runtime.lastError);

  if (tab.id !== undefined && tab.id >= 0) {
    chrome.action.setBadgeBackgroundColor({ color: "#fa1e4e" }).catch(() => {});
    chrome.action.setBadgeText({ tabId: tab.id, text: on ? "ON" : "" }).catch(() => {});
  }
}

async function clearSuppression() {
  await setSuppressed(new Set());
}

async function toggleSite(tab) {
  if (!tab) return;
  const key = siteKey(tab.url);
  if (!key) return;
  const state = await readState(tab.incognito);
  await setSite(tab, key, !isOn(state, key));
  await clearSuppression();
  await syncAll();
}

async function toggleGlobal() {
  const { global } = await chrome.storage.local.get("global");
  await chrome.storage.local.set({ global: global !== true });
  await clearSuppression();
  await syncAll();
}

function setup() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SITE,
      title: msg("menuSite"),
      type: "checkbox",
      contexts: ["page", "frame", "action"]
    });
    chrome.contextMenus.create({
      id: MENU_GLOBAL,
      title: msg("menuGlobal"),
      type: "checkbox",
      contexts: ["page", "frame", "action"]
    });
    syncAll();
  });
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SITE) toggleSite(tab);
  else if (info.menuItemId === MENU_GLOBAL) toggleGlobal();
});

chrome.action.onClicked.addListener((tab) => toggleSite(tab));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-site") toggleSite(tab || (await activeTab()));
});

chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (source.tabId === undefined) return;
  if (reason === "canceled_by_user") {
    const set = await getSuppressed();
    set.add(source.tabId);
    await setSuppressed(set);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const set = await getSuppressed();
  if (set.delete(tabId)) await setSuppressed(set);
});

chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "loading") syncTab(tab);
  if (changeInfo.url || changeInfo.status === "complete") refresh(tab);
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) refresh();
});
