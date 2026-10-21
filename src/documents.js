export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

const cash = (value) => `UGX ${Math.round(Number(value) || 0).toLocaleString("en-UG")}`;

function styles(format) {
  if (format === "thermal58") {
    return `@page { size: 58mm auto; margin: 0; }
html, body { width: 58mm; margin: 0; }
body { width: 48mm; padding: 3mm 5mm; font: 9.5px/1.35 'DM Mono','Courier New',monospace; color:#000; background:#fff; }
* { color:#000 !important; background:transparent !important; box-sizing:border-box; }
.c { text-align:center; } .sep { border-top:1px dashed #000; margin:5px 0; }
.row { display:flex; justify-content:space-between; gap:6px; }
.big { font-size:12px; font-weight:700; } .wrap { word-break:break-word; }
.stamp { border:2px solid #000; text-align:center; padding:3px; font-weight:700; margin:6px 0; }`;
  }
  return `@page { size: A4; margin: 18mm; }
body { max-width: 760px; margin: auto; padding: 24px; color: #111; font: 12px/1.5 'DM Mono','Courier New',monospace; }
.row { display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid #ddd; }
.big { font-size:16px; font-weight:700; } .stamp { border:2px solid #111; padding:8px; margin:18px auto; text-align:center; }
.sep { border-top:1px solid #aaa; margin:14px 0; } .c { text-align:center; } .wrap { word-break:break-word; }
@media print { button { display:none; } }`;
}

function page(title, content, format) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${styles(format)}</style></head>
<body>${content}<script>window.onload=()=>window.print()</script></body></html>`;
}

function lineMarkup(item) {
  return `<div class="wrap">${esc(item.title)}</div><div class="row"><span></span><span>${cash(item.amount)}</span></div>`;
}

export function buildInvoiceHtml(model, format = "a4") {
  const lines = (model.items || []).map(lineMarkup).join("");
  const content = `<div class="c big">SOLOMANTALGO WEB DESIGN</div><div class="sep"></div>
<div class="c">INVOICE · ${esc(model.number)} · ${esc(model.date)}</div><div class="sep"></div>
<div class="wrap">${esc(model.clientName)}<br>${esc(model.business)}</div><div class="sep"></div>${lines}
<div class="sep"></div><div class="row"><span>Total</span><b>${cash(model.total)}</b></div>
<div class="row"><span>Paid</span><span>${cash(model.paid)}</span></div>
<div class="row big"><span>Balance</span><span>${cash(model.balance)}</span></div>
<div class="stamp">${esc(model.stamp)}</div><div class="c">Thank you for your business.</div>`;
  return page(`Invoice ${model.number}`, content, format);
}

export function buildReceiptHtml(model, format = "a4") {
  const lines = (model.lines || []).map(lineMarkup).join("");
  const total = model.total ?? (model.lines || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const content = `<div class="c big">SOLOMANTALGO WEB DESIGN</div><div class="sep"></div>
<div class="c">RECEIPT · ${esc(model.number)} · ${esc(model.date)}</div><div class="sep"></div>
<div class="wrap">${esc(model.clientName)}<br>${esc(model.business)}</div><div class="sep"></div>${lines}
<div class="row big"><span>Total received</span><span>${cash(total)}</span></div>
<div class="stamp">${esc(model.stamp || "PAYMENT RECEIVED")}</div>
<div class="c">Thank you for your business.</div>`;
  return page(`Receipt ${model.number}`, content, format);
}
