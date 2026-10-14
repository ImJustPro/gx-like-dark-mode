"""End-to-end tests for both editions. Run: python3 tests/test_extensions.py"""
import asyncio, functools, http.server, io, os, sys, tempfile, threading
from PIL import Image
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "tests", "site")
PORT = 8765
A = f"http://127.0.0.1:{PORT}"
B = f"http://localhost:{PORT}"

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve():
    h = functools.partial(Quiet, directory=SITE)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

failures = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not cond: failures.append(name)

async def pixel(page, x, y):
    im = Image.open(io.BytesIO(await page.screenshot())).convert("RGB")
    return im.getpixel((x, y))

dark = lambda p: sum(p) < 150
light = lambda p: sum(p) > 600
reddish = lambda p: p[0] > 150 and p[1] < 90 and p[2] < 90

async def launch(p, ext):
    ctx = await p.chromium.launch_persistent_context(
        tempfile.mkdtemp(), headless=True, channel="chromium",
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}",
              "--no-proxy-server", "--silent-debugger-extension-api"])
    sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker")
    return ctx, sw

TOGGLE = """async (prefix) => { const [t] = await chrome.tabs.query({url: prefix + '/*'}); await toggleSite(t); }"""

async def open_page(ctx, url):
    pg = await ctx.new_page(); await pg.goto(url); await pg.wait_for_timeout(500); return pg

async def common(ctx, sw, label):
    pg = await open_page(ctx, A + "/white.html")
    check(f"{label}: starts light", light(await pixel(pg, 300, 400)))
    await sw.evaluate(TOGGLE, "http://127.0.0.1:%d" % PORT)
    await pg.wait_for_timeout(700)
    check(f"{label}: site toggle darkens page", dark(await pixel(pg, 300, 400)), await pixel(pg, 300, 400))
    check(f"{label}: images keep their colors", reddish(await pixel(pg, 700, 120)), await pixel(pg, 700, 120))
    await pg.reload(); await pg.wait_for_timeout(700)
    check(f"{label}: remembered after reload", dark(await pixel(pg, 300, 400)))
    other = await open_page(ctx, B + "/white.html")
    check(f"{label}: other site untouched", light(await pixel(other, 300, 400)))
    badge = await sw.evaluate("async () => { const [t] = await chrome.tabs.query({url: 'http://127.0.0.1/*'}); return chrome.action.getBadgeText({tabId: t.id}); }")
    check(f"{label}: badge shows ON", badge == "ON", badge)

    # global switch
    await sw.evaluate("() => toggleGlobal()")
    await other.wait_for_timeout(700)
    check(f"{label}: global switch darkens other site", dark(await pixel(other, 300, 400)))
    await sw.evaluate(TOGGLE, "http://localhost:%d" % PORT)
    await other.wait_for_timeout(700)
    check(f"{label}: per-site off beats global on", light(await pixel(other, 300, 400)))
    await sw.evaluate("() => toggleGlobal()")

    # keys that exist on Object.prototype must not count as stored sites
    r = await sw.evaluate("""() => { const m = toMap(JSON.parse('{"__proto__": true, "x": "yes"}'));
        return [Object.getPrototypeOf(m) === null, isOn({global:false, sites:m}, '__proto__'),
                isOn({global:false, sites:toMap({})}, 'constructor'), Object.hasOwn(m, 'x')]; }""")
    check(f"{label}: prototype-safe storage", r == [True, True, False, False], r)
    keys = await sw.evaluate("() => [siteKey('https://www.Example.com/a'), siteKey('chrome://settings'), siteKey('javascript:alert(1)'), siteKey('file:///C:/x.html')]")
    check(f"{label}: site keys", keys == ["example.com", None, None, "file://"], keys)
    # toggle back to clean state
    await sw.evaluate(TOGGLE, "http://127.0.0.1:%d" % PORT)
    await pg.wait_for_timeout(700)
    check(f"{label}: toggle off restores page", light(await pixel(pg, 300, 400)))
    for x in ctx.pages: await x.close()

async def filter_only(ctx, sw):
    label = "filter"
    await sw.evaluate("() => toggleGlobal()")
    pg = await open_page(ctx, A + "/dark.html")
    check(f"{label}: global mode skips already-dark site", dark(await pixel(pg, 300, 300)), await pixel(pg, 300, 300))
    await sw.evaluate("() => toggleGlobal()")
    await sw.evaluate(TOGGLE, "http://127.0.0.1:%d" % PORT)
    w = await open_page(ctx, A + "/wipe.html")
    await w.wait_for_timeout(2200)
    check(f"{label}: survives sites rewriting <html> attributes", dark(await pixel(w, 300, 300)))
    f = await open_page(ctx, A + "/fs.html")
    await f.click("#go"); await f.wait_for_timeout(800)
    fs = await f.evaluate("!!document.fullscreenElement")
    img = await pixel(f, 50, 50)
    check(f"{label}: media look normal in fullscreen", fs and img[0] > 200 and img[1] < 40 and img[2] < 40, img)
    await sw.evaluate(TOGGLE, "http://127.0.0.1:%d" % PORT)

async def main():
    serve()
    async with async_playwright() as p:
        ctx, sw = await launch(p, os.path.join(ROOT, "extension"))
        await common(ctx, sw, "filter"); await filter_only(ctx, sw); await ctx.close()
        ctx, sw = await launch(p, os.path.join(ROOT, "extension-native"))
        await common(ctx, sw, "native"); await ctx.close()
    print(f"\n{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)

asyncio.run(main())
