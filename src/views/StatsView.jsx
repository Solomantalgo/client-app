import { useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { fmtUGX, todayStr } from "../lib/format.js";
import { outstandingBalances } from "../clients.js";
import "./StatsView.css";

const periods = ["Today", "7 days", "30 days", "Year"];

function dateOffset(days) {
  const [year, month, day] = todayStr().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

export default function StatsView({ clients, target }) {
  const [period, setPeriod] = useState("30 days");
  const today = todayStr();
  const all = useMemo(
    () => Object.entries(clients || {}).flatMap(([date, entries]) => entries.map((client) => ({ ...client, date }))),
    [clients],
  );
  const cutoff = period === "Today" ? today : period === "7 days" ? dateOffset(6) : period === "30 days" ? dateOffset(29) : `${today.slice(0, 4)}-01-01`;
  const selected = all.filter((client) => client.date >= cutoff && client.date <= today);
  const pitches = selected.length;
  const warm = selected.filter((client) => client.temp === "warm").length;
  const won = selected.filter((client) => client.status === "ongoing").length;
  const followed = selected.filter((client) => client.followUp === "done").length;
  const conversion = pitches ? Math.round((won / pitches) * 100) : 0;
  const outstanding = outstandingBalances(clients).reduce((sum, item) => sum + item.balance, 0);
  const totalPitches = all.length;
  const totalWon = all.filter((client) => client.status === "ongoing").length;
  const totalLeads = all.filter((client) => client.status !== "ongoing").length;
  const analyses = [
    {
      title: "Pitch method",
      first: "In-person",
      firstCount: selected.filter((client) => client.pitchMethod === "In-Person").length,
      second: "WhatsApp",
      secondCount: selected.filter((client) => client.pitchMethod === "WhatsApp").length,
    },
    {
      title: "Lead temperature",
      first: "Warm",
      firstCount: warm,
      second: "Cold",
      secondCount: selected.filter((client) => client.temp === "cold").length,
    },
    {
      title: "Decision maker",
      first: "Owner present",
      firstCount: selected.filter((client) => client.ownerAround === "yes").length,
      second: "Owner absent",
      secondCount: selected.filter((client) => client.ownerAround === "no").length,
    },
  ];
  const kpis = [
    ["Pitches", pitches],
    ["Warm leads", warm],
    ["Won", won],
    ["Conversion", `${conversion}%`],
  ];
  const funnel = [
    ["Pitched", pitches],
    ["Warm", warm],
    ["Followed up", followed],
    ["Won", won],
  ];
  const maxValue = Math.max(1, ...funnel.map(([, value]) => value));

  return (
    <div className="stats-page">
      <header className="stats-heading">
        <div><p>Insights</p><h1>Performance</h1><span>See how outreach is turning into client work.</span></div>
      </header>
      <div className="stats-periods" role="group" aria-label="Performance period">
        {periods.map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}
      </div>
      {selected.length === 0 ? (
        <Card className="stats-empty"><h2>No activity in this period</h2><p>Log outreach to see your performance here.</p></Card>
      ) : (
        <>
          <section className="stats-kpis">
            {kpis.map(([label, value]) => <Card key={label}><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString("en-UG") : value}</strong></Card>)}
          </section>
          <div className="stats-layout">
            <div className="stats-main">
              <Card className="stats-target">
                <header><div><h2>Today's outreach target</h2><p>{selected.filter((client) => client.date === today).length} of {target} pitches today</p></div><strong>{target ? Math.min(100, Math.round((all.filter((client) => client.date === today).length / target) * 100)) : 0}%</strong></header>
                <progress
                  className="stats-target-progress"
                  max={target || 1}
                  value={Math.min(target || 1, all.filter((client) => client.date === today).length)}
                />
              </Card>
              <Card className="stats-funnel">
                <header><h2>Outreach funnel</h2><span>{period}</span></header>
                {funnel.map(([label, value], index) => <div className="stats-funnel-row" key={label}><span>{label}</span><i><b className={index === 3 ? "won" : ""} style={{ width: `${(value / maxValue) * 100}%` }} /></i><strong>{value}</strong></div>)}
              </Card>
              <div className="stats-analysis">
                {analyses.map((item) => {
                  const total = item.firstCount + item.secondCount;
                  const firstShare = total ? (item.firstCount / total) * 100 : 0;
                  return <Card key={item.title}><h2>{item.title}</h2><div className="stats-analysis-values"><span>{item.first} <b>{item.firstCount}</b></span><span>{item.second} <b>{item.secondCount}</b></span></div><div className="stats-bar split"><i style={{ width: `${firstShare}%` }} /><b style={{ width: `${100 - firstShare}%` }} /></div></Card>;
                })}
              </div>
            </div>
            <aside className="stats-aside">
              <Card><h2>All-time conversion</h2><strong className="stats-big-number">{totalPitches ? Math.round((totalWon / totalPitches) * 100) : 0}%</strong><p>{totalWon} ongoing from {totalPitches} pitches</p><div className="stats-divider" /><p>{totalLeads} leads · {fmtUGX(outstanding)} current client balances</p></Card>
              <Card><h2>Leads to ongoing</h2><strong className="stats-big-number">{totalWon}</strong><p>Clients converted from outreach leads</p></Card>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
