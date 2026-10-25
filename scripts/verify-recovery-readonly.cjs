const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const recoveryDir =
  "C:/Users/HP/Documents/Solo Sales OS Recovery/" +
  "client-app-recovery-20261023-224511";
const source = fs.readFileSync(path.resolve("src/App.jsx"), "utf8");
const supabaseUrl = source.match(/DEFAULT_SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const supabaseKey = source.match(/DEFAULT_SUPABASE_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!supabaseUrl || !supabaseKey) throw new Error("Configured cloud endpoint unavailable");
const candidate = JSON.parse(
  fs.readFileSync(
    path.join(recoveryDir, "recovery-candidates/localhost-5173-main.json"),
    "utf8",
  ),
);
const expectedTimestamp = "2026-10-23T20:07:08.000Z";
const origin = "http://localhost:5173";
const allowedCloudHost = new URL(supabaseUrl).hostname;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blockedRequests = [];
  const pageErrors = [];
  const cloudRequests = [];

  await context.addInitScript(({ data }) => {
    if (!localStorage.getItem("solo-sales-os-v1")) {
      localStorage.setItem("solo-sales-os-v1", JSON.stringify(data));
    }
    if (!localStorage.getItem("solo-sales-os-v1:backup")) {
      localStorage.setItem("solo-sales-os-v1:backup", JSON.stringify(data));
    }
  }, { data: candidate });
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "localhost" && url.port === "5173") {
      return route.continue();
    }
    if (
      url.hostname === allowedCloudHost &&
      ["GET", "OPTIONS"].includes(request.method())
    ) {
      return route.continue();
    }
    blockedRequests.push({ host: url.hostname, method: request.method() });
    return route.abort();
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === allowedCloudHost) {
      cloudRequests.push({ method: request.method(), path: url.pathname });
    }
    if (url.hostname === allowedCloudHost && !["GET", "OPTIONS"].includes(request.method())) {
      blockedRequests.push({ host: url.hostname, method: request.method() });
    }
  });
  page.on("requestfailed", (request) => {
    cloudRequests.push({
      method: request.method(),
      failed: request.failure()?.errorText || "unknown",
    });
  });

  try {
    const response = await page.goto(origin, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.locator(".os-topbar").waitFor();
    try {
      await page.waitForFunction((timestamp) => {
        const data = JSON.parse(localStorage.getItem("solo-sales-os-v1") || "null");
        return data?.meta?.updatedAt === timestamp;
      }, expectedTimestamp, { timeout: 20000 });
    } catch {
      const diagnostic = await page.evaluate(() => ({
        updatedAt: JSON.parse(localStorage.getItem("solo-sales-os-v1") || "null")?.meta?.updatedAt,
        syncStatus: document.querySelector(".os-sync")?.innerText,
        heading: document.querySelector(".os-topbar h1")?.innerText,
      }));
      throw new Error(JSON.stringify({ diagnostic, cloudRequests, pageErrors, blockedRequests }));
    }

    const afterSync = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("solo-sales-os-v1"));
      const clients = Object.values(data.clients || {}).flat();
      return {
        updatedAt: data.meta.updatedAt,
        clients: clients.length,
        services: clients.reduce((sum, client) => sum + (client.services || []).length, 0),
        payments: clients.reduce((sum, client) => sum + (client.payments || []).length, 0),
        expenses: data.expenses.length,
        separatelyLoggedIncome: data.finance.manualIncome.length,
        outreachLogs: data.outreach.logs.length,
        pausedClients: clients.filter((client) => client.paused).length,
      };
    });
    assert.deepEqual(
      {
        clients: afterSync.clients,
        services: afterSync.services,
        payments: afterSync.payments,
        expenses: afterSync.expenses,
        separatelyLoggedIncome: afterSync.separatelyLoggedIncome,
        outreachLogs: afterSync.outreachLogs,
      },
      { clients: 83, services: 10, payments: 12, expenses: 23, separatelyLoggedIncome: 3, outreachLogs: 26 },
    );

    await page.locator(".os-sidebar").getByRole("button", { name: "History" }).click();
    const historyDays = await page.locator(".history-day").count();
    assert.ok(historyDays > 0);

    await page.locator(".os-sidebar").getByRole("button", { name: "Transactions" }).click();
    await page.locator(".money-nav").waitFor({ state: "visible" });
    await page.locator(".money-nav").getByRole("button", { name: "Expenses" }).click();
    await page.locator(".m-filter-row").getByRole("button", { name: "Expenses" }).click();
    const expenseRows = await page.locator(".m-transaction-row").count();
    assert.equal(expenseRows, 23);

    await page.locator(".money-nav").getByRole("button", { name: "Income" }).click();
    await page.locator(".m-filter-row").getByRole("button", { name: "Income" }).click();
    const incomeRows = await page.locator(".m-transaction-row").count();
    assert.equal(incomeRows, 15);

    await page.locator(".os-sidebar").getByRole("button", { name: "Monthly earnings" }).click();
    const reportVisible = await page.getByRole("heading", { name: "Monthly earnings" }).isVisible();
    assert.equal(reportVisible, true);

    await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    const owingSummary = await page.locator(".ongoing-summary").innerText();
    assert.match(owingSummary, /430,000/);

    const paidClient = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("solo-sales-os-v1"));
      const clients = Object.values(data.clients || {}).flat();
      return clients.find(
        (client) => client.status === "ongoing" && (client.payments || []).length,
      )?.name;
    });
    assert.ok(paidClient, "a client with recorded payments exists");
    await page.locator(".cr-main").filter({ hasText: paidClient }).click();
    await page.locator(".cs").waitFor();
    const serviceCards = await page.locator(".cs-service").count();
    const paymentRows = await page.locator(".cs-payment").count();
    assert.ok(serviceCards > 0);
    assert.ok(paymentRows > 0);

    await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    await page.locator(".ongoing-filters").getByRole("button", { name: /Paused/ }).click();
    const pausedRows = await page.locator(".cr-main").count();
    assert.equal(pausedRows, afterSync.pausedClients);
    if (pausedRows > 0) {
      await page.locator(".cr-main").first().click();
      await page.locator(".cs").waitFor();
      assert.match(await page.locator(".cs").innerText(), /Resume client/);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".os-topbar").waitFor();
    const persisted = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem("solo-sales-os-v1"));
      return {
        updatedAt: data.meta.updatedAt,
        clients: Object.values(data.clients || {}).flat().length,
        expenses: data.expenses.length,
      };
    });
    assert.equal(persisted.clients, 83);
    assert.equal(persisted.expenses, 23);
    assert.equal(pageErrors.length, 0, pageErrors.join("; "));
    assert.equal(blockedRequests.length, 0, JSON.stringify(blockedRequests));

    console.log(JSON.stringify({
      verification: "recovery data loaded, rendered, and persisted after reload",
      origin,
      cloudAccess: "GET only; external requests default-denied",
      counts: afterSync,
      rendered: {
        historyDays,
        expenseRows,
        incomeRows,
        monthlyEarnings: reportVisible,
        serviceCards,
        paymentRows,
        pausedRows,
      },
      afterReload: persisted,
      pageErrors: pageErrors.length,
      blockedUnexpectedRequests: blockedRequests.length,
      cloudRequests,
    }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
