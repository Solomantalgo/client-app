import { jsPDF } from "jspdf";
import { buildMonthCsv, classifyEarning, monthDateRange } from "./earnings.js";

const REPORT_INK = "29252D";
const REPORT_VIOLET = "A984D6";
const REPORT_LIME = "C3FF4D";
const REPORT_MUTED = "706A76";

export function createMonthlyReportModel({
  month,
  summary,
  transactions,
  year,
  filterLabel = "All",
  profile = {},
  generatedAt = new Date().toISOString().slice(0, 10),
}) {
  return {
    title: "Monthly earnings",
    month,
    range: monthDateRange(month),
    currency: "UGX",
    basis: "Cash received date",
    filterLabel,
    summary,
    transactions: (transactions || []).map((transaction) => {
      const classification = classifyEarning(transaction);
      const reportClassification =
        transaction.type === "expense"
          ? "Expense"
          : classification === "earned"
            ? "Earned"
            : classification === "other"
              ? "Other received"
              : "Unclassified";
      return { ...transaction, reportClassification };
    }),
    trend: (year?.months || []).filter((item) => !item.future),
    profile,
    generatedAt,
  };
}

export function monthlyReportFilename(month, extension) {
  return `solomantalgo-monthly-earnings-${month}.${extension}`;
}

export function buildMonthlyCsv(report) {
  const csv = buildMonthCsv(report.summary, report.range, {
    transactions: report.transactions,
    filterLabel: report.filterLabel,
  });
  const title = `"Report title","${report.title}"\r\n`;
  const generated = `"Generated","${report.generatedAt}"\r\n`;
  return `${title}${generated}${csv}`;
}

function formatMoney(value) {
  return `UGX ${Math.round(Number(value) || 0).toLocaleString("en-UG")}`;
}

function reportMonthLabel(month) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-UG", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  }).format(new Date(Date.UTC(year, number - 1, 15)));
}

function text(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ");
}

function sourceBreakdown(report) {
  return report.summary.bySource || [];
}

export function buildMonthlyPdf(report) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const page = { width: 210, height: 297, margin: 15 };
  const contentWidth = page.width - page.margin * 2;
  let y = page.margin;

  const addPageIfNeeded = (height = 8) => {
    if (y + height <= page.height - page.margin) return;
    doc.addPage();
    y = page.margin;
  };

  const setFont = (style = "normal", size = 10) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };

  const line = (x1, y1, x2, y2, color = "D8D3DD", width = 0.25) => {
    doc.setDrawColor(`#${color}`);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };

  const profile = report.profile || {};
  doc.setFillColor(`#${REPORT_INK}`);
  doc.rect(page.margin, y, contentWidth, 31, "F");
  doc.setFillColor(`#${REPORT_VIOLET}`);
  doc.rect(page.margin, y, 2.5, 31, "F");
  let brandX = page.margin + 8;
  let logoEmbedded = false;
  if (profile.showLogoA4 !== false && profile.logoDataUri) {
    try {
      doc.addImage(
        profile.logoDataUri,
        "PNG",
        brandX,
        y + 4,
        45,
        12,
        undefined,
        "FAST",
      );
      logoEmbedded = true;
      brandX += 49;
    } catch {
      brandX = page.margin + 8;
    }
  }
  if (!logoEmbedded) {
    setFont("bold", 14);
    doc.setTextColor("FFFFFF");
    doc.text(text(profile.brandName || "Solomantalgo"), brandX, y + 12);
  }
  setFont("normal", 8);
  doc.setTextColor("DAD4E0");
  const brandLine = [profile.tagline, profile.location, profile.website]
    .filter(Boolean)
    .join(" · ");
  doc.text(doc.splitTextToSize(brandLine, 100), brandX, y + 18);
  setFont("bold", 18);
  doc.setTextColor(`#${REPORT_VIOLET}`);
  doc.text("MONTHLY EARNINGS", page.width - page.margin - 4, y + 12, {
    align: "right",
  });
  setFont("normal", 8);
  doc.setTextColor("FFFFFF");
  doc.text(
    reportMonthLabel(report.month),
    page.width - page.margin - 4,
    y + 20,
    {
      align: "right",
    },
  );
  doc.text(
    `Generated ${report.generatedAt}`,
    page.width - page.margin - 4,
    y + 25,
    {
      align: "right",
    },
  );
  y += 39;

  const summaryItems = [
    ["Earned", report.summary.earned],
    ["Other received", report.summary.otherReceived],
    ["Unclassified", report.summary.unclassified],
    ["Expenses", report.summary.expenses],
    ["After expenses · not profit", report.summary.afterExpenses],
  ];
  const boxGap = 3;
  const boxWidth = (contentWidth - boxGap * 2) / 3;
  summaryItems.forEach(([label, amount], index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = page.margin + col * (boxWidth + boxGap);
    const top = y + row * 23;
    addPageIfNeeded(24);
    doc.setFillColor(index === 0 ? "302A35" : "F2EFF4");
    doc.roundedRect(x, top, boxWidth, 20, 2.5, 2.5, "F");
    setFont("normal", 8);
    doc.setTextColor(index === 0 ? "E7DDF1" : `#${REPORT_MUTED}`);
    doc.text(text(label), x + 4, top + 6);
    setFont("bold", 11);
    doc.setTextColor(index === 0 ? `#${REPORT_LIME}` : `#${REPORT_INK}`);
    doc.text(formatMoney(amount), x + 4, top + 14);
  });
  y += 49;

  setFont("normal", 8);
  doc.setTextColor(`#${REPORT_MUTED}`);
  doc.text(
    `Date range ${report.range.start} to ${report.range.end} · Currency ${report.currency} · Basis ${report.basis}`,
    page.margin,
    y,
  );
  y += 8;
  if (report.filterLabel && report.filterLabel !== "All") {
    doc.text(`Transaction filter: ${text(report.filterLabel)}`, page.margin, y);
    y += 6;
  }

  const drawSectionTitle = (title) => {
    addPageIfNeeded(12);
    setFont("bold", 12);
    doc.setTextColor(`#${REPORT_INK}`);
    doc.text(title, page.margin, y + 4);
    line(
      page.margin,
      y + 7,
      page.width - page.margin,
      y + 7,
      REPORT_VIOLET,
      0.65,
    );
    y += 12;
  };

  const breakdown = sourceBreakdown(report);
  if (breakdown.length) {
    drawSectionTitle("Earnings breakdown");
    breakdown.forEach((item) => {
      addPageIfNeeded(7);
      setFont("normal", 9);
      doc.setTextColor(`#${REPORT_INK}`);
      doc.text(text(item.source), page.margin + 1, y);
      setFont("bold", 9);
      doc.text(formatMoney(item.amount), page.width - page.margin, y, {
        align: "right",
      });
      y += 6;
      line(page.margin, y - 2, page.width - page.margin, y - 2);
    });
    y += 4;
  }

  drawSectionTitle(`Transactions (${report.transactions.length})`);
  const colX = {
    date: page.margin,
    classification: page.margin + 25,
    detail: page.margin + 53,
    amount: page.width - page.margin,
  };
  const drawTableHeader = () => {
    doc.setFillColor("EEEAF1");
    doc.rect(page.margin, y - 4, contentWidth, 8, "F");
    setFont("bold", 8);
    doc.setTextColor(`#${REPORT_INK}`);
    doc.text("Date", colX.date + 2, y + 1);
    doc.text("Report class", colX.classification, y + 1);
    doc.text("Description · source · account", colX.detail, y + 1);
    doc.text("Amount UGX", colX.amount - 1, y + 1, { align: "right" });
    y += 7;
  };
  drawTableHeader();

  for (const transaction of report.transactions) {
    const description = [
      transaction.clientName || transaction.description || "Transaction",
      transaction.serviceName,
      transaction.sourceType,
      transaction.accountName || transaction.accountId || "Not assigned",
    ]
      .filter(Boolean)
      .join(" · ");
    setFont("normal", 8.5);
    const descriptionLines = doc.splitTextToSize(description, 82);
    const rowHeight = Math.max(7, descriptionLines.length * 4.1 + 2);
    addPageIfNeeded(rowHeight + 2);
    if (y === page.margin) drawTableHeader();
    doc.setTextColor(`#${REPORT_INK}`);
    doc.text(
      text(transaction.reportDate || transaction.date || ""),
      colX.date,
      y,
    );
    doc.text(text(transaction.reportClassification), colX.classification, y);
    doc.text(descriptionLines, colX.detail, y);
    setFont("bold", 8.5);
    doc.text(
      Math.round(Number(transaction.amount) || 0).toLocaleString("en-UG"),
      colX.amount,
      y,
      { align: "right" },
    );
    y += rowHeight;
    line(page.margin, y - 2, page.width - page.margin, y - 2);
  }
  if (!report.transactions.length) {
    setFont("normal", 9);
    doc.setTextColor(`#${REPORT_MUTED}`);
    doc.text("No transactions match this report filter.", page.margin, y + 2);
    y += 8;
  }

  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    const footerY = page.height - 9;
    line(page.margin, footerY - 4, page.width - page.margin, footerY - 4);
    setFont("normal", 8);
    doc.setTextColor(`#${REPORT_MUTED}`);
    doc.text(
      `${text(profile.brandName || "Solomantalgo")} · ${text(profile.website || "")} · ${report.month}`,
      page.margin,
      footerY,
    );
    doc.text(
      `Page ${index} of ${totalPages}`,
      page.width - page.margin,
      footerY,
      {
        align: "right",
      },
    );
  }

  return doc.output("blob");
}

function imageBytes(dataUri) {
  const encoded = String(dataUri).split(",")[1] || "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function logoDimensions(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const ratio = height && width ? width / height : 4;
  return { width: Math.min(160, 32 * ratio), height: 32 };
}

export async function buildMonthlyDocx(report) {
  const {
    BorderStyle,
    Document,
    Footer,
    HeadingLevel,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");
  const violet = "8D65B5";
  const ink = "29252D";
  const line = { style: BorderStyle.SINGLE, size: 1, color: "D8D3DD" };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cell = (content, options = {}) =>
    new TableCell({
      children: Array.isArray(content)
        ? content
        : [new Paragraph(String(content))],
      width: { size: options.width || 100, type: WidthType.PERCENTAGE },
      shading: options.fill
        ? { type: ShadingType.CLEAR, color: "auto", fill: options.fill }
        : undefined,
      borders: {
        top: options.border || noBorder,
        bottom: options.border || noBorder,
        left: noBorder,
        right: noBorder,
      },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      verticalAlign: "center",
    });
  const p = (value, options = {}) =>
    new Paragraph({
      heading: options.heading,
      alignment: options.alignment,
      spacing: { before: options.before || 0, after: options.after ?? 80 },
      children: [
        new TextRun({
          text: text(value),
          bold: Boolean(options.bold),
          color: options.color || ink,
          size: options.size || 21,
          font: "Arial",
        }),
      ],
    });
  const label = (value) =>
    p(value, {
      size: 17,
      bold: true,
      color: violet,
      after: 120,
      heading: HeadingLevel.HEADING_2,
    });
  const summaryRows = [
    ["Earned", report.summary.earned],
    ["Other money received", report.summary.otherReceived],
    ["Unclassified received", report.summary.unclassified],
    ["Expenses", report.summary.expenses],
    ["After expenses · not profit", report.summary.afterExpenses],
  ];
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4800, 4800],
    rows: summaryRows.map(
      ([name, amount]) =>
        new TableRow({
          children: [
            cell(name, { border: line }),
            cell(formatMoney(amount), { border: line }),
          ],
        }),
    ),
  });
  const transactionRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell("Date", { fill: "EEEAF1", border: line }),
        cell("Type", { fill: "EEEAF1", border: line }),
        cell("Description · source · account", {
          fill: "EEEAF1",
          border: line,
        }),
        cell("Amount UGX", { fill: "EEEAF1", border: line }),
      ],
    }),
    ...report.transactions.map((transaction) => {
      const description = [
        transaction.clientName || transaction.description || "Transaction",
        transaction.serviceName,
        transaction.sourceType,
        transaction.accountName || transaction.accountId || "Not assigned",
      ]
        .filter(Boolean)
        .join(" · ");
      return new TableRow({
        cantSplit: true,
        children: [
          cell(transaction.reportDate || transaction.date || "", {
            border: line,
          }),
          cell(transaction.reportClassification, { border: line }),
          cell(description, { border: line }),
          cell(
            Math.round(Number(transaction.amount) || 0).toLocaleString("en-UG"),
            {
              border: line,
            },
          ),
        ],
      });
    }),
  ];
  if (!report.transactions.length) {
    transactionRows.push(
      new TableRow({
        children: [
          cell("", { border: line }),
          cell("", { border: line }),
          cell("No transactions match this report filter.", { border: line }),
          cell("", { border: line }),
        ],
      }),
    );
  }
  const transactionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [1600, 1500, 5300, 2000],
    rows: transactionRows,
  });
  const headerChildren = [];
  if (report.profile?.showLogoA4 !== false && report.profile?.logoDataUri) {
    try {
      const bytes = imageBytes(report.profile.logoDataUri);
      headerChildren.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: bytes,
              transformation: logoDimensions(bytes),
            }),
          ],
        }),
      );
    } catch {
      headerChildren.push(
        p(report.profile.brandName || "Solomantalgo", { bold: true }),
      );
    }
  } else {
    headerChildren.push(
      p(report.profile?.brandName || "Solomantalgo", { bold: true }),
    );
  }
  headerChildren.push(
    p("Monthly earnings", {
      size: 36,
      bold: true,
      color: violet,
      heading: HeadingLevel.HEADING_1,
    }),
  );
  headerChildren.push(
    p(reportMonthLabel(report.month), { size: 26, bold: true }),
  );
  headerChildren.push(
    p(
      `Date range ${report.range.start} to ${report.range.end} · Currency ${report.currency}`,
    ),
  );
  headerChildren.push(
    p(`Generated ${report.generatedAt} · Basis ${report.basis}`),
  );
  if (report.filterLabel && report.filterLabel !== "All") {
    headerChildren.push(
      p(`Transaction filter: ${report.filterLabel}`, { color: violet }),
    );
  }
  headerChildren.push(label("Summary"), summaryTable);
  if (sourceBreakdown(report).length) {
    headerChildren.push(label("Earnings breakdown"));
    headerChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: sourceBreakdown(report).map(
          (item) =>
            new TableRow({
              children: [
                cell(item.source, { border: line }),
                cell(formatMoney(item.amount), { border: line }),
              ],
            }),
        ),
      }),
    );
  }
  headerChildren.push(
    label(`Transactions (${report.transactions.length})`),
    transactionTable,
  );
  const brand = text(report.profile?.brandName || "Solomantalgo");
  const website = text(report.profile?.website || "");
  const doc = new Document({
    creator: brand,
    title: `${brand} monthly earnings ${report.month}`,
    subject: "Monthly earnings report",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 21, color: ink },
          paragraph: { spacing: { after: 80 } },
        },
        heading1: {
          run: { font: "Arial", size: 36, bold: true, color: violet },
          paragraph: { outlineLevel: 0, spacing: { before: 200, after: 100 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              p(`${brand}${website ? ` · ${website}` : ""} · ${report.month}`, {
                size: 16,
                color: REPORT_MUTED,
              }),
            ],
          }),
        },
        children: headerChildren,
      },
    ],
  });
  return Packer.toBlob(doc);
}
