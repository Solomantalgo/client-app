import qrcode from "qrcode-generator";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export const formatDocumentMoney = (value) =>
  `UGX ${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-UG")}`;

export function receiptSummary(model) {
  const linesTotal = (model.lines || []).reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  );
  const received = Math.max(0, Number(model.received ?? model.total ?? linesTotal));
  const invoiceTotal = Math.max(0, Number(model.invoiceTotal ?? model.total) || 0);
  const previouslyPaid = Math.max(0, Number(model.previouslyPaid) || 0);
  const balance = Math.max(0, invoiceTotal - previouslyPaid - received);
  return {
    received,
    invoiceTotal,
    previouslyPaid,
    balance,
    paidInFull: balance === 0 && invoiceTotal > 0,
  };
}

export function invoiceSummary(model) {
  const total = Math.max(0, Number(model.total) || 0);
  const paid = Math.max(0, Number(model.paid) || 0);
  const balance = Math.max(0, total - paid);
  const status = balance === 0 ? "PAID IN FULL" : paid ? "PARTIAL PAYMENT" : "AWAITING PAYMENT";
  return { total, paid, balance, status, paidInFull: balance === 0 };
}

function methodName(value) {
  const name = String(value || "").trim();
  if (!name) return "Not specified";
  return ({
    cash: "Cash",
    bank: "Bank",
    "mobile-money": "MTN MoMo",
    momo: "MTN MoMo",
  })[name.toLowerCase()] || name;
}

function displayDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function qrMarkup(profile, thermal = false) {
  const website = profile.website || "solomantalgo.com";
  const destination = profile.qrUrl || `https://${website}`;
  const qr = qrcode(0, "M");
  qr.addData(destination);
  qr.make();
  return `<div class="doc-qr${thermal ? " thermal-qr" : ""}">
    ${qr.createSvgTag(3, 4).replace(/<\?xml[^>]*>/, "")}
    <span>Scan to visit ${esc(website)}</span>
  </div>`;
}

function logoMarkup(profile, format) {
  const enabled = format === "a4" ? profile.showLogoA4 !== false : profile.showLogoThermal === true;
  if (!enabled || !profile.logoDataUri) {
    return `<b class="brand-fallback">${esc(profile.brandName || "Solomantalgo")}</b>`;
  }
  return `<img class="doc-logo" src="${esc(profile.logoDataUri)}" alt="">`;
}

function brandDetails(profile) {
  return [profile.tagline, profile.location, profile.website]
    .filter(Boolean)
    .map((value) => `<span>${esc(value)}</span>`)
    .join('<i aria-hidden="true">·</i>');
}

function ribbon(profile, model, type, middle, format) {
  return `<header class="doc-ribbon">
    <div class="doc-brand">
      ${logoMarkup(profile, format)}
      <div class="doc-brand-details">${brandDetails(profile)}</div>
    </div>
    <div class="doc-id">
      <h1>${type === "Receipt" ? "PAYMENT RECEIPT" : "INVOICE"}</h1>
      <b>${esc(model.number || "")}</b>
      ${middle}
    </div>
  </header>`;
}

function ribbonMarkup(profile, model, type, format) {
  const middle = type === "Receipt"
    ? ""
    : `<span>Issued ${esc(displayDate(model.date))}</span>
      ${model.dueDate ? `<span>Due ${esc(displayDate(model.dueDate))}</span>` : ""}`;
  return ribbon(profile, model, type, middle, format);
}

function paymentDetails(profile) {
  const bank = profile.bankName || profile.bankAccountName || profile.bankAccountNo;
  const momo = profile.momoNumber || profile.momoName;
  if (!bank && !momo) return "";
  const blocks = [];
  if (bank) {
    blocks.push(`<section><b>Bank transfer</b>
      ${profile.bankName ? `<span>${esc(profile.bankName)}</span>` : ""}
      ${profile.bankAccountName ? `<span>${esc(profile.bankAccountName)}</span>` : ""}
      ${profile.bankAccountNo ? `<span>${esc(profile.bankAccountNo)}</span>` : ""}
    </section>`);
  }
  if (momo) {
    blocks.push(`<section><b>Mobile Money (MTN)</b>
      ${profile.momoNumber ? `<span>${esc(profile.momoNumber)}</span>` : ""}
      ${profile.momoName ? `<span>${esc(profile.momoName)}</span>` : ""}
    </section>`);
  }
  return `<section class="payment-details">
    <h2>Payment details</h2><div class="payment-detail-grid">${blocks.join("")}</div>
  </section>`;
}

function receiptLines(model) {
  return (model.lines || [])
    .filter((line) => line.title || Number(line.amount))
    .map((line) => `<div class="description-line">
      <span>${esc(line.title || "")}</span><b>${formatDocumentMoney(line.amount)}</b>
    </div>`)
    .join("");
}

function includedPayments(model) {
  if (!model.payments?.length) return "";
  return `<section class="included-payments">
    <h2>Payments included</h2>
    ${model.payments.map((payment) => `<div class="financial-row">
      <span>${esc(displayDate(payment.date))} · ${esc(methodName(payment.method))}
        ${payment.reference ? ` · Ref ${esc(payment.reference)}` : ""}</span>
      <b>${formatDocumentMoney(payment.amount)}</b>
    </div>`).join("")}
  </section>`;
}

function issuer(profile) {
  if (!profile.ownerName && !profile.ownerTitle) return "";
  return `<div class="issuer-copy"><span>Issued by</span>
    ${profile.ownerName ? `<b>${esc(profile.ownerName)}</b>` : ""}
    ${profile.ownerTitle ? `<span>${esc(profile.ownerTitle)}</span>` : ""}
  </div>`;
}

function footer(model, profile) {
  return `<footer class="doc-footer">
    <span>${esc(model.number || "")}</span>
    <span>${esc(profile.brandName || "Solomantalgo")} · ${esc(profile.website || "")}</span>
    <span>Page <i class="page-current">1</i> of <i class="page-total">1</i></span>
  </footer>`;
}

function a4Styles() {
  return `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #171717;
      font: 10.5pt/1.45 Arial, Helvetica, sans-serif; }
    .doc-page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm 16mm 23mm; }
    .doc-ribbon { height: 34mm; display: flex; align-items: center; justify-content: space-between;
      gap: 8mm; padding: 4mm 7mm; border-left: 3mm solid #C3FF4D; background: #202020; color: #fff; }
    .doc-brand { display: flex; min-width: 0; flex: 1; flex-direction: column; justify-content: center; gap: 1.6mm; }
    .doc-logo { display: block; width: 55mm; height: 18mm; object-fit: contain; object-position: left center; }
    .brand-fallback { color: #fff; font-size: 18pt; }
    .doc-brand-details { display: flex; flex-wrap: wrap; align-items: center; gap: 1.5mm 2.2mm;
      color: #f4f4f4; font-size: 9pt; line-height: 1.25; }
    .doc-brand-details i { color: #fff; font-style: normal; }
    .doc-id { display: flex; max-width: 76mm; flex-direction: column; align-items: flex-end; gap: 1mm;
      color: #fff; text-align: right; font-size: 8.5pt; }
    .doc-id h1 { margin: 0 0 1mm; color: #fff; font-size: 19pt; line-height: 1.08;
      letter-spacing: .035em; white-space: nowrap; }
    .doc-id b { color: #fff; font-size: 10pt; letter-spacing: .04em; }
    .doc-content { padding-top: 8mm; }
    .recipient-row { display: grid; grid-template-columns: 1fr auto; gap: 10mm; padding: 0 0 7mm;
      border-bottom: 1px solid #DADADA; }
    .recipient-row > section { display: flex; min-width: 0; flex-direction: column; gap: .8mm; }
    .recipient-meta { min-width: 50mm; text-align: right; }
    .doc-kicker { color: #555; font-size: 9pt; }
    .recipient-row strong { color: #171717; font-size: 13pt; overflow-wrap: anywhere; }
    .recipient-row .business-name { color: #555; }
    .document-reference { color: #555; font-size: 9.5pt; }
    .doc-description { display: grid; gap: 2mm; padding: 6mm 0; border-bottom: 1px solid #DADADA; }
    .doc-description h2, .included-payments h2, .payment-details h2 { margin: 0; font-size: 9pt;
      font-weight: 500; color: #555; }
    .description-line { display: flex; justify-content: space-between; gap: 8mm; padding: 1mm 0; }
    .description-line span { min-width: 0; overflow-wrap: anywhere; }
    .description-line b, .financial-row b { flex: none; text-align: right; font-variant-numeric: tabular-nums; }
    .amount-row { display: flex; align-items: center; justify-content: space-between; gap: 6mm;
      padding: 7mm 0 6mm; border-bottom: 1px solid #DADADA; }
    .amount-row > div { display: flex; min-width: 0; flex-direction: column; gap: 1mm; }
    .amount-label { color: #555; font-size: 9.5pt; }
    .amount-value { font-size: 30pt; font-weight: 700; line-height: 1.06; letter-spacing: -.025em;
      font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .amount-value::after { display: block; width: 18mm; margin-top: 2mm; border-bottom: 1.4mm solid #C3FF4D;
      content: ""; }
    .status-badge { flex: none; padding: 2.2mm 3mm; border-radius: 2mm; background: #EDF8D9;
      color: #171717; font-size: 9pt; font-weight: 700; letter-spacing: normal; white-space: nowrap; }
    .status-badge.pending { border: 0; background: #FFF3DE; color: #4C3A20; }
    .financial-summary { width: 100%; margin: 3mm 0 0; }
    .financial-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8mm;
      padding: 2.3mm 0; border-bottom: 1px solid #DADADA; }
    .financial-row > span:first-child { min-width: 0; overflow-wrap: anywhere; }
    .financial-row b { font-weight: 600; font-variant-numeric: tabular-nums; }
    .financial-row.balance { margin-top: 1.5mm; padding: 3mm; border: 0; background: #EDF8D9; font-weight: 700; }
    .financial-row.balance b { font-size: 12pt; }
    .included-payments { display: grid; gap: 1.5mm; margin-top: 4mm; padding-top: 3mm;
      border-top: 1px solid #DADADA; }
    .included-payments .financial-row { padding: 1mm 0; font-size: 9pt; }
    .method-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2mm 8mm;
      padding: 5mm 0; border-bottom: 1px solid #DADADA; font-size: 10pt; line-height: 1.35; }
    .method-row strong { font-weight: 600; white-space: nowrap; }
    .payment-details { margin-top: 5mm; }
    .payment-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5mm; margin-top: 2mm; }
    .payment-detail-grid section { display: flex; min-width: 0; flex-direction: column; gap: 1mm; padding: 3mm;
      border: 1px solid #DADADA; overflow-wrap: anywhere; }
    .payment-detail-grid b { margin-bottom: 1mm; }
    .invoice-table { width: 100%; margin: 5mm 0; border-collapse: collapse; }
    .invoice-table thead { display: table-header-group; }
    .invoice-table th { padding: 2.8mm 2mm; border-bottom: 1.5px solid #777; color: #555;
      font-size: 9pt; font-weight: 500; text-align: left; }
    .invoice-table td { padding: 3mm 2mm; border-bottom: 1px solid #DADADA; vertical-align: top; }
    .invoice-table td:first-child { overflow-wrap: anywhere; }
    .invoice-table th:last-child, .invoice-table td:last-child { width: 42mm; text-align: right; }
    .invoice-totals { width: 78mm; margin: 2mm 0 0 auto; }
    .thermal-invoice-lines { margin: 2mm 0; }
    .thermal-invoice-line { display: grid; gap: 1mm; padding: 1.7mm 0;
      border-bottom: 1px solid #000; overflow-wrap: anywhere; }
    .thermal-invoice-line b { text-align: right; }
    .invoice-primary { margin-top: 5mm; }
    .terms { margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #DADADA; }
    .terms h2 { margin: 0 0 2mm; font-size: 9pt; font-weight: 500; color: #555; }
    .terms-content { overflow-wrap: anywhere; white-space: pre-wrap; }
    .issuer-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm;
      margin-top: 8mm; break-inside: avoid; }
    .issuer-copy { display: flex; min-width: 0; flex-direction: column; gap: 1mm; }
    .issuer-copy > span:first-child { color: #555; font-size: 9pt; }
    .issuer-copy b { font-size: 11pt; }
    .issuer-copy span:last-child { color: #555; }
    .doc-qr { display: flex; flex: none; flex-direction: column; align-items: center; gap: 1mm; color: #555;
      font-size: 8.5pt; text-align: center; }
    .doc-qr svg { display: block; width: 24mm; height: 24mm; background: #fff; }
    .doc-thanks { margin: 5mm 0 0; color: #555; font-style: italic; text-align: right; }
    .doc-footer { display: flex; justify-content: space-between; gap: 5mm; margin-top: 8mm; padding-top: 2mm;
      border-top: 1px solid #DADADA; color: #555; font-size: 9pt; line-height: 1.25; }
    .doc-footer > span { min-width: 0; overflow-wrap: anywhere; }
    .doc-footer i { font-style: normal; }
    .page-current::after, .page-total::after { content: ""; }
    .keep-together { break-inside: avoid; }
    @media print {
      .doc-page { margin: 0; }
      .doc-footer { position: fixed; right: 16mm; bottom: 5mm; left: 16mm; margin: 0; }
      .page-current, .page-total { font-size: 0; }
      .page-current::after { content: counter(page); font-size: 8.5pt; }
      .page-total::after { content: counter(pages); font-size: 8.5pt; }
      .invoice-table tr { break-inside: avoid; }
    }
  `;
}

function thermalStyles() {
  return `
    @page { size: 58mm auto; margin: 0; }
    * { box-sizing: border-box; color: #000; background: #fff; }
    html, body { width: 58mm; margin: 0; padding: 0; font: 9px/1.35 Arial, Helvetica, sans-serif; }
    .doc-page { width: 58mm; margin: 0; padding: 3mm 5mm 5mm; }
    .doc-ribbon { display: block; height: auto; padding: 0 0 3mm; border: 0; border-bottom: 1px solid #000;
      background: #fff; color: #000; text-align: center; }
    .doc-brand { align-items: center; gap: 1mm; }
    .doc-logo { width: 38mm; height: 12mm; object-position: center; filter: grayscale(1) contrast(1.3); }
    .brand-fallback { color: #000; font-size: 12px; }
    .doc-brand-details { justify-content: center; gap: 1mm; color: #000; font-size: 7.5px; }
    .doc-brand-details i { color: #000; }
    .doc-id { max-width: none; align-items: center; gap: .5mm; margin-top: 2mm; color: #000; font-size: 8px; }
    .doc-id h1 { margin: 0; color: #000; font-size: 12px; }
    .doc-id b { color: #000; font-size: 8px; }
    .doc-content { padding-top: 3mm; }
    .recipient-row { grid-template-columns: 1fr; gap: 2mm; padding-bottom: 2.5mm; }
    .recipient-meta { min-width: 0; text-align: left; }
    .recipient-row strong { font-size: 10px; }
    .doc-kicker { font-size: 8px; }
    .document-reference { font-size: 8px; }
    .doc-description { gap: 1mm; padding: 2.5mm 0; }
    .description-line { display: block; padding: 1mm 0; }
    .description-line b { display: block; margin-top: .5mm; text-align: right; }
    .amount-row { align-items: flex-start; padding: 3mm 0; }
    .amount-label { font-size: 8px; }
    .amount-value { font-size: 17px; }
    .amount-value::after { width: 10mm; margin-top: 1mm; border-bottom-width: 1mm; }
    .status-badge { padding: 1mm; border: 1px solid #000; border-radius: 0; background: #fff; font-size: 7px; }
    .financial-row { display: grid; grid-template-columns: 1fr; gap: .5mm; padding: 1.4mm 0; font-size: 8px; }
    .financial-row b { justify-self: end; }
    .financial-row.balance { margin-top: 1mm; padding: 1.5mm; border: 1px solid #000; background: #fff; }
    .financial-row.balance b { font-size: 9px; }
    .included-payments { gap: 1mm; margin-top: 2mm; padding-top: 2mm; }
    .included-payments .financial-row { font-size: 7.5px; }
    .method-row { display: grid; gap: 1mm; padding: 2mm 0; font-size: 8px; }
    .payment-details { margin-top: 2mm; }
    .payment-detail-grid { grid-template-columns: 1fr; gap: 1.5mm; }
    .payment-detail-grid section { gap: .5mm; padding: 1.5mm; }
    .thermal-invoice-lines { font-size: 8px; }
    .invoice-totals { width: 100%; margin-top: 2mm; }
    .terms { margin-top: 2mm; padding-top: 2mm; }
    .terms-content { font-size: 8px; }
    .issuer-row { display: grid; justify-items: center; gap: 1mm; margin-top: 3mm; }
    .issuer-copy { align-items: center; text-align: center; }
    .issuer-copy > span:first-child { font-size: 7.5px; }
    .issuer-copy b { font-size: 9px; }
    .issuer-copy span:last-child { font-size: 7.5px; }
    .doc-qr { font-size: 7px; }
    .doc-qr svg { width: 19mm; height: 19mm; }
    .doc-thanks { margin-top: 2mm; font-size: 8px; text-align: center; }
    .doc-footer { display: grid; justify-content: center; gap: .5mm; margin-top: 2mm; padding-top: 1.5mm;
      border-top: 1px dashed #000; font-size: 7px; text-align: center; }
    @media print { .doc-footer { position: static; } }
  `;
}

function documentPage(title, content, format) {
  const style = format === "thermal58" ? thermalStyles() : a4Styles();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title><style>${style}</style></head>
    <body><main class="doc-page">${content}</main></body></html>`;
}

function recipient(model, label, status = "") {
  const isReceipt = label === "Received from";
  return `<section class="recipient-row">
    <section><span class="doc-kicker">${label}</span>
      <strong>${esc(model.clientName || "")}</strong>
      ${model.business ? `<span class="business-name">${esc(model.business)}</span>` : ""}
    </section>
    <section class="recipient-meta"><span class="doc-kicker">${isReceipt ? "Date" : "Status"}</span>
      <strong>${esc(isReceipt ? displayDate(model.date) : status)}</strong>
      ${isReceipt && model.invoiceNo
        ? `<span class="document-reference">Invoice ref. ${esc(model.invoiceNo)}</span>`
        : ""}
      ${isReceipt && model.reference
        ? `<span class="document-reference">Reference ${esc(model.reference)}</span>`
        : ""}
    </section>
  </section>`;
}

function amountReceived(summary) {
  const status = summary.paidInFull ? "Paid in full" : "Partial payment";
  return `<section class="amount-row"><div><span class="amount-label">Amount received</span>
    <strong class="amount-value">${formatDocumentMoney(summary.received)}</strong></div>
    <b class="status-badge${summary.paidInFull ? "" : " pending"}">${status}</b></section>`;
}

function receiptFinancials(summary) {
  return `<section class="financial-summary">
    <div class="financial-row"><span>Invoice total</span><b>${formatDocumentMoney(summary.invoiceTotal)}</b></div>
    <div class="financial-row"><span>Previously paid</span><b>${formatDocumentMoney(summary.previouslyPaid)}</b></div>
    <div class="financial-row balance"><span>Remaining balance</span><b>${formatDocumentMoney(summary.balance)}</b></div>
  </section>`;
}

function invoiceAmount(summary) {
  const settled = summary.balance === 0;
  const label = settled ? "Invoice total" : "Balance due";
  const amount = settled ? summary.total : summary.balance;
  return `<section class="amount-row invoice-primary"><div><span class="amount-label">${label}</span>
    <strong class="amount-value">${formatDocumentMoney(amount)}</strong></div>
    <b class="status-badge${settled ? "" : " pending"}">${esc(summary.status)}</b></section>`;
}

function paymentMethod(model) {
  if (model.payments?.length) {
    return `<section class="method-row"><strong>Payment methods</strong>
      <span>${[...new Set(model.payments.map((payment) => methodName(payment.method)))].map(esc).join(", ")}</span>
      ${model.reference ? `<span>Reference ${esc(model.reference)}</span>` : ""}
    </section>`;
  }
  return `<section class="method-row"><strong>Payment method</strong>
    <span>${esc(methodName(model.method || model.payment?.accountName || model.payment?.accountId))}</span>
    ${model.reference ? `<span>Reference ${esc(model.reference)}</span>` : ""}
  </section>`;
}

function issuerAndQr(profile) {
  return `<section class="issuer-row keep-together">${issuer(profile)}${qrMarkup(profile)}</section>`;
}

function receiptContent(model, profile, format) {
  const summary = receiptSummary(model);
  const descriptions = receiptLines(model);
  const forBlock = descriptions
    ? `<section class="doc-description"><h2>For</h2>${descriptions}</section>`
    : "";
  const included = includedPayments(model);
  return `${ribbonMarkup(profile, model, "Receipt", format)}
    <div class="doc-content">${recipient(model, "Received from")}
      ${forBlock}${included}${amountReceived(summary)}${receiptFinancials(summary)}
      ${paymentMethod(model)}${paymentDetails(profile)}${issuerAndQr(profile)}
      <p class="doc-thanks">Thank you for your business.</p>
      ${footer(model, profile)}
    </div>`;
}

function invoiceTable(model, format) {
  if (format === "thermal58") {
    return `<section class="thermal-invoice-lines">${(model.items || []).map((item) => `
      <div class="thermal-invoice-line"><span>${esc(item.title || "")}</span>
        <b>${formatDocumentMoney(item.amount)}</b></div>`).join("")}</section>`;
  }
  return `<table class="invoice-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead>
    <tbody>${(model.items || []).map((item) => `<tr>
      <td>${esc(item.title || "")}</td><td>${formatDocumentMoney(item.amount)}</td>
    </tr>`).join("")}</tbody></table>`;
}

function invoiceContent(model, profile, format) {
  const summary = invoiceSummary(model);
  const totals = `<section class="invoice-totals financial-summary">
    <div class="financial-row"><span>Total</span><b>${formatDocumentMoney(summary.total)}</b></div>
    <div class="financial-row"><span>Paid</span><b>${formatDocumentMoney(summary.paid)}</b></div>
    <div class="financial-row balance"><span>Balance due</span><b>${formatDocumentMoney(summary.balance)}</b></div>
  </section>`;
  const terms = profile.termsText
    ? `<section class="terms"><h2>Terms</h2><div class="terms-content">${esc(profile.termsText)}</div></section>`
    : "";
  return `${ribbonMarkup(profile, model, "Invoice", format)}
    <div class="doc-content">${recipient(model, "Billed to", summary.status)}${invoiceTable(model, format)}
      ${totals}${invoiceAmount(summary)}${paymentDetails(profile)}${terms}
      ${issuerAndQr(profile)}<p class="doc-thanks">Thank you for your business.</p>
      ${footer(model, profile)}
    </div>`;
}

function titleFile(type, model) {
  const number = String(model.number || "Document").replace(/[^\p{L}\p{N}-]+/gu, "-");
  const client = String(model.clientName || "Client").replace(/[^\p{L}\p{N}-]+/gu, "-");
  return `${type}-${number}-${client}`;
}

export function buildReceiptHtml(model, format = "a4", profile = {}) {
  const title = titleFile("Receipt", model);
  return documentPage(title, receiptContent(model, profile, format), format);
}

export function buildInvoiceHtml(model, format = "a4", profile = {}) {
  const title = titleFile("Invoice", model);
  return documentPage(title, invoiceContent(model, profile, format), format);
}

export { methodName as formatPaymentMethod, titleFile as documentFilename };
