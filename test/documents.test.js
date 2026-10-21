import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceHtml, buildReceiptHtml } from "../src/documents.js";

test("thermal invoice has 58mm print CSS and A4 invoice does not", () => {
  const model = { number: "SWD-2026-001", date: "2026-10-21", clientName: "Ada", items: [], total: 0 };
  assert.match(buildInvoiceHtml(model, "thermal58"), /@page \{ size: 58mm auto/);
  assert.doesNotMatch(buildInvoiceHtml(model, "a4"), /58mm/);
});

test("document builders escape markup in names", () => {
  const html = buildInvoiceHtml({ number: "1", clientName: "<script>alert(1)</script>", items: [] });
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)/);
});

test("group receipt total is the sum of the payment lines", () => {
  const html = buildReceiptHtml({
    number: "RCP-2026-1",
    clientName: "Ada",
    lines: [
      { title: "Deposit", amount: 200_000 },
      { title: "Balance", amount: 300_000 },
    ],
  });
  assert.match(html, /UGX 500,000/);
});
