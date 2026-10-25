import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import { outstandingBalances } from "../clients.js";

const money = (value) => `UGX ${Math.round(value || 0).toLocaleString("en-UG")}`;

export default function Overview({
  totals,
  transactions,
  clients,
  activeBuckets,
  finance,
  assignedBalance,
  onChangeTab,
  onEditBucket,
  onResetBucket,
  onArchiveBucket,
  onUndoBucketClear,
  onEditTransaction,
  onSetAccount,
}) {
  const clientIncome = transactions
    .filter((row) => row.type === "income" && row.sourceType === "client_payment")
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const owing = outstandingBalances(clients).reduce(
    (sum, item) => sum + item.balance,
    0,
  );
  const metrics = [
    ["Available", money(totals.available)],
    ["Received", money(totals.income)],
    ["Spent", money(totals.expenses)],
    ["Owing", money(owing)],
  ];

  return (
    <div className="money-content overview-screen">
      <div className="m-stats">
        {metrics.map(([label, value]) => (
          <Card className="m-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </Card>
        ))}
      </div>
      <Card className="m-panel">
        <header className="m-section-head">
          <div><h2>Money by purpose</h2><p>What each allocation is set aside for.</p></div>
          <button className="m-quiet" onClick={() => onChangeTab("Allocations")}>Manage purposes</button>
        </header>
        <div className="m-bucket-grid">
          {activeBuckets.map((bucket) => {
            const balance = totals.buckets[bucket.id] || { allocated: 0, spent: 0, balance: 0, borrowed: 0 };
            const reset = (finance.bucketResets || []).filter((item) => item.bucketId === bucket.id).at(-1);
            return (
              <article className="m-bucket" key={bucket.id}>
                <div className="m-bucket-name"><Icon name="Money" /><strong>{bucket.name}</strong></div>
                <strong className="m-amount">{money(balance.balance)}</strong>
                <span className="m-muted">Available in purpose</span>
                {balance.borrowed > 0 && <span className="m-muted">Borrowed: {money(balance.borrowed)} · repaid from future allocations</span>}
                <div className="m-progress"><i style={{ width: `${bucket.target ? Math.max(0, Math.min(100, balance.balance / bucket.target * 100)) : 0}%` }} /></div>
                <div className="m-detail-row"><span>{bucket.percentage}% allocation</span><span>{money(balance.spent)} spent</span></div>
                <div className="m-row-actions">
                  <button className="m-quiet" onClick={() => onEditBucket(bucket)}>Edit</button>
                  <button className="m-quiet" onClick={() => onResetBucket(bucket)}>Start fresh</button>
                  <button className="m-quiet" onClick={() => onArchiveBucket(bucket)}>Archive</button>
                </div>
                {reset && <p className="m-muted">Counting since {new Date(reset.at).toLocaleDateString("en-UG")} · <button className="m-quiet" onClick={() => onUndoBucketClear(reset)}>Undo clear</button></p>}
              </article>
            );
          })}
          {!activeBuckets.length && <p className="m-muted">Add a purpose to organize future income.</p>}
        </div>
        <p className="m-muted">Not assigned to a purpose: {money(totals.available - assignedBalance)}</p>
      </Card>
      <div className="m-two-col">
        <Card className="m-panel">
          <header className="m-section-head"><div><h2>Account balances</h2><p>Where money is held.</p></div><button className="m-quiet" onClick={() => onChangeTab("Accounts")}>View accounts</button></header>
          {finance.accounts.filter((account) => account.status !== "archived").map((account) => (
            <div className="m-list-row" key={account.id}><span>{account.name}</span><strong>{money(totals.accounts[account.id] || 0)}</strong></div>
          ))}
        </Card>
        <Card className="m-panel">
          <header className="m-section-head"><div><h2>Recent activity</h2><p>{clientIncome ? `${money(clientIncome)} from client payments` : "Latest recorded transactions"}</p></div><button className="m-quiet" onClick={() => onChangeTab("Income")}>Full history</button></header>
          {transactions.slice(0, 5).map((row) => (
            <div className="m-list-row" key={row.id}><button className="m-row-title" onClick={() => onEditTransaction(row)}>{row.description || row.note || "Transaction"}</button><strong>{money(row.amount)}</strong><button className="m-quiet" onClick={() => onSetAccount(row, row.accountId || "")}>Account</button></div>
          ))}
        </Card>
      </div>
    </div>
  );
}
