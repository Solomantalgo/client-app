import test from "node:test";
import assert from "node:assert/strict";
import { buildIndex, runSearch } from "../src/search.js";

const sample = {
  clients: {
    day: [{ id: "c1", name: "José Nakasero", business: "Cafe Lumière", status: "ongoing",
      phone: "+256 700 123 456", notes: "met near market", services: [{ id: "s1", title: "Web build",
        items: [{ id: "i1", title: "Menu design", price: 500000 }], invoiceNo: "SWD-2026-0001" }],
      payments: [{ id: "p1", amount: 500000, note: "Deposit received", date: "2026-10-20", receiptNo: "RCP-2026-0001", serviceId: "s1" }] }],
  },
  expenses: [{ id: "e1", note: "market transport", amount: 12000, date: "2026-10-19" }],
  finance: { buckets: [{ id: "b1", name: "Emergency" }], accounts: [{ id: "a1", name: "Mobile Money" }] },
};

test("search matches phone digits, raw and formatted amounts, and multi-word AND", () => {
  const index = buildIndex(sample);
  assert.equal(runSearch(index, "0700123456")[0].type, "Clients");
  assert.ok(runSearch(index, "500000").some((item) => item.type === "Payments"));
  assert.ok(runSearch(index, "500,000").some((item) => item.type === "Payments"));
  assert.ok(runSearch(index, "cafe market").some((item) => item.type === "Clients"));
});

test("search ignores accents and ranks title starts before later text matches", () => {
  const index = buildIndex(sample);
  assert.ok(runSearch(index, "jose").some((item) => item.type === "Clients"));
  const ranked = runSearch([
    { type: "Clients", id: "contains", title: "A Cafe", text: "the cafe" },
    { type: "Clients", id: "starts", title: "Cafe Lumiere", text: "cafe lumiere" },
  ], "cafe");
  assert.equal(ranked[0].id, "starts");
});
