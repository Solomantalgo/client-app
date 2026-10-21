import { getTransactions } from "./money.js";
import { serviceTotal } from "./clients.js";

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase();

const digits = (value) => String(value ?? "").replace(/\D/g, "");
const phoneVariants = (value) => {
  const valueDigits = digits(value);
  return valueDigits.startsWith("256")
    ? `${valueDigits} 0${valueDigits.slice(3)}`
    : valueDigits;
};
const amountText = (value) => {
  const amount = Math.round(Number(value) || 0);
  return `${amount} ${amount.toLocaleString("en-UG")}`;
};

export function buildIndex(data) {
  const index = [];
  for (const [date, clients] of Object.entries(data?.clients || {})) {
    for (const client of clients) {
      const clientText = [client.name, client.business, client.businessType, phoneVariants(client.phone),
        client.notes, client.status, client.paused ? "PAUSED" : "", client.phone].join(" ");
      index.push({ type: "Clients", id: client.id, clientId: client.id, date,
        title: client.name, subtitle: `${client.business || "No business"} · ${client.paused ? "Paused" : client.status}`,
        text: clientText });
      for (const service of client.services || []) {
        const items = (service.items || []).map((item) => `${item.title} ${item.name} ${item.price}`).join(" ");
        index.push({ type: "Services", id: service.id, clientId: client.id, date, serviceId: service.id,
          title: service.title, subtitle: `${client.name} · ${client.status}`, text: `${service.title} ${items} ${service.categories} ${amountText(serviceTotal(service, client))}` });
        if (service.invoiceNo) index.push({ type: "Invoices", id: service.id, clientId: client.id,
          date, serviceId: service.id, title: service.invoiceNo, subtitle: `${client.name} · ${service.title}`,
          text: `${service.invoiceNo} ${client.name} ${service.title}` });
      }
      for (const payment of client.payments || []) {
        const formatted = amountText(payment.amount);
        index.push({ type: "Payments", id: payment.id, clientId: client.id, date,
          serviceId: payment.serviceId, title: payment.note || "Payment",
          subtitle: `${client.name} · ${payment.date || date}`, text: `${payment.note} ${payment.amount} ${formatted} ${payment.date} ${payment.receiptNo || ""}` });
      }
    }
  }
  for (const transaction of getTransactions(data)) {
    if (transaction.sourceType === "client_payment") continue;
    index.push({ type: "Money", id: transaction.id, subtype: transaction.type, title: transaction.description || "Transaction",
      subtitle: `${transaction.type} · ${transaction.date || "Date unknown"}`,
      text: `${transaction.description} ${transaction.note} ${transaction.sourceType} ${transaction.amount} ${amountText(transaction.amount)} ${transaction.date}` });
  }
  for (const bucket of data?.finance?.buckets || []) index.push({
    type: "Buckets", id: bucket.id, title: bucket.name, subtitle: bucket.status === "archived" ? "Archived bucket" : "Bucket",
    text: `${bucket.name} ${bucket.status === "archived" ? "archived" : "active"}`,
  });
  for (const account of data?.finance?.accounts || []) index.push({
    type: "Accounts", id: account.id, title: account.name, subtitle: account.status === "archived" ? "Archived account" : account.type,
    text: `${account.name} ${account.type} ${account.status === "archived" ? "archived" : "active"}`,
  });
  return index;
}

function rank(item, tokens) {
  const title = normalize(item.title);
  const text = normalize(item.text);
  let score = 0;
  for (const token of tokens) {
    if (title.startsWith(token)) score += 30;
    else if (title.split(/\s+/).some((word) => word.startsWith(token))) score += 20;
    else if (text.includes(token)) score += 10;
    else return -1;
  }
  return score;
}

export function runSearch(index, query, { types, limit = 8 } = {}) {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const allowed = types?.length ? new Set(types) : null;
  const ranked = index
    .filter((item) => !allowed || allowed.has(item.type))
    .map((item) => ({ item, score: rank(item, tokens) }))
    .filter((result) => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  const groups = new Map();
  for (const result of ranked) {
    if (!groups.has(result.item.type)) groups.set(result.item.type, []);
    groups.get(result.item.type).push(result);
  }
  return [...groups.values()]
    .sort((a, b) => b[0].score - a[0].score)
    .flat()
    .slice(0, limit)
    .map((result) => result.item);
}
