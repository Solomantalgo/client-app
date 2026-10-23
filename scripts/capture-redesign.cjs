const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:5180/";
const output = path.resolve("screenshots/redesign/latest");
fs.mkdirSync(output, { recursive: true });

const synthetic = {
  clients: {
    "2026-10-22": [
      {
        id: "sample-lead",
        name: "William Kalule",
        business: "Kalule Auto & General Supplies",
        businessType: "Retail",
        phone: "+256700123456",
        status: "lead",
        temp: "warm",
        followUp: "needed",
        followUpDate: "2026-10-20",
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
            date: "2026-10-21",
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
  const sizes = [375, 768, 1280, 1440];
  for (const width of sizes) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript((data) => {
      localStorage.setItem("solo-sales-os-v1", JSON.stringify(data));
      localStorage.setItem("solo-sales-cloud-config:url", "https://isolated.test");
      localStorage.setItem("solo-sales-cloud-config:key", "synthetic-only");
    }, synthetic);
    await context.route("https://isolated.test/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`${width}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`${width} console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      failures.push(`${width} request failed: ${request.url()} ${request.failure()?.errorText || ""}`);
    });
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator(".os-topbar").waitFor();
    await page.locator(".os-search-button").click();
    await page.locator(".os-search-dialog input").fill("Amina");
    await page.locator(".os-search-results button").first().waitFor();
    await page.screenshot({ path: path.join(output, `search-${width}.png`), fullPage: true });
    await page.keyboard.press("Escape");
    await page.locator(".os-search-dialog").waitFor({ state: "hidden" });
    if (width < 900) {
      await page.locator(".os-mobile-nav button").filter({ hasText: "Add" }).click();
      await page.screenshot({ path: path.join(output, `quick-add-${width}.png`), fullPage: true });
      await page.locator('.os-quick-sheet button[aria-label="Close quick add"]').click();
      await page.locator(".os-mobile-nav button").filter({ hasText: "More" }).click();
      await page.screenshot({ path: path.join(output, `more-${width}.png`), fullPage: true });
      await page.locator(".os-more-sheet button").filter({ hasText: "Business profile" }).click();
    } else {
      await page.locator(".os-sidebar footer button").filter({ hasText: "Business profile" }).click();
    }
    await page.locator(".profile-sheet").waitFor();
    await page.screenshot({ path: path.join(output, `business-profile-${width}.png`), fullPage: true });
    await page.locator(".profile-sheet button").filter({ hasText: "Cancel" }).click();
    const tabs = [
      ["today", "Today"],
      ["pipeline", "Pipeline"],
      ["money", "Money"],
      ["outreach", "Outreach"],
      ["due", "Due"],
      ["ongoing", "Ongoing"],
      ["stats", "Stats"],
      ["history", "History"],
      ["guide", "Playbook"],
    ];
    for (const [key, label] of tabs) {
      const nav = page.locator(".os-sidebar");
      if (width < 900 && ["stats", "history", "guide"].includes(key)) {
        await page.locator(".os-mobile-nav button").filter({ hasText: "More" }).click();
        await page.locator(".os-more-sheet button").filter({ hasText: label }).click();
      } else if (width < 900 && key === "pipeline") {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" }).click();
      } else if (width < 900 && ["outreach", "due", "ongoing"].includes(key)) {
        const pipelineButton = page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" });
        await pipelineButton.click();
        await page.locator(".os-segments button").filter({ hasText: label }).click();
      } else if (width < 900 && key === "money") {
        await page.locator(".os-mobile-nav button").filter({ hasText: "Money" }).click();
      } else if (width >= 900) {
        const text = key === "pipeline"
          ? "Outreach"
          : key === "due"
            ? "Due"
            : key === "guide"
              ? "Playbook"
              : label;
        await nav.getByRole("button", { name: new RegExp(text) }).click();
      }
      await page.waitForTimeout(150);
      const safe = label.toLowerCase().replace(/[^a-z]+/g, "-");
      await page.screenshot({ path: path.join(output, `${safe}-${width}.png`), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) failures.push(`${width} ${label}: horizontal overflow`);
    }
    if (width < 900) {
      await page.locator(".os-mobile-nav button").filter({ hasText: "Pipeline" }).click();
      await page.locator(".os-segments button").filter({ hasText: "Ongoing" }).click();
    } else {
      await page.locator(".os-sidebar").getByRole("button", { name: /Ongoing/ }).click();
    }
    await page.locator(".cr-main").first().click();
    await page.locator(".cs-bar").waitFor();
    await page.screenshot({ path: path.join(output, `client-${width}.png`), fullPage: true });
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
