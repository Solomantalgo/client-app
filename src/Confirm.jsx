import { createContext, useContext, useEffect, useRef, useState } from "react";

const ConfirmContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ask;
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [typed, setTyped] = useState("");
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const ask = (options) =>
    new Promise((resolve) => {
      previousFocusRef.current = document.activeElement;
      setTyped("");
      setDialog({ ...options, resolve });
    });
  const finish = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.resolve(false);
        setDialog(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [dialog]);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {dialog && (
        <div
          className="ce-overlay confirm-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && finish(false)}
        >
          <section
            ref={dialogRef}
            className="ce-dialog confirm-dialog"
            role="alertdialog"
            aria-modal="true"
          >
            <h2>{dialog.title}</h2>
            <p>{dialog.body}</p>
            {dialog.requireText && (
              <label className="ce-field">
                Type <b>{dialog.requireText}</b> to confirm
                <input value={typed} onChange={(event) => setTyped(event.target.value)} />
              </label>
            )}
            <footer>
              <button ref={cancelRef} onClick={() => finish(false)}>
                Cancel
              </button>
              {dialog.altAction && (
                <button
                  onClick={() => {
                    dialog.altAction.run?.();
                    finish(false);
                  }}
                >
                  {dialog.altAction.label}
                </button>
              )}
              <button
                className="danger"
                disabled={Boolean(dialog.requireText && typed !== dialog.requireText)}
                onClick={() => finish(true)}
              >
                {dialog.confirmLabel || "Delete"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
