import { useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";

const money = (value) => `UGX ${Math.round(value || 0).toLocaleString("en-UG")}`;

export default function Transactions({
  rows, filter, setFilter, searchText, setSearchText,
  onEdit, onDelete, finance, onSetAccount, onAddSource, onCreateExpense,
  showExpenseAction,
}) {
  const [accountPicker, setAccountPicker] = useState(null);
  return (
    <Card className="m-panel transactions-screen">
      <header className="m-section-head">
        <div><h2>Transactions</h2><p>Client payments, income and expenses in one ledger.</p></div>
        <div className="m-actions">
          {showExpenseAction && <button className="m-secondary" onClick={onCreateExpense}>Add expense</button>}
          <button className="m-quiet" onClick={onAddSource}>Manage source types</button>
        </div>
      </header>
      <div className="m-filter-row">
        {["All", "Income", "Expenses"].map((item) => (
          <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <label className="m-search"><Icon name="Search" /><span className="sr-only">Search transactions</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search transactions" /><button type="button" aria-label="Clear search" onClick={() => setSearchText("")}>×</button></label>
      <div className="m-transaction-list">
        {rows.map((row) => {
          const account = finance.accounts.find((item) => item.id === row.accountId);
          return (
            <article className="m-transaction-row" key={row.id}>
              <span className={`m-transaction-icon ${row.type}`}><Icon name={row.type === "income" ? "Check" : "Edit"} /></span>
              <button className="m-transaction-main" onClick={() => onEdit(row)}>
                <strong>{row.description || row.note || (row.type === "income" ? "Income" : "Expense")}</strong>
                <small>{row.sourceType || row.bucketName || row.date || "Date unknown"} · {row.date || "Date unknown"}</small>
              </button>
              <div className="m-transaction-side"><strong className={row.type === "income" ? "income" : "expense"}>{money(row.amount)}</strong>
                <button className={account ? "m-account-chip" : "m-account-chip unassigned"} onClick={() => setAccountPicker(row)}>
                  {account?.name || "Assign account"}
                </button>
              </div>
              {onDelete && <button className="m-quiet" aria-label={`Delete ${row.description || "transaction"}`} onClick={() => onDelete(row)}>Delete</button>}
            </article>
          );
        })}
        {!rows.length && <p className="m-muted">No transactions match these filters.</p>}
      </div>
      {accountPicker && (
        <div className="m-overlay" onMouseDown={(event) => event.target === event.currentTarget && setAccountPicker(null)}>
          <section className="m-dialog m-account-picker" role="dialog" aria-modal="true" aria-labelledby="account-picker-title">
            <h2 id="account-picker-title">Assign account</h2>
            <p>Select where this payment was received.</p>
            {finance.accounts.filter((item) => item.status !== "archived").map((item) => (
              <button className="btn btn-ghost" key={item.id} onClick={() => { onSetAccount(accountPicker, item.id); setAccountPicker(null); }}>
                {item.name}
              </button>
            ))}
            <button className="btn btn-ghost" onClick={() => { onSetAccount(accountPicker, ""); setAccountPicker(null); }}>Unknown</button>
            <button className="btn btn-ghost" onClick={() => setAccountPicker(null)}>Cancel</button>
          </section>
        </div>
      )}
    </Card>
  );
}
