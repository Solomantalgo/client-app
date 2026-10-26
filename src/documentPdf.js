import { jsPDF } from "jspdf";
import qrcode from "qrcode-generator";
import {
  documentFilename,
  formatDocumentMoney,
  formatPaymentMethod,
  invoiceSummary,
  receiptSummary,
} from "./documents.js";

const INK = [23, 23, 23];
const MUTED = [85, 85, 85];
const LINE = [218, 218, 218];
const LIME = [195, 255, 77];
const PAID = [237, 248, 217];
const PAPER_WIDTH = 210;
const MARGIN = 16;
const CONTENT_WIDTH = PAPER_WIDTH - MARGIN * 2;
const A4_BOTTOM = 270;

function setTextStyle(doc, size, bold = false, color = INK) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function wrapped(doc, value, width, size) {
  setTextStyle(doc, size);
  return doc.splitTextToSize(String(value ?? ""), width);
}

function drawWrapped(state, value, x, width, options = {}) {
  const size = options.size || 10;
  const lineHeight = options.lineHeight || 4.6;
  const color = options.color || INK;
  const lines = wrapped(state.doc, value, width, size);
  for (const line of lines) {
    state.ensure(lineHeight + 1);
    setTextStyle(state.doc, size, options.bold, color);
    state.doc.text(line, x, state.y);
    state.y += lineHeight;
  }
  return lines.length * lineHeight;
}

function createA4State(doc, model, type) {
  const state = {
    doc,
    y: 55,
    ensure(height) {
      if (this.y + height <= A4_BOTTOM) return;
      this.doc.addPage();
      this.y = 19;
      setTextStyle(this.doc, 9, true, MUTED);
      this.doc.text(`${type.toUpperCase()} CONTINUED · ${model.number || ""}`, MARGIN, this.y);
      this.y += 9;
      if (type === "Invoice") drawTableHeader(this);
    },
  };
  return state;
}

function drawA4Ribbon(doc, model, type, profile) {
  const x = MARGIN;
  const y = 15;
  const width = CONTENT_WIDTH;
  const height = 34;
  doc.setFillColor(32, 32, 32);
  doc.rect(x, y, width, height, "F");
  doc.setFillColor(...LIME);
  doc.rect(x, y, 3, height, "F");

  const logoEnabled = profile.showLogoA4 !== false && profile.logoDataUri;
  if (logoEnabled) {
    try {
      doc.addImage(profile.logoDataUri, "PNG", x + 8, y + 4, 56, 19, undefined, "FAST");
    } catch {
      setTextStyle(doc, 18, true, [255, 255, 255]);
      doc.text(profile.brandName || "Solomantalgo", x + 8, y + 16);
    }
  } else {
    setTextStyle(doc, 18, true, [255, 255, 255]);
    doc.text(profile.brandName || "Solomantalgo", x + 8, y + 16);
  }

  const details = [profile.tagline, profile.location, profile.website]
    .filter(Boolean)
    .join("  |  ");
  setTextStyle(doc, 8.5, false, [244, 244, 244]);
  doc.text(details, x + 8, y + 29, { maxWidth: 93 });

  const right = x + width - 8;
  setTextStyle(doc, type === "Receipt" ? 17 : 20, true, [255, 255, 255]);
  doc.text(type === "Receipt" ? "PAYMENT RECEIPT" : "INVOICE", right, y + 12, {
    align: "right",
  });
  setTextStyle(doc, 9.5, true, [255, 255, 255]);
  doc.text(model.number || "", right, y + 20, { align: "right" });
  setTextStyle(doc, 8.5, false, [244, 244, 244]);
  const metadata = type === "Receipt"
    ? []
    : [model.date && `Issued ${displayDate(model.date)}`, model.dueDate && `Due ${displayDate(model.dueDate)}`];
  metadata.filter(Boolean).forEach((line, index) => {
    doc.text(line, right, y + 26 + index * 4, { align: "right" });
  });
}

function displayDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function drawRecipient(state, model, label, status = "") {
  const { doc } = state;
  const y = state.y;
  setTextStyle(doc, 9, false, MUTED);
  doc.text(label, MARGIN, y);
  setTextStyle(doc, 13, true);
  const nameLines = doc.splitTextToSize(model.clientName || "", 95);
  doc.text(nameLines, MARGIN, y + 6);
  state.y = y + 6 + nameLines.length * 5.1;
  if (model.business) {
    state.y += drawWrapped(state, model.business, MARGIN, 95, {
      size: 10,
      color: MUTED,
    });
  }

  const rightX = MARGIN + CONTENT_WIDTH;
  const isReceipt = label === "Received from";
  setTextStyle(doc, 9, false, MUTED);
  doc.text(isReceipt ? "Date" : "Status", rightX, y, { align: "right" });
  setTextStyle(doc, 10, true);
  doc.text(isReceipt ? displayDate(model.date) : status, rightX, y + 6, { align: "right" });
  let rightY = y + 11;
  const references = isReceipt
    ? [model.invoiceNo ? `Invoice ref. ${model.invoiceNo}` : "",
      model.reference ? `Reference ${model.reference}` : ""]
    : [];
  for (const text of references.filter(Boolean)) {
    setTextStyle(doc, 9, false, MUTED);
    doc.text(text, rightX, rightY, { align: "right", maxWidth: 70 });
    rightY += 4.3;
  }
  state.y = Math.max(state.y, rightY) + 5;
  drawRule(state);
}

function drawRule(state, color = LINE, thickness = 0.25) {
  state.doc.setDrawColor(...color);
  state.doc.setLineWidth(thickness);
  state.doc.line(MARGIN, state.y, MARGIN + CONTENT_WIDTH, state.y);
  state.y += 4.5;
}

function drawSectionLabel(state, label) {
  setTextStyle(state.doc, 9, false, MUTED);
  state.doc.text(label, MARGIN, state.y);
  state.y += 5;
}

function drawDescriptionRows(state, rows, width = CONTENT_WIDTH) {
  if (!rows?.length) return;
  drawSectionLabel(state, "For");
  const amountWidth = 43;
  for (const row of rows) {
    const lines = wrapped(state.doc, row.title || "", width - amountWidth - 4, 10);
    const height = Math.max(5, lines.length * 4.7);
    state.ensure(height + 2);
    setTextStyle(state.doc, 10);
    state.doc.text(lines, MARGIN, state.y);
    setTextStyle(state.doc, 10, true);
    state.doc.text(formatDocumentMoney(row.amount), MARGIN + width, state.y, { align: "right" });
    state.y += height + 1.5;
  }
  state.y += 2;
  drawRule(state);
}

function drawBadge(doc, text, x, y, paid, thermal = false) {
  setTextStyle(doc, thermal ? 7 : 9, true, INK);
  const width = doc.getTextWidth(text) + (thermal ? 4 : 7);
  const height = thermal ? 6 : 8;
  if (paid && !thermal) {
    doc.setFillColor(...PAID);
    doc.setDrawColor(...PAID);
  } else {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...(thermal ? INK : LINE));
  }
  doc.roundedRect(x, y - height + 1, width, height, thermal ? 0 : 1, thermal ? 0 : 1, "FD");
  setTextStyle(doc, thermal ? 7 : 9, true, INK);
  doc.text(text, x + width / 2, y - height / 2 + 1, { align: "center" });
}

function drawHero(state, label, amount, status, paid) {
  const { doc } = state;
  state.ensure(24);
  setTextStyle(doc, 9.5, false, MUTED);
  doc.text(label, MARGIN, state.y);
  setTextStyle(doc, 29, true);
  doc.text(formatDocumentMoney(amount), MARGIN, state.y + 12);
  doc.setDrawColor(...LIME);
  doc.setLineWidth(1.4);
  doc.line(MARGIN, state.y + 16, MARGIN + 18, state.y + 16);
  setTextStyle(doc, 9, true, INK);
  const badgeWidth = doc.getTextWidth(status) + 7;
  drawBadge(doc, status, MARGIN + CONTENT_WIDTH - badgeWidth, state.y + 11, paid);
  state.y += 23;
  drawRule(state);
}

function drawFinancialRow(state, label, amount, options = {}) {
  const { doc } = state;
  state.ensure(options.balance ? 12 : 8);
  if (options.balance && options.paid) {
    doc.setFillColor(...PAID);
    doc.rect(MARGIN, state.y - 4.5, CONTENT_WIDTH, 10, "F");
  }
  setTextStyle(doc, options.balance ? 10 : 9.7, Boolean(options.balance));
  doc.text(label, MARGIN + (options.balance ? 2 : 0), state.y);
  doc.text(formatDocumentMoney(amount), MARGIN + CONTENT_WIDTH - (options.balance ? 2 : 0), state.y, {
    align: "right",
  });
  if (!options.balance) drawRule(state);
  else state.y += 7;
}

function drawIncludedPayments(state, payments = []) {
  if (!payments.length) return;
  state.ensure(16);
  drawSectionLabel(state, "Payments included");
  for (const payment of payments) {
    const label = `${displayDate(payment.date)} · ${formatPaymentMethod(payment.method)}`;
    const reference = payment.reference ? ` · Ref ${payment.reference}` : "";
    drawFinancialRow(state, `${label}${reference}`, payment.amount);
  }
}

function drawMethod(state, model) {
  const methods = model.payments?.length
    ? [...new Set(model.payments.map((payment) => formatPaymentMethod(payment.method)))]
    : [formatPaymentMethod(model.method || model.payment?.accountName || model.payment?.accountId)];
  const label = model.payments?.length ? "Payment methods" : "Payment method";
  state.ensure(10);
  setTextStyle(state.doc, 9, true);
  state.doc.text(label, MARGIN, state.y);
  drawWrapped(state, methods.join(", "), MARGIN + 32, CONTENT_WIDTH - 32, { size: 9 });
  state.y += 2;
  drawRule(state);
}

function drawPaymentDetails(state, profile) {
  const details = [];
  if (profile.bankName || profile.bankAccountName || profile.bankAccountNo) {
    details.push({
      title: "Bank transfer",
      lines: [profile.bankName, profile.bankAccountName, profile.bankAccountNo].filter(Boolean),
    });
  }
  if (profile.momoNumber || profile.momoName) {
    details.push({
      title: "Mobile Money (MTN)",
      lines: [profile.momoNumber, profile.momoName].filter(Boolean),
    });
  }
  if (!details.length) return;
  state.ensure(19);
  drawSectionLabel(state, "Payment details");
  const colWidth = (CONTENT_WIDTH - 6) / Math.min(details.length, 2);
  details.forEach((detail, index) => {
    const x = MARGIN + index * (colWidth + 6);
    setTextStyle(state.doc, 9.5, true);
    state.doc.text(detail.title, x, state.y);
    let detailY = state.y + 4.5;
    for (const line of detail.lines) {
      const lines = wrapped(state.doc, line, colWidth - 5, 9);
      setTextStyle(state.doc, 9);
      state.doc.text(lines, x, detailY);
      detailY += Math.max(4, lines.length * 4);
    }
  });
  state.y += 16;
  drawRule(state);
}

function drawTerms(state, terms) {
  if (!terms) return;
  state.ensure(14);
  drawSectionLabel(state, "Terms");
  drawWrapped(state, terms, MARGIN, CONTENT_WIDTH, { size: 9.5, lineHeight: 4.5 });
  state.y += 2;
}

function drawQr(doc, profile, x, y, size) {
  const destination = profile.qrUrl || `https://${profile.website || "solomantalgo.com"}`;
  const qr = qrcode(0, "M");
  qr.addData(destination);
  qr.make();
  const modules = qr.getModuleCount();
  const quiet = 4;
  const cell = size / (modules + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
  doc.setFillColor(...INK);
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.isDark(row, col)) {
        doc.rect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell, cell, "F");
      }
    }
  }
}

function drawIssuerAndQr(state, profile, format) {
  const thermal = format === "thermal58";
  const qrSize = thermal ? 19 : 24;
  if (!thermal) state.ensure(qrSize + 14);
  const top = state.y;
  const issuerWidth = CONTENT_WIDTH - qrSize - 10;
  if (profile.ownerName || profile.ownerTitle) {
    setTextStyle(state.doc, thermal ? 7.5 : 9, false, MUTED);
    state.doc.text("Issued by", MARGIN, state.y + 3);
    state.y += 8;
    if (profile.ownerName) {
      state.y += drawWrapped(state, profile.ownerName, MARGIN, issuerWidth, {
        size: thermal ? 9 : 11,
        bold: true,
        lineHeight: thermal ? 4 : 5,
      });
    }
    if (profile.ownerTitle) {
      state.y += drawWrapped(state, profile.ownerTitle, MARGIN, issuerWidth, {
        size: thermal ? 7.5 : 9,
        color: MUTED,
        lineHeight: 4.3,
      });
    }
  }
  const qrX = MARGIN + CONTENT_WIDTH - qrSize;
  drawQr(state.doc, profile, qrX, top, qrSize);
  setTextStyle(state.doc, thermal ? 6.8 : 7.5, false, MUTED);
  state.doc.text(`Scan to visit ${profile.website || "solomantalgo.com"}`, qrX + qrSize / 2, top + qrSize + 3, {
    align: "center",
  });
  state.y = Math.max(state.y, top + qrSize + (thermal ? 7 : 8));
}

function drawA4Receipt(doc, model, profile) {
  const summary = receiptSummary(model);
  drawA4Ribbon(doc, model, "Receipt", profile);
  const state = createA4State(doc, model, "Receipt");
  drawRecipient(state, model, "Received from");
  drawDescriptionRows(state, model.lines || []);
  drawHero(state, "Amount received", summary.received,
    summary.paidInFull ? "Paid in full" : "Partial payment", summary.paidInFull);
  drawFinancialRow(state, "Invoice total", summary.invoiceTotal);
  drawFinancialRow(state, "Previously paid", summary.previouslyPaid);
  drawFinancialRow(state, "Remaining balance", summary.balance, {
    balance: true,
    paid: summary.balance === 0,
  });
  drawIncludedPayments(state, model.payments);
  drawMethod(state, model);
  drawPaymentDetails(state, profile);
  drawIssuerAndQr(state, profile, "a4");
  drawThanks(state);
  return state;
}

function drawTableHeader(state) {
  setTextStyle(state.doc, 9, true, MUTED);
  state.doc.text("Description", MARGIN, state.y);
  state.doc.text("Amount", MARGIN + CONTENT_WIDTH, state.y, { align: "right" });
  state.y += 3;
  drawRule(state, MUTED, 0.4);
}

function drawInvoiceRows(state, model) {
  drawTableHeader(state);
  for (const item of model.items || []) {
    const lines = wrapped(state.doc, item.title || "", CONTENT_WIDTH - 47, 10);
    const height = Math.max(5, lines.length * 4.7);
    state.ensure(height + 4);
    setTextStyle(state.doc, 10);
    state.doc.text(lines, MARGIN, state.y);
    setTextStyle(state.doc, 10, true);
    state.doc.text(formatDocumentMoney(item.amount), MARGIN + CONTENT_WIDTH, state.y, {
      align: "right",
    });
    state.y += height + 1;
    drawRule(state);
  }
}

function drawA4Invoice(doc, model, profile) {
  const summary = invoiceSummary(model);
  drawA4Ribbon(doc, model, "Invoice", profile);
  const state = createA4State(doc, model, "Invoice");
  drawRecipient(state, model, "Billed to", invoiceSummary(model).status);
  drawInvoiceRows(state, model);
  drawFinancialRow(state, "Total", summary.total);
  drawFinancialRow(state, "Paid", summary.paid);
  drawHero(
    state,
    summary.balance > 0 ? "Balance due" : "Invoice total",
    summary.balance > 0 ? summary.balance : summary.total,
    summary.status,
    summary.paidInFull,
  );
  drawPaymentDetails(state, profile);
  drawTerms(state, profile.termsText);
  drawIssuerAndQr(state, profile, "a4");
  drawThanks(state);
  return state;
}

function drawThanks(state) {
  state.ensure(10);
  setTextStyle(state.doc, 9, false, MUTED);
  state.doc.text("Thank you for your business.", MARGIN, state.y + 4);
  state.y += 9;
}

function drawThermalHeader(doc, model, type, profile) {
  const width = 58;
  let y = 5;
  if (profile.showLogoThermal && profile.logoDataUri) {
    try {
      doc.addImage(profile.logoDataUri, "PNG", 13, y, 32, 11, undefined, "FAST");
      y += 13;
    } catch {
      setTextStyle(doc, 11, true);
      doc.text(profile.brandName || "Solomantalgo", width / 2, y + 4, { align: "center" });
      y += 8;
    }
  } else {
    setTextStyle(doc, 11, true);
    doc.text(profile.brandName || "Solomantalgo", width / 2, y + 4, { align: "center" });
    y += 8;
  }
  const details = [profile.tagline, profile.location, profile.website].filter(Boolean).join(" · ");
  setTextStyle(doc, 7.2);
  const detailLines = doc.splitTextToSize(details, 48);
  doc.text(detailLines, width / 2, y, { align: "center" });
  y += detailLines.length * 3.2 + 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.line(5, y, 53, y);
  y += 5;
  setTextStyle(doc, 11, true);
  doc.text(type === "Receipt" ? "PAYMENT RECEIPT" : "INVOICE", width / 2, y, { align: "center" });
  y += 4;
  setTextStyle(doc, 7.5, true);
  doc.text(model.number || "", width / 2, y, { align: "center" });
  y += 4;
  const meta = type === "Receipt"
    ? [displayDate(model.date), model.invoiceNo && `Invoice ref. ${model.invoiceNo}`]
    : [model.date && `Issued ${displayDate(model.date)}`, model.dueDate && `Due ${displayDate(model.dueDate)}`];
  setTextStyle(doc, 7.2);
  meta.filter(Boolean).forEach((line) => {
    doc.text(doc.splitTextToSize(line, 48), width / 2, y, { align: "center" });
    y += 3.5;
  });
  doc.line(5, y + 1, 53, y + 1);
  return y + 6;
}

function createThermalState(doc, y) {
  return {
    doc,
    y,
    ensure() {},
  };
}

function drawThermalReceipt(doc, model, profile) {
  const summary = receiptSummary(model);
  const state = createThermalState(doc, drawThermalHeader(doc, model, "Receipt", profile));
  const drawSmallRow = (label, value, bold = false) => {
    setTextStyle(doc, bold ? 8 : 7.5, bold);
    doc.text(label, 5, state.y);
    doc.text(formatDocumentMoney(value), 53, state.y, { align: "right" });
    state.y += 4.2;
  };
  setTextStyle(doc, 7);
  doc.text("RECEIVED FROM", 5, state.y);
  state.y += 4;
  state.y += drawWrapped(state, model.clientName || "", 5, 48, { size: 8.5, bold: true, lineHeight: 4 });
  if (model.business) state.y += drawWrapped(state, model.business, 5, 48, { size: 7.3, color: MUTED, lineHeight: 3.5 });
  state.y += drawWrapped(state, `Date: ${displayDate(model.date)}`, 5, 48, {
    size: 7.3,
    color: MUTED,
    lineHeight: 3.5,
  });
  if (model.invoiceNo) {
    state.y += drawWrapped(state, `Invoice ref. ${model.invoiceNo}`, 5, 48, {
      size: 7.3,
      color: MUTED,
      lineHeight: 3.5,
    });
  }
  if (model.reference) {
    state.y += drawWrapped(state, `Reference ${model.reference}`, 5, 48, {
      size: 7.3,
      color: MUTED,
      lineHeight: 3.5,
    });
  }
  state.y += 2;
  drawRule(state, INK, 0.3);
  if (model.lines?.length) {
    setTextStyle(doc, 7, false, MUTED);
    doc.text("FOR", 5, state.y);
    state.y += 4;
    for (const line of model.lines) {
      state.y += drawWrapped(state, line.title || "", 5, 48, { size: 7.5, lineHeight: 3.6 });
      drawSmallRow("", line.amount, true);
    }
    drawRule(state, INK, 0.3);
  }
  setTextStyle(doc, 7);
  doc.text("AMOUNT RECEIVED", 5, state.y);
  setTextStyle(doc, 16, true);
  doc.text(formatDocumentMoney(summary.received), 5, state.y + 8);
  drawBadge(doc, summary.paidInFull ? "PAID IN FULL" : "PARTIAL", 53, state.y + 8, false, true);
  state.y += 13;
  drawRule(state, INK, 0.3);
  drawSmallRow("Invoice total", summary.invoiceTotal);
  drawSmallRow("Previously paid", summary.previouslyPaid);
  drawSmallRow("Remaining balance", summary.balance, true);
  if (model.payments?.length) {
    drawRule(state, INK, 0.3);
    setTextStyle(doc, 7, true);
    doc.text("PAYMENTS INCLUDED", 5, state.y);
    state.y += 4;
    for (const payment of model.payments) {
      const label = `${displayDate(payment.date)} · ${formatPaymentMethod(payment.method)}`;
      state.y += drawWrapped(state, label, 5, 34, { size: 6.8, lineHeight: 3.2 });
      setTextStyle(doc, 7, true);
      doc.text(formatDocumentMoney(payment.amount), 53, state.y - 2, { align: "right" });
    }
  }
  drawRule(state, INK, 0.3);
  setTextStyle(doc, 7, true);
  doc.text("PAYMENT METHOD", 5, state.y);
  state.y += 4;
  state.y += drawWrapped(state, model.payments?.length
    ? [...new Set(model.payments.map((payment) => formatPaymentMethod(payment.method)))].join(", ")
    : formatPaymentMethod(model.method || model.payment?.accountName || model.payment?.accountId),
  5, 48, { size: 7.3, lineHeight: 3.5 });
  if (profile.bankName || profile.bankAccountName || profile.bankAccountNo || profile.momoNumber || profile.momoName) {
    state.y += 1;
    for (const value of [profile.bankName, profile.bankAccountName, profile.bankAccountNo,
      profile.momoNumber, profile.momoName].filter(Boolean)) {
      state.y += drawWrapped(state, value, 5, 48, { size: 6.8, lineHeight: 3.2 });
    }
  }
  state.y += 2;
  if (profile.ownerName) {
    setTextStyle(doc, 8, true);
    doc.text(profile.ownerName, 5, state.y);
    state.y += 4;
  }
  if (profile.ownerTitle) {
    state.y += drawWrapped(state, profile.ownerTitle, 5, 48, { size: 6.8, color: MUTED, lineHeight: 3.2 });
  }
  drawQr(doc, profile, 19.5, state.y, 19);
  setTextStyle(doc, 6.5, false, MUTED);
  doc.text(profile.website || "solomantalgo.com", 29, state.y + 22, { align: "center" });
  state.y += 27;
  setTextStyle(doc, 7, false, MUTED);
  doc.text("Thank you for your business.", 29, state.y, { align: "center" });
  state.y += 6;
  doc.setDrawColor(...LINE);
  doc.line(5, state.y, 53, state.y);
  state.y += 4;
  setTextStyle(doc, 6.5, false, MUTED);
  doc.text(`${model.number || ""} · ${profile.website || ""}`, 29, state.y, { align: "center" });
  state.y += 4;
  doc.internal.pageSize.setHeight(state.y + 4);
  return state;
}

function drawThermalInvoice(doc, model, profile) {
  const summary = invoiceSummary(model);
  const state = createThermalState(doc, drawThermalHeader(doc, model, "Invoice", profile));
  setTextStyle(doc, 7);
  doc.text("BILLED TO", 5, state.y);
  state.y += 4;
  state.y += drawWrapped(state, model.clientName || "", 5, 48, { size: 8.5, bold: true, lineHeight: 4 });
  if (model.business) state.y += drawWrapped(state, model.business, 5, 48, { size: 7.3, color: MUTED, lineHeight: 3.5 });
  state.y += 2;
  drawRule(state, INK, 0.3);
  for (const item of model.items || []) {
    state.y += drawWrapped(state, item.title || "", 5, 48, { size: 7.5, lineHeight: 3.7 });
    setTextStyle(doc, 7, true);
    doc.text(formatDocumentMoney(item.amount), 53, state.y, { align: "right" });
    state.y += 4;
  }
  drawRule(state, INK, 0.3);
  const row = (label, amount, bold = false) => {
    setTextStyle(doc, bold ? 8 : 7.5, bold);
    doc.text(label, 5, state.y);
    doc.text(formatDocumentMoney(amount), 53, state.y, { align: "right" });
    state.y += 4.2;
  };
  row("Total", summary.total);
  row("Paid", summary.paid);
  row("Balance due", summary.balance, true);
  drawRule(state, INK, 0.3);
  setTextStyle(doc, 7, true);
  doc.text("STATUS", 5, state.y);
  state.y += 4;
  state.y += drawWrapped(state, summary.status, 5, 48, { size: 7.3, lineHeight: 3.5 });
  if (profile.bankName || profile.bankAccountName || profile.bankAccountNo || profile.momoNumber || profile.momoName) {
    drawRule(state, INK, 0.3);
    for (const value of [profile.bankName, profile.bankAccountName, profile.bankAccountNo,
      profile.momoNumber, profile.momoName].filter(Boolean)) {
      state.y += drawWrapped(state, value, 5, 48, { size: 6.8, lineHeight: 3.2 });
    }
  }
  if (profile.termsText) {
    drawRule(state, INK, 0.3);
    setTextStyle(doc, 7, true);
    doc.text("TERMS", 5, state.y);
    state.y += 4;
    state.y += drawWrapped(state, profile.termsText, 5, 48, { size: 6.8, lineHeight: 3.2 });
  }
  state.y += 2;
  if (profile.ownerName) {
    setTextStyle(doc, 8, true);
    doc.text(profile.ownerName, 5, state.y);
    state.y += 4;
  }
  drawQr(doc, profile, 19.5, state.y, 19);
  state.y += 24;
  setTextStyle(doc, 7, false, MUTED);
  doc.text("Thank you for your business.", 29, state.y, { align: "center" });
  state.y += 6;
  setTextStyle(doc, 6.5, false, MUTED);
  doc.text(`${model.number || ""} · ${profile.website || ""}`, 29, state.y, { align: "center" });
  state.y += 4;
  doc.internal.pageSize.setHeight(state.y + 4);
  return state;
}

function addA4Footers(doc, model, profile) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const y = 288;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y - 3, MARGIN + CONTENT_WIDTH, y - 3);
    setTextStyle(doc, 8.5, false, MUTED);
    doc.text(model.number || "", MARGIN, y);
    doc.text(`${profile.brandName || "Solomantalgo"} · ${profile.website || ""}`, PAPER_WIDTH / 2, y, {
      align: "center",
    });
    doc.text(`Page ${page} of ${pages}`, PAPER_WIDTH - MARGIN, y, { align: "right" });
  }
}

export async function createDocumentPdf(model, docType, format, profile = {}) {
  const thermal = format === "thermal58";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: thermal ? [58, 1000] : "a4",
    compress: false,
    putOnlyUsedFonts: true,
  });
  const title = documentFilename(docType, model);
  doc.setProperties({ title, subject: `${docType} ${model.number || ""}` });

  if (thermal) {
    if (docType === "Receipt") drawThermalReceipt(doc, model, profile);
    else drawThermalInvoice(doc, model, profile);
  } else {
    if (docType === "Receipt") drawA4Receipt(doc, model, profile);
    else drawA4Invoice(doc, model, profile);
    addA4Footers(doc, model, profile);
  }

  return doc.output("blob");
}
