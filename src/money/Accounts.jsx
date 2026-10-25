import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";

const money = (value) => `UGX ${Math.round(value || 0).toLocaleString("en-UG")}`;

export default function Accounts({ accounts, totals, onAdd, onEdit, onArchive }) {
  return (
    <Card className="m-panel accounts-screen">
      <header className="m-section-head"><div><h2>Accounts</h2><p>Where money is held, separate from the purposes it is allocated to.</p></div><button className="m-primary" onClick={onAdd}>Add account</button></header>
      {accounts.map((account) => (
        <article className={`m-rule ${account.status === "archived" ? "archived" : ""}`} key={account.id}>
          <span className="m-icon"><Icon name="Money" /></span>
          <div className="m-rule-main"><strong>{account.name}</strong><div className="m-muted">{account.type} · {account.status === "archived" ? "Archived" : "Active"}</div></div>
          <strong className="m-amount">{money(totals.accounts[account.id] || 0)}</strong>
          {account.status !== "archived" && <><button className="m-quiet" onClick={() => onEdit(account)}>Edit</button><button className="m-quiet" onClick={() => onArchive(account)}>Archive</button></>}
        </article>
      ))}
      <p className="m-hint">Legacy expenses without an account stay marked unknown and are excluded from account totals.</p>
      {!accounts.length && <p className="m-muted">Add an account to track where money is held.</p>}
    </Card>
  );
}
