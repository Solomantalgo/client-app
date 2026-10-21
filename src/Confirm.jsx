import { createContext, useContext, useState } from "react";

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
  const ask = (options) =>
    new Promise((resolve) => {
      setTyped("");
      setDialog({ ...options, resolve });
    });
  const finish = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {dialog && (
        <div
          className="ce-overlay confirm-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && finish(false)}
        >
          <section className="ce-dialog confirm-dialog" role="alertdialog" aria-modal="true">
            <h2>{dialog.title}</h2>
            <p>{dialog.body}</p>
            {dialog.requireText && (
              <label className="ce-field">
                Type <b>{dialog.requireText}</b> to confirm
                <input value={typed} onChange={(event) => setTyped(event.target.value)} />
              </label>
            )}
            <footer>
              <button autoFocus onClick={() => finish(false)}>Cancel</button>
              {dialog.altAction && (
                <button onClick={() => {
                  dialog.altAction.run?.();
                  finish(false);
                }}>{dialog.altAction.label}</button>
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
