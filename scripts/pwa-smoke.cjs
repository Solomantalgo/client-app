const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const origin = process.argv[2] || "http://127.0.0.1:4173/";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const errors = [];

  await context.addInitScript(() => {
    localStorage.setItem("solo-sales-os-v1", JSON.stringify({
      clients: {},
      expenses: [],
      target: 5,
      outreach: { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 },
      finance: {
        buckets: [],
        accounts: [],
        sources: [],
        manualIncome: [],
        paymentSnapshots: {},
        bucketResets: [],
        bucketLoans: [],
      },
      meta: { updatedAt: new Date().toISOString() },
    }));
    localStorage.setItem("solo-sales-cloud-config:url", "https://isolated.test");
    localStorage.setItem("solo-sales-cloud-config:key", "pwa-smoke-only");
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin) {
      await route.continue();
      return;
    }
    if (url.hostname === "isolated.test") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
      return;
    }
    await route.abort();
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    console.log("Request failed:", request.url(), request.failure()?.errorText || "");
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("Browser error:", message.text());
  });
  page.on("response", (response) => {
    if (response.request().isNavigationRequest()) {
      console.log("Navigation response:", response.status(), response.url());
    }
  });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator(".os-topbar").waitFor({ timeout: 15_000 }).catch(async () => {
    console.error("App did not mount:", (await page.locator("body").innerText()).slice(0, 1600));
    throw new Error("App shell did not mount in the isolated PWA check.");
  });

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return null;
    return fetch(link.href).then((response) => response.json());
  });
  assert.ok(manifest, "manifest link and JSON should load");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));

  const iconSizes = await page.evaluate(async (icons) => Promise.all(
    icons.map((icon) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = reject;
      image.src = icon.src;
    })),
  ), manifest.icons);
  assert.deepEqual(iconSizes, [[192, 192], [512, 512]]);

  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    null,
    { timeout: 15_000 },
  );
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cache = await caches.open("solo-sales-shell-v4");
    return {
      scriptURL: registration.active?.scriptURL || "",
      cached: (await cache.keys()).map((request) => new URL(request.url).pathname),
    };
  });
  assert.ok(worker.scriptURL.endsWith("/sw.js"), "service worker should be active");
  console.log("Active worker cache:", worker.cached.join(", "));

  await context.unroute("**/*");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".os-topbar").waitFor({ timeout: 15_000 }).catch(async () => {
    const state = await page.evaluate(async () => ({
      ready: document.readyState,
      body: document.body?.innerText?.slice(0, 1200) || "",
      controlled: Boolean(navigator.serviceWorker?.controller),
      cachedRoot: (await caches.match("/"))?.status || null,
    }));
    console.error("Offline app did not mount:", state);
    throw new Error("Cached app shell did not mount while offline.");
  });
  assert.deepEqual(errors, [], "application should not throw during online or offline load");

  console.log("PWA smoke passed: manifest, 192/512 icons, active worker, offline shell.");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
