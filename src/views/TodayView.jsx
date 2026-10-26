import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import ClientRow from "../clients/ClientRow.jsx";
import { outstandingBalances } from "../clients.js";
import { fmtUGX } from "../lib/format.js";
import { getBalances, getTransactions } from "../money.js";
import { currentKampalaMonth, summarizeMonth } from "../reporting/earnings.js";
import "./TodayView.css";

function daysBetween(later, earlier) {
  const [ly, lm, ld] = later.split("-").map(Number);
  const [ey, em, ed] = earlier.split("-").map(Number);
  return Math.max(
    0,
    Math.floor(
      (Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / 86400000,
    ),
  );
}

function getPeriodGreeting() {
  const parts = new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 12);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(value) {
  return new Intl.DateTimeFormat("en-UG", {
    timeZone: "Africa/Kampala",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+03:00`));
}

export default function TodayView({
  outreach,
  clients,
  data,
  target,
  today,
  pendingCount,
  profile,
  onTargetChange,
  onMarkDone,
  onAddLead,
  onLogLead,
  onOpenDue,
  onOpenMoney,
  areas,
}) {
  const [activeTrack, setActiveTrack] = useState("physical");
  const sequence = activeTrack === "physical"
    ? outreach?.physicalPointer || 120
    : outreach?.remotePointer || 1;
  const selectedArea = areas.find((item) => item.sequence === sequence) || {
    area: "Choose the next area",
    division: "",
  };
  const todayClients = clients[today] || [];
  const allClients = Object.entries(clients).flatMap(([date, entries]) =>
    entries.map((client) => ({ ...client, date })),
  );
  const overdue = allClients
    .filter(
      (client) =>
        client.status !== "ongoing" &&
        !client.paused &&
        client.followUp !== "done" &&
        client.followUpDate &&
        client.followUpDate < today,
    )
    .map((client) => ({
      ...client,
      overdueDays: daysBetween(today, client.followUpDate),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 4);
  const biggestBalances = useMemo(
    () =>
      outstandingBalances(clients)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3),
    [clients],
  );
  const moneyTotals = useMemo(
    () => getBalances(getTransactions(data), data.finance || {}),
    [data],
  );
  const monthSummary = useMemo(
    () => summarizeMonth(data, currentKampalaMonth()),
    [data],
  );
  const activeProjects = allClients.filter(
    (client) => client.status === "ongoing" && !client.paused,
  ).length;
  const ownerFirstName = profile?.ownerName?.trim().split(/\s+/)[0] || "Solo";
  const progress = target > 0 ? Math.min(1, todayClients.length / target) : 0;

  return (
    <div className="today-page studio-home">
      <header className="studio-greeting">
        <div>
          <h1>Today</h1>
          <h2>{getPeriodGreeting()}, {ownerFirstName}</h2>
          <p>{formatToday(today)}</p>
        </div>
      </header>

      <div className="studio-home-top">
        <Card className="studio-panel studio-outreach">
          <p className="studio-kicker">Next outreach area</p>
          <div className="studio-area-line">
            <Icon name="Pipeline" size={31} />
            <h2>{selectedArea.area}</h2>
          </div>
          <p className="studio-area-subtitle">{selectedArea.division || "Outreach plan"}</p>
          <div className="studio-track-control" role="group" aria-label="Outreach track">
            <button
              className={activeTrack === "physical" ? "selected" : ""}
              onClick={() => setActiveTrack("physical")}
            >
              <Icon name="Pipeline" size={17} /> Physical
            </button>
            <button
              className={activeTrack === "remote" ? "selected" : ""}
              onClick={() => setActiveTrack("remote")}
            >
              <Icon name="Message" size={17} /> Remote
            </button>
          </div>
          <div className="studio-outreach-actions">
            <button className="btn btn-primary" onClick={() => onMarkDone(activeTrack)}>
              <Icon name="Check" size={17} /> Mark stop done
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onAddLead(selectedArea, activeTrack)}
            >
              <Icon name="Plus" size={17} /> Log lead
            </button>
          </div>
        </Card>

        <Card className="studio-panel studio-pitches">
          <div className="studio-metric-heading">
            <Icon name="Pipeline" size={20} />
            <span>Pitches today</span>
          </div>
          <div className="studio-pitch-count">
            {todayClients.length}<small> / {target}</small>
          </div>
          <div className="studio-progress-track">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="studio-target-row">
            <span>{Math.max(0, target - todayClients.length)} to target</span>
            <details className="today-target-menu">
              <summary aria-label="Edit daily target">
                <Icon name="Edit" size={16} /> <span>Edit target</span>
              </summary>
              <div className="today-target-controls">
                <button
                  aria-label="Decrease target"
                  onClick={() => onTargetChange(Math.max(1, target - 1))}
                >
                  −
                </button>
                <strong>{target}</strong>
                <button aria-label="Increase target" onClick={() => onTargetChange(target + 1)}>
                  +
                </button>
              </div>
            </details>
          </div>
          <div className="studio-pitch-divider" />
          <button className="studio-followups-link" onClick={onOpenDue}>
            <span><Icon name="History" size={19} /> Follow-ups due</span>
            <b>{pendingCount}</b>
          </button>
        </Card>

        <button
          className="studio-panel studio-earnings"
          onClick={() => onOpenMoney("Monthly earnings")}
        >
          <div className="studio-earnings-label">
            <Icon name="Money" size={22} />
            <span>Earned this month</span>
          </div>
          <strong>{fmtUGX(monthSummary.earned)}</strong>
          <span className="studio-earnings-link">
            View earnings <Icon name="ChevronRight" size={17} />
          </span>
        </button>
      </div>

      <div className="studio-home-bottom">
        <Card className="studio-panel studio-leads">
          <header className="studio-panel-heading">
            <h2>Today’s leads</h2>
            <span>{todayClients.length} {todayClients.length === 1 ? "client" : "clients"}</span>
          </header>
          <div className="today-client-list">
            {todayClients.length ? todayClients.map((client) => (
              <ClientRow key={client.id} client={client} date={today} />
            )) : (
              <div className="studio-empty">
                <Icon name="Today" size={27} />
                <strong>No leads logged yet</strong>
                <p>Log your first lead to start today’s activity.</p>
                <button className="btn btn-primary" onClick={onLogLead}>
                  <Icon name="Plus" size={17} /> Log lead
                </button>
              </div>
            )}
          </div>
        </Card>

        <div className="studio-attention-stack">
          <Card className="studio-panel studio-attention">
            <header className="studio-panel-heading">
              <h2>Needs attention</h2>
              <button className="studio-link" onClick={onOpenDue}>
                View all <Icon name="ChevronRight" size={16} />
              </button>
            </header>
            {overdue.length ? (
              <div className="studio-attention-list">
                {overdue.map((client) => (
                  <ClientRow
                    key={`${client.date}-${client.id}`}
                    client={client}
                    date={client.date}
                    highlight
                  />
                ))}
              </div>
            ) : (
              <div className="studio-calm-empty">
                <Icon name="Check" size={17} /> You’re up to date on follow-ups.
              </div>
            )}
            {biggestBalances.length > 0 && (
              <div className="studio-collectibles">
                <h3>Balances to collect</h3>
                {biggestBalances.map((balance) => (
                  <button
                    className="studio-balance-row"
                    key={`${balance.id}-${balance.service}`}
                    onClick={() => onOpenMoney("Client balances")}
                  >
                    <span><strong>{balance.name}</strong><small>{balance.service}</small></span>
                    <b>{fmtUGX(balance.balance)}</b>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="studio-panel studio-snapshot">
            <header className="studio-panel-heading">
              <h2>Money snapshot</h2>
              <button className="studio-link" onClick={() => onOpenMoney("Overview")}>
                Open money <Icon name="ChevronRight" size={16} />
              </button>
            </header>
            <div><span>Received this month</span><b>{fmtUGX(monthSummary.earned + monthSummary.otherReceived + monthSummary.unclassified)}</b></div>
            <div><span>Available in app</span><b>{fmtUGX(moneyTotals.available)}</b></div>
            <div><span>Current outstanding</span><b>{fmtUGX(outstandingBalances(clients).reduce((sum, item) => sum + item.balance, 0))}</b></div>
            <div><span>Active projects</span><b>{activeProjects}</b></div>
            <p>Recorded app totals; account balances are not independently verified.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
