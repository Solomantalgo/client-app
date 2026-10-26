const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.argv[2] || "http://127.0.0.1:5173/";
const output = path.resolve(process.argv[3] || "screenshots/monthly-workspace");
const widths = process.argv[4]
  ? process.argv[4].split(",").map(Number)
  : [360, 375, 390, 430, 768, 1280, 1440];
const errors = [];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Kampala",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replaceAll("/", "-");
const yesterdayDate = new Date(`${today}T12:00:00+03:00`);
yesterdayDate.setDate(yesterdayDate.getDate() - 1);
const yesterday = yesterdayDate.toISOString().slice(0, 10);
const sample = {
  clients: {
    [today]: [
      {
        id: "monthly-sample-client",
        name: "Amina Namusoke with a long client name for responsive review",
        business: "Namusoke Family Salon and Beauty Supply Company",
        businessType: "Salon",
        phone: "+256700123457",
        status: "ongoing",
        totalAgreedPrice: 1250000000,
        amountPaid: 250000,
        services: [
          {
            id: "monthly-sample-service",
            title: "Booking, payments, and appointment integration service",
            dueDate: today,
            items: [
              {
                id: "monthly-sample-item",
                title: "Website and booking implementation",
                price: 1250000000,
              },
            ],
            agreedPrice: 1250000000,
          },
        ],
        payments: [
          {
            id: "monthly-sample-payment-one",
            date: yesterday,
            amount: 100000,
            note: "Deposit",
            serviceId: "monthly-sample-service",
            accountName: "MTN MoMo",
            receiptNo: "RCP-2026-0101",
          },
          {
            id: "monthly-sample-payment-two",
            date: today,
            amount: 150000,
            note: "Second payment",
            serviceId: "monthly-sample-service",
            accountName: "Cash",
            receiptNo: "RCP-2026-0102",
          },
        ],
      },
    ],
  },
  expenses: [
    {
      id: "monthly-sample-expense",
      date: today,
      amount: 47000,
      note: "Local transport",
      accountId: "sample-cash",
    },
  ],
  target: 5,
  outreach: { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 },
  finance: {
    buckets: [
      { id: "move-out", name: "Move-out", percentage: 30, status: "active" },
      { id: "living", name: "Living", percentage: 40, status: "active" },
      { id: "business", name: "Business", percentage: 30, status: "active" },
    ],
    accounts: [
      { id: "sample-cash", name: "Cash", type: "cash", status: "active" },
    ],
    sources: ["Work"],
    manualIncome: [
      {
        id: "monthly-sample-income",
        date: today,
        amount: 90000,
        sourceType: "Freelance / Contract",
        description: "Separate consulting income",
        reportingClass: "earned",
        accountId: "sample-cash",
      },
    ],
    paymentSnapshots: {
      "monthly-sample-payment-one": {
        accountId: "sample-cash",
        allocations: [],
      },
      "monthly-sample-payment-two": {
        accountId: "sample-cash",
        allocations: [],
      },
    },
    bucketResets: [],
    bucketLoans: [],
  },
  settings: {
    business: {
      brandName: "Solomantalgo",
      tagline: "Web Design",
      location: "Kampala, Uganda",
      website: "solomantalgo.com",
      ownerName: "Solomon Kisense",
      ownerTitle: "Owner, Solomantalgo Web Design",
      showLogoA4: true,
    },
  },
  meta: {
    updatedAt: new Date().toISOString(),
    counters: { invoice: 0, receipt: 0 },
  },
};

async function goMonthly(page, width) {
  if (width < 900) {
    await page
      .locator(".os-mobile-nav button")
      .filter({ hasText: "Money" })
      .click();
    await page.locator(".os-money-current").click();
    await page
      .locator(".os-money-menu button")
      .filter({ hasText: "Monthly earnings" })
      .click();
  } else {
    await page
      .locator(".os-sidebar")
      .getByRole("button", { name: /Monthly earnings/ })
      .click();
  }
  await page.locator(".earnings-page").waitFor();
}

async function goClient(page, width) {
  if (width < 900) {
    await page
      .locator(".os-mobile-nav button")
      .filter({ hasText: "Pipeline" })
      .click();
    await page
      .locator(".os-segments button")
      .filter({ hasText: "Ongoing" })
      .click();
  } else {
    await page
      .locator(".os-sidebar")
      .getByRole("button", { name: /Ongoing/ })
      .click();
  }
  await page.locator(".cr-main").first().click();
  await page.locator(".cs-bar").waitFor();
}

async function downloadExport(page, format, targetDirectory) {
  await page.locator(".earnings-export").click();
  const menu = page.getByRole("menu", { name: "Export report" });
  await menu.waitFor();
  const menuText = await menu.innerText();
  if (!menuText.includes("current report filter: Expenses")) {
    throw new Error(
      `Export menu did not disclose selected filters: ${menuText}`,
    );
  }
  const downloadPromise = page.waitForEvent("download");
  await menu.getByRole("menuitem", { name: format }).click();
  const download = await downloadPromise;
  const target = path.join(targetDirectory, download.suggestedFilename());
  await download.saveAs(target);
  return target;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      acceptDownloads: true,
    });
    await context.addInitScript((data) => {
      if (sessionStorage.getItem("monthly-workspace-seeded") !== "yes") {
        localStorage.setItem("solo-sales-os-v1", JSON.stringify(data));
        localStorage.setItem(
          "solo-sales-cloud-config:url",
          "https://isolated.test",
        );
        localStorage.setItem("solo-sales-cloud-config:key", "synthetic-only");
        sessionStorage.setItem("monthly-workspace-seeded", "yes");
      }
    }, sample);
    await context.route("**/*", (route) => {
      const requestUrl = new URL(route.request().url());
      const appUrl = new URL(origin);
      if (requestUrl.hostname === "isolated.test") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "null",
        });
      }
      if (requestUrl.origin === appUrl.origin) return route.continue();
      errors.push(
        `${width}px unexpected external request blocked: ${requestUrl.origin}`,
      );
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      errors.push(`${width}px page error: ${error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push(`${width}px console error: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).hostname !== "isolated.test") {
        errors.push(`${width}px request failed: ${request.url()}`);
      }
    });
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".os-topbar").waitFor();
    await page.locator(".cr-main").first().waitFor();

    await goMonthly(page, width);
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(output, `monthly-earnings-${width}.png`),
      fullPage: true,
    });
    const month = await page.locator('input[type="month"]').inputValue();
    await page
      .locator(".earnings-filter-select select")
      .selectOption("Expenses");
    await page.locator(".earnings-export").click();
    const exportMenu = page.getByRole("menu", { name: "Export report" });
    await exportMenu.waitFor();
    if (
      !(await exportMenu.innerText()).includes(
        "current report filter: Expenses",
      )
    ) {
      errors.push(
        `${width}px export did not reflect the active evidence filter.`,
      );
    }
    await page.keyboard.press("Escape");
    await goClient(page, width);
    const tabLayout = await page.locator(".cs-sections").evaluate((tabs) => {
      const styles = getComputedStyle(tabs);
      const bounds = tabs.getBoundingClientRect();
      const buttons = [...tabs.querySelectorAll('[role="tab"]')];
      return {
        columns: styles.gridTemplateColumns.split(" ").length,
        overflow: tabs.scrollWidth > tabs.clientWidth + 1,
        tabCount: buttons.length,
        tabsVisible: buttons.every((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right;
        }),
      };
    });
    const expectedColumns = width <= 560 ? 2 : 4;
    if (tabLayout.columns !== expectedColumns || tabLayout.overflow) {
      errors.push(
        `${width}px client sections expected ${expectedColumns} columns with no horizontal scroll.`,
      );
    }
    if (tabLayout.tabCount !== 4 || !tabLayout.tabsVisible) {
      errors.push(`${width}px did not show all four client section tabs.`);
    }
    const contactLinks = await page
      .locator(".cs-contact a")
      .evaluateAll((links) =>
        links.map((link) => {
          const rect = link.getBoundingClientRect();
          return {
            href: link.getAttribute("href"),
            decoration: getComputedStyle(link).textDecorationLine,
            width: rect.width,
            height: rect.height,
            right: rect.right,
          };
        }),
      );
    if (
      contactLinks.some(
        (link) => link.decoration !== "none" || link.height < 44,
      )
    ) {
      errors.push(
        `${width}px client contact actions are underlined or below 44px.`,
      );
    }
    if (contactLinks.some((link) => link.right > width + 1)) {
      errors.push(`${width}px long contact details overflow the viewport.`);
    }
    const storedBefore = await page.evaluate(() =>
      localStorage.getItem("solo-sales-os-v1"),
    );
    for (const [section, screenshot] of [
      ["Overview", "overview"],
      ["Finances", "finances"],
      ["Services & records", "services"],
      ["Activity", "activity"],
    ]) {
      await page.getByRole("tab", { name: section }).click();
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(output, `client-${screenshot}-${width}.png`),
        fullPage: true,
      });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      if (hasOverflow)
        errors.push(`${width}px client ${section} has horizontal overflow.`);
      if (
        (await page
          .getByRole("tab", { name: section })
          .getAttribute("aria-selected")) !== "true"
      ) {
        errors.push(`${width}px client tab ${section} did not become active.`);
      }
    }
    await page.keyboard.press("Shift+Tab");
    const tabSelected = await page
      .locator('.cs-sections [role="tab"][aria-selected="true"]')
      .count();
    if (tabSelected !== 1)
      errors.push(`${width}px client tabs do not have one selected tab.`);
    const storedAfter = await page.evaluate(() =>
      localStorage.getItem("solo-sales-os-v1"),
    );
    if (storedBefore !== storedAfter)
      errors.push(
        `${width}px client section navigation changed saved records.`,
      );

    await page.getByRole("tab", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    if (
      (await page
        .getByRole("tab", { name: "Finances" })
        .getAttribute("aria-selected")) !== "true"
    ) {
      errors.push(`${width}px arrow navigation did not select Finances.`);
    }
    await page.keyboard.press("Home");
    if (
      (await page
        .getByRole("tab", { name: "Overview" })
        .getAttribute("aria-selected")) !== "true"
    ) {
      errors.push(`${width}px Home did not return to Overview.`);
    }

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(120);
    const stickyTabPosition = await page
      .locator(".cs-sections")
      .evaluate((tabs) => {
        const tabTop = tabs.getBoundingClientRect().top;
        const shellHeaderBottom = document
          .querySelector(".os-topbar")
          .getBoundingClientRect().bottom;
        return { tabTop, shellHeaderBottom };
      });
    if (stickyTabPosition.tabTop < stickyTabPosition.shellHeaderBottom - 1) {
      errors.push(`${width}px sticky client tabs overlap the app header.`);
    }

    if (width === 375) {
      const getSampleClient = () =>
        page.evaluate(() => {
          const saved = JSON.parse(
            localStorage.getItem("solo-sales-os-v1") || "{}",
          );
          return Object.values(saved.clients || {})
            .flat()
            .find((client) => client.id === "monthly-sample-client");
        });
      const beforePause = await getSampleClient();
      await page
        .locator(".cs-actionbar")
        .getByRole("button", { name: "Pause client" })
        .click();
      await page.locator(".ce-dialog").waitFor();
      await page
        .locator(".ce-dialog")
        .getByRole("button", { name: "Pause client" })
        .click();
      await page.getByText("PAUSED", { exact: true }).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(output, "client-paused-375.png"),
        fullPage: true,
      });
      const paused = await getSampleClient();
      if (!paused?.paused)
        errors.push("Pause did not persist in isolated local storage.");
      const financialProjection = (client) => ({
        totalAgreedPrice: client?.totalAgreedPrice,
        services: client?.services?.map((service) => ({
          id: service.id,
          title: service.title,
          agreedPrice: service.agreedPrice,
          items: service.items?.map((item) => ({
            id: item.id,
            title: item.title,
            price: item.price,
          })),
        })),
        payments: client?.payments?.map((payment) => ({
          id: payment.id,
          date: payment.date,
          amount: payment.amount,
          serviceId: payment.serviceId,
          accountId: payment.accountId,
        })),
      });
      if (
        JSON.stringify(financialProjection(beforePause)) !==
        JSON.stringify(financialProjection(paused))
      ) {
        errors.push(
          `Pause changed financial data: ${JSON.stringify(pauseComparison)}`,
        );
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(".os-topbar").waitFor();
      await page
        .locator(".os-mobile-nav button")
        .filter({ hasText: "Pipeline" })
        .click();
      await page
        .locator(".os-segments button")
        .filter({ hasText: "Ongoing" })
        .click();
      await page
        .locator(".ongoing-filters button")
        .filter({ hasText: "Paused" })
        .click();
      const pausedRowCount = await page.locator(".cr-main").count();
      if (pausedRowCount !== 1) {
        const state = await getSampleClient();
        errors.push(
          `After reload, Paused filter showed ${pausedRowCount} rows (stored paused=${state?.paused}, status=${state?.status}).`,
        );
      } else {
        await page.locator(".cr-main").first().click();
        await page
          .locator(".cs-actionbar")
          .getByRole("button", { name: "Resume client" })
          .click();
      }
      if (pausedRowCount === 1) {
        await page.waitForFunction(() => {
          const saved = JSON.parse(
            localStorage.getItem("solo-sales-os-v1") || "{}",
          );
          const client = Object.values(saved.clients || {})
            .flat()
            .find((item) => item.id === "monthly-sample-client");
          return client?.paused === false;
        });
        await page.screenshot({
          path: path.join(output, "client-resumed-375.png"),
          fullPage: true,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator(".os-topbar").waitFor();
        await page
          .locator(".os-mobile-nav button")
          .filter({ hasText: "Pipeline" })
          .click();
        await page
          .locator(".os-segments button")
          .filter({ hasText: "Ongoing" })
          .click();
        const activeSummary = await page
          .locator(".ongoing-summary")
          .innerText();
        if (!activeSummary.includes("UGX 1,249,750,000")) {
          errors.push(
            "Resume did not restore the collectible balance after reload.",
          );
        }
        const resumed = await getSampleClient();
        if (resumed?.paused)
          errors.push("Resume did not persist after reload.");
        if (
          JSON.stringify(financialProjection(beforePause)) !==
          JSON.stringify(financialProjection(resumed))
        ) {
          errors.push(
            "Pause/resume changed services, agreed totals or payment records.",
          );
        }
      }
    }

    const todayButton =
      width >= 900
        ? page
            .locator(".os-sidebar nav button")
            .filter({ hasText: "Today" })
            .first()
        : page.locator(".os-mobile-nav button").filter({ hasText: "Today" });
    await todayButton.click();
    await page.screenshot({
      path: path.join(output, `today-${width}.png`),
      fullPage: true,
    });
    await page.locator(".today-target-menu summary").click();
    await page.screenshot({
      path: path.join(output, `today-target-controls-${width}.png`),
      fullPage: true,
    });
    const targetControlSizes = await page
      .locator(".today-target-controls button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const { width, height } = button.getBoundingClientRect();
          return { width, height };
        }),
      );
    if (
      targetControlSizes.some(({ width, height }) => width < 44 || height < 44)
    ) {
      errors.push(`${width}px daily target controls are smaller than 44px.`);
    }
    const storedTargetBefore = await page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem("solo-sales-os-v1") || "{}",
      );
      return saved.target;
    });
    const targetButtons = page.locator(".today-target-controls button");
    await targetButtons.last().click();
    await page.waitForFunction((expected) => {
      const saved = JSON.parse(
        localStorage.getItem("solo-sales-os-v1") || "{}",
      );
      return saved.target === expected;
    }, storedTargetBefore + 1);
    await targetButtons.first().click();
    await page.waitForFunction((expected) => {
      const saved = JSON.parse(
        localStorage.getItem("solo-sales-os-v1") || "{}",
      );
      return saved.target === expected;
    }, storedTargetBefore);
    await page.locator(".today-target-menu summary").click();
    await page.evaluate(() => window.scrollTo(0, 600));
    const moneyButton =
      width >= 900
        ? page
            .locator(".os-sidebar nav button")
            .filter({ hasText: "Overview" })
            .first()
        : page.locator(".os-mobile-nav button").filter({ hasText: "Money" });
    await moneyButton.click();
    await page.waitForTimeout(60);
    if ((await page.evaluate(() => window.scrollY)) !== 0) {
      errors.push(
        `${width}px main navigation did not return the page to the top.`,
      );
    }

    if (width === 1280) {
      await goMonthly(page, width);
      await page
        .locator(".earnings-filter-select select")
        .selectOption("Expenses");
      const exportDirectory = path.join(output, "exports");
      fs.mkdirSync(exportDirectory, { recursive: true });
      const storedBeforeExports = await page.evaluate(() =>
        localStorage.getItem("solo-sales-os-v1"),
      );
      const csvPath = await downloadExport(page, "CSV", exportDirectory);
      const csv = fs.readFileSync(csvPath, "utf8");
      if (
        !csv.includes("Date range") ||
        !csv.includes("Evidence filter") ||
        !csv.toLowerCase().includes("transport")
      ) {
        errors.push(
          "CSV is missing report context or filtered transaction data.",
        );
      }
      if (!path.basename(csvPath).includes(month))
        errors.push("CSV filename does not identify the selected month.");
      const xlsxPath = await downloadExport(
        page,
        "Excel (.xlsx)",
        exportDirectory,
      );
      const xlsx = fs.readFileSync(xlsxPath);
      if (xlsx.subarray(0, 4).toString("hex") !== "504b0304")
        errors.push("Excel export is not a valid XLSX ZIP package.");
      if (!path.basename(xlsxPath).includes(month))
        errors.push("XLSX filename does not identify the selected month.");
      const pdfPath = await downloadExport(page, "PDF", exportDirectory);
      const pdf = fs.readFileSync(pdfPath);
      if (pdf.subarray(0, 5).toString() !== "%PDF-")
        errors.push("PDF export is not a genuine PDF.");
      if (!pdf.toString("latin1").includes("/Subtype /Image"))
        errors.push("PDF export did not embed the configured logo.");
      if (!path.basename(pdfPath).includes(month))
        errors.push("PDF filename does not identify the selected month.");
      const docxPath = await downloadExport(
        page,
        "Word (.docx)",
        exportDirectory,
      );
      const docx = fs.readFileSync(docxPath);
      if (docx.subarray(0, 4).toString("hex") !== "504b0304")
        errors.push("Word export is not a valid DOCX ZIP package.");
      if (!path.basename(docxPath).includes(month))
        errors.push("DOCX filename does not identify the selected month.");
      const storedAfterExports = await page.evaluate(() =>
        localStorage.getItem("solo-sales-os-v1"),
      );
      if (storedAfterExports !== storedBeforeExports)
        errors.push("Monthly exports modified saved records.");
    }
    await context.close();
  }
  await browser.close();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `Inspected ${widths.join(", ")}px with disposable local data, mocked cloud and blocked external requests.`,
    );
    console.log(
      `Captured monthly, Today, and client-section screens; generated CSV, XLSX, PDF and DOCX under ${output}.`,
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
