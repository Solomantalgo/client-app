import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceHtml, buildReceiptHtml } from "../src/documents.js";

const model = {
  number: "SWD-2026-002",
  date: "2026-10-21",
  clientName: "<script>alert(1)</script>",
  business: "Ada Studio",
  items: [{ title: "Site design", amount: 500_000 }],
  total: 500_000,
  paid: 100_000,
};

test("A4 and thermal invoice templates have separate page structures", () => {
  const a4 = buildInvoiceHtml(model, "a4");
  const thermal = buildInvoiceHtml(model, "thermal58");
  assert.match(a4, /size:A4/);
  assert.doesNotMatch(a4, /58mm/);
  assert.match(thermal, /58mm/);
  assert.doesNotMatch(thermal, /<table/);
  assert.notEqual(a4, thermal);
  assert.match(a4, /max-width:170mm/);
  assert.match(thermal, /width:48mm/);
});

test("invoice escapes user supplied markup", () => {
  const html = buildInvoiceHtml(model, "a4");
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)/);
});

test("receipt has true payment method, payment details only when configured, and filename title", () => {
  const base = {
    number: "RCP-2026-002",
    date: "2026-10-22",
    clientName: "William Kalule",
    business: "Kalule Works",
    invoiceTotal: 500_000,
    previouslyPaid: 100_000,
    received: 100_000,
    method: "MTN MoMo",
    lines: [{ title: "Deposit", amount: 100_000 }],
  };
  const plain = buildReceiptHtml(base, "a4");
  assert.match(plain, /<title>Receipt-RCP-2026-002-William-Kalule<\/title>/);
  assert.match(plain, /<label class="label">PAYMENT METHOD<\/label><div><b>MTN MoMo<\/b>/);
  assert.doesNotMatch(plain.match(/PAYMENT METHOD[\s\S]*?<\/section>/)?.[0] || "", /Thank you/);
  assert.doesNotMatch(plain, /PAYMENT DETAILS/);
  assert.match(plain, /REMAINING BALANCE[\s\S]*?UGX 300,000/);
  assert.match(plain, /<svg/);
  assert.doesNotMatch(buildReceiptHtml(base, "thermal58"), /<img/);
  const configured = buildReceiptHtml(base, "a4", { bankName: "Bank One", bankAccountNo: "123" });
  assert.match(configured, /PAYMENT DETAILS/);
});

test("group receipt sums its payments and escapes names", () => {
  const html = buildReceiptHtml({
    number: "RCP-2026-3",
    clientName: "Ada <script>bad</script>",
    invoiceTotal: 700_000,
    previouslyPaid: 200_000,
    payments: [
      { date: "2026-10-20", method: "Bank", amount: 200_000 },
      { date: "2026-10-21", method: "Cash", amount: 300_000 },
    ],
    lines: [{ title: "Payment", amount: 500_000 }],
    total: 500_000,
  });
  assert.match(html, /UGX 500,000/);
  assert.match(html, /UGX 0/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>bad/);
});
