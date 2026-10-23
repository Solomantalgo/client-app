import { useEffect, useState } from "react";
import { Icon } from "./components/Icon.jsx";
import QuickAdd from "./QuickAdd.jsx";
import MoreView from "./views/MoreView.jsx";

const views = [
  {
    group: "Work",
    items: [
      ["today", "Today", "Today"],
      ["outreach", "Outreach", "Pipeline"],
      ["followups", "Due", "Today"],
      ["ongoing", "Ongoing", "Pipeline"],
    ],
  },
  { group: "Money", items: [["payments", "Money", "Money"]] },
  {
    group: "Records",
    items: [
      ["stats", "Stats", "More"],
      ["history", "History", "More"],
      ["flow", "Playbook", "Book"],
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
  flow: "Playbook",
};

export default function AppShell({
  tab,
  setTab,
  pendingCount,
  cloudStatus,
  onSync,
  onOpenCloud,
  onOpenProfile,
  onReset,
  children,
  banner,
  onDismissBanner,
  detail,
  onSearch,
  onExportBackup,
  searchPanel,
  onQuickLead,
  onQuickIncome,
  onQuickExpense,
}) {
  const [more, setMore] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [lastPipeline, setLastPipeline] = useState("followups");
  const [logoFailed, setLogoFailed] = useState(false);
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
    ["today", "Today", "Today"],
    ["pipeline", "Pipeline", "Pipeline"],
    ["quick-add", "Add", "Plus"],
    ["payments", "Money", "Money"],
    ["more", "More", "More"],
  ];
  const logo = (
    <img
      src="/assets/images/logo.png"
      alt="Solomantalgo"
      onError={() => setLogoFailed(true)}
    />
  );
  return (
    <div className="app-shell os-shell">
      <aside className="os-sidebar">
        <div className="os-brand">
          {logoFailed ? <b className="os-wordmark">Solo Sales OS</b> : logo}
        </div>
        <button
          className="btn btn-primary os-new-button"
          onClick={() => setQuickAdd(true)}
        >
          <Icon name="Plus" size={19} /> New
        </button>
        <nav>
          {views.map((group) => (
            <section key={group.group}>
              <h2>{group.group}</h2>
              {group.items.map(([key, label, icon]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => select(key)}
                >
                  <Icon name={icon} size={20} />
                  <span>{label}</span>
                  {key === "followups" && pendingCount > 0 && (
                    <i>{pendingCount}</i>
                  )}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <footer>
          <button onClick={onSync}>
            <Icon name="Sync" size={19} />
            Sync now <small>{cloudStatus}</small>
          </button>
          <button onClick={onOpenProfile}>Business profile</button>
          <button onClick={onExportBackup}>Export backup</button>
          <button onClick={onOpenCloud}>Cloud settings</button>
          <button className="danger" onClick={onReset}>
            Reset data
          </button>
        </footer>
      </aside>
      <div className="os-main">
        <header className="os-topbar">
          <div className="os-mobile-logo">{logoFailed ? <b>S</b> : logo}</div>
          <h1 title={titles[tab] || "Today"}>{titles[tab] || "Today"}</h1>
          <button
            className={`os-sync ${statusTone}`}
            onClick={onSync}
            title={`Sync now · ${cloudStatus}`}
            aria-label={`Sync now · ${cloudStatus}`}
          >
            <span /> <small>{cloudStatus}</small>
          </button>
          <button
            className="os-search-button iconbtn"
            onClick={onSearch}
            aria-label="Search"
          >
            <Icon name="Search" />
          </button>
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
        <main
          className={`os-content${detail ? " has-detail" : ""}${pipeline ? " split-pipeline" : ""}`}
        >
          {(tab === "today" || pipeline) && (
            <button className="os-inline-search" onClick={onSearch}>
              <Icon name="Search" size={19} />
              <span>Search clients, services, payments</span>
            </button>
          )}
          <div className="os-list">{children}</div>
          {detail && <section className="os-detail">{detail}</section>}
          {!detail && pipeline && (
            <section className="os-detail os-detail-empty">
              <div className="card">
                <h2>Select a client to see details</h2>
                <button className="btn btn-secondary" onClick={onSearch}>
                  <Icon name="Search" size={18} />
                  Search clients
                </button>
              </div>
            </section>
          )}
        </main>
        {searchPanel}
      </div>
      <nav className="os-mobile-nav" aria-label="Main navigation">
        {navItems.map(([key, label, icon]) => {
          const active =
            key === "pipeline"
              ? pipeline
              : key === "more"
                ? more
                : tab === (key === "payments" ? "payments" : key);
          return (
            <button
              key={key}
              className={active ? "active" : ""}
              onClick={() => {
                if (key === "quick-add") setQuickAdd(true);
                else if (key === "pipeline") select(lastPipeline);
                else if (key === "more") setMore((value) => !value);
                else select(key);
              }}
            >
              <span className={`os-nav-icon${key === "quick-add" ? " raised" : ""}`}>
                <Icon name={icon} size={22} />
                {key === "pipeline" && pendingCount > 0 && (
                  <i>{pendingCount}</i>
                )}
              </span>
              <small>{label}</small>
            </button>
          );
        })}
      </nav>
      {quickAdd && (
        <QuickAdd
          onClose={() => setQuickAdd(false)}
          onLead={() => {
            setQuickAdd(false);
            onQuickLead?.();
          }}
          onIncome={() => {
            setQuickAdd(false);
            onQuickIncome?.();
          }}
          onExpense={() => {
            setQuickAdd(false);
            onQuickExpense?.();
          }}
        />
      )}
      {more && (
        <MoreView
          cloudStatus={cloudStatus}
          onClose={() => setMore(false)}
          onNavigate={select}
          onSync={() => {
            setMore(false);
            onSync();
          }}
          onOpenProfile={() => {
            setMore(false);
            onOpenProfile();
          }}
          onExportBackup={() => {
            setMore(false);
            onExportBackup();
          }}
          onOpenCloud={() => {
            setMore(false);
            onOpenCloud();
          }}
          onReset={() => {
            setMore(false);
            onReset();
          }}
        />
      )}
    </div>
  );
}
