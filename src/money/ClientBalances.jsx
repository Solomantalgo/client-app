import Card from "../components/Card.jsx";

const money = (value) => `UGX ${Math.round(value || 0).toLocaleString("en-UG")}`;

export default function ClientBalances({ rows, pausedRows, onEditPayment }) {
  const pausedTotal = pausedRows.reduce((sum, row) => sum + row.balance, 0);
  return (
    <Card className="m-panel client-balances-screen">
      <header className="m-section-head"><div><h2>Outstanding client balances</h2><p>Agreed amounts not yet paid. These are not available cash.</p></div></header>
      {rows.map((row) => (
        <article className="m-list-row m-client-balance" key={row.id}>
          <div><strong>{row.name}</strong><div className="m-muted">{row.service} · {money(row.paid)} received of {money(row.total)}</div>
            {row.payments.map((payment) => <div className="m-client-payment" key={payment.id}><span>{payment.date || "Date unknown"} · {payment.note || "Payment"} · {money(payment.amount)}</span><button className="m-quiet" onClick={() => onEditPayment(row, payment)}>Edit payment</button></div>)}
          </div><strong className="m-amount">{money(row.balance)}</strong>
        </article>
      ))}
      {!rows.length && <p className="m-muted">No active client balances are outstanding.</p>}
      <details className="m-paused"><summary>Paused ({pausedRows.length}) · {money(pausedTotal)} not counted</summary>
        {pausedRows.map((row) => <div className="m-list-row" key={row.id}><div><strong>{row.name}</strong><div className="m-muted">{row.service}</div></div><strong className="m-muted">{money(row.balance)}</strong></div>)}
        {!pausedRows.length && <p className="m-muted">No paused client balances.</p>}
      </details>
    </Card>
  );
}
