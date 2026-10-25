import { useMemo } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import ClientRow from "../clients/ClientRow.jsx";
import { fmtDate } from "../lib/format.js";
import "./PipelineViews.css";

export default function HistoryView({ clients, sortedDates, today, selected, onSelect }) {
  const dates = sortedDates.filter((date) => date !== today);
  const months = useMemo(() => {
    const groups = new Map();
    for (const date of dates) {
      const key = date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(date);
    }
    return [...groups.entries()];
  }, [dates]);

  if (selected) {
    const rows = clients[selected] || [];
    return (
      <div className="history-page">
        <button className="btn btn-ghost history-back" onClick={() => onSelect(null)}>
          <Icon name="Back" size={18} /> Back to history
        </button>
        <header className="pipeline-heading">
          <div><p className="pipeline-eyebrow">Session</p><h1>{fmtDate(selected)}</h1></div>
          <span className="pipeline-count">{rows.length} clients</span>
        </header>
        {rows.length ? (
          <div className="pipeline-list">
            {rows.map((client) => <ClientRow key={client.id} client={client} date={selected} />)}
          </div>
        ) : (
          <Card className="pipeline-empty"><h2>No clients in this session</h2></Card>
        )}
      </div>
    );
  }

  return (
    <div className="history-page">
      <header className="pipeline-heading">
        <div><p className="pipeline-eyebrow">Records</p><h1>Outreach history</h1><p>Review each session and the people you met.</p></div>
      </header>
      {dates.length === 0 ? (
        <Card className="pipeline-empty">
          <span className="pipeline-empty-icon"><Icon name="History" size={22} /></span>
          <h2>No past sessions yet</h2><p>Completed outreach sessions will appear here.</p>
        </Card>
      ) : (
        <div className="history-months">
          {months.map(([month, monthDates]) => (
            <section key={month} className="history-month">
              <h2>{new Intl.DateTimeFormat("en-UG", { month: "long", year: "numeric", timeZone: "Africa/Kampala" }).format(new Date(`${month}-15T12:00:00+03:00`))}</h2>
              <div className="history-days">
                {monthDates.map((date) => {
                  const entries = clients[date] || [];
                  const warm = entries.filter((client) => client.temp === "warm").length;
                  const pending = entries.filter((client) => client.followUp === "needed").length;
                  return (
                    <button className="history-day" key={date} onClick={() => onSelect(date)}>
                      <span className="history-day-date"><strong>{fmtDate(date)}</strong><small>{entries.length} clients</small></span>
                      <span className="history-day-chips">
                        {warm > 0 && <i className="warm">{warm} warm</i>}
                        {pending > 0 && <i>{pending} pending</i>}
                      </span>
                      <Icon name="ChevronRight" size={18} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
