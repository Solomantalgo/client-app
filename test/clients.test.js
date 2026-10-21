import test from "node:test";
import assert from "node:assert/strict";
import {
  upsertService,
  removeService,
  paymentsForService,
  removeClientFromData,
  findClient,
  serviceTotal,
} from "../src/clients.js";
import { normalizeData } from "../src/data.js";

test("deleting the last service stays empty after normalizeData", () => {
  const client = {
    id: "c1",
    status: "ongoing",
    services: [{ id: "s1", agreedPrice: 100 }],
  };
  const deleted = removeService(client, "s1");
  const result = normalizeData({ clients: { "2026-01-01": [deleted] } });
  assert.deepEqual(result.clients["2026-01-01"][0].services, []);
});

test("legacy records without a services array still synthesize their historical service", () => {
  const result = normalizeData({
    clients: {
      "2026-01-01": [{ id: "old", status: "ongoing", totalAgreedPrice: 90 }],
    },
  });
  assert.equal(result.clients["2026-01-01"][0].services.length, 1);
});

test("legacy shaped saved service data is retained without edits", () => {
  const sample = {
    status: "ongoing",
    package: "Website",
    totalAgreedPrice: 120,
    services: [
      {
        id: "legacy-svc",
        title: "Website",
        categories: "Landing page",
        items: [{ id: "legacy-item", title: "Landing page", price: 120 }],
        agreedPrice: 120,
        dueDate: "2026-12-01",
        status: "active",
        createdAt: "2026-01-01",
      },
    ],
  };
  const result = normalizeData({ clients: { "2026-01-01": [sample] } });
  const normalized = result.clients["2026-01-01"][0].services[0];
  assert.equal(normalized.id, sample.services[0].id);
  assert.equal(normalized.title, sample.services[0].title);
  assert.equal(normalized.agreedPrice, sample.services[0].agreedPrice);
  assert.equal(normalized.items[0].id, sample.services[0].items[0].id);
});

test("adding keeps services separate and editing updates only its service", () => {
  const one = upsertService(
    { services: [] },
    { id: "one", title: "One", agreedPrice: 50, items: [] },
  );
  const added = upsertService(one, {
    id: "two",
    title: "Two",
    agreedPrice: 75,
    items: [],
  });
  const edited = upsertService(added, {
    id: "one",
    title: "Updated",
    agreedPrice: 60,
    items: [],
  });
  assert.deepEqual(
    edited.services.map((s) => s.title),
    ["Updated", "Two"],
  );
  assert.equal(edited.totalAgreedPrice, 135);
});

test("deleting a service removes linked payments and recomputes totals", () => {
  const client = {
    services: [
      { id: "a", agreedPrice: 100 },
      { id: "b", agreedPrice: 200 },
    ],
    payments: [
      { id: "p1", serviceId: "a", amount: 30 },
      { id: "p2", serviceId: "b", amount: 20 },
    ],
  };
  assert.equal(paymentsForService(client, "a").length, 1);
  const result = removeService(client, "a");
  assert.deepEqual(
    result.payments.map((p) => p.id),
    ["p2"],
  );
  assert.equal(result.totalAgreedPrice, 200);
  assert.equal(result.amountPaid, 20);
  assert.equal(removeService(client, "b").amountPaid, 30);
});

test("removing a client clears snapshots and an empty date key", () => {
  const data = {
    clients: {
      "2026-01-01": [{ id: "c", payments: [{ id: "p", amount: 10 }] }],
    },
    finance: { paymentSnapshots: { p: { unallocated: 10 }, other: {} } },
  };
  const result = removeClientFromData(data, "2026-01-01", "c");
  assert.equal("2026-01-01" in result.clients, false);
  assert.deepEqual(result.finance.paymentSnapshots, { other: {} });
});

test("findClient returns the matching date and client or null", () => {
  const client = { id: "found", name: "Ada" };
  const data = { clients: { "2026-01-01": [client] } };
  assert.deepEqual(findClient(data, "found"), { date: "2026-01-01", client });
  assert.equal(findClient(data, "missing"), null);
});

test("normalizeData round-trips pause, merge, receipt, reset, and document counter fields", () => {
  const result = normalizeData({
    clients: {
      day: [
        {
          id: "c",
          status: "ongoing",
          paused: true,
          pausedAt: "2026-01-02",
          pauseReason: "Waiting",
          payments: [{ id: "p1" }, { id: "p2" }],
          receiptGroups: [
            { id: "g", paymentIds: ["p1", "p2"], receiptNo: "RCP-2026-1" },
          ],
          services: [
            {
              id: "s",
              mergedFrom: [{ id: "old" }],
              paymentMap: { p1: "old" },
              invoiceNo: "SWD-2026-1",
            },
          ],
        },
      ],
    },
    finance: { bucketResets: [{ id: "r", bucketId: "living" }] },
    meta: { counters: { invoice: 2, receipt: 3 } },
  });
  const client = result.clients.day[0];
  assert.equal(client.paused, true);
  assert.equal(client.pausedAt, "2026-01-02");
  assert.equal(client.pauseReason, "Waiting");
  assert.deepEqual(client.receiptGroups[0].paymentIds, ["p1", "p2"]);
  assert.deepEqual(client.services[0].mergedFrom, [{ id: "old" }]);
  assert.deepEqual(client.services[0].paymentMap, { p1: "old" });
  assert.equal(client.services[0].invoiceNo, "SWD-2026-1");
  assert.deepEqual(result.finance.bucketResets, [
    { id: "r", bucketId: "living" },
  ]);
  assert.deepEqual(result.meta.counters, { invoice: 2, receipt: 3 });
});

test("normalizeData removes receipt groups with deleted payments or fewer than two members", () => {
  const result = normalizeData({
    clients: {
      day: [
        {
          id: "c",
          payments: [{ id: "p1" }, { id: "p2" }],
          receiptGroups: [
            { id: "keep", paymentIds: ["p1", "gone", "p2"] },
            { id: "drop", paymentIds: ["p1", "gone"] },
          ],
        },
      ],
    },
  });
  assert.deepEqual(
    result.clients.day[0].receiptGroups.map((group) => group.id),
    ["keep"],
  );
  assert.deepEqual(result.clients.day[0].receiptGroups[0].paymentIds, [
    "p1",
    "p2",
  ]);
});

test("shared serviceTotal prefers priced items and supports single-service legacy fallback", () => {
  assert.equal(
    serviceTotal({ agreedPrice: 100, items: [{ price: 45 }, { price: 5 }] }),
    50,
  );
  assert.equal(serviceTotal({ agreedPrice: 75, items: [{ price: 0 }] }), 75);
  assert.equal(
    serviceTotal({ agreedPrice: 0 }, { services: [{}], totalAgreedPrice: 80 }),
    80,
  );
  assert.equal(
    serviceTotal(
      { agreedPrice: 0 },
      { services: [{}, {}], totalAgreedPrice: 80 },
    ),
    0,
  );
});
