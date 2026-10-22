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

const cash = (value) => `UGX ${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-UG")}`;
const methodName = (value) => ({
  cash: "Cash",
  bank: "Bank",
  "mobile-money": "MTN MoMo",
  momo: "MTN MoMo",
}[String(value || "").toLowerCase()] || value || "Not specified");

function qrMarkup(profile) {
  const website = profile.qrUrl || `https://${profile.website || "solomantalgo.com"}`;
  const qr = qrcode(0, "M");
  qr.addData(website);
  qr.make();
  const svg = qr.createSvgTag(4, 0).replace(/<\?xml[^>]*>/, "");
  return `<div class="qr">${svg}</div>`;
}

function fontMarkup(profile) {
  const declarations = [profile.font400Url, profile.font500Url]
    .filter(Boolean)
    .map((url, index) => `@font-face{font-family:'DM Mono';font-weight:${index ? 500 : 400};src:url('${esc(url)}') format('woff2');}`)
    .join("");
  return `<style>${declarations}</style>`;
}

function logoMarkup(profile, format) {
  const enabled = format === "a4" ? profile.showLogoA4 !== false : profile.showLogoThermal === true;
  return enabled && profile.logoDataUri ? `<img class="logo" src="${esc(profile.logoDataUri)}" alt="">` : "";
}

function brand(profile, format) {
  return `<header class="brand">${logoMarkup(profile, format)}<b>${esc(profile.brandName || "Solomantalgo")}</b>
<strong>${esc(profile.tagline || "Web Design")}</strong><span>${esc(profile.location || "Kampala, Uganda")}</span>
<span>${esc(profile.website || "solomantalgo.com")}</span></header>`;
}

function paymentDetails(profile) {
  const rows = [];
  if (profile.bankName || profile.bankAccountName || profile.bankAccountNo) {
    rows.push(`<b>Bank Transfer</b>${profile.bankName ? `<div>${esc(profile.bankName)}</div>` : ""}
${profile.bankAccountName ? `<div>Account Name: ${esc(profile.bankAccountName)}</div>` : ""}
${profile.bankAccountNo ? `<div>Account No: ${esc(profile.bankAccountNo)}</div>` : ""}`);
  }
  if (profile.momoNumber || profile.momoName) {
    rows.push(`<b>Mobile Money (MTN)</b>${profile.momoNumber ? `<div>Number: ${esc(profile.momoNumber)}</div>` : ""}
${profile.momoName ? `<div>Name: ${esc(profile.momoName)}</div>` : ""}`);
  }
  return rows.length ? `<section class="payment-details"><label>PAYMENT DETAILS</label>${rows.join("<div class='detail-gap'></div>")}</section>` : "";
}

function signature(profile) {
  return `<section class="signature"><b>${esc(profile.ownerName || "")}</b>
<span>${esc(profile.ownerTitle || "")}</span></section>`;
}

function styles(format) {
  const base = `*{color:#000!important;background:#fff!important;box-sizing:border-box}
html,body{margin:0;font-family:'DM Mono','Courier New',monospace;color:#000;background:#fff}
.brand,.c{text-align:center}.brand{display:flex;align-items:center;flex-direction:column;gap:2px}
.brand b,.brand strong{font-size:1.15em}.logo{object-fit:contain;max-width:100%;height:18mm}
.rule{border-top:3px solid #000;margin:12px 0}.thin{border-width:1px;margin:8px 0}
.doc-title{text-align:center;font-size:1.5em;font-weight:700;letter-spacing:.08em}
.doc-meta{text-align:center;line-height:1.8}.block{margin:12px 0}.label{font-size:.78em;letter-spacing:.08em}
.row{display:flex;justify-content:space-between;gap:8px;padding:4px 0}.row b,.grand{font-weight:700}
.lines{margin:10px 0}.line{display:flex;justify-content:space-between;gap:8px;padding:5px 0}
.line-name{min-width:0;overflow-wrap:anywhere}.stamp{border:2px solid #000;text-align:center;padding:8px;font-weight:700;margin:14px 0}
.signature{display:flex;flex-direction:column;gap:3px;margin-top:18px}.qr{text-align:center;margin:12px auto}.qr svg{width:30mm;height:30mm}
.qr svg path{fill:#000!important}.detail-gap{height:7px}.wrap{overflow-wrap:anywhere}.included{margin:10px 0}`;
  if (format === "thermal58") return `@page{size:58mm auto;margin:0}html,body{width:58mm;margin:0}
body{width:48mm;padding:3mm 5mm 8mm;font:9px/1.35 'DM Mono','Courier New',monospace}
${base.replace("height:18mm", "height:12mm").replace("width:30mm;height:30mm", "width:26mm;height:26mm")}
.brand{gap:1px}.rule{margin:7px 0}.thin{margin:5px 0}.doc-title{font-size:1.35em}
.block{margin:8px 0}.label{font-size:7px}.row{padding:2px 0}.line{display:block;padding:3px 0}
.line .amount{display:block;text-align:right}.stamp{padding:3px;margin:6px 0}.qr{margin:7px auto}`;
  return `@page{size:A4;margin:16mm}body{max-width:170mm;margin:0 auto;padding:0;font:12.5px/1.55 'DM Mono','Courier New',monospace}
${base}.brand{gap:4px}.logo{height:18mm}.rule{margin:20px 0}.thin{margin:12px 0}
.doc-title{font-size:23px}.block{margin:18px 0}.label{font-size:9px}.row{padding:8px 0}
.line{padding:8px 0}.stamp{padding:12px;margin:24px auto}.qr{margin:22px auto}.qr svg{width:30mm;height:30mm}`;
}

function page(title, content, format, profile) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${fontMarkup(profile)}
<style>${styles(format)}</style></head><body>${content}</body></html>`;
}

function titleFile(type, number, name) {
  return `${type}-${number}-${String(name || "Client").replace(/[^\p{L}\p{N}-]+/gu, "-")}`;
}

function clientBlock(model) {
  return `<section class="block"><label class="label">${model.docType === "Receipt" ? "RECEIVED FROM" : "BILLED TO"}</label>
<div><b>${esc(model.clientName)}</b></div><div>${esc(model.business || "")}</div></section>`;
}

function linesBlock(items) {
  return `<section class="lines">${(items || []).map((item) => `<div class="line">
<div class="line-name">${esc(item.title)}</div><b class="amount">${cash(item.amount)}</b></div>`).join("")}</section>`;
}

export function buildReceiptHtml(model, format = "a4", profile = {}) {
  const total = Number(model.total ?? (model.lines || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0));
  const received = Math.max(0, Number(model.received ?? total));
  const previous = Math.max(0, Number(model.previouslyPaid) || 0);
  const balance = Math.max(0, Number(model.invoiceTotal || 0) - previous - received);
  const method = methodName(model.method || model.payment?.accountName || model.payment?.accountId);
  const invoiceRef = model.invoiceNo ? `<div>Ref Invoice: ${esc(model.invoiceNo)}</div>` : "";
  const included = model.payments?.length ? `<section class="included"><b>PAYMENTS INCLUDED</b>${model.payments.map((payment) =>
    `<div class="row"><span>${esc(payment.date)} · ${esc(methodName(payment.method))}</span><b>${cash(payment.amount)}</b></div>`).join("")}</section>` : "";
  const paidFull = balance === 0 && model.invoiceTotal > 0;
  const content = `${brand(profile, format)}<div class="rule"></div><div class="doc-title">RECEIPT</div>
<div class="doc-meta"><b>${esc(model.number || "")}</b><div>Date: ${esc(model.date || "")}</div>${invoiceRef}</div>
<div class="rule thin"></div>${clientBlock({ ...model, docType: "Receipt" })}${included}
${model.lines?.length ? linesBlock(model.lines) : ""}<div class="row"><span>Invoice Total</span><b>${cash(model.invoiceTotal || model.total)}</b></div>
<div class="row"><span>Previously Paid</span><span>${cash(previous)}</span></div><div class="rule thin"></div>
<div class="row grand"><span>AMOUNT RECEIVED</span><b>${cash(received)}</b></div><div class="rule thin"></div>
<div class="row grand"><span>REMAINING BALANCE</span><b>${cash(balance)}</b></div><section class="block">
<label class="label">PAYMENT METHOD</label><div><b>${esc(method)}</b></div></section>${paymentDetails(profile)}
<div class="stamp">${paidFull ? "PAID IN FULL" : "PARTIAL PAYMENT"}</div>${balance ? `<div class="c"><b>BALANCE DUE ${cash(balance)}</b></div>` : ""}
${signature(profile)}${qrMarkup(profile)}<div class="c">${esc(profile.website || "solomantalgo.com")}</div>
<div class="c block">Thank you for your business.</div>`;
  return page(titleFile("Receipt", model.number || "", model.clientName), content, format, profile);
}

export function buildInvoiceHtml(model, format = "a4", profile = {}) {
  const total = Math.max(0, Number(model.total) || 0);
  const paid = Math.max(0, Number(model.paid) || 0);
  const balance = Math.max(0, total - paid);
  const dueDate = model.dueDate || "";
  const content = `${brand(profile, format)}<div class="rule"></div><div class="doc-title">INVOICE</div>
<div class="doc-meta"><b>${esc(model.number || "")}</b><div>Issue date: ${esc(model.date || "")}</div>
<div>Due date: ${esc(dueDate)}</div></div><div class="rule thin"></div>${clientBlock({ ...model, docType: "Invoice" })}
${linesBlock(model.items || [])}<div class="rule thin"></div><div class="row"><span>Total</span><b>${cash(total)}</b></div>
<div class="row"><span>Paid</span><span>${cash(paid)}</span></div><div class="row grand"><span>BALANCE DUE</span><b>${cash(balance)}</b></div>
<div class="stamp">${esc(model.stamp || (balance === 0 ? "PAID IN FULL" : paid ? "PARTIAL PAYMENT" : "AWAITING PAYMENT"))}</div>
${paymentDetails(profile)}${profile.termsText ? `<section class="block"><label class="label">TERMS</label><div class="wrap">${esc(profile.termsText)}</div></section>` : ""}
${signature(profile)}${qrMarkup(profile)}<div class="c">${esc(profile.website || "solomantalgo.com")}</div>`;
  return page(titleFile("Invoice", model.number || "", model.clientName), content, format, profile);
}
