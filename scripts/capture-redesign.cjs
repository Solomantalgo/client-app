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
            id: "sample-payment-one",
            date: yesterday,
            amount: 100000,
            note: "Deposit",
            serviceId: "sample-service",
            accountName: "MTN MoMo",
            receiptNo: "RCP-2026-0101",
          },
          {
            id: "sample-payment-two",
            date: today,
            amount: 150000,
            note: "Second payment",
            serviceId: "sample-service",
            accountName: "Cash",
            receiptNo: "RCP-2026-0102",
          },
        ],
        receiptGroups: [
          {
            id: "sample-receipt-group",
            receiptNo: "RCP-2026-0103",
            paymentIds: ["sample-payment-one", "sample-payment-two"],
            createdAt: new Date().toISOString(),
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

async function captureDocumentVariants(context, origin, output) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator(".os-topbar").waitFor();
  const profile = await page.evaluate(async () => {
    const response = await fetch("/assets/images/logo.png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return {
      brandName: "Solomantalgo",
      tagline: "Web Design",
      location: "Kampala, Uganda",
      website: "solomantalgo.com",
      ownerName: "Solomon Kisense",
      ownerTitle: "Owner, Solomantalgo Web Design",
      logoDataUri: `data:image/png;base64,${btoa(binary)}`,
      showLogoA4: true,
      showLogoThermal: false,
      invoiceDueDays: 14,
      termsText: "Payment is due by the date shown. Contact us if you need to discuss a payment schedule.",
    };
  });
  const invoice = {
    number: "SWD-2026-0573",
    date: today,
    dueDate: addDays(14),
    clientName: "William Kalule",
    business: "Kalule Auto & General Supplies",
    items: [
      { title: "Website design", amount: 500000 },
      { title: "Online booking setup", amount: 400000 },
    ],
    total: 900000,
    paid: 250000,
  };
  const receipt = {
    number: "RCP-2026-0573",
    date: today,
    invoiceNo: invoice.number,
    clientName: invoice.clientName,
    business: invoice.business,
    lines: [{ title: "Initial deposit · Website design", amount: 100000 }],
    received: 100000,
    invoiceTotal: 900000,
    previouslyPaid: 0,
    method: "MTN MoMo",
    reference: "SYNTHETIC-REF-01",
  };
  const groupedReceipt = {
    ...receipt,
    number: "RCP-2026-0574",
    lines: [
      { title: "Initial deposit · Website design", amount: 100000 },
      { title: "Second payment · Booking setup", amount: 150000 },
    ],
    received: 250000,
    payments: [
      { date: yesterday, method: "MTN MoMo", amount: 100000 },
      { date: today, method: "Cash", amount: 150000 },
    ],
  };
  const longInvoice = {
    ...invoice,
    items: Array.from({ length: 38 }, (_, index) => ({
      title: `Custom website implementation item ${index + 1}: responsive layout, content and integration`,
      amount: 15000,
    })),
    total: 570000,
  };
  const variants = [
    ["invoice-paid-a4", "Invoice", { ...invoice, paid: 900000 }, "a4"],
    ["invoice-partial-a4", "Invoice", invoice, "a4"],
    ["receipt-single-a4", "Receipt", receipt, "a4"],
    ["receipt-partial-a4", "Receipt", { ...receipt, received: 100000 }, "a4"],
    ["receipt-group-a4", "Receipt", groupedReceipt, "a4"],
    ["invoice-long-a4", "Invoice", longInvoice, "a4"],
    ["invoice-58mm", "Invoice", invoice, "thermal58"],
    ["receipt-58mm", "Receipt", receipt, "thermal58"],
  ];
  for (const [filename, type, model, format] of variants) {
    const html = await page.evaluate(async ({ type, model, format, profile }) => {
      const documents = await import("/src/documents.js");
      return type === "Receipt"
        ? documents.buildReceiptHtml(model, format, profile)
        : documents.buildInvoiceHtml(model, format, profile);
    }, { type, model, format, profile });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    });
    await page.screenshot({
      path: path.join(output, `${filename}.png`),
      fullPage: true,
    });
  }
  await page.close();
}

function addDays(days) {
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const downloads = [];
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
    page.on("download", (download) => downloads.push(download));
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
    const recordsBeforeDocuments = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("solo-sales-os-v1") || "{}");
      return JSON.stringify(saved.clients || {});
    });

    await page.locator(".cs-bar").getByRole("button", { name: "Edit" }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `client-editor-${width}.png`) });
    await page.locator(".ce-dialog button").filter({ hasText: "Cancel" }).click();

    await page.getByRole("tab", { name: "Services & records" }).click();
    const service = page.locator(".cs-service").first();
    await service.getByRole("button", { name: "Edit" }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `service-editor-${width}.png`) });
    await page.locator(".ce-dialog button").filter({ hasText: "Cancel" }).click();

    await service.getByRole("button", { name: "Invoice" }).click();
    await page.locator(".print-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `print-dialog-${width}.png`) });
    await page.locator(".print-format button").filter({ hasText: "58 mm" }).click();
    await page.locator(".print-preview iframe").waitFor();
    await page.waitForFunction(() => {
      const frame = document.querySelector(".print-preview iframe");
      return frame?.contentDocument?.querySelector(".doc-ribbon") != null;
    });
    await page.screenshot({ path: path.join(output, `print-thermal-${width}.png`) });
    await page.locator(".print-format button").filter({ hasText: "A4" }).click();
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll(".print-dialog button")]
        .find((item) => item.textContent.trim() === "Print");
      return button && !button.disabled;
    });
    await page.evaluate(() => {
      const frame = document.querySelector(".print-preview iframe");
      frame.contentWindow.print = () => { window.__brandRibbonPrintCalled = true; };
    });
    const downloadsBeforePrint = downloads.length;
    await page.locator(".print-dialog button").filter({ hasText: "Print" }).click();
    await page.waitForFunction(() => window.__brandRibbonPrintCalled === true);
    if (downloads.length !== downloadsBeforePrint) {
      failures.push(`${width}: Print unexpectedly triggered a file download.`);
    }
    const pdfDownloadPromise = page.waitForEvent("download");
    await page.locator(".print-dialog button").filter({ hasText: "Download PDF" }).click();
    const pdfDownload = await pdfDownloadPromise;
    const pdfPath = path.join(output, pdfDownload.suggestedFilename());
    await pdfDownload.saveAs(pdfPath);
    const pdfBytes = fs.readFileSync(pdfPath);
    if (pdfBytes.subarray(0, 5).toString() !== "%PDF-") {
      failures.push(`${width}: Download PDF did not produce a PDF file.`);
    }
    if (!pdfDownload.suggestedFilename().endsWith(".pdf")) {
      failures.push(`${width}: PDF download filename does not use .pdf.`);
    }
    await page.locator(".print-dialog button").filter({ hasText: "Cancel" }).click();

    await page.getByRole("tab", { name: "Finances" }).click();
    const receiptGroup = page.locator(".cs-receipt-group").first();
    if (await receiptGroup.count()) {
      await receiptGroup.getByRole("button", { name: "Expand" }).click();
    }
    const payment = page.locator(".cs-payment").first();
    await payment.getByRole("button", { name: "Receipt" }).click();
    await page.locator(".print-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `receipt-preview-${width}.png`) });
    const receiptHtml = await page.locator(".print-preview iframe").evaluate((frame) =>
      frame.contentDocument.body.innerText,
    );
    if (!receiptHtml.includes("Amount received") || !receiptHtml.includes("MTN MoMo")) {
      failures.push(`${width}: receipt preview is missing its amount or payment method.`);
    }
    await page.locator(".print-format button").filter({ hasText: "58 mm" }).click();
    await page.waitForFunction(() => {
      const frame = document.querySelector(".print-preview iframe");
      return frame?.contentDocument?.querySelector(".doc-ribbon") != null;
    });
    await page.screenshot({ path: path.join(output, `receipt-thermal-${width}.png`) });
    await page.locator(".print-dialog button").filter({ hasText: "Cancel" }).click();
    await page.locator(".cs-payments button").filter({ hasText: "Print" }).first().click();
    await page.locator(".print-dialog").waitFor();
    await page.locator(".print-format button").filter({ hasText: "A4" }).click();
    await page.waitForFunction(() => {
      const frame = document.querySelector(".print-preview iframe");
      return frame?.contentDocument?.querySelector(".doc-ribbon") != null;
    });
    await page.screenshot({ path: path.join(output, `grouped-receipt-${width}.png`) });
    const groupedHtml = await page.locator(".print-preview iframe").evaluate((frame) =>
      frame.contentDocument.body.innerText,
    );
    if (!groupedHtml.includes("Payments included") || !groupedHtml.includes("250,000")) {
      failures.push(`${width}: grouped receipt preview is missing its payment details or total.`);
    }
    await page.locator(".print-dialog button").filter({ hasText: "Cancel" }).click();
    const recordsAfterDocuments = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("solo-sales-os-v1") || "{}");
      return JSON.stringify(saved.clients || {});
    });
    if (recordsAfterDocuments !== recordsBeforeDocuments) {
      failures.push(`${width}: document preview or output changed client records.`);
    }

    await page.locator(".cs-actionbar").getByRole("button", { name: /Record payment/ }).click();
    await page.locator(".ce-dialog").waitFor();
    await page.screenshot({ path: path.join(output, `payment-editor-${width}.png`) });
    if (width === Math.max(...sizes)) {
      await captureDocumentVariants(context, origin, output);
    }
    await context.close();
  }
  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Captured ${sizes.length} widths with synthetic records; no overflow, runtime errors, or print/download path issues.`);
  }
})();
