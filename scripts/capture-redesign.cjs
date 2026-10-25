const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || "http://127.0.0.1:5180/";
const output = path.resolve(process.argv[3] || "screenshots/redesign/latest");
fs.mkdirSync(output, { recursive: true });

function kampalaDate(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offset),
  );
  return date.toISOString().slice(0, 10);
}

const today = kampalaDate();
const yesterday = kampalaDate(-1);

const synthetic = {
  clients: {
    [today]: [
      {
        id: "sample-lead",
        name: "William Kalule",
        business: "Kalule Auto & General Supplies",
        businessType: "Retail",
        phone: "+256700123456",
        status: "lead",
        temp: "warm",
        followUp: "needed",
        followUpDate: kampalaDate(-3),
        servicesToOffer: "Website, Booking",
        quotedPrice: "900000",
        services: [],
        payments: [],
      },
      {
        id: "sample-client",
        name: "Amina Namusoke",
        business: "Namusoke Salon",
        businessType: "Salon",
        phone: "+256700123457",
        status: "ongoing",
        totalAgreedPrice: 800000,
        amountPaid: 250000,
        services: [
          {
            id: "sample-service",
            title: "Booking website",
            dueDate: "2026-10-29",
            items: [{ id: "sample-item", title: "Website", price: 800000 }],
            agreedPrice: 800000,
          },
        ],
        payments: [
          {
            id: "sample-payment",
            date: yesterday,
            amount: 250000,
            note: "Deposit",
            serviceId: "sample-service",
          },
        ],
      },
    ],
  },
  expenses: [],
  target: 5,
  outreach: { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 },
  finance: {
    buckets: [
      { id: "move-out", name: "Move-out", percentage: 30, status: "active" },
      { id: "living", name: "Living", percentage: 40, status: "active" },
      { id: "business", name: "Business", percentage: 30, status: "active" },
    ],
    accounts: [{ id: "cash", name: "Cash", type: "cash", status: "active" }],
    sources: ["Work"],
    manualIncome: [],
    paymentSnapshots: {},
    bucketResets: [],
    bucketLoans: [],
  },
  meta: { updatedAt: new Date().toISOString(), counters: { invoice: 0, receipt: 0 } },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const sizes = process.argv[4]
    ? process.argv[4].split(",").map(Number)
    : [375, 768, 1280, 1440];
  for (const width of sizes) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript((data) => {
      localStorage.setItem("solo-sales-os-v1", JSON.stringify(data));
      localStorage.setItem("solo-sales-cloud-config:url", "https://isolated.test");
      localStorage.setItem("solo-sales-cloud-config:key", "synthetic-only");
    }, synthetic);
    await context.route("**/*", (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.hostname === "isolated.test") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "null",
        });
      }
      if (
        requestUrl.hostname === new URL(origin).hostname &&
        requestUrl.port === new URL(origin).port
      ) {
        return route.continue();
      }
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`${width}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") {
        failures.push(`${width} console: ${message.text()}`);
        console.error(`${width} console: ${message.text()}`);
      }
    });
    page.on("requestfailed", (request) => {
      failures.push(`${width} request failed: ${request.url()} ${request.failure()?.errorText || ""}`);
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    if (!(await page.locator(".os-topbar").count())) {
      console.error("App did not mount:", (await page.locator("body").innerText()).slice(0, 2000));
    }
    await page.locator(".os-topbar").waitFor();
    await page.waitForTimeout(800);
    await page.locator(".os-search-button").click();
    await page.locator(".os-search-dialog input").fill("Amina");
    await page.locator(".os-search-results button").first().waitFor();
    await page.screenshot({ path: path.join(output, `search-${width}.png`) });
    await page.keyboard.press("Escape");
    await page.locator(".os-search-dialog").waitFor({ state: "hidden" });
    if (width < 900) {
      await page.locator(".os-mobile-nav button").filter({ hasText: "Add" }).click();
      await page.screenshot({ path: path.join(output, `quick-add-${width}.png`) });
      await page.locator(".os-quick-sheet button").filter({ hasText: "New lead" }).click();
      await page.waitForTimeout(250);
      if (!(await page.locator(".cf-dialog").isVisible().catch(() => false))) {
        console.error(`Quick add did not open the lead form at ${width}px.`);
        console.error((await page.locator("body").innerText()).slice(-900));
      }
      await page.locator(".cf-dialog").waitFor();
      await page.screenshot({ path: path.join(output, `lead-form-${width}.png`) });
      if (width < 600) {
        await page.locator('.cf-dialog button[aria-label="Close lead form"]').click({ force: true });
      } else {
        await page.locator(".cf-dialog button").filter({ hasText: "Cancel" }).click();
      }
      await page.waitForTimeout(250);
      await page.locator(".cf-overlay").waitFor({ state: "hidden" });
      await page.locator(".os-mobile-nav button").filter({ hasText: "Add" }).click();
      await page.locator(".os-quick-sheet button").filter({ hasText: "Log income" }).click();
      await page.locator(".m-dialog").waitFor();
      await page.screenshot({ path: path.join(output, `income-form-${width}.png`) });
      await page.locator(".m-dialog .m-close").click();
      await page.locator(".m-overlay").waitFor({ state: "hidden" });
      await page.locator(".os-mobile-nav button").filter({ hasText: "Add" }).click();
      await page.locator(".os-quick-sheet button").filter({ hasText: "Add expense" }).click();
      await page.locator(".m-dialog").waitFor();
      await page.screenshot({ path: path.join(output, `expense-form-${width}.png`) });
      await page.locator(".m-dialog .m-close").click();
      await page.locator(".m-overlay").waitFor({ state: "hidden" });
      await page.locator(".os-mobile-nav button").filter({ hasText: "More" }).click();
      await page.screenshot({ path: path.join(output, `more-${width}.png`) });
      await page.locator(".os-more-sheet button").filter({ hasText: "Business profile" }).click();
    } else {
      await page.locator(".os-sidebar footer button").filter({ hasText: "Business profile" }).click();
    }
    await page.locator(".profile-sheet").waitFor();
    await page.screenshot({ path: path.join(output, `business-profile-${width}.png`) });
    await page.locator(".profile-sheet button").filter({ hasText: "Cancel" }).click();
    const tabs = [
      ["today", "Today"],
      ["pipeline", "Pipeline"],
      ["money", "Money"],
      ["monthly", "Monthly earnings"],
      ["outreach", "Outreach"],
      ["due", "Due"],
      ["ongoing", "Ongoing"],
      ["stats", "Stats"],
      ["history", "History"],
      ["guide", "Playbook"],
    ];
    for (const [key, label] of tabs) {
      const nav = page.locator(".os-sidebar");
      if (width < 900 && key === "today") {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Today" }).click();
      } else if (width < 900 && ["stats", "history", "guide"].includes(key)) {
        await page.locator(".os-mobile-nav button").filter({ hasText: "More" }).click();
        await page.locator(".os-more-sheet button").filter({ hasText: label }).click();
      } else if (width < 900 && key === "pipeline") {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" }).click();
      } else if (width < 900 && ["outreach", "due", "ongoing"].includes(key)) {
        const pipelineButton = page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" });
        await pipelineButton.click();
        await page.locator(".os-segments button").filter({ hasText: label }).click();
      } else if (width < 900 && ["money", "monthly"].includes(key)) {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Money" }).click();
        if (key === "monthly") {
          await page.locator(".os-money-current").click();
          await page.locator(".os-money-menu button").filter({ hasText: "Monthly earnings" }).click();
        }
      } else if (width >= 900) {
        const text = key === "pipeline"
          ? "Outreach"
          : key === "money"
            ? "Overview"
          : key === "due"
            ? "Due"
            : key === "guide"
              ? "Playbook"
              : key === "stats"
                ? "Performance"
              : label;
        await nav.getByRole("button", { name: new RegExp(text) }).click();
      }
      await page.waitForTimeout(150);
      const safe = label.toLowerCase().replace(/[^a-z]+/g, "-");
      await page.screenshot({ path: path.join(output, `${safe}-${width}.png`) });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) failures.push(`${width} ${label}: horizontal overflow`);
    }
    const moneySections = [
      ["Overview", "money-overview"],
      ["Income", "money-transactions"],
      ["Expenses", "money-expenses"],
      ["Allocations", "money-purposes"],
      ["Accounts", "money-accounts"],
      ["Client balances", "money-client-balances"],
    ];
    for (const [section, filename] of moneySections) {
      if (width < 900) {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Money" }).click();
        await page.locator(".os-money-current").click();
        const menuLabel = {
          Income: "Transactions",
          Allocations: "Purposes",
          "Client balances": "Clients",
        }[section] || section;
        await page.locator(".os-money-menu button").filter({ hasText: menuLabel }).click();
      } else {
        const label = ["Income", "Expenses"].includes(section)
          ? "Transactions"
          : section === "Allocations"
            ? "Purposes"
            : section;
        await page.locator(".os-sidebar").getByRole("button", { name: new RegExp(label) }).click();
        if (["Income", "Expenses"].includes(section)) {
          await page.locator(".m-filter-row button").filter({ hasText: section }).click();
        }
      }
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(output, `${filename}-${width}.png`) });
    }
    if (width < 900) {
      await page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" }).click();
      await page.locator(".os-segments button").filter({ hasText: "Ongoing" }).click();
    } else {
      await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    }
    await page.locator(".cr-main").first().click();
    await page.locator(".cs-bar").waitFor();
    await page.screenshot({ path: path.join(output, `client-${width}.png`) });

    await page.locator(".cs-bar").getByRole("button", { name: "Edit" }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `client-editor-${width}.png`) });
    await page.locator(".ce-dialog button").filter({ hasText: "Cancel" }).click();

    const service = page.locator(".cs-service").first();
    await service.getByRole("button", { name: "Edit" }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `service-editor-${width}.png`) });
    await page.locator(".ce-dialog button").filter({ hasText: "Cancel" }).click();

    await service.getByRole("button", { name: "Invoice" }).click();
    await page.locator(".print-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `print-dialog-${width}.png`) });
    await page.locator(".print-dialog button").filter({ hasText: "Cancel" }).click();

    await page.locator(".cs-actionbar").getByRole("button", { name: /Record payment/ }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `payment-editor-${width}.png`) });
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Captured ${sizes.length} widths with synthetic records; no overflow or runtime errors.`);
  }
})();
