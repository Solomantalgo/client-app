const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:5180/";
const key = "solo-sales-os-v1";
const payment = {
  id: "pause-payment",
  date: "2026-10-20",
  amount: 100000,
  note: "Synthetic deposit",
  serviceId: "pause-service",
};
const service = {
  id: "pause-service",
  title: "Synthetic website",
  items: [{ id: "pause-item", title: "Website", price: 500000 }],
  agreedPrice: 500000,
  dueDate: "2026-11-01",
  status: "active",
};
const initial = {
  clients: {
    "2026-10-20": [
      {
        id: "pause-client",
        name: "Synthetic Paused Client",
        business: "Test Business",
        status: "ongoing",
        totalAgreedPrice: 500000,
        amountPaid: 100000,
        paused: false,
        services: [service],
        payments: [payment],
      },
    ],
  },
  expenses: [],
  finance: {
    buckets: [
      { id: "purpose-1", name: "Living", percentage: 100, status: "active" },
    ],
    accounts: [{ id: "cash", name: "Cash", type: "cash", status: "active" }],
    sources: ["Work"],
    manualIncome: [],
    paymentSnapshots: {
      [payment.id]: {
        allocations: [{ bucketId: "purpose-1", percentage: 100, amount: 100000 }],
        unallocated: 0,
        origin: "current",
        accountId: "cash",
      },
    },
    bucketResets: [],
    bucketLoans: [],
  },
  target: 5,
  outreach: { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 },
  meta: { updatedAt: new Date().toISOString() },
};
const screenshotDir = path.resolve("screenshots/redesign/dark-neon-final");
fs.mkdirSync(screenshotDir, { recursive: true });

async function readClient(page) {
  return page.evaluate((storageKey) => {
    const data = JSON.parse(localStorage.getItem(storageKey));
    return data.clients["2026-10-20"].find((client) => client.id === "pause-client");
  }, key);
}

async function openOngoingClient(page, filter = "Owing") {
  await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
  await page.locator(".ongoing-filters").getByRole("button", { name: new RegExp(filter) }).click();
  await page.waitForTimeout(100);
  if (!(await page.locator(".cr-main").count())) {
    const client = await readClient(page);
    throw new Error(`No ongoing row under ${filter}; status=${client.status}, paused=${client.paused}`);
  }
  await page.locator(".cr-main").filter({ hasText: "Synthetic Paused Client" }).click();
  await page.locator(".cs").waitFor();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(
    ({ storageKey, data }) => {
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
      localStorage.setItem("solo-sales-cloud-config:url", "https://isolated.test");
      localStorage.setItem("solo-sales-cloud-config:key", "synthetic-only");
    },
    { storageKey: key, data: initial },
  );
  await context.route("**/*", (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === "isolated.test") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
    }
    if (requestUrl.hostname === "127.0.0.1" && requestUrl.port === "5180") {
      return route.continue();
    }
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator(".os-sidebar").waitFor();
    await openOngoingClient(page, "Owing");
    const before = await readClient(page);
    const beforeServices = JSON.stringify(before.services);
    const beforePayments = JSON.stringify(before.payments);

    await page.getByRole("button", { name: "Pause client", exact: true }).click();
    await page.locator(".ce-dialog").filter({ hasText: "Pause client" }).getByRole("button", { name: "Pause client" }).click();
    await page.waitForFunction(
      (storageKey) => JSON.parse(localStorage.getItem(storageKey)).clients["2026-10-20"][0].paused,
      key,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    assert.match(
      await page.locator(".ongoing-summary").innerText(),
      /Owing\s+UGX 0[\s\S]*Paused clients\s+1[\s\S]*Excluded from collectible totals/,
      "paused debt is excluded from the ongoing summary",
    );
    await openOngoingClient(page, "Paused");
    assert.equal((await readClient(page)).paused, true, "paused state persists after reload");
    assert.equal(await page.getByRole("button", { name: "Resume client", exact: true }).count(), 1);
    assert.match(await page.locator(".cr-main").innerText(), /UGX 400,000 excluded/);
    assert.match(await page.locator(".cs").innerText(), /UGX 400,000 excluded from Money/);
    await page.screenshot({ path: path.join(screenshotDir, "client-paused-1280.png") });

    await page.locator(".os-sidebar").getByRole("button", { name: /Overview/ }).click();
    const overviewText = await page.locator(".overview-screen").innerText();
    assert.match(overviewText, /Owing[\s\S]*UGX 0/, "paused debt is excluded from Money overview");

    await page.locator(".os-sidebar").getByRole("button", { name: /Monthly earnings/ }).click();
    const earned = page.locator(".earnings-primary-stat strong");
    await earned.waitFor();
    assert.match(await earned.innerText(), /100,000/, "received payment remains in monthly earnings while paused");

    await openOngoingClient(page, "Paused");
    await page.getByRole("button", { name: "Resume client", exact: true }).click();
    await page.waitForFunction(
      (storageKey) => !JSON.parse(localStorage.getItem(storageKey)).clients["2026-10-20"][0].paused,
      key,
    );
    await page.reload({ waitUntil: "networkidle" });
    const resumed = await readClient(page);
    assert.equal(resumed.paused, false, "resume persists after reload");
    assert.equal(resumed.services[0].agreedPrice, before.services[0].agreedPrice);
    assert.equal(resumed.totalAgreedPrice, before.totalAgreedPrice);
    assert.deepEqual(resumed.services, before.services, "pause/resume leaves services unchanged");
    assert.deepEqual(resumed.payments, before.payments, "pause/resume leaves payments unchanged");

    await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    const owingSummary = await page.locator(".ongoing-summary").innerText();
    assert.match(owingSummary, /UGX 400,000/, "resumed balance is collectible again");
    await page.locator(".ongoing-filters").getByRole("button", { name: /Owing/ }).click();
    await page.locator(".cr-main").filter({ hasText: "Synthetic Paused Client" }).click();
    await page.screenshot({ path: path.join(screenshotDir, "client-resumed-1280.png") });
    await page.locator(".os-sidebar").getByRole("button", { name: /Overview/ }).click();
    assert.match(await page.locator(".overview-screen").innerText(), /Owing[\s\S]*UGX 400,000/);
    assert.deepEqual(errors, [], "no browser runtime errors");
    process.stdout.write("Pause/reload/resume/reload browser scenario passed with isolated synthetic data.\n");
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
