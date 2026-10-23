const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const origin = "http://127.0.0.1:5180/";
const buckets = [
  { id: "needs", name: "Needs", percentage: 100, status: "active" },
  { id: "a", name: "Bucket A", percentage: 0, status: "active" },
  { id: "b", name: "Bucket B", percentage: 0, status: "active" },
  { id: "c", name: "Bucket C", percentage: 0, status: "active" },
];

function syntheticData(donorBalance) {
  return {
    clients: {},
    expenses: [],
    target: 5,
    outreach: { remotePointer: 1, physicalPointer: 120, logs: [], laps: 0 },
    finance: {
      buckets,
      accounts: [{ id: "cash", name: "Cash", type: "cash", status: "active" }],
      sources: ["Work"],
      manualIncome: [
        {
          id: "seed-income",
          date: "2026-10-21",
          amount: donorBalance * 3,
          description: "Synthetic starting funds",
          sourceType: "Work",
          accountId: "cash",
          allocations: [
            { bucketId: "a", percentage: 33.34, amount: donorBalance },
            { bucketId: "b", percentage: 33.33, amount: donorBalance },
            { bucketId: "c", percentage: 33.33, amount: donorBalance },
          ],
          unallocated: 0,
          allocationMode: "custom",
          origin: "current",
        },
      ],
      paymentSnapshots: {},
      bucketResets: [],
      bucketLoans: [],
    },
    meta: { updatedAt: new Date().toISOString() },
  };
}

async function newPage(browser, donorBalance) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((data) => {
    if (!localStorage.getItem("solo-sales-os-v1")) {
      localStorage.setItem("solo-sales-os-v1", JSON.stringify(data));
    }
    localStorage.setItem("solo-sales-cloud-config:url", "https://isolated.test");
    localStorage.setItem("solo-sales-cloud-config:key", "synthetic-only");
  }, syntheticData(donorBalance));
  await context.route("https://isolated.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator(".os-sidebar").waitFor();
  await page.locator(".os-sidebar button").filter({ hasText: "Money" }).click();
  return { context, page, errors };
}

async function submitExpense(page, amount) {
  await page.locator(".money-nav button").filter({ hasText: "Expenses" }).click();
  await page.getByRole("button", { name: /Log expense/ }).last().click();
  await page.getByLabel("Amount (UGX)").fill(String(amount));
  await page.getByLabel("Expense description").fill("Synthetic shortfall test");
  await page.getByLabel("Bucket").selectOption("needs");
  return page;
}

async function readStored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("solo-sales-os-v1")));
}

function bucketBalances(data) {
  const balances = Object.fromEntries(
    data.finance.buckets.map((bucket) => [bucket.id, 0]),
  );
  for (const income of data.finance.manualIncome) {
    for (const allocation of income.allocations || []) {
      balances[allocation.bucketId] += allocation.amount;
    }
  }
  for (const expense of data.expenses) {
    balances[expense.bucketId] -= expense.amount;
  }
  for (const loan of data.finance.bucketLoans) {
    const outstanding = loan.amount - loan.repaid;
    balances[loan.borrowerId] += outstanding;
    balances[loan.lenderId] -= outstanding;
  }
  return balances;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const sufficient = await newPage(browser, 100);
    const { page } = sufficient;
    await submitExpense(page, 101);
    const checkbox = page.getByLabel("Borrow the shortfall");
    await checkbox.waitFor({ state: "visible" });
    assert.equal(await checkbox.isEnabled(), true);
    await checkbox.check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.locator(".m-dialog").waitFor({ state: "hidden" });
    await page.waitForTimeout(150);

    let saved = await readStored(page);
    assert.equal(saved.expenses.length, 1, "expense should be saved");
    const expense = saved.expenses[0];
    assert.equal(saved.finance.bucketLoans.length, 3);
    assert.ok(saved.finance.bucketLoans.every((loan) => loan.expenseId === expense.id));
    assert.deepEqual(
      saved.finance.bucketLoans.map((loan) => loan.amount),
      [34, 34, 33],
      "loans should divide evenly with rounding",
    );
    assert.ok(saved.finance.bucketLoans.every((loan) => loan.amount <= 100));
    assert.deepEqual(bucketBalances(saved), {
      needs: 0,
      a: 66,
      b: 66,
      c: 67,
    });
    assert.ok(Object.values(bucketBalances(saved)).every((balance) => balance >= 0));

    await page.reload({ waitUntil: "networkidle" });
    saved = await readStored(page);
    assert.equal(saved.expenses.length, 1, "expense should persist after reload");
    assert.equal(saved.finance.bucketLoans.length, 3, "loans should persist after reload");

    for (const amount of [5, 1, 2]) {
      await page.locator(".money-nav button").filter({ hasText: "Income" }).click();
      await page.getByRole("button", { name: /Log income/ }).last().click();
      await page.getByLabel("Amount (UGX)").fill(String(amount));
      await page.getByLabel("Source / description").fill("Synthetic repayment");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.locator(".m-dialog").waitFor({ state: "hidden" });
      await page.waitForTimeout(100);
    }
    saved = await readStored(page);
    assert.deepEqual(
      saved.finance.bucketLoans.map((loan) => loan.repaid),
      [4, 3, 1],
      "unequal and rounded incoming allocations should repay all lender records evenly",
    );
    assert.deepEqual(bucketBalances(saved), {
      needs: 0,
      a: 70,
      b: 69,
      c: 68,
    });

    await page.locator(".money-nav button").filter({ hasText: "Expenses" }).click();
    const expenseRow = page.locator(".m-transaction").filter({
      hasText: "Synthetic shortfall test",
    });
    await expenseRow.getByRole("button", { name: "Delete" }).click();
    await page.locator(".confirm-dialog").waitFor();
    await page.locator(".confirm-dialog button").last().click();
    await page.locator(".confirm-dialog").waitFor({ state: "hidden" });
    await page.waitForTimeout(150);
    saved = await readStored(page);
    assert.equal(saved.expenses.length, 0, "expense should be deleted");
    assert.equal(saved.finance.bucketLoans.length, 0, "expense loan records should be deleted");
    assert.deepEqual(bucketBalances(saved), {
      needs: 8,
      a: 100,
      b: 100,
      c: 100,
    });

    await page.reload({ waitUntil: "networkidle" });
    saved = await readStored(page);
    assert.equal(saved.expenses.length, 0, "deletion should persist after reload");
    assert.equal(saved.finance.bucketLoans.length, 0, "loan cleanup should persist after reload");
    assert.deepEqual(sufficient.errors, [], "no app runtime errors should occur");
    await sufficient.context.close();

    const insufficient = await newPage(browser, 30);
    await submitExpense(insufficient.page, 101);
    const blockedChoice = insufficient.page.getByLabel("Borrow the shortfall");
    await blockedChoice.waitFor({ state: "visible" });
    assert.equal(await blockedChoice.isEnabled(), false);
    await insufficient.page.getByRole("button", { name: "Save", exact: true }).click();
    assert.match(
      await insufficient.page.getByText(/Other buckets only have UGX 90 available/).innerText(),
      /Other buckets only have UGX 90 available/,
    );
    const unchanged = await readStored(insufficient.page);
    assert.equal(unchanged.expenses.length, 0, "insufficient funds must block submission");
    assert.equal(unchanged.finance.bucketLoans.length, 0);
    assert.deepEqual(insufficient.errors, [], "no app runtime errors should occur");
    await insufficient.context.close();
    console.log("Borrowing browser scenarios passed with isolated synthetic data.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
