import { jsPDF } from "jspdf";
import JSZip from "jszip";
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

const xmlEscape = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

function excelColumn(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function excelTextCell(reference, value, style = 0) {
  const textValue = xmlEscape(value);
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${textValue}</t></is></c>`;
}

function excelNumberCell(reference, value, style = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return excelTextCell(reference, value, style);
  return `<c r="${reference}" s="${style}"><v>${amount}</v></c>`;
}

function excelRow(number, cells, height) {
  const heightAttribute = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${number}"${heightAttribute}>${cells.join("")}</row>`;
}

function excelWorksheet({ rows, widths, freezeRows = 0, filterRange = "" }) {
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const pane = freezeRows
    ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRows + 1}" sqref="A${freezeRows + 1}"/>`
    : "";
  const autoFilter = filterRange ? `<autoFilter ref="${filterRange}"/>` : "";
  const lastRow = rows.length;
  const lastColumn = excelColumn(widths.length - 1);
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="20"/><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>${autoFilter}` +
    `<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>` +
    `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><printOptions horizontalCentered="1"/>` +
    `</worksheet>`
  );
}

function monthlyExcelStyles() {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;UGX&quot; #,##0;[Red]-&quot;UGX&quot; #,##0"/></numFmts>` +
    `<fonts count="4"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Aptos Display"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF29252D"/><sz val="11"/><name val="Aptos"/></font></fonts>` +
    `<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF29252D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFA984D6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F0F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBFAFC"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color rgb="FFC3FF4D"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="9">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>` +
    `<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
    `<xf numFmtId="164" fontId="0" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>` +
    `<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  );
}

function monthlySummarySheet(report) {
  const widthCount = 6;
  const rows = [];
  const fillBand = (rowNumber, label, style = 1) =>
    excelRow(
      rowNumber,
      [
        excelTextCell(`A${rowNumber}`, label, style),
        ...Array.from({ length: widthCount - 1 }, (_, index) =>
          excelTextCell(`${excelColumn(index + 1)}${rowNumber}`, "", style),
        ),
      ],
      28,
    );
  rows.push(fillBand(1, "Solomantalgo · Monthly earnings"));
  rows.push(
    excelRow(
      2,
      [
        excelTextCell("A2", "Period", 8),
        excelTextCell("B2", `${report.range.start} to ${report.range.end}`),
        excelTextCell("C2", "Generated", 8),
        excelTextCell("D2", report.generatedAt),
        excelTextCell("E2", "Currency", 8),
        excelTextCell("F2", report.currency),
      ],
      24,
    ),
  );
  rows.push(
    excelRow(
      3,
      [
        excelTextCell("A3", "Report basis", 8),
        excelTextCell("B3", report.basis),
        excelTextCell("C3", "Active filter", 8),
        excelTextCell("D3", report.filterLabel || "All"),
      ],
      24,
    ),
  );
  rows.push(excelRow(4, []));
  rows.push(fillBand(5, "Monthly summary", 2));
  const summaryItems = [
    ["Earned", report.summary.earned],
    ["Other received", report.summary.otherReceived],
    ["Unclassified received", report.summary.unclassified],
    ["Expenses", report.summary.expenses],
    ["After expenses", report.summary.afterExpenses],
  ];
  summaryItems.forEach(([label, amount], index) => {
    const rowNumber = index + 6;
    const alternate = index % 2 ? 6 : 4;
    rows.push(
      excelRow(
        rowNumber,
        [
          excelTextCell(`A${rowNumber}`, label, alternate),
          excelNumberCell(`B${rowNumber}`, amount, alternate === 6 ? 7 : 5),
        ],
        24,
      ),
    );
  });
  rows.push(excelRow(11, []));
  rows.push(fillBand(12, "Earnings breakdown", 2));
  rows.push(
    excelRow(
      13,
      [
        excelTextCell("A13", "Source", 3),
        excelTextCell("B13", "Amount UGX", 3),
      ],
      25,
    ),
  );
  (report.summary.bySource || []).forEach((item, index) => {
    const rowNumber = index + 14;
    const style = index % 2 ? 6 : 4;
    rows.push(
      excelRow(
        rowNumber,
        [
          excelTextCell(`A${rowNumber}`, item.source, style),
          excelNumberCell(`B${rowNumber}`, item.amount, style === 6 ? 7 : 5),
        ],
        24,
      ),
    );
  });
  return excelWorksheet({
    rows,
    widths: [28, 24, 18, 25, 16, 18],
  });
}

function monthlyTransactionsSheet(report) {
  const headers = [
    "Date",
    "Classification",
    "Type",
    "Client",
    "Service",
    "Description",
    "Source",
    "Amount UGX",
    "Account",
  ];
  const rows = [
    excelRow(
      1,
      headers.map((label, index) =>
        excelTextCell(`${excelColumn(index)}1`, label, 3),
      ),
      30,
    ),
  ];
  report.transactions.forEach((transaction, index) => {
    const rowNumber = index + 2;
    const style = index % 2 ? 6 : 4;
    const amountStyle = index % 2 ? 7 : 5;
    const date = transaction.reportDate || transaction.date || "";
    const values = [
      date,
      transaction.reportClassification || "",
      transaction.type || "",
      transaction.clientName || "",
      transaction.serviceName || "",
      transaction.description || transaction.note || "",
      transaction.sourceType || "",
      null,
      transaction.accountName || transaction.accountId || "Not assigned",
    ];
    const cells = values.map((value, column) =>
      column === 7
        ? excelNumberCell(
            `${excelColumn(column)}${rowNumber}`,
            transaction.amount,
            amountStyle,
          )
        : excelTextCell(
            `${excelColumn(column)}${rowNumber}`,
            value,
            column === 5 ? style : style,
          ),
    );
    rows.push(excelRow(rowNumber, cells, 34));
  });
  return excelWorksheet({
    rows,
    widths: [15, 21, 12, 26, 24, 52, 22, 19, 24],
    freezeRows: 1,
    filterRange: `A1:I${Math.max(1, rows.length)}`,
  });
}

export async function buildMonthlyXlsx(report) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`,
  );
  zip
    .folder("_rels")
    .file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    );
  zip
    .folder("xl")
    .file(
      "workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="Report" sheetId="1" r:id="rId1"/><sheet name="Transactions" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    );
  zip
    .folder("xl")
    .folder("_rels")
    .file(
      "workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    );
  zip.folder("xl").file("styles.xml", monthlyExcelStyles());
  zip
    .folder("xl")
    .folder("worksheets")
    .file("sheet1.xml", monthlySummarySheet(report));
  zip
    .folder("xl")
    .folder("worksheets")
    .file("sheet2.xml", monthlyTransactionsSheet(report));
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
