import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInvoiceHtml, buildReceiptHtml, invoiceSummary, receiptSummary } from "../src/documents.js";
import { renderPrintHtml } from "../src/print.js";
import { createDocumentPdf } from "../src/documentPdf.js";

const invoice = {
  number: "SWD-2026-002",
  date: "2026-10-21",
  dueDate: "2026-11-04",
  clientName: "William Kalule",
  business: "Kalule Works",
  items: [{ title: "Site design", amount: 500_000 }],
  total: 500_000,
  paid: 100_000,
};

const receipt = {
  number: "RCP-2026-002",
  date: "2026-10-22",
  invoiceNo: "SWD-2026-002",
  clientName: "William Kalule",
  business: "Kalule Works",
  lines: [{ title: "Deposit", amount: 100_000 }],
  total: 100_000,
  received: 100_000,
  invoiceTotal: 500_000,
  previouslyPaid: 100_000,
  method: "MTN MoMo",
  reference: "PM-224",
};

const profile = {
  brandName: "Solomantalgo",
  tagline: "Web Design",
  location: "Kampala, Uganda",
  website: "solomantalgo.com",
  ownerName: "Solomon Kisense",
  ownerTitle: "Owner, Solomantalgo Web Design",
  logoDataUri: "data:image/png;base64,iVBORw0KGgo=",
};

test("print helper preserves the document request and supports missing requests", () => {
  let calls = 0;
  const request = {
    profile: { brandName: "Solo" },
    build: (format, business) => {
      calls += 1;
      return `${format}:${business.brandName}`;
    },
  };
  assert.equal(renderPrintHtml(null, "a4"), "");
  assert.equal(renderPrintHtml({ build: "not a function" }, "a4"), "");
  assert.equal(renderPrintHtml(request, "thermal58"), "thermal58:Solo");
  assert.equal(calls, 1);
});

test("A4 and thermal use distinct Brand Ribbon document templates", () => {
  const a4 = buildInvoiceHtml(invoice, "a4", profile);
  const thermal = buildInvoiceHtml(invoice, "thermal58", profile);
  assert.match(a4, /size: A4 portrait/);
  assert.match(thermal, /size: 58mm auto/);
  assert.doesNotMatch(thermal, /<table/);
  assert.notEqual(a4, thermal);
  assert.match(a4, /doc-ribbon/);
  assert.match(a4, /C3FF4D/);
  assert.match(thermal, /width: 58mm/);
  assert.doesNotMatch(thermal, /background: #202020/);
});

test("Brand Ribbon uses the embedded logo without repeating its wordmark", () => {
  const html = buildReceiptHtml(receipt, "a4", profile);
  assert.match(html, /class="doc-logo" src="data:image\/png;base64/);
  assert.match(html, /Web Design/);
  assert.match(html, /Kampala, Uganda/);
  assert.doesNotMatch(html, /<b class="brand-fallback">Solomantalgo<\/b>/);
});

test("A4 lime is used as an accent fill and never as document text", () => {
  const html = buildInvoiceHtml({ ...invoice, paid: 500_000 }, "a4", profile);
  assert.match(html, /border-bottom: 1\.4mm solid #C3FF4D/);
  assert.doesNotMatch(html, /color:\s*#C3FF4D/i);
  assert.match(html, /PAID IN FULL/);
});

test("documents escape names and preserve long content, terms and real amounts", () => {
  const longInvoice = {
    ...invoice,
    clientName: "A very long name <script>alert(1)</script> used to check wrapping",
    items: Array.from({ length: 80 }, (_, index) => ({
      title: `Custom responsive service description ${index + 1}`,
      amount: 10_000,
    })),
  };
  const html = buildInvoiceHtml(longInvoice, "a4", {
    ...profile,
    termsText: "Long service terms that remain in the rendered document.",
  });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)/);
  assert.match(html, /Long service terms/);
  assert.match(html, /break-inside: avoid/);
  assert.match(html, /Custom responsive service description 80/);
  assert.match(html, /Balance due/);
});

test("receipt methods, optional payment details and grouped payment rows render accurately", () => {
  const plain = buildReceiptHtml(receipt, "a4", profile);
  assert.match(plain, /MTN MoMo/);
  assert.match(plain, /Reference PM-224/);
  assert.doesNotMatch(plain, /<section class="payment-details">/);
  assert.match(plain, /UGX 300,000/);

  const configured = buildReceiptHtml(receipt, "a4", {
    ...profile,
    bankName: "Example Bank",
    bankAccountName: "Solomantalgo",
    momoNumber: "+256700000000",
  });
  assert.match(configured, /Example Bank/);
  assert.match(configured, /\+256700000000/);

  const grouped = buildReceiptHtml({
    ...receipt,
    number: "RCP-2026-003",
    payments: [
      { date: "2026-10-20", method: "Cash", amount: 100_000 },
      { date: "2026-10-22", method: "MTN MoMo", amount: 200_000 },
    ],
    invoiceTotal: 700_000,
    previouslyPaid: 200_000,
    received: 300_000,
    total: 300_000,
  }, "a4", profile);
  assert.match(grouped, /Payments included/);
  assert.match(grouped, /Cash/);
  assert.match(grouped, /MTN MoMo/);
  assert.match(grouped, /UGX 200,000/);
  assert.match(grouped, /UGX 300,000/);
});

test("receipt totals use received-date model amounts and never show negative balance", () => {
  assert.deepEqual(receiptSummary({
    invoiceTotal: 500_000,
    previouslyPaid: 450_000,
    received: 100_000,
  }), {
    invoiceTotal: 500_000,
    previouslyPaid: 450_000,
    received: 100_000,
    balance: 0,
    paidInFull: true,
  });
  assert.equal(invoiceSummary({ total: 500_000, paid: 100_000 }).balance, 400_000);
});

test("A4 and thermal PDF downloads are genuine selectable-text PDFs", async () => {
  for (const [docType, model, format] of [
    ["Invoice", invoice, "a4"],
    ["Receipt", receipt, "a4"],
    ["Receipt", receipt, "thermal58"],
  ]) {
    const blob = await createDocumentPdf(model, docType, format, profile);
    assert.equal(blob.type, "application/pdf");
    assert.ok(blob.size > 1500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const contents = new TextDecoder().decode(bytes);
    assert.equal(contents.slice(0, 8), "%PDF-1.3");
    assert.match(contents, /\/Type \/Page\b/);
    assert.match(contents, /William Kalule/);
  }
});

test("PDF downloads embed the supplied brand logo as an image", async () => {
  const logo = readFileSync(new URL("../public/assets/images/logo.png", import.meta.url));
  const logoProfile = {
    ...profile,
    logoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
  };
  const blob = await createDocumentPdf(invoice, "Invoice", "a4", logoProfile);
  const content = new TextDecoder().decode(await blob.arrayBuffer());
  assert.match(content, /\/Subtype \/Image/);
});

test("PDF output keeps long invoices across multiple pages", async () => {
  const model = {
    ...invoice,
    items: Array.from({ length: 90 }, (_, index) => ({
      title: `Long design and implementation service item ${index + 1}`,
      amount: 10_000,
    })),
  };
  const blob = await createDocumentPdf(model, "Invoice", "a4", profile);
  const contents = new TextDecoder().decode(await blob.arrayBuffer());
  const pages = contents.match(/\/Type \/Page\b/g) || [];
  assert.ok(pages.length > 1);
  assert.match(contents, /Page 1 of/);
  assert.match(contents, /Page 2 of/);
});
