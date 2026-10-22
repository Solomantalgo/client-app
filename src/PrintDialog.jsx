import { createContext, useContext, useState } from "react";
import { Close } from "./icons.jsx";
import "./PrintDialog.css";
import font400 from "@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2?url";
import font500 from "@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2?url";

const PrintContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function usePrintDialog() {
  return useContext(PrintContext);
}

export function PrintDialogProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [format, setFormat] = useState(() => {
    try {
      return localStorage.getItem("solo-print-format") || "a4";
    } catch {
      return "a4";
    }
  });
  const print = (next) => {
    const profile = {
      ...(next.profile || {}),
      font400Url: new URL(font400, location.origin).href,
      font500Url: new URL(font500, location.origin).href,
    };
    setRequest({ ...next, profile });
  };
  const close = () => setRequest(null);
  const build = request ? request.build(format, request.profile) : () => "";
  const html = request ? build() : "";
  const hasPaymentDetails =
    request &&
    ![
      "bankName",
      "bankAccountName",
      "bankAccountNo",
      "momoNumber",
      "momoName",
    ].some((key) => request.profile[key]);
  const doPrint = async () => {
    const frame = document.querySelector(".print-preview iframe");
    await frame?.contentDocument?.fonts?.ready;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  };
  const openFallback = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <PrintContext.Provider value={print}>
      {children}
      {request && (
        <div
          className="print-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && close()
          }
        >
          <section
            className="print-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Print ${request.docType}`}
          >
            <header>
              <h2>Print {request.docType}</h2>
              <button className="iconbtn" onClick={close} aria-label="Close">
                <Close />
              </button>
            </header>
            <label className="print-format label">
              Format
              <select
                className="field"
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value);
                  try {
                    localStorage.setItem(
                      "solo-print-format",
                      event.target.value,
                    );
                  } catch {
                    /* optional */
                  }
                }}
              >
                <option value="a4">A4 document (print or save as PDF)</option>
                <option value="thermal58">58mm thermal receipt</option>
              </select>
            </label>
            {hasPaymentDetails && (
              <span className="chip chip-blue">
                Add payment details in More → Business profile
              </span>
            )}
            <div className={`print-stage ${format}`}>
              <div className="print-preview">
                <iframe srcDoc={html} title="Preview" />
              </div>
            </div>
            <p>In the print window choose your printer, or “Save as PDF”.</p>
            <a
              href="#open-print"
              onClick={(event) => {
                event.preventDefault();
                openFallback();
              }}
            >
              Having trouble? Open in a new tab
            </a>
            <footer>
              <button className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={doPrint}>
                Print
              </button>
            </footer>
          </section>
        </div>
      )}
    </PrintContext.Provider>
  );
}
