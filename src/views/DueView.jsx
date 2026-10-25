import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import ClientRow from "../clients/ClientRow.jsx";
import { todayStr } from "../lib/format.js";
import "./PipelineViews.css";

export default function DueView({ clients, today = todayStr() }) {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const leads = Object.entries(clients || {}).flatMap(([date, entries]) =>
      entries
        .filter((client) => client.status !== "ongoing" && !client.paused)
        .filter(
          (client) =>
            client.followUp === "needed" ||
            (client.followUpDate && client.followUp !== "done"),
        )
        .map((client) => ({ ...client, date })),
    );
    const matches = leads
      .filter((client) => filter === "All" || client.temp === filter.toLowerCase())
      .filter((client) =>
        `${client.name} ${client.business} ${client.businessType}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      );
    const sort = (left, right) => {
      const warmth = (right.temp === "warm") - (left.temp === "warm");
      const leftAge = left.followUpDate
        ? Date.parse(`${left.followUpDate}T00:00:00Z`)
        : Date.parse(`${left.date}T00:00:00Z`);
      const rightAge = right.followUpDate
        ? Date.parse(`${right.followUpDate}T00:00:00Z`)
        : Date.parse(`${right.date}T00:00:00Z`);
      return warmth || leftAge - rightAge;
    };
    return [
      {
        title: "Overdue",
        rows: matches
          .filter((client) => client.followUpDate && client.followUpDate < today)
          .sort(sort),
      },
      {
        title: "Due today",
        rows: matches
          .filter((client) => client.followUpDate === today)
          .sort(sort),
      },
      {
        title: "Upcoming",
        rows: matches
          .filter((client) => client.followUpDate && client.followUpDate > today)
          .sort(sort),
      },
      {
        title: "Needs a date",
        rows: matches
          .filter((client) => !client.followUpDate)
          .sort(sort),
      },
    ];
  }, [clients, filter, query, today]);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="pipeline-page">
      <header className="pipeline-heading">
        <div>
          <p className="pipeline-eyebrow">Pipeline</p>
          <h1>Follow-ups</h1>
          <p>Reach the people who are waiting to hear from you.</p>
        </div>
        <span className="pipeline-count">{total} leads</span>
      </header>
      <div className="pipeline-controls">
        <label className="pipeline-search">
          <Icon name="Search" size={19} />
          <input
            className="field"
            type="search"
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search follow-ups"
            aria-label="Search follow-ups"
          />
          {query && (
            <button
              className="iconbtn"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <Icon name="Close" size={17} />
            </button>
          )}
        </label>
        <div className="pipeline-filters" role="group" aria-label="Lead temperature">
          {[
            ["All", total],
            ["Warm", groups.flatMap((group) => group.rows).filter((item) => item.temp === "warm").length],
            ["Cold", groups.flatMap((group) => group.rows).filter((item) => item.temp === "cold").length],
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
      </div>
      {total === 0 ? (
        <Card className="pipeline-empty">
          <span className="pipeline-empty-icon"><Icon name="Check" size={22} /></span>
          <h2>You're caught up</h2>
          <p>No follow-ups match this filter.</p>
        </Card>
      ) : (
        <div className="pipeline-groups">
          {groups.filter((group) => group.rows.length > 0).map((group) => (
            <section className="pipeline-group" key={group.title}>
              <header><h2>{group.title}</h2><span>{group.rows.length}</span></header>
              <div className="pipeline-list">
                {group.rows.map((client) => (
                  <ClientRow key={`${client.date}-${client.id}`} client={client} date={client.date} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
