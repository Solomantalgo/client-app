export function getInvoiceNum(client, service) {
  const year = client.date
    ? client.date.split("-")[0]
    : new Date().getFullYear();
  const sequence = String(service?.id || client.id)
    .slice(-3)
    .replace(/\D/g, "0")
    .padStart(3, "0");
  return `SWD-${year}-${sequence}`;
}

export function getReceiptNum(payment) {
  const year = payment.date
    ? payment.date.split("-")[0]
    : new Date().getFullYear();
  const sequence = String(payment.id)
    .slice(-3)
    .replace(/\D/g, "0")
    .padStart(3, "0");
  return `RCP-${year}-${sequence}`;
}
