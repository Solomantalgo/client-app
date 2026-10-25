import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";

const money = (value) => `UGX ${Math.round(value || 0).toLocaleString("en-UG")}`;

export default function Purposes({
  buckets,
  totals,
  allocationTotal,
  assignedBalance,
  available,
  onAdd,
  onEdit,
  onArchive,
  onRestore,
  onReset,
  onUndo,
  onReorder,
}) {
  return (
    <Card className="m-panel purposes-screen">
      <header className="m-section-head">
        <div>
          <h2>Purposes</h2>
          <p>Allocation rules apply to future income.</p>
        </div>
        <button className="m-primary" onClick={onAdd}>
          Add purpose
        </button>
      </header>
      <p className={`m-allocation-total ${allocationTotal > 100 ? "invalid" : ""}`}>
        <strong>{allocationTotal}% allocated</strong> ·{" "}
        {allocationTotal < 100
          ? `${100 - allocationTotal}% remains unassigned`
          : "All income allocated"}
      </p>
      {buckets.map((bucket, index) => {
        const balance = totals.buckets[bucket.id] || { balance: 0, borrowed: 0 };
        const reset = (bucket.resets || []).at(-1);
        return (
          <article
            className={`m-rule ${bucket.status === "archived" ? "archived" : ""}`}
            key={bucket.id}
          >
            <span className="m-icon">
              <Icon name="Money" />
            </span>
            <div className="m-rule-main">
              <strong>{bucket.name}</strong>
              <div className="m-muted">
                {money(balance.balance)} available · {bucket.percentage}% allocation
                {balance.borrowed ? ` · ${money(balance.borrowed)} owed` : ""}
              </div>
            </div>
            {reset && (
              <small className="m-muted">
                Counting since {new Date(reset.at).toLocaleDateString("en-UG")} {" "}
                <button className="m-quiet" onClick={() => onUndo(reset)}>
                  Undo
                </button>
              </small>
            )}
            {bucket.status === "archived" ? (
              <button className="m-quiet" onClick={() => onRestore(bucket)}>
                Restore
              </button>
            ) : (
              <>
                <button
                  className="m-quiet"
                  disabled={index === 0}
                  aria-label={`Move ${bucket.name} up`}
                  onClick={() => onReorder(bucket, -1)}
                >
                  ↑
                </button>
                <button
                  className="m-quiet"
                  disabled={index === buckets.length - 1}
                  aria-label={`Move ${bucket.name} down`}
                  onClick={() => onReorder(bucket, 1)}
                >
                  ↓
                </button>
                <button className="m-quiet" onClick={() => onEdit(bucket)}>
                  Edit
                </button>
                <button className="m-quiet" onClick={() => onReset(bucket)}>
                  Start fresh
                </button>
                <button className="m-quiet" onClick={() => onArchive(bucket)}>
                  Archive
                </button>
              </>
            )}
          </article>
        );
      })}
      <p className="m-muted">
        Not assigned to a purpose: {money(available - assignedBalance)}
      </p>
    </Card>
  );
}
