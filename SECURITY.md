# Security

## What the extension can and cannot do

**CSS edition (`extension/`)**

- Runs a content script on http, https and file pages. The script only reads your saved choices from extension storage and adds or removes one attribute (`data-gx-like-dark`) on the `<html>` element.
- It does not read page content, form fields, cookies or passwords, and does not send messages to or from web pages.
- Chrome will show the warning *"Read and change all your data on all websites"* at install time. That is the standard warning for any extension that styles every website, and it is required for per-site dark mode to apply automatically when a page loads.

**Native edition (`extension-native/`)**

- Uses the `debugger` permission. This permission is powerful in general, so here is exactly how it is used:
  - it attaches only to tabs on http, https or file pages that you switched to dark;
  - the only DevTools command ever sent is `Emulation.setAutoDarkModeOverride` with `{ enabled: true }`;
  - it detaches as soon as you switch a site off, and respects *Cancel* on Chrome's warning bar.
- It has no content scripts.

**Both editions**

- No network requests, no analytics, no remote code, no `eval`.
- Data stored: a list of hostnames with on/off values and the global switch, in `chrome.storage.local`. Choices made in incognito go to `chrome.storage.session` and are never written to disk.
- Stored data is copied into prototype-less objects and only boolean values are accepted, so hostnames such as `constructor` or `__proto__` cannot change how the extension behaves.

## Review notes (v1.0.0)

Issues found and fixed during the review before the first release:

- A hostname equal to a built-in object property (for example an intranet host called `constructor`) was treated as "dark on". Fixed with prototype-less maps and `Object.hasOwn`.
- The native edition kept the list of attached tabs in memory, which is lost whenever Chrome restarts the service worker, so a tab could stay dark and impossible to switch off. It now relies on `chrome.debugger.detach`, which only ever ends this extension's own session.
- Unneeded permissions were removed. The CSS edition no longer requests the `tabs` permission.
- Incognito choices were saved to disk. They now live in session storage only.
- Some websites wipe the attributes on `<html>` while loading, which silently turned dark mode off. The attribute is now restored when that happens.

## Reporting a problem

Please open an issue on GitHub. For anything sensitive, use GitHub's private vulnerability reporting on this repository (Security tab, *Report a vulnerability*).
