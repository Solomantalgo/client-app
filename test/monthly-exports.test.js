import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import JSZip from "jszip";
import {
  buildMonthlyCsv,
  buildMonthlyDocx,
  buildMonthlyPdf,
  buildMonthlyXlsx,
  createMonthlyReportModel,
  monthlyReportFilename,
} from "../src/reporting/monthlyExports.js";
import { summarizeMonth, summarizeYear } from "../src/reporting/earnings.js";

function sampleData() {
  return {
    clients: {
      "2026-10-02": [
        {
          id: "client-1",
          name: "William Kalule",
          business: "William Shop",
          services: [{ id: "service-1", title: "Website" }],
          payments: [
            {
              id: "payment-1",
              serviceId: "service-1",
              amount: 500000,
              date: "2026-10-02",
            },
          ],
        },
      ],
    },
    expenses: [
      { id: "expense-1", amount: 99000, date: "2026-10-12", note: "Transport" },
    ],
    finance: {
      accounts: [{ id: "cash", name: "Cash" }],
      paymentSnapshots: {
        "payment-1": {
          accountId: "cash",
          allocations: [],
          unallocated: 500000,
        },
      },
      manualIncome: [
        {
          id: "income-1",
          amount: 75000,
          date: "2026-10-08",
          sourceType: "Gift",
          reportingClass: "other",
          description: "Support",
        },
      ],
    },
  };
}

function reportFor(data, overrides = {}) {
  const month = overrides.month || "2026-10";
  const summary = summarizeMonth(data, month);
  const year = summarizeYear(
    data,
    Number(month.slice(0, 4)),
    new Date("2026-10-20T12:00:00Z"),
  );
  return createMonthlyReportModel({
    month,
    summary,
    transactions: overrides.transactions || summary.transactions,
    year,
    filterLabel: overrides.filterLabel || "All",
    profile: overrides.profile || {
      brandName: "Solomantalgo",
      website: "solomantalgo.com",
    },
    generatedAt: "2026-10-26",
  });
}

async function unzipEntry(blob, target) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  let end = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (bytes.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  assert.notEqual(end, -1, "DOCX must contain a ZIP directory");
  const entries = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < entries; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === target) {
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(
        dataOffset,
        dataOffset + compressedSize,
      );
      return method === 8
        ? inflateRawSync(compressed).toString("utf8")
        : compressed.toString("utf8");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

test("monthly report model shares the selected summary, date range and filtered rows", () => {
  const data = sampleData();
  const summary = summarizeMonth(data, "2026-10");
  const filtered = summary.transactions.filter((row) => row.type === "expense");
  const report = createMonthlyReportModel({
    month: "2026-10",
    summary,
    transactions: filtered,
    year: summarizeYear(data, 2026, new Date("2026-10-20T12:00:00Z")),
    filterLabel: "Expenses",
    generatedAt: "2026-10-26",
  });

  assert.equal(report.summary, summary);
  assert.deepEqual(
    report.transactions.map((transaction) => {
      const original = { ...transaction };
      delete original.reportClassification;
      return original;
    }),
    filtered,
  );
  assert.deepEqual(
    report.transactions.map((transaction) => transaction.reportClassification),
    ["Expense"],
  );
  assert.deepEqual(report.range, {
    start: "2026-10-01",
    end: "2026-10-31",
    daysInMonth: 31,
  });
  assert.equal(report.currency, "UGX");
  assert.equal(report.basis, "Cash received date");
});

test("CSV export includes title, period and existing filtered report rows safely", () => {
  const data = sampleData();
  const summary = summarizeMonth(data, "2026-10");
  const report = reportFor(data, {
    transactions: summary.transactions.filter((row) => row.type === "expense"),
    filterLabel: "Expenses",
  });
  report.transactions = [
    ...report.transactions,
    {
      id: "formula",
      type: "expense",
      date: "2026-10-20",
      reportDate: "2026-10-20",
      amount: 1,
      description: '=HYPERLINK("x")',
    },
  ];
  const csv = buildMonthlyCsv(report);
  assert.match(csv, /Report title/);
  assert.match(csv, /Date range/);
  assert.match(csv, /Currency/);
  assert.match(csv, /Cash received date/);
  assert.match(csv, /Evidence filter.*Expenses/);
  assert.match(csv, /' =HYPERLINK|'=HYPERLINK/);
  assert.equal(
    monthlyReportFilename("2026-10", "csv"),
    "solomantalgo-monthly-earnings-2026-10.csv",
  );
});

test("CSV preserves field boundaries, quotes and line breaks safely", () => {
  const report = reportFor(sampleData());
  report.transactions = [
    {
      type: "expense",
      date: "2026-10-12",
      reportDate: "2026-10-12",
      reportClassification: "Expense",
      clientName: '=HYPERLINK("x")',
      serviceName: "Service, one",
      description: 'First line,\nSecond "line"',
      amount: 4000,
    },
  ];
  const csv = buildMonthlyCsv(report);
  assert.match(
    csv,
    /"Client","Service","Description","Source","Amount UGX","Account"/,
  );
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"First line,\nSecond ""line"""'));
});

test("XLSX export is a styled workbook with frozen, filterable transaction headers", async () => {
  const report = reportFor(sampleData());
  report.transactions = [
    {
      type: "expense",
      date: "2026-10-12",
      reportDate: "2026-10-12",
      reportClassification: "Expense",
      clientName: "William Kalule",
      serviceName: "Website",
      description: `Long description ${"Kampala service details ".repeat(8)}`,
      sourceType: "Expense",
      amount: 99000,
      accountName: "Cash",
    },
  ];
  const blob = await buildMonthlyXlsx(report);
  assert.equal(
    blob.type,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const workbook = await JSZip.loadAsync(await blob.arrayBuffer());
  const transactionSheet = await workbook
    .file("xl/worksheets/sheet2.xml")
    .async("string");
  const summarySheet = await workbook
    .file("xl/worksheets/sheet1.xml")
    .async("string");
  const styles = await workbook.file("xl/styles.xml").async("string");
  assert.match(transactionSheet, /ySplit="1"/);
  assert.match(transactionSheet, /autoFilter ref="A1:I2"/);
  assert.match(transactionSheet, /width="52"/);
  assert.match(styles, /wrapText="1"/);
  assert.match(transactionSheet, /William Kalule/);
  assert.match(transactionSheet, /UGX/);
  assert.match(summarySheet, /Solomantalgo/);
  assert.match(summarySheet, /Monthly summary/);
  assert.match(styles, /FFA984D6/);
  assert.match(styles, /FFC3FF4D/);
  assert.equal(
    workbook.file("xl/worksheets/sheet1.xml").name.endsWith(".xml"),
    true,
  );
  assert.equal(
    monthlyReportFilename("2026-10", "xlsx"),
    "solomantalgo-monthly-earnings-2026-10.xlsx",
  );
});

test("PDF export is a readable genuine multi-page PDF with period, figures and logo", async () => {
  const data = sampleData();
  data.clients["2026-10-02"][0].business =
    `Long client business ${"Kampala workspace ".repeat(12)}`;
  data.finance.manualIncome = Array.from({ length: 110 }, (_, index) => ({
    id: `long-${index}`,
    date: "2026-10-22",
    amount: 1234567890 + index,
    sourceType: "Freelance / Contract",
    description: `A long transaction description ${index} `.repeat(8),
    reportingClass: "earned",
  }));
  const report = reportFor(data, {
    profile: {
      brandName: "Solomantalgo",
      website: "solomantalgo.com",
      logoDataUri: `data:image/png;base64,${(await readFile(new URL("../public/assets/images/logo.png", import.meta.url))).toString("base64")}`,
    },
  });
  const original = JSON.stringify(report);
  const pdf = buildMonthlyPdf(report);
  const output = await pdf.text();
  assert.equal(pdf.type, "application/pdf");
  assert.match(output, /^%PDF-/);
  assert.match(output, /MONTHLY EARNINGS/);
  assert.match(output, /2026-10-01 to 2026-10-31/);
  assert.match(output, /Earned/);
  assert.match(output, /Solomantalgo/);
  assert.ok((output.match(/\/Type \/Page\b/g) || []).length > 1);
  assert.equal(
    JSON.stringify(report),
    original,
    "export must not mutate report data",
  );
});

test("Word export is an editable DOCX with report content and configured logo", async () => {
  const data = sampleData();
  const logoDataUri = `data:image/png;base64,${(await readFile(new URL("../public/assets/images/logo.png", import.meta.url))).toString("base64")}`;
  const report = reportFor(data, {
    profile: {
      brandName: "Solomantalgo",
      website: "solomantalgo.com",
      logoDataUri,
    },
  });
  report.transactions = [
    ...report.transactions,
    ...Array.from({ length: 60 }, (_, index) => ({
      id: `long-report-row-${index}`,
      type: "income",
      date: "2026-10-20",
      reportDate: "2026-10-20",
      amount: 9876543210 + index,
      reportClassification: "Earned",
      clientName: `Long client and service description ${index} ${"Kampala project ".repeat(4)}`,
      sourceType: "Freelance / Contract",
      accountName: "Cash",
    })),
  ];
  const docx = await buildMonthlyDocx(report);
  const xml = await unzipEntry(docx, "word/document.xml");
  const relationships = await unzipEntry(docx, "word/_rels/document.xml.rels");
  assert.equal(
    docx.type,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.ok(docx.size > 10000);
  assert.match(xml, /Monthly earnings/);
  assert.match(xml, /William Shop/);
  assert.match(xml, /Long client and service description 59/);
  assert.match(xml, /Transactions/);
  assert.match(xml, /w:tbl/);
  assert.match(xml, /pic:pic/);
  assert.match(relationships, /Target="media\//);
});

test("empty monthly reports export with useful empty-state detail", async () => {
  const data = {
    clients: {},
    expenses: [],
    finance: { buckets: [], accounts: [] },
  };
  const report = reportFor(data, { month: "2026-09" });
  const csv = buildMonthlyCsv(report);
  const pdf = await buildMonthlyPdf(report).text();
  const docx = await buildMonthlyDocx(report);
  const xml = await unzipEntry(docx, "word/document.xml");
  assert.match(csv, /2026-09/);
  assert.match(pdf, /No transactions match/);
  assert.match(xml, /No transactions match/);
});
