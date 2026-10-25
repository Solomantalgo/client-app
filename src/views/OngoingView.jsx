import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import ClientRow from "../clients/ClientRow.jsx";
import { clientTotals } from "../clients.js";
import { fmtUGX } from "../lib/format.js";
import "./PipelineViews.css";

export default function OngoingView({ clients }) {
  const [filter, setFilter] = useState("Owing");
  const ongoing = useMemo(
    () =>
      Object.entries(clients || {}).flatMap(([date, entries]) =>
        entries
          .filter((client) => client.status === "ongoing")
          .map((client) => ({ ...client, date, totals: clientTotals(client) })),
      ),
    [clients],
  );
  const active = ongoing.filter((client) => !client.paused);
  const paused = ongoing.filter((client) => client.paused);
  const owing = active.filter((client) => client.totals.balance > 0);
  const paid = active.filter((client) => client.totals.balance <= 0);
  const visible =
    filter === "Paused"
      ? paused
      : filter === "Paid up"
        ? paid
        : filter === "All"
          ? ongoing
          : owing;
  const owingAmount = owing.reduce((sum, client) => sum + client.totals.balance, 0);

  return (
    <div className="pipeline-page">
      <header className="pipeline-heading">
        <div>
          <p className="pipeline-eyebrow">Pipeline</p>
          <h1>Ongoing projects</h1>
          <p>Track balances, delivery dates and active client work.</p>
        </div>
      </header>
      <section className="ongoing-summary" aria-label="Ongoing balances">
        <Card><span>Owing</span><strong>{fmtUGX(owingAmount)}</strong><small>{owing.length} active clients</small></Card>
        <Card><span>Paused clients</span><strong>{paused.length}</strong><small>Excluded from collectible totals</small></Card>
      </section>
      <div className="pipeline-filters ongoing-filters" role="group" aria-label="Ongoing clients">
        {[
          ["Owing", owing.length],
          ["Paused", paused.length],
          ["Paid up", paid.length],
          ["All", ongoing.length],
        ].map(([label, count]) => (
          <button
            type="button"
            className={filter === label ? "active" : ""}
            key={label}
            onClick={() => setFilter(label)}
          >
            {label} <b>{count}</b>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Card className="pipeline-empty">
          <h2>No {filter.toLowerCase()} clients</h2>
          <p>Clients will appear here as their balance or status changes.</p>
        </Card>
      ) : (
        <div className="pipeline-list">
          {visible.map((client) => (
            <ClientRow key={`${client.date}-${client.id}`} client={client} date={client.date} />
          ))}
        </div>
      )}
    </div>
  );
}
