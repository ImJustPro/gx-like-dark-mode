"use strict";

// GX-like Dark Mode, CSS filter engine.
//
// Stored state
//   chrome.storage.local   { global: boolean, sites: { [siteKey]: boolean } }
//   chrome.storage.session { sites: { [siteKey]: boolean } }   (incognito only)
//
// A per-site value always wins over the global switch. Choices made in an
// incognito window are kept in session storage, so they never touch disk and
// disappear when the browser closes.

const MENU_SITE = "gx-site";
const MENU_GLOBAL = "gx-global";

const msg = (key) => chrome.i18n.getMessage(key) || key;

// Same function exists in content.js, keep them in sync.
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

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

// Updates menu check marks and the toolbar badge for a tab.
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

async function toggleSite(tab) {
  if (!tab) return;
  const key = siteKey(tab.url);
  if (!key) return;
  const state = await readState(tab.incognito);
  await setSite(tab, key, !isOn(state, key));
  await refresh(tab);
}

async function toggleGlobal(tab) {
  const { global } = await chrome.storage.local.get("global");
  await chrome.storage.local.set({ global: global !== true });
  await refresh(tab);
}

async function setup() {
  // Lets content scripts read incognito choices from session storage.
  await chrome.storage.session
    .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
    .catch(() => {});

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
    refresh();
  });
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SITE) toggleSite(tab);
  else if (info.menuItemId === MENU_GLOBAL) toggleGlobal(tab);
});

chrome.action.onClicked.addListener((tab) => toggleSite(tab));

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === "toggle-site") toggleSite(tab || (await activeTab()));
});

chrome.tabs.onActivated.addListener(() => refresh());
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") refresh(tab);
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) refresh();
});
