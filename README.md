<p align="center"><img src="extension/icons/icon128.png" width="96" alt=""></p>

<h1 align="center">GX-like Dark Mode</h1>

<p align="center">Right-click, <b>Force dark page</b>, done. The Opera GX dark page toggle, for Google Chrome.</p>

<p align="center"><a href="README.it.md">Leggi in italiano</a></p>

---

## Why this exists

I used Opera GX for a long time, and the feature I liked most was the right-click **Force dark page** option: any blinding white website turns dark with one click, and GX remembers it for that site.

Over time GX became laggy and slow for me, so I switched back to Chrome. Chrome is fast again, but it has no equivalent: its built-in force dark mode is hidden in `chrome://flags` and applies to every website at once, with no per-site switch and no menu entry. This extension brings the GX behaviour back.

> **Heads-up: this project is vibe coded.** I built it together with an AI assistant (Claude), describing what I wanted and testing the result, rather than writing every line by hand. The code has been reviewed for security and is covered by automated browser tests, but please read [SECURITY.md](SECURITY.md) and treat it like any small hobby project.

## Features

- **Force dark page** in the right-click menu, remembered per site
- **Force dark on all sites** global switch, with per-site exceptions
- Click the toolbar icon, or press **Alt+Shift+D**, to toggle the current site
- An **ON** badge on the icon shows when the current site is darkened
- Incognito choices are kept in memory only and vanish when you close the browser
- English and Italian interface
- No tracking, no network requests, no remote code, no data leaves your browser

## Two editions

There are two versions in this repository. Install **one** of them.

| | `extension/` (recommended) | `extension-native/` |
|---|---|---|
| How it darkens | Inverts the page with a CSS filter, then flips photos and videos back | Turns on Chrome's own Auto Dark Mode engine, the same one used by `chrome://flags/#enable-force-dark` and by Opera GX |
| Look | Good on most sites, some background images and logos can look inverted | Closest to Opera GX, smarter about images |
| Warning bar | None | Chrome shows *"started debugging this browser"* while a site is darkened (see below) |
| Permissions | Context menu, storage, access to http/https/file pages | Context menu, storage, tabs, **debugger** |

### About the warning bar in the native edition

Chrome only lets an extension switch on its native dark engine through the `debugger` API, and it always shows a warning bar when that API is in use. This is a Chrome security feature and cannot be turned off from inside an extension.

If you want the native look without the bar, start Chrome with the `--silent-debugger-extension-api` flag:

- **Windows**: right-click the Chrome shortcut, *Properties*, and add ` --silent-debugger-extension-api` after the closing quote in *Target*. Taskbar pins are separate shortcuts, edit those too.
- **macOS**: quit Chrome, then run `open -a "Google Chrome" --args --silent-debugger-extension-api`
- **Linux**: `google-chrome --silent-debugger-extension-api`

The flag hides the warning for **every** extension that uses the debugger, so only use it if you trust all the extensions you have installed. Pressing *Cancel* on the bar switches dark mode off for that tab until you toggle it again.

## Install

The extension is not on the Chrome Web Store, so you load it yourself. It takes a minute.

1. Download the latest zip from [Releases](../../releases), or clone this repository.
2. Unzip it to a folder you will keep (Chrome loads it from there every time).
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension` folder (or `extension-native`).
5. Reload the tabs you already had open.

For local files (`file://`), open the extension details and enable **Allow access to file URLs**.

Works in Chrome 110 or newer, and in other Chromium browsers such as Edge, Brave and Vivaldi.

## How it works

**Per-site memory.** Choices are stored in `chrome.storage.local` by hostname, with `www.` stripped, so `www.example.com` and `example.com` share one setting. A per-site choice always wins over the global switch.

**CSS edition.** A tiny content script runs on every page at `document_start`. It reads your saved choice and, if the page should be dark, sets one attribute on `<html>`. The stylesheet only does something when that attribute is present: it applies `invert(1) hue-rotate(180deg)` to the whole page and the same filter again to images, videos and common video embeds, so they look normal. When the global switch is on, pages that already have a dark background are left alone; a site you switched on by hand is always darkened.

**Native edition.** There is no content script at all. The background service worker attaches to the tabs you chose and sends a single DevTools protocol command, `Emulation.setAutoDarkModeOverride`, which makes Chrome render the page with its built-in dark engine. Switching off detaches, and the page goes back to normal immediately.

## Limitations

- Chrome does not allow extensions on `chrome://` pages, the Chrome Web Store, or other extensions' pages.
- CSS edition: CSS background images are inverted together with the page, and colors in photos can shift slightly because `hue-rotate` is an approximation.
- Native edition: the warning bar described above.

## Development

```
extension/          CSS filter edition
extension-native/   native engine edition
tests/              end-to-end tests with Playwright and Chromium
```

Run the tests (Python 3, `pip install playwright pillow`, then `playwright install chromium`):

```
python3 tests/test_extensions.py
```

They load both editions into a real Chromium and check darkening, per-site memory, the global switch, already-dark pages, image colors, fullscreen media, sites that rewrite the `<html>` attributes, and storage keys such as `__proto__`.

Build release zips with `./scripts/package.sh`.

## Not affiliated

This is an independent hobby project. It is not made by, endorsed by or affiliated with Opera, Opera GX or Google. "Opera GX" is mentioned only to describe the feature this extension imitates.

## License

[MIT](LICENSE) © 2026 Ruben Pacchin
