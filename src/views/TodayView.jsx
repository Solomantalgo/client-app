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
  const remoteSequence = outreach?.remotePointer || 1;
  const physicalSequence = outreach?.physicalPointer || 120;
  const track = activeTrack === "physical" ? "physical" : "remote";
  const sequence = track === "physical" ? physicalSequence : remoteSequence;
  const area = areas.find((item) => item.sequence === sequence);
  const selectedArea = area || { area: "Choose the next area", division: "" };
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
  const circumference = 100;
  const progressValue = circumference * progress;

  return (
    <div className="today-page">
      <header className="today-page-header">
        <div>
          <p>{formatToday(today)}</p>
          <h1>
            {getPeriodGreeting()}, {ownerFirstName}
          </h1>
          <span>Here’s your outreach and follow-up snapshot.</span>
        </div>
        <button className="btn btn-primary" onClick={onLogLead}>
          <Icon name="Plus" size={18} /> Log lead
        </button>
      </header>

      <section className="today-summary" aria-label="Daily summary">
        <div className="today-summary-item">
          <span>Today’s pitches</span>
          <strong>
            {todayClients.length}
            <small> / {target}</small>
          </strong>
          <span className="today-summary-detail">
            {Math.max(0, target - todayClients.length)} to target
          </span>
        </div>
        <button className="today-summary-item" onClick={onOpenDue}>
          <span>Follow-ups due</span>
          <strong>{pendingCount}</strong>
          <span className="today-summary-detail">Open pipeline</span>
        </button>
        <button
          className="today-summary-item"
          onClick={() => onOpenMoney("Client balances")}
        >
          <span>Active projects</span>
          <strong>{activeProjects}</strong>
          <span className="today-summary-detail">Current ongoing work</span>
        </button>
        <button
          className="today-summary-item"
          onClick={() => onOpenMoney("Monthly earnings")}
        >
          <span>Earned this month</span>
          <strong>{fmtUGX(monthSummary.earned)}</strong>
          <span className="today-summary-detail">Cash received this month</span>
        </button>
      </section>

      <div className="today-columns">
        <div className="today-work-column">
          <Card className="today-session-card">
            <div className="today-session-top">
              <div
                className="today-session-ring"
                aria-label={`${todayClients.length} of ${target} pitches`}
              >
                <svg viewBox="0 0 40 40" aria-hidden="true">
                  <circle className="today-ring-track" cx="20" cy="20" r="16" />
                  <circle
                    className="today-ring-value"
                    cx="20"
                    cy="20"
                    r="16"
                    strokeDasharray={`${progressValue} ${circumference - progressValue}`}
                  />
                </svg>
                <strong>
                  {todayClients.length}
                  <small>/{target}</small>
                </strong>
              </div>
              <div className="today-session-copy">
                <p className="today-section-kicker">Outreach session</p>
                <h2>Pitches today</h2>
                <p>
                  {target > todayClients.length
                    ? `${target - todayClients.length} more to reach your target`
                    : "Daily target reached"}
                </p>
              </div>
              <details className="today-target-menu">
                <summary aria-label="Edit daily target">
                  <Icon name="Edit" size={18} />
                  <span>Edit target</span>
                </summary>
                <div className="today-target-controls">
                  <button
                    aria-label="Decrease target"
                    onClick={() => onTargetChange(Math.max(1, target - 1))}
                  >
                    −
                  </button>
                  <strong>{target}</strong>
                  <button
                    aria-label="Increase target"
                    onClick={() => onTargetChange(target + 1)}
                  >
                    +
                  </button>
                </div>
              </details>
            </div>
            <div className="today-progress-track">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="today-session-chips">
              <span className="today-chip warm">
                Warm{" "}
                <b>
                  {
                    todayClients.filter((client) => client.temp === "warm")
                      .length
                  }
                </b>
              </span>
              <span className="today-chip cold">
                Cold{" "}
                <b>
                  {
                    todayClients.filter((client) => client.temp === "cold")
                      .length
                  }
                </b>
              </span>
              <span className="today-chip neutral">
                Follow-up pending{" "}
                <b>
                  {
                    todayClients.filter(
                      (client) => client.followUp === "needed",
                    ).length
                  }
                </b>
              </span>
              <span className="today-chip success">
                Done{" "}
                <b>
                  {
                    todayClients.filter((client) => client.followUp === "done")
                      .length
                  }
                </b>
              </span>
            </div>
          </Card>

          <Card className="today-next-stop">
            <header className="today-section-heading">
              <div>
                <p className="today-section-kicker">Next stop</p>
                <h2>Your next outreach area</h2>
              </div>
              <div
                className="today-track-selector"
                role="group"
                aria-label="Outreach track"
              >
                <button
                  className={track === "physical" ? "selected" : ""}
                  onClick={() => setActiveTrack("physical")}
                >
                  Physical
                </button>
                <button
                  className={track === "remote" ? "selected" : ""}
                  onClick={() => setActiveTrack("remote")}
                >
                  Remote
                </button>
              </div>
            </header>
            <div className="today-area-detail">
              <span className="today-area-icon">
                <Icon
                  name={track === "physical" ? "Pipeline" : "Message"}
                  size={20}
                />
              </span>
              <div>
                <h3>{selectedArea.area}</h3>
                <p>
                  {selectedArea.division || "Outreach plan"} · Stop {sequence}{" "}
                  of 120
                </p>
              </div>
            </div>
            <div className="today-stop-actions">
              <button
                className="btn btn-primary"
                onClick={() => onMarkDone(track)}
              >
                Mark stop done
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onAddLead(selectedArea, track)}
              >
                Log a lead here
              </button>
            </div>
          </Card>

          <section className="today-activity-section">
            <header className="today-section-heading">
              <div>
                <p className="today-section-kicker">Today</p>
                <h2>Recent leads</h2>
              </div>
              <span className="today-count-chip">
                {todayClients.length}{" "}
                {todayClients.length === 1 ? "client" : "clients"}
              </span>
            </header>
            <div className="today-client-list">
              {todayClients.length ? (
                todayClients.map((client) => (
                  <ClientRow key={client.id} client={client} date={today} />
                ))
              ) : (
                <div className="today-empty">
                  <span className="today-empty-icon">
                    <Icon name="Today" size={20} />
                  </span>
                  <strong>No leads logged today</strong>
                  <span>Log your first lead to start today’s activity.</span>
                  <button className="btn btn-secondary" onClick={onLogLead}>
                    Log a lead
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="today-attention-column">
          <Card className="today-attention-card">
            <header className="today-section-heading">
              <div>
                <p className="today-section-kicker">Priority</p>
                <h2>Needs attention</h2>
              </div>
              <button className="today-link" onClick={onOpenDue}>
                See all
              </button>
            </header>
            <h3>Overdue follow-ups</h3>
            {overdue.length ? (
              <div className="today-attention-list">
                {overdue.map((client) => (
                  <div
                    className="today-attention-row"
                    key={`${client.date}-${client.id}`}
                  >
                    <ClientRow client={client} date={client.date} highlight />
                  </div>
                ))}
              </div>
            ) : (
              <div className="today-quiet-state">
                <Icon name="Check" size={18} />
                <span>You’re up to date on follow-ups.</span>
              </div>
            )}

            <div className="today-attention-divider" />
            <h3>Largest current balances</h3>
            {biggestBalances.length ? (
              biggestBalances.map((balance) => (
                <button
                  className="today-balance-row"
                  key={`${balance.id}-${balance.service}`}
                  onClick={() => onOpenMoney("Client balances")}
                >
                  <span>
                    <strong>{balance.name}</strong>
                    <small>{balance.service}</small>
                  </span>
                  <b>{fmtUGX(balance.balance)}</b>
                </button>
              ))
            ) : (
              <div className="today-quiet-state">
                <span>No current client balances are due.</span>
              </div>
            )}
          </Card>

          <Card className="today-money-snapshot">
            <header className="today-section-heading">
              <div>
                <p className="today-section-kicker">Money</p>
                <h2>Cash snapshot</h2>
              </div>
              <button
                className="today-link"
                onClick={() => onOpenMoney("Overview")}
              >
                Open money
              </button>
            </header>
            <div className="today-snapshot-values">
              <div>
                <span>Received this month</span>
                <b>
                  {fmtUGX(
                    monthSummary.earned +
                      monthSummary.otherReceived +
                      monthSummary.unclassified,
                  )}
                </b>
              </div>
              <div>
                <span>Available in app</span>
                <b>{fmtUGX(moneyTotals.available)}</b>
              </div>
              <div>
                <span>Current outstanding</span>
                <b>
                  {fmtUGX(
                    outstandingBalances(clients).reduce(
                      (sum, item) => sum + item.balance,
                      0,
                    ),
                  )}
                </b>
              </div>
            </div>
            <p className="today-snapshot-note">
              Recorded app totals; account balances are not independently
              verified.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
