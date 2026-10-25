import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import ClientRow from "../clients/ClientRow.jsx";
import "./OutreachView.css";

export default function OutreachView({
  outreach,
  clients,
  target,
  today,
  areas,
  onUndoLog,
  onOpenAddClient,
  onMarkDone,
  onAddLead,
}) {
  const [track, setTrack] = useState("physical");
  const [planOpen, setPlanOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const remoteSeq = outreach?.remotePointer || 1;
  const physicalSeq = outreach?.physicalPointer || 120;
  const remoteArea = areas.find((area) => area.sequence === remoteSeq) || areas[0];
  const physicalArea = areas.find((area) => area.sequence === physicalSeq) || areas[119];
  const todayClients = clients[today] || [];
  const progress = target ? Math.min(100, (todayClients.length / target) * 100) : 0;
  const nextArea = track === "physical" ? physicalArea : remoteArea;
  const logs = outreach?.logs || [];
  const filteredLogs = logs.filter((log) => logFilter === "all" || log.track === logFilter);
  const filteredAreas = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    if (!value) return areas;
    return areas.filter((area) =>
      `${area.area} ${area.division} ${area.sequence}`.toLocaleLowerCase().includes(value),
    );
  }, [areas, search]);

  return (
    <div className="outreach-page">
      <header className="outreach-heading">
        <div><p className="outreach-kicker">Work</p><h1>Outreach</h1><p>Your next stop and today's session.</p></div>
        <button className="btn btn-primary" onClick={onOpenAddClient}><Icon name="Plus" size={18} /> Add client</button>
      </header>
      <div className="outreach-grid">
        <div className="outreach-column">
          <Card className="outreach-session">
            <header className="outreach-card-head">
              <div><span className="outreach-kicker">Today's session</span><h2>{todayClients.length} of {target} pitches</h2></div>
              <button className="btn btn-secondary" onClick={onOpenAddClient}>Add client</button>
            </header>
            <div className="outreach-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="outreach-stat-chips">
              <span className="warm">Warm <b>{todayClients.filter((client) => client.temp === "warm").length}</b></span>
              <span className="cold">Cold <b>{todayClients.filter((client) => client.temp === "cold").length}</b></span>
              <span>Pending <b>{todayClients.filter((client) => client.followUp === "needed").length}</b></span>
            </div>
            <div className="outreach-list">
              {todayClients.length ? todayClients.map((client) => (
                <ClientRow key={client.id} client={client} date={today} />
              )) : (
                <div className="outreach-empty">
                  <strong>No pitches logged today</strong>
                  <span>Add a client or log a lead from your next stop.</span>
                </div>
              )}
            </div>
          </Card>
          <Card className="outreach-next-card">
            <header className="outreach-card-head">
              <div><span className="outreach-kicker">Next stop</span><h2>{nextArea.area}</h2><p>{nextArea.division} · Stop {nextArea.sequence} of 120</p></div>
              <div className="outreach-track-toggle" role="group" aria-label="Outreach track">
                {[["physical", "Physical"], ["remote", "Remote"]].map(([key, label]) => (
                  <button key={key} className={track === key ? "active" : ""} onClick={() => setTrack(key)}>{label}</button>
                ))}
              </div>
            </header>
            <div className="outreach-next-actions">
              <button className="btn btn-primary" onClick={() => onMarkDone(track)}>Mark stop done</button>
              <button className="btn btn-secondary" onClick={() => onAddLead(nextArea, track)}>Log a lead here</button>
            </div>
          </Card>
        </div>
        <div className="outreach-column">
          <Card className="outreach-rotation-card">
            <header><span className="outreach-kicker">Rotation plan</span><h2>120-area progress</h2><span className="outreach-lap">Lap {(outreach?.laps || 0) + 1}</span></header>
            {[["Remote · forward", remoteSeq, remoteArea], ["Physical · backward", 121 - physicalSeq, physicalArea]].map(([label, current, area]) => (
              <div className="outreach-track-row" key={label}>
                <div><strong>{label}</strong><span>{current} of 120 · next {area.area}</span></div>
                <div className="outreach-progress"><i style={{ width: `${(current / 120) * 100}%` }} /></div>
              </div>
            ))}
          </Card>
          <button className="outreach-list-action" onClick={() => setPlanOpen(true)}>
            <span><strong>Full 120-area plan</strong><small>Search the rotation and see current positions</small></span><Icon name="ChevronRight" size={19} />
          </button>
          <button className="outreach-list-action" onClick={() => setLogsOpen(true)}>
            <span><strong>History logs</strong><small>{logs.length} completed stops and rotation events</small></span><Icon name="ChevronRight" size={19} />
          </button>
        </div>
      </div>
      {planOpen && (
        <div className="outreach-overlay" onMouseDown={(event) => event.target === event.currentTarget && setPlanOpen(false)}>
          <section className="outreach-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title">
            <header><div><span className="outreach-kicker">Reference</span><h2 id="plan-title">120-area plan</h2></div><button className="iconbtn" onClick={() => setPlanOpen(false)} aria-label="Close area plan"><Icon name="Close" /></button></header>
            <label className="outreach-search"><Icon name="Search" size={18} /><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search areas" /></label>
            <div className="outreach-area-list">
              {filteredAreas.map((area) => {
                const remote = area.sequence === remoteSeq;
                const physical = area.sequence === physicalSeq;
                return <div className={`outreach-area${remote || physical ? " current" : ""}`} key={area.sequence}>
                  <span>{area.sequence}</span><div><strong>{area.area}</strong><small>{area.division} · Month {area.month}, week {area.week}</small></div>
                  {remote && <i>Remote next</i>}{physical && <i>Physical next</i>}
                </div>;
              })}
            </div>
          </section>
        </div>
      )}
      {logsOpen && (
        <div className="outreach-overlay" onMouseDown={(event) => event.target === event.currentTarget && setLogsOpen(false)}>
          <section className="outreach-dialog" role="dialog" aria-modal="true" aria-labelledby="logs-title">
            <header><div><span className="outreach-kicker">Records</span><h2 id="logs-title">Outreach history</h2></div><button className="iconbtn" onClick={() => setLogsOpen(false)} aria-label="Close history logs"><Icon name="Close" /></button></header>
            <div className="outreach-track-toggle" role="group" aria-label="Filter history logs">
              {[["all", "All"], ["physical", "Physical"], ["remote", "Remote"]].map(([key, label]) => <button key={key} className={logFilter === key ? "active" : ""} onClick={() => setLogFilter(key)}>{label}</button>)}
            </div>
            <div className="outreach-log-list">
              {filteredLogs.length ? filteredLogs.map((log, index) => (
                <article className="outreach-log" key={log.id}>
                  <div><strong>{log.area}</strong><small>{log.division} · {new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kampala" }).format(new Date(log.completedAt))}</small></div>
                  <span>{log.track === "lap" ? "Lap" : log.track}</span>
                  {index === 0 && log.track !== "lap" && <button className="btn btn-ghost" onClick={() => onUndoLog(log.id)}>Undo</button>}
                </article>
              )) : <p className="outreach-empty">No history logs for this filter.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
