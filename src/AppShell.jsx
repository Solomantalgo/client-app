import { useState, useEffect } from "react";

const views = [
  {
    group: "Work",
    items: [
      ["today", "Today"],
      ["outreach", "Outreach"],
      ["followups", "Due"],
      ["ongoing", "Ongoing"],
    ],
  },
  { group: "Money", items: [["payments", "Money"]] },
  {
    group: "Records",
    items: [
      ["stats", "Stats"],
      ["history", "History"],
      ["flow", "Guide"],
    ],
  },
];
const titles = {
  today: "Today's Session",
  outreach: "Outreach Scheduler",
  followups: "Follow-Ups",
  ongoing: "Ongoing Projects",
  payments: "Money",
  stats: "Performance Stats",
  history: "History",
  flow: "System Flow",
};

export default function AppShell({
  tab,
  setTab,
  pendingCount,
  cloudStatus,
  onSync,
  onOpenCloud,
  onReset,
  topExtra,
  children,
  banner,
  onDismissBanner,
  detail,
}) {
  const [more, setMore] = useState(false);
  const [lastPipeline, setLastPipeline] = useState("followups");
  const pipeline = ["outreach", "followups", "ongoing"].includes(tab);
  const select = (key) => {
    setTab(key);
    setMore(false);
    if (["outreach", "followups", "ongoing"].includes(key))
      setLastPipeline(key);
  };
  const statusTone = /synced|connected/i.test(cloudStatus)
    ? "green"
    : /pending|syncing/i.test(cloudStatus)
      ? "orange"
      : "grey";
  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(onDismissBanner, 8000);
    return () => clearTimeout(timer);
  }, [banner, onDismissBanner]);
  const navItems = [
    ["today", "Today"],
    ["pipeline", "Pipeline"],
    ["payments", "Money"],
    ["more", "More"],
  ];
  return (
    <div className="app-shell os-shell">
      <aside className="os-sidebar">
        <div className="os-brand">
          SOLO <span>SALES OS</span>
        </div>
        <nav>
          {views.map((group) => (
            <section key={group.group}>
              <h2>{group.group}</h2>
              {group.items.map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => select(key)}
                >
                  {label}
                  {key === "followups" && pendingCount > 0 && (
                    <i>{pendingCount}</i>
                  )}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <footer>
          <button onClick={onSync}>↻ Sync now</button>
          <button onClick={onOpenCloud}>Cloud settings</button>
          <button className="danger" onClick={onReset}>
            Reset data
          </button>
        </footer>
      </aside>
      <div className="os-main">
        <header className="os-topbar">
          <h1>{titles[tab] || "Today"}</h1>
          <button
            className={`os-sync ${statusTone}`}
            onClick={onSync}
            title="Sync now"
          >
            <span />
            {cloudStatus}
          </button>
          {tab === "today" && topExtra}
        </header>
        {banner && (
          <div className="os-banner" role="status">
            <span>{banner}</span>
            <button aria-label="Dismiss notification" onClick={onDismissBanner}>
              ×
            </button>
          </div>
        )}
        {pipeline && (
          <nav
            className={`os-segments${detail ? " has-detail" : ""}`}
            aria-label="Pipeline views"
          >
            {[
              ["outreach", "Outreach"],
              ["followups", `Due${pendingCount ? ` (${pendingCount})` : ""}`],
              ["ongoing", "Ongoing"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => select(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <main className={`os-content${detail ? " has-detail" : ""}`}>
          <div className="os-list">{children}</div>
          {detail && <section className="os-detail">{detail}</section>}
        </main>
      </div>
      <nav className="os-mobile-nav" aria-label="Main navigation">
        {navItems.map(([key, label]) => (
          <button
            key={key}
            className={
              (
                key === "pipeline"
                  ? pipeline
                  : key === "more"
                    ? more
                    : tab === (key === "money" ? "payments" : key)
              )
                ? "active"
                : ""
            }
            onClick={() => {
              if (key === "pipeline") select(lastPipeline);
              else if (key === "more") setMore((v) => !v);
              else select(key === "money" ? "payments" : key);
            }}
          >
            {label}
            {key === "pipeline" && pendingCount > 0 && <i>{pendingCount}</i>}
          </button>
        ))}
      </nav>
      {more && (
        <>
          <button
            className="os-sheet-backdrop"
            aria-label="Close menu"
            onClick={() => setMore(false)}
          />
          <section className="os-more-sheet">
            <h2>More</h2>
            {[
              ["stats", "Stats"],
              ["history", "History"],
              ["flow", "Guide"],
            ].map(([key, label]) => (
              <button key={key} onClick={() => select(key)}>
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                setMore(false);
                onSync();
              }}
            >
              Sync now
            </button>
            <button
              onClick={() => {
                setMore(false);
                onOpenCloud();
              }}
            >
              Cloud settings
            </button>
            <button
              className="danger"
              onClick={() => {
                setMore(false);
                onReset();
              }}
            >
              Reset data
            </button>
          </section>
        </>
      )}
    </div>
  );
}
