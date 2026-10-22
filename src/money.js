export const DEFAULT_BUCKETS = [
  {
    id: "move-out",
    name: "Move-out Fund",
    icon: "⌂",
    percentage: 30,
    target: 0,
    status: "active",
    sortOrder: 0,
  },
  {
    id: "living",
    name: "Living & Basics",
    icon: "◉",
    percentage: 25,
    target: 0,
    status: "active",
    sortOrder: 1,
  },
  {
    id: "business",
    name: "Business Growth",
    icon: "↗",
    percentage: 20,
    target: 0,
    status: "active",
    sortOrder: 2,
  },
  {
    id: "emergency",
    name: "Emergency",
    icon: "＋",
    percentage: 10,
    target: 0,
    status: "active",
    sortOrder: 3,
  },
  {
    id: "projects",
    name: "Projects",
    icon: "◇",
    percentage: 10,
    target: 0,
    status: "active",
    sortOrder: 4,
  },
  {
    id: "giving",
    name: "Giving",
    icon: "♡",
    percentage: 5,
    target: 0,
    status: "active",
    sortOrder: 5,
  },
];
export const DEFAULT_ACCOUNTS = [
  { id: "bank", name: "Bank", type: "Bank", status: "active" },
  { id: "momo", name: "MTN MoMo", type: "Mobile money", status: "active" },
  { id: "cash", name: "Cash", type: "Cash", status: "active" },
  {
    id: "pool",
    name: "Business / Project Pool",
    type: "Other",
    status: "active",
  },
];
export const DEFAULT_SOURCES = [
  "Freelance / Contract",
  "Salary",
  "Business",
  "Commission",
  "Gift",
  "Refund",
  "Other",
];
export const DEFAULT_FINANCE = {
  buckets: DEFAULT_BUCKETS,
  accounts: DEFAULT_ACCOUNTS,
  sources: DEFAULT_SOURCES,
  manualIncome: [],
  paymentSnapshots: {},
  bucketLoans: [],
};

/** Divert allocations for indebted buckets to their lenders before new money is credited. */
export function applyBucketLoanRepayment(split, finance) {
  const loans = (finance.bucketLoans || []).map((loan) => ({ ...loan }));
  const allocations = (split.allocations || []).map((allocation) => ({
    ...allocation,
  }));
  const repayments = [];

  for (const allocation of allocations) {
    let available = Math.max(0, Number(allocation.amount) || 0);
    const borrowerLoans = loans.filter(
      (loan) =>
        loan.borrowerId === allocation.bucketId &&
        (Number(loan.amount) || 0) > (Number(loan.repaid) || 0),
    );
    for (const loan of borrowerLoans) {
      if (!available) break;
      const outstanding = Math.max(
        0,
        (Number(loan.amount) || 0) - (Number(loan.repaid) || 0),
      );
      const repaid = Math.min(available, outstanding);
      loan.repaid = (Number(loan.repaid) || 0) + repaid;
      allocation.amount -= repaid;
      available -= repaid;
      const lenderAllocation = allocations.find(
        (item) => item.bucketId === loan.lenderId,
      );
      if (lenderAllocation) lenderAllocation.amount += repaid;
      else
        allocations.push({
          bucketId: loan.lenderId,
          percentage: 0,
          amount: repaid,
        });
      repayments.push({ loanId: loan.id, amount: repaid });
    }
  }

  return {
    split: {
      ...split,
      allocations: allocations.filter((item) => item.amount > 0),
    },
    finance: { ...finance, bucketLoans: loans },
    repayments,
  };
}

export function allocateAmount(amount, buckets, override) {
  const active = override || buckets.filter((b) => b.status !== "archived");
  const weights = active.map((b) => ({
    id: b.id,
    percentage: Number(b.percentage) || 0,
  }));
  const basisPoints = weights.map((b) => Math.round(b.percentage * 100));
  const totalBasisPoints = basisPoints.reduce((n, b) => n + b, 0);
  const total = totalBasisPoints / 100;
  if (totalBasisPoints > 10000)
    throw new Error("Allocation percentages exceed 100%.");
  const rounded = Math.round(Number(amount) || 0);
  if (!Number.isSafeInteger(rounded) || rounded < 0)
    throw new Error("Enter a valid whole UGX amount.");
  let remaining = BigInt(rounded);
  const result = weights.map((b, i) => {
    const value =
      i === weights.length - 1 && totalBasisPoints === 10000
        ? remaining
        : (BigInt(rounded) * BigInt(basisPoints[i])) / 10000n;
    remaining -= value;
    return { bucketId: b.id, percentage: b.percentage, amount: Number(value) };
  });
  return {
    allocations: result,
    unallocated: Number(remaining > 0n ? remaining : 0n),
    totalPercentage: total,
  };
}

export function getTransactions(data) {
  const finance = data.finance || DEFAULT_FINANCE;
  const snapshots = finance.paymentSnapshots || {};
  const seenPaymentIds = new Set();
  const transactions = Object.entries(data.clients || {}).flatMap(
    ([date, clients]) =>
      clients.flatMap((client) =>
        (client.payments || [])
          .filter((payment) => {
            if (seenPaymentIds.has(payment.id)) return false;
            seenPaymentIds.add(payment.id);
            return true;
          })
          .map((payment) => {
            const snap = snapshots[payment.id];
            return {
              id: `payment:${payment.id}`,
              type: "income",
              sourceType: "client_payment",
              amount: Math.round(Number(payment.amount) || 0),
              date: payment.date || date,
              accountId: payment.accountId || snap?.accountId || "",
              clientId: client.id,
              clientName: client.business || client.name,
              serviceId: payment.serviceId || "",
              serviceName:
                client.services?.find((s) => s.id === payment.serviceId)
                  ?.title ||
                client.package ||
                "Client service",
              paymentId: payment.id,
              description: payment.note || "Client payment",
              allocations: snap?.allocations || [],
              unallocated: snap?.unallocated || 0,
            };
          }),
      ),
  );
  for (const income of finance.manualIncome || [])
    transactions.push({
      ...income,
      id: `income:${income.id}`,
      type: "income",
      sourceType: income.sourceType || "Other",
    });
  for (const expense of data.expenses || [])
    transactions.push({
      ...expense,
      id: `expense:${expense.id}`,
      type: "expense",
      amount: Math.round(Number(expense.amount) || 0),
      description: expense.note || expense.description || "Expense",
      bucketId: expense.bucketId || "",
      accountId: expense.accountId || "",
    });
  return transactions.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
}

export function getBalances(transactions, finance) {
  const buckets = Object.fromEntries(
    (finance.buckets || []).map((b) => [b.id, { allocated: 0, spent: 0 }]),
  );
  const accounts = Object.fromEntries(
    (finance.accounts || []).map((a) => [a.id, 0]),
  );
  let income = 0,
    expenses = 0,
    unallocated = 0,
    clientIncome = 0,
    otherIncome = 0;
  for (const t of transactions) {
    if (t.type === "income") {
      income += t.amount;
      if (t.sourceType === "client_payment") clientIncome += t.amount;
      else otherIncome += t.amount;
      unallocated += t.unallocated || 0;
      for (const a of t.allocations || [])
        if (buckets[a.bucketId]) buckets[a.bucketId].allocated += a.amount;
      if (accounts[t.accountId] !== undefined)
        accounts[t.accountId] += t.amount;
    } else {
      expenses += t.amount;
      if (buckets[t.bucketId]) buckets[t.bucketId].spent += t.amount;
      if (accounts[t.accountId] !== undefined)
        accounts[t.accountId] -= t.amount;
    }
  }
  for (const reset of finance.bucketResets || []) {
    const bucket = buckets[reset.bucketId];
    if (!bucket) continue;
    bucket.allocated +=
      (Number(reset.opening) || 0) - (Number(reset.allocated) || 0);
    bucket.spent -= Number(reset.spent) || 0;
  }
  const borrowed = Object.fromEntries(
    Object.keys(buckets).map((id) => [id, 0]),
  );
  for (const loan of finance.bucketLoans || []) {
    const amount = Math.max(0, Number(loan.amount) || 0);
    const repaid = Math.min(amount, Math.max(0, Number(loan.repaid) || 0));
    const outstanding = amount - repaid;
    if (buckets[loan.lenderId])
      buckets[loan.lenderId].loaned =
        (buckets[loan.lenderId].loaned || 0) + amount;
    if (borrowed[loan.borrowerId] !== undefined)
      borrowed[loan.borrowerId] += outstanding;
  }
  for (const bucket of Object.values(buckets)) {
    bucket.borrowed = 0;
    bucket.balance = bucket.allocated - bucket.spent - (bucket.loaned || 0);
  }
  for (const [bucketId, amount] of Object.entries(borrowed))
    buckets[bucketId].borrowed = amount;
  return {
    income,
    expenses,
    clientIncome,
    otherIncome,
    unallocated,
    available: income - expenses,
    buckets,
    accounts,
  };
}
