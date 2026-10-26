import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createDocumentPdf } from "./documentPdf.js";
import { Close } from "./components/Icon.jsx";
import { documentFilename } from "./documents.js";
import { renderPrintHtml } from "./print.js";
import "./PrintDialog.css";

const PrintContext = createContext(null);
const PAGE_WIDTH = 794;

// eslint-disable-next-line react-refresh/only-export-components
export function usePrintDialog() {
  return useContext(PrintContext);
}

function waitForFrameAssets(frame) {
  const frameDocument = frame?.contentDocument;
  if (!frameDocument) return Promise.resolve();
  const fonts = frameDocument.fonts?.ready || Promise.resolve();
  const images = [...frameDocument.images].map((image) =>
    typeof image.decode === "function"
      ? image.decode().catch(() => undefined)
      : undefined,
  );
  return Promise.all([fonts, ...images]);
}

function fallbackHtml(html) {
  const toolbar = `<style>
    .browser-print-tools{position:sticky;top:0;z-index:9999;display:flex;align-items:center;
      justify-content:space-between;gap:12px;padding:10px 16px;background:rgb(33 31 32);color:rgb(245 243 246);
      font:14px Arial,sans-serif}
    .browser-print-tools button{min-height:44px;padding:0 18px;border:0;border-radius:8px;
      background:rgb(195 255 77);color:rgb(20 19 19);font:600 14px Arial,sans-serif}
    @media print{.browser-print-tools{display:none}}
  </style><div class="browser-print-tools"><span>Use your browser’s Print or Share menu if needed.</span>
    <button type="button" onclick="window.print()">Print</button></div>`;
  return html.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
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
  const [frameReady, setFrameReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [frameHeight, setFrameHeight] = useState(1123);
  const [previewScale, setPreviewScale] = useState(1);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const priorFocus = useRef(null);

  const print = (next) => {
    if (!next || typeof next.build !== "function") return;
    priorFocus.current = document.activeElement;
    setFrameReady(false);
    setActionError("");
    setFallbackUrl("");
    setRequest({ ...next, profile: next.profile || {} });
  };

  const close = () => {
    setRequest(null);
    setActionError("");
    window.setTimeout(() => priorFocus.current?.focus?.(), 0);
  };

  useEffect(() => {
    if (!request) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [request, busy]);

  useEffect(() => {
    if (!request || !stageRef.current) return undefined;
    const stage = stageRef.current;
    const updateScale = () => {
      const available = Math.max(240, stage.clientWidth - 24);
      const naturalWidth = format === "a4" ? PAGE_WIDTH : 220;
      setPreviewScale(Math.min(1, available / naturalWidth));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [request, format]);

  const html = renderPrintHtml(request, format);
  const hasPaymentDetails =
    request &&
    ![
      "bankName",
      "bankAccountName",
      "bankAccountNo",
      "momoNumber",
      "momoName",
    ].some((key) => request.profile[key]);
  const frameWidth = format === "a4" ? PAGE_WIDTH : 220;
  const previewWidth = frameWidth * previewScale;
  const previewHeight = frameHeight * previewScale;

  const handleFrameLoad = async (event) => {
    const frame = event.currentTarget;
    await waitForFrameAssets(frame);
    const documentHeight =
      frame.contentDocument?.documentElement?.scrollHeight || 0;
    setFrameHeight(
      format === "a4"
        ? Math.max(1123, documentHeight)
        : Math.max(280, documentHeight),
    );
    setFrameReady(true);
  };

  const doPrint = () => {
    const frame = frameRef.current;
    if (!frameReady || !frame?.contentWindow) {
      setActionError(
        "The document is still preparing. Try Print again in a moment.",
      );
      return;
    }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      setActionError(
        "This browser could not open printing. Use Open in browser, then its Print or Share menu.",
      );
    }
  };

  const downloadPdf = async () => {
    if (!request?.model) {
      setActionError(
        "This document is missing its PDF data. Use Print or Open in browser.",
      );
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await waitForFrameAssets(frameRef.current);
      const blob = await createDocumentPdf(
        request.model,
        request.docType,
        format,
        request.profile,
      );
      if (!(blob instanceof Blob) || blob.type !== "application/pdf") {
        throw new Error("PDF output was not generated.");
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentFilename(request.docType, request.model)}.pdf`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setActionError(
        error?.message ||
          "PDF download failed. Use Open in browser and its Print or Share menu.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openFallback = () => {
    const url = URL.createObjectURL(
      new Blob([fallbackHtml(html)], { type: "text/html" }),
    );
    const tab = window.open(url, "_blank");
    if (tab) {
      tab.opener = null;
      window.setTimeout(() => URL.revokeObjectURL(url), 300_000);
      setFallbackUrl("");
      setActionError("");
    } else {
      setFallbackUrl(url);
      setActionError(
        "The browser blocked the new tab. Open the document from the link below.",
      );
    }
  };

  const changeFormat = (next) => {
    setFormat(next);
    setFrameReady(false);
    setFrameHeight(next === "a4" ? 1123 : 700);
    try {
      localStorage.setItem("solo-print-format", next);
    } catch {
      /* optional preference */
    }
  };

  return (
    <PrintContext.Provider value={print}>
      {children}
      {request && (
        <div
          className="print-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !busy && close()
          }
        >
          <section
            className="print-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${request.docType} preview`}
          >
            <header className="print-dialog-header">
              <button
                className="iconbtn print-back"
                onClick={close}
                aria-label="Back to client"
              >
                <Close />
              </button>
              <div>
                <span className="print-eyebrow">Document preview</span>
                <h2>{request.docType} preview</h2>
              </div>
              <button
                className="iconbtn print-close"
                onClick={close}
                aria-label="Close preview"
              >
                <Close />
              </button>
            </header>

            <div className="print-toolbar">
              <div
                className="print-format"
                role="group"
                aria-label="Document format"
              >
                <button
                  type="button"
                  className={format === "a4" ? "active" : ""}
                  aria-pressed={format === "a4"}
                  onClick={() => changeFormat("a4")}
                >
                  A4
                </button>
                <button
                  type="button"
                  className={format === "thermal58" ? "active" : ""}
                  aria-pressed={format === "thermal58"}
                  onClick={() => changeFormat("thermal58")}
                >
                  58 mm
                </button>
              </div>
              {hasPaymentDetails && (
                <span className="print-config-note">
                  Payment details can be added in Business profile.
                </span>
              )}
            </div>

            <div className={`print-stage ${format}`} ref={stageRef}>
              <div
                className="print-preview-shell"
                style={{
                  width: `${previewWidth}px`,
                  height: `${previewHeight}px`,
                }}
              >
                <div
                  className={`print-preview ${format}`}
                  style={{ transform: `scale(${previewScale})` }}
                >
                  <iframe
                    ref={frameRef}
                    srcDoc={html}
                    title={`${request.docType} preview document`}
                    style={{
                      width: `${frameWidth}px`,
                      height: `${frameHeight}px`,
                    }}
                    onLoad={handleFrameLoad}
                  />
                </div>
              </div>
              {!frameReady && (
                <p className="print-loading">Preparing the document…</p>
              )}
            </div>

            <p className="print-hint">
              Print opens your browser’s print options. Choose a printer or Save
              as PDF.
            </p>
            {actionError && (
              <p className="print-error" role="alert">
                {actionError}
              </p>
            )}
            {fallbackUrl && (
              <a
                className="print-fallback-link"
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open the printable document
              </a>
            )}

            <footer className="print-actions">
              <button
                className="btn btn-ghost print-cancel"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={openFallback}
                disabled={!frameReady || busy}
              >
                Open in browser
              </button>
              <button
                className="btn btn-secondary"
                onClick={downloadPdf}
                disabled={busy || !frameReady}
              >
                {busy ? "Preparing PDF…" : "Download PDF"}
              </button>
              <button
                className="btn btn-primary"
                onClick={doPrint}
                disabled={!frameReady || busy}
              >
                Print
              </button>
            </footer>
          </section>
        </div>
      )}
    </PrintContext.Provider>
  );
}
