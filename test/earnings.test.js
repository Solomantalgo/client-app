import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import process from "node:process";
import {
  buildMonthCsv,
  classifyEarning,
  comparisonPeriods,
  currentKampalaMonth,
  reportDate,
  summarizeMonth,
  summarizeRange,
  summarizeYear,
} from "../src/reporting/earnings.js";

function fixture() {
  return {
    clients: {
      "2026-01-30": [
        {
          id: "client-1",
          name: "William",
          business: "William Shop",
          services: [],
          payments: [
            { id: "payment-1", amount: 300000, date: "2026-01-31" },
            { id: "payment-2", amount: 50000, date: "2026-02-01" },
          ],
        },
      ],
    },
    expenses: [
      { id: "expense-1", amount: 90000, date: "2026-01-31", note: "Tools" },
    ],
    finance: {
      paymentSnapshots: {
        "payment-1": { allocations: [{ bucketId: "one", amount: 300000 }] },
        "payment-2": { allocations: [{ bucketId: "one", amount: 50000 }] },
      },
      manualIncome: [
        {
          id: "manual-1",
          amount: 100000,
          date: "2026-01-15",
          sourceType: "Salary",
          description: "Pay",
        },
        {
          id: "manual-2",
          amount: 20000,
          date: "2026-01-20",
          sourceType: "Gift",
          description: "Gift",
        },
        {
          id: "manual-3",
          amount: 40000,
          date: "2026-01-22",
          sourceType: "Custom source",
          reportingClass: "earned",
          description: "=HYPERLINK(\"x\")",
        },
      ],
    },
  };
}

test("user reporting category overrides source defaults without changing transaction type", () => {
  assert.equal(
    classifyEarning({ sourceType: "Gift", reportingClass: "earned" }),
    "earned",
  );
  assert.equal(
    classifyEarning({ sourceType: "Salary", reportingClass: "other" }),
    "other",
  );
  assert.equal(classifyEarning({ sourceType: "Custom source" }), "");
});

test("monthly report reconciles deduplicated receipts, other inflows and expenses", () => {
  const report = summarizeMonth(fixture(), "2026-01");
  assert.equal(report.earned, 440000);
  assert.equal(report.otherReceived, 20000);
  assert.equal(report.expenses, 90000);
  assert.equal(report.afterExpenses, 350000);
  assert.equal(report.incomeCount, 4);
  assert.equal(report.transactions.length, 5);
});

test("payments received before a client was paused remain historical earnings", () => {
  const data = fixture();
  data.clients["2026-01-30"][0].paused = true;
  data.clients["2026-01-30"][0].pausedAt = "2026-02-15";
  const report = summarizeMonth(data, "2026-01");

  assert.equal(report.earned, 440000);
  assert.equal(report.transactions.filter((row) => row.sourceType === "client_payment").length, 1);
  assert.equal(report.earned, 300000 + 100000 + 40000);
  assert.equal(report.earned < 0, false);
});

test("date-only values stay on their business day in distant runtime timezones", () => {
  assert.equal(reportDate("2026-12-31"), "2026-12-31");
  for (const timezone of ["Pacific/Honolulu", "America/Los_Angeles", "Asia/Tokyo"]) {
    const result = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import {reportDate} from './src/reporting/earnings.js'; " +
          "process.stdout.write(reportDate('2026-01-01'))",
      ],
      { env: { ...process.env, TZ: timezone }, encoding: "utf8" },
    );
    assert.equal(result, "2026-01-01");
  }
  assert.equal(reportDate("2026-01-31T21:30:00.000Z"), "2026-02-01");
});

test("month and year boundaries, leap months, and future periods are explicit", () => {
  assert.equal(currentKampalaMonth(new Date("2026-12-31T22:30:00Z")), "2027-01");
  const year = summarizeYear(fixture(), 2024, new Date("2024-03-01T00:00:00Z"));
  assert.equal(year.months.find((item) => item.month === "2024-02").future, false);
  assert.equal(year.months.find((item) => item.month === "2024-03").future, false);
  assert.equal(year.months.find((item) => item.month === "2024-04").future, true);
  assert.equal(year.monthlyAverage.denominator, 3);
});

test("current-month comparison uses the same elapsed dates and clamps short months", () => {
  const periods = comparisonPeriods(
    "2026-03",
    new Date("2026-03-31T12:00:00Z"),
  );
  assert.equal(periods.current.start, "2026-03-01");
  assert.equal(periods.current.end, "2026-03-31");
  assert.equal(periods.previous.start, "2026-02-01");
  assert.equal(periods.previous.end, "2026-02-28");
});

test("range summaries can compare selected periods and CSV protects formulas", () => {
  const data = fixture();
  const january = summarizeRange(data, "2026-01", {
    start: "2026-01-15",
    end: "2026-01-22",
  });
  assert.equal(january.earned, 140000);
  assert.equal(january.otherReceived, 20000);
  const csv = buildMonthCsv(january, {
    start: "2026-01-15",
    end: "2026-01-22",
  });
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /Cash received date/);
});

