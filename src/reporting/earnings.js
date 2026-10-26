import { getTransactions } from "../money.js";

const TIME_ZONE = "Africa/Kampala";
const EARNED_SOURCES = new Set([
  "freelance / contract",
  "freelance",
  "contract",
  "salary",
  "business",
  "commission",
]);
const OTHER_SOURCES = new Set([
  "gift",
  "refund",
  "loan",
  "external loan",
  "opening balance",
  "owner transfer",
  "transfer from owner",
  "other",
]);

function sourceClass(sourceType) {
  const source = String(sourceType || "")
    .trim()
    .toLocaleLowerCase();
  if (EARNED_SOURCES.has(source)) return "earned";
  if (OTHER_SOURCES.has(source)) return "other";
  return "";
}

function validDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, date: `${match[1]}-${match[2]}-${match[3]}` };
}

export function reportDate(value) {
  const text = String(value || "");
  const localDate = validDateParts(text.slice(0, 10));
  if (localDate && text.length === 10) {
    return localDate.date;
  }
  const timestamp = new Date(text);
  if (Number.isNaN(timestamp.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function currentKampalaMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}`;
}

export function monthDateRange(month, throughDay = null) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const endDay = Math.min(
    daysInMonth,
    Math.max(1, Number(throughDay) || daysInMonth),
  );
  const pad = (number) => String(number).padStart(2, "0");
  return {
    start: `${match[1]}-${match[2]}-01`,
    end: `${match[1]}-${match[2]}-${pad(endDay)}`,
    daysInMonth,
  };
}

function blankSummary(month) {
  return {
    month,
    earned: 0,
    otherReceived: 0,
    unclassified: 0,
    expenses: 0,
    afterExpenses: 0,
    incomeCount: 0,
    expenseCount: 0,
    inferredDateAmount: 0,
    invalidDateCount: 0,
    invalidAmountCount: 0,
    bySource: [],
    transactions: [],
  };
}

export function classifyEarning(transaction) {
  if (transaction.sourceType === "client_payment") return "earned";
  if (["earned", "other"].includes(transaction.reportingClass)) {
    return transaction.reportingClass;
  }
  return sourceClass(transaction.sourceType);
}

export function summarizeMonth(data, month, options = {}) {
  const range = monthDateRange(month, options.throughDay);
  const summary = blankSummary(month);
  if (!range) return summary;
  const bySource = new Map();
  const allTransactions = getTransactions(data);
  for (const transaction of allTransactions) {
    const date = reportDate(transaction.date);
    if (!date) {
      summary.invalidDateCount += 1;
      continue;
    }
    if (date < range.start || date > range.end) continue;
    const amount = Number(transaction.amount);
    if (
      transaction.amountValid === false ||
      !Number.isSafeInteger(Math.round(amount)) ||
      !Number.isFinite(amount)
    ) {
      summary.invalidAmountCount += 1;
      continue;
    }
    const rounded = Math.round(amount);
    const row = { ...transaction, amount: rounded, reportDate: date };
    summary.transactions.push(row);
    if (transaction.dateInferred) summary.inferredDateAmount += rounded;
    if (transaction.type === "expense") {
      summary.expenses += Math.abs(rounded);
      summary.expenseCount += 1;
      continue;
    }
    summary.incomeCount += 1;
    const classification = classifyEarning(transaction);
    if (classification === "earned") {
      summary.earned += rounded;
      const source =
        transaction.sourceType === "client_payment"
          ? "Client work"
          : transaction.sourceType || "Other";
      const existing = bySource.get(source) || { source, amount: 0, count: 0 };
      existing.amount += rounded;
      existing.count += 1;
      bySource.set(source, existing);
    } else if (classification === "other") {
      summary.otherReceived += rounded;
    } else {
      summary.unclassified += rounded;
    }
  }
  summary.afterExpenses = summary.earned - summary.expenses;
  summary.bySource = [...bySource.values()].sort((a, b) => b.amount - a.amount);
  return summary;
}

export function summarizeYear(data, year, now = new Date()) {
  const selectedYear = Number(year);
  const currentMonth = currentKampalaMonth(now);
  const finalMonth = currentMonth.startsWith(`${selectedYear}-`)
    ? Number(currentMonth.slice(5, 7))
    : selectedYear < Number(currentMonth.slice(0, 4))
      ? 12
      : 0;
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
    const future = index + 1 > finalMonth;
    return {
      month,
      future,
      summary: future ? blankSummary(month) : summarizeMonth(data, month),
    };
  });
  const available = months.filter((item) => !item.future);
  const total = available.reduce(
    (result, item) => {
      result.earned += item.summary.earned;
      result.otherReceived += item.summary.otherReceived;
      result.expenses += item.summary.expenses;
      result.afterExpenses += item.summary.afterExpenses;
      return result;
    },
    { earned: 0, otherReceived: 0, expenses: 0, afterExpenses: 0 },
  );
  return {
    year: selectedYear,
    months,
    total,
    monthlyAverage: {
      ...total,
      denominator: available.length,
      earned: available.length
        ? Math.round(total.earned / available.length)
        : 0,
    },
  };
}

function previousMonth(month) {
  const range = monthDateRange(month);
  const [year, monthNumber] = month.split("-").map(Number);
  if (!range) return "";
  return monthNumber === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}

export function comparisonPeriods(month, now = new Date(), fullMonth = false) {
  const currentMonth = currentKampalaMonth(now);
  const currentDate = reportDate(now.toISOString());
  if (month !== currentMonth || fullMonth) {
    return {
      current: monthDateRange(month),
      previous: monthDateRange(previousMonth(month)),
    };
  }
  const day = Number(currentDate.slice(8, 10));
  const previous = previousMonth(month);
  return {
    current: monthDateRange(month, day),
    previous: monthDateRange(previous, day),
  };
}

export function summarizeRange(data, month, range) {
  const summary = blankSummary(month);
  if (!range?.start || !range?.end) return summary;
  const selected = getTransactions(data).filter((transaction) => {
    const date = reportDate(transaction.date);
    return date && date >= range.start && date <= range.end;
  });
  const scoped = {
    ...data,
    clients: {},
    expenses: [],
    finance: {
      ...(data.finance || {}),
      manualIncome: [],
      paymentSnapshots: {},
    },
  };
  for (const transaction of selected) {
    if (transaction.type === "expense") {
      scoped.expenses.push({
        ...transaction,
        id: transaction.id.replace(/^expense:/, ""),
        date: transaction.date,
        amount: transaction.amount,
      });
    } else if (transaction.sourceType === "client_payment") {
      const date = transaction.reportDate || reportDate(transaction.date);
      const list = scoped.clients[date] || [];
      list.push({
        id: transaction.clientId,
        name: transaction.clientName,
        services: [],
        payments: [
          {
            id: transaction.paymentId,
            amount: transaction.amount,
            date: transaction.date,
            note: transaction.description,
          },
        ],
      });
      scoped.clients[date] = list;
    } else {
      scoped.finance.manualIncome.push({
        ...transaction,
        id: transaction.id.replace(/^income:/, ""),
      });
    }
  }
  return summarizeMonth(scoped, month, {
    throughDay: Number(String(range.end).slice(8, 10)),
  });
}

function safeCsvCell(value) {
  const text = String(value ?? "");
  const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

export function buildMonthCsv(summary, range, options = {}) {
  const transactions = options.transactions || summary.transactions;
  const lines = [
    ["Report basis", "Cash received date", "Currency", "UGX"],
    ["Date range", range?.start || "", range?.end || ""],
    ["Evidence filter", options.filterLabel || "All"],
    ["Month", summary.month],
    ["Earned", summary.earned],
    ["Other money received", summary.otherReceived],
    ["Unclassified received", summary.unclassified],
    ["Expenses", summary.expenses],
    ["After expenses", summary.afterExpenses],
    [],
    [
      "Date",
      "Reporting classification",
      "Type",
      "Client",
      "Service",
      "Description",
      "Source",
      "Amount UGX",
      "Account",
    ],
    ...transactions.map((transaction) => [
      transaction.reportDate || reportDate(transaction.date),
      transaction.reportClassification || "",
      transaction.type,
      transaction.clientName || "",
      transaction.serviceName || "",
      transaction.description || transaction.note || "",
      transaction.sourceType || "",
      Math.round(Number(transaction.amount) || 0),
      transaction.accountName || transaction.accountId || "Not assigned",
    ]),
  ];
  return lines.map((line) => line.map(safeCsvCell).join(",")).join("\r\n");
}
