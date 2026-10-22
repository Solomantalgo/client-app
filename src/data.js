import { DEFAULT_FINANCE } from "./money.js";
const todayStr = () => new Date().toISOString().split("T")[0];

export function touchData(data) {
  return normalizeData({
    ...data,
    meta: {
      ...(data?.meta || {}),
      updatedAt: new Date().toISOString(),
    },
  });
}

export function makeServiceFromClient(c) {
  const agreed =
    Number(c.totalAgreedPrice) ||
    Number(String(c.quotedPrice || "").replace(/\D/g, "")) ||
    0;
  const service = {
    id: `svc-${c.id || Date.now()}`,
    title:
      c.package && c.package !== "Undecided"
        ? c.package
        : c.servicesToOffer
          ? "Client Service"
          : "Web Design Service",
    categories: c.servicesToOffer || "",
    items: splitServiceItems(c.servicesToOffer).map((title) => ({
      id: `item-${Date.now()}-${title}`,
      title,
      price: 0,
    })),
    agreedPrice: agreed,
    dueDate: c.paymentDueDate || "",
    status: c.status === "ongoing" ? "active" : "quoted",
    createdAt: c.date || todayStr(),
    mergedFrom: [],
    paymentMap: {},
    invoiceNo: "",
  };
  return { service };
}

export function splitServiceItems(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeData(d) {
  const source = d && typeof d === "object" ? d : {};
  const normalizedClients = {};
  if (source.clients) {
    for (const [date, arr] of Object.entries(source.clients)) {
      if (Array.isArray(arr)) {
        normalizedClients[date] = arr.map((c) => ({
          id: c.id,
          name: c.name || "Unnamed",
          business: c.business || "",
          businessType: c.businessType || "",
          phone: c.phone || "",
          pitchMethod: c.pitchMethod || "In-Person",
          package: c.package || "Undecided",
          servicesToOffer: c.servicesToOffer || "",
          quotedPrice: c.quotedPrice || "",
          demoShown: c.demoShown || "no",
          temp: c.temp || "warm",
          followUp: c.followUp || "needed",
          notes: c.notes || "",
          time: c.time || "12:00 PM",
          status: c.status || "lead",
          ownerAround: c.ownerAround || "unknown",
          followUpDate: c.followUpDate || "",
          hasWhatsApp: c.hasWhatsApp || "yes",
          totalAgreedPrice: c.totalAgreedPrice || "",
          amountPaid: c.amountPaid ?? 0,
          paused: c.paused === true,
          pausedAt: c.pausedAt || "",
          pauseReason: c.pauseReason || "",
          receiptGroups: Array.isArray(c.receiptGroups) ? c.receiptGroups : [],
          payments: (c.payments || []).map((p, index) => ({
            ...p,
            id: p.id || `payment-${c.id || date}-${index + 1}`,
            amount: Number(p.amount) || 0,
            serviceId: p.serviceId || "",
          })),
          services: Array.isArray(c.services)
            ? c.services.map((s) => ({
                id:
                  s.id ||
                  `svc-${c.id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                title: s.title || s.name || "Client Service",
                categories:
                  s.categories || s.description || c.servicesToOffer || "",
                items:
                  Array.isArray(s.items) && s.items.length
                    ? s.items.map((item) => ({
                        id:
                          item.id ||
                          `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        title: item.title || item.name || "Service item",
                        price: Number(item.price ?? item.amount) || 0,
                      }))
                    : splitServiceItems(
                        s.categories || s.description || "",
                      ).map((title) => ({
                        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        title,
                        price: 0,
                      })),
                agreedPrice:
                  Number(s.agreedPrice ?? s.price ?? c.totalAgreedPrice) || 0,
                dueDate: s.dueDate || s.paymentDueDate || "",
                status: s.status || "active",
                createdAt: s.createdAt || date,
                mergedFrom: Array.isArray(s.mergedFrom) ? s.mergedFrom : [],
                paymentMap:
                  s.paymentMap && typeof s.paymentMap === "object"
                    ? s.paymentMap
                    : {},
                invoiceNo: s.invoiceNo || "",
              }))
            : c.status === "ongoing" || c.totalAgreedPrice || c.amountPaid
              ? [makeServiceFromClient({ ...c, date }).service]
              : [],
        }));
      }
    }
  }
  const financeSource = source.finance || {};
  const finance = {
    buckets: Array.isArray(financeSource.buckets)
      ? financeSource.buckets
      : DEFAULT_FINANCE.buckets,
    accounts: Array.isArray(financeSource.accounts)
      ? financeSource.accounts
      : DEFAULT_FINANCE.accounts,
    sources: Array.isArray(financeSource.sources)
      ? financeSource.sources
      : DEFAULT_FINANCE.sources,
    manualIncome: (Array.isArray(financeSource.manualIncome)
      ? financeSource.manualIncome
      : []
    ).map((income) =>
      income.origin
        ? income
        : {
            ...income,
            allocations: [],
            unallocated: Number(income.amount) || 0,
            origin: "legacy",
          },
    ),
    paymentSnapshots: { ...(financeSource.paymentSnapshots || {}) },
    bucketResets: Array.isArray(financeSource.bucketResets)
      ? financeSource.bucketResets
      : [],
  };
  // Snapshots written by the first Money migration had no origin marker and
  // applied today's rules to pre-existing receipts. Treat those as legacy cash.
  // New receipts are tagged "current" and retain their historical allocation.
  for (const [paymentId, snapshot] of Object.entries(
    finance.paymentSnapshots,
  )) {
    if (snapshot && !snapshot.origin) {
      const payment = Object.values(normalizedClients)
        .flat()
        .flatMap((client) => client.payments || [])
        .find((item) => item.id === paymentId);
      finance.paymentSnapshots[paymentId] = {
        ...snapshot,
        allocations: [],
        unallocated:
          Number(payment?.amount) ||
          Number(snapshot.unallocated) ||
          (snapshot.allocations || []).reduce(
            (sum, allocation) => sum + (Number(allocation.amount) || 0),
            0,
          ),
        totalPercentage: 0,
        origin: "legacy",
      };
    }
  }
  for (const arr of Object.values(normalizedClients))
    for (const client of arr)
      for (const payment of client.payments || []) {
        if (!finance.paymentSnapshots[payment.id]) {
          // Existing payments predate bucket allocation. Preserve them as unallocated;
          // the current rules apply when a payment is newly recorded, not retroactively.
          finance.paymentSnapshots[payment.id] = {
            allocations: [],
            unallocated: Number(payment.amount) || 0,
            totalPercentage: 0,
            accountId: payment.accountId || "",
            origin: "legacy",
          };
        }
      }
  for (const arr of Object.values(normalizedClients)) {
    for (const client of arr) {
      const paymentIds = new Set(
        (client.payments || []).map((payment) => payment.id),
      );
      client.receiptGroups = (client.receiptGroups || [])
        .map((group) => ({
          ...group,
          paymentIds: (group.paymentIds || []).filter((paymentId) =>
            paymentIds.has(paymentId),
          ),
        }))
        .filter((group) => group.paymentIds.length >= 2);
    }
  }
  return {
    ...source,
    settings: {
      ...(source.settings || {}),
      business: {
        brandName: "Solomantalgo",
        tagline: "Web Design",
        location: "Kampala, Uganda",
        website: "solomantalgo.com",
        ownerName: "Solomon Kisense",
        ownerTitle: "Owner, Solomantalgo Web Design",
        bankName: "",
        bankAccountName: "",
        bankAccountNo: "",
        momoNumber: "",
        momoName: "",
        qrUrl: "",
        showLogoA4: true,
        showLogoThermal: false,
        invoiceDueDays: 14,
        termsText: "",
        ...(source.settings?.business || {}),
      },
    },
    finance,
    clients: normalizedClients,
    target: source.target ?? 5,
    expenses: (source.expenses || []).map((e) => ({
      ...e,
      id: e.id || Date.now().toString(),
      date: e.date || "",
      amount: Number(e.amount) || 0,
      note: e.note || e.description || "",
      bucketId: e.bucketId || "",
      accountId: e.accountId || "",
    })),
    outreach: {
      remotePointer: Math.min(
        120,
        Math.max(1, Number(source.outreach?.remotePointer) || 1),
      ),
      physicalPointer: Math.min(
        120,
        Math.max(1, Number(source.outreach?.physicalPointer) || 120),
      ),
      logs: Array.isArray(source.outreach?.logs) ? source.outreach.logs : [],
      laps: Number(source.outreach?.laps) || 0,
    },
    meta: {
      ...(source.meta || {}),
      counters: { invoice: 0, receipt: 0, ...(source.meta?.counters || {}) },
      updatedAt: source.meta?.updatedAt || "1970-01-01T00:00:00.000Z",
    },
  };
}
