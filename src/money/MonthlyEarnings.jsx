import { useContext, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import { ClientActions } from "../clients/ClientActions.js";
import {
  classifyEarning,
  comparisonPeriods,
  currentKampalaMonth,
  summarizeMonth,
  summarizeRange,
  summarizeYear,
} from "../reporting/earnings.js";
import {
  buildMonthlyCsv,
  buildMonthlyDocx,
  buildMonthlyPdf,
  createMonthlyReportModel,
  monthlyReportFilename,
} from "../reporting/monthlyExports.js";
import "./MonthlyEarnings.css";

const money = (amount) =>
  `UGX ${Math.round(Number(amount) || 0).toLocaleString("en-UG")}`;

const monthLabel = (month) => {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-UG", {
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  }).format(new Date(Date.UTC(year, number - 1, 15)));
};

const shiftMonth = (month, offset) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

const reportClassText = (summary) =>
  summary.unclassified > 0
    ? `${money(summary.unclassified)} needs review`
    : "All receipts classified";

function downloadReport(blob, filename) {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("The report file could not be generated.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export default function MonthlyEarnings({
  data,
  initialMonth,
  onSave,
  onSelectTransaction,
}) {
  const actions = useContext(ClientActions);
  const currentMonth = currentKampalaMonth();
  const [month, setMonth] = useState(initialMonth || currentMonth);
  const [series, setSeries] = useState("earned");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [fullMonthComparison, setFullMonthComparison] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const summary = useMemo(() => summarizeMonth(data, month), [data, month]);
  const year = useMemo(
    () => summarizeYear(data, Number(month.slice(0, 4))),
    [data, month],
  );
  const comparison = useMemo(() => {
    const periods = comparisonPeriods(month, new Date(), fullMonthComparison);
    return {
      current: summarizeRange(data, month, periods.current),
      previous: summarizeRange(data, shiftMonth(month, -1), periods.previous),
      periods,
    };
  }, [data, month, fullMonthComparison]);
  const storedTarget = Number(
    data.settings?.monthlyEarningsTargets?.[month] || 0,
  );
  const target = targetDraft === "" ? storedTarget : Number(targetDraft) || 0;
  const sourceName = (transaction) =>
    transaction.sourceType === "client_payment"
      ? "Client work"
      : transaction.sourceType || "Unclassified";
  const transactions = summary.transactions.filter((transaction) => {
    if (sourceFilter === "All") return true;
    if (sourceFilter === "Expenses") return transaction.type === "expense";
    if (transaction.type !== "income") return false;
    if (sourceFilter === "Unclassified") {
      return !classifyEarning(transaction);
    }
    return sourceName(transaction) === sourceFilter;
  });
  const report = useMemo(
    () =>
      createMonthlyReportModel({
        month,
        summary,
        transactions,
        year,
        filterLabel: sourceFilter,
        profile: actions?.profile || data.settings?.business || {},
        generatedAt: currentBusinessDate(),
      }),
    [
      month,
      summary,
      transactions,
      year,
      sourceFilter,
      actions?.profile,
      data.settings?.business,
    ],
  );
  const maxChartValue = Math.max(
    1,
    ...year.months.flatMap((item) => [
      item.summary.earned,
      item.summary.expenses,
    ]),
  );
  const visibleMonths = year.months.filter((item) => !item.future);
  const barHeight = (value) =>
    Math.max(2, Math.round((Math.max(0, value) / maxChartValue) * 164));
  const percentChange = (() => {
    const previous = comparison.previous.earned;
    const difference = comparison.current.earned - previous;
    if (!previous && !difference) return "No change";
    if (!previous) return "New income";
    const percent = Math.round((difference / Math.abs(previous)) * 100);
    return `${difference > 0 ? "+" : ""}${money(difference)} · ${percent > 0 ? "+" : ""}${percent}%`;
  })();

  const changeMonth = (nextMonth) => {
    setMonth(nextMonth);
    setSourceFilter("All");
    setTargetDraft("");
    const url = new URL(window.location.href);
    url.searchParams.set("view", "money");
    url.searchParams.set("section", "monthly");
    url.searchParams.set("month", nextMonth);
    window.history.replaceState(window.history.state, "", url);
  };

  const saveTarget = () => {
    const nextTargets = { ...(data.settings?.monthlyEarningsTargets || {}) };
    if (target > 0) nextTargets[month] = Math.round(target);
    else delete nextTargets[month];
    onSave({
      ...data,
      settings: { ...data.settings, monthlyEarningsTargets: nextTargets },
    });
    setTargetDraft("");
  };

  const exportReport = async (format) => {
    setExportOpen(false);
    setExportStatus("");
    setExportError("");
    try {
      if (format === "csv") {
        const blob = new Blob([buildMonthlyCsv(report)], {
          type: "text/csv;charset=utf-8",
        });
        downloadReport(blob, monthlyReportFilename(month, "csv"));
      } else if (format === "pdf") {
        downloadReport(
          buildMonthlyPdf(report),
          monthlyReportFilename(month, "pdf"),
        );
      } else {
        const blob = await buildMonthlyDocx(report);
        downloadReport(blob, monthlyReportFilename(month, "docx"));
      }
      setExportStatus(
        `${format.toUpperCase()} report downloaded for ${monthLabel(month)}.`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "The report could not be exported.",
      );
    }
  };

  return (
    <div className="earnings-page">
      <header className="earnings-heading">
        <div>
          <p className="earnings-kicker">Money report · Cash received date</p>
          <h1>Monthly earnings</h1>
          <p>
            Earnings follow the date money was received, not when work began or
            was invoiced.
          </p>
        </div>
        <div className="earnings-export-wrap">
          <button
            className="btn btn-secondary earnings-export"
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((open) => !open)}
          >
            <Icon name="Download" size={18} /> Export report
          </button>
          {exportOpen && (
            <div
              className="earnings-export-menu"
              role="menu"
              aria-label="Export report"
            >
              <p>
                Exports {monthLabel(month)} using the current report filter:{" "}
                {sourceFilter}.
              </p>
              <button role="menuitem" onClick={() => exportReport("csv")}>
                CSV
              </button>
              <button role="menuitem" onClick={() => exportReport("pdf")}>
                PDF
              </button>
              <button role="menuitem" onClick={() => exportReport("docx")}>
                Word (.docx)
              </button>
            </div>
          )}
        </div>
      </header>
      {exportStatus && (
        <p className="earnings-export-status" role="status">
          {exportStatus}
        </p>
      )}
      {exportError && (
        <p className="earnings-export-error" role="alert">
          {exportError}
        </p>
      )}

      <section className="earnings-period" aria-label="Report period">
        <button
          className="iconbtn"
          onClick={() => changeMonth(shiftMonth(month, -1))}
          aria-label="Previous month"
        >
          <Icon name="ChevronLeft" size={18} />
        </button>
        <label>
          <span className="sr-only">Selected month</span>
          <input
            className="field"
            type="month"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
          />
          <strong>{monthLabel(month)}</strong>
        </label>
        <button
          className="iconbtn"
          onClick={() => changeMonth(shiftMonth(month, 1))}
          aria-label="Next month"
          disabled={month >= currentMonth}
        >
          <Icon name="ChevronRight" size={18} />
        </button>
        {month !== currentMonth && (
          <button
            className="btn btn-ghost"
            onClick={() => changeMonth(currentMonth)}
          >
            Current month
          </button>
        )}
      </section>

      <section className="earnings-summary" aria-label="Selected month totals">
        <Card className="earnings-primary-stat">
          <span>Earned</span>
          <strong>{money(summary.earned)}</strong>
          <small>{summary.incomeCount} receipts classified as earnings</small>
        </Card>
        <Card>
          <span>Other money received</span>
          <strong>{money(summary.otherReceived)}</strong>
          <small>Gifts, loans, refunds and other non-earnings</small>
        </Card>
        <Card>
          <span>Expenses</span>
          <strong>{money(summary.expenses)}</strong>
          <small>{summary.expenseCount} recorded outflows</small>
        </Card>
        <Card>
          <span>After expenses</span>
          <strong className={summary.afterExpenses < 0 ? "negative" : ""}>
            {money(summary.afterExpenses)}
          </strong>
          <small>Earned less recorded expenses · not profit</small>
        </Card>
      </section>

      {(summary.unclassified !== 0 ||
        summary.inferredDateAmount !== 0 ||
        summary.invalidDateCount > 0 ||
        summary.invalidAmountCount > 0) && (
        <div className="earnings-review" role="status">
          <strong>
            {summary.unclassified > 0
              ? reportClassText(summary)
              : "Review report records"}
          </strong>
          <span>
            {money(summary.unclassified)} in receipts has no reporting class.
            {summary.inferredDateAmount !== 0 &&
              ` ${money(summary.inferredDateAmount)} uses an inferred received date.`}
            {summary.invalidDateCount > 0 &&
              ` ${summary.invalidDateCount} records with an invalid date cannot be assigned to a month.`}
            {summary.invalidAmountCount > 0 &&
              ` ${summary.invalidAmountCount} records with invalid amounts are excluded.`}
          </span>
        </div>
      )}

      <section className="earnings-main-grid">
        <Card className="earnings-chart-card">
          <header className="earnings-section-header">
            <div>
              <h2>Year at a glance</h2>
              <p>Monthly amounts in UGX for {year.year}</p>
            </div>
            <label className="earnings-series-control">
              <span>Show</span>
              <select
                className="field"
                value={series}
                onChange={(event) => setSeries(event.target.value)}
              >
                <option value="earned">Earnings</option>
                <option value="expenses">Expenses</option>
                <option value="both">Both</option>
              </select>
            </label>
          </header>
          <div className="earnings-legend" aria-label="Chart legend">
            {series !== "expenses" && (
              <span>
                <i className="earned-dot" /> Earnings
              </span>
            )}
            {series !== "earned" && (
              <span>
                <i className="expense-dot" /> Expenses
              </span>
            )}
          </div>
          <div
            className="earnings-chart"
            role="img"
            aria-label={`Monthly earnings and expenses in ${year.year}`}
          >
            {year.months.map((item) => (
              <button
                type="button"
                key={item.month}
                className={`earnings-month-bar${item.month === month ? " selected" : ""}${item.future ? " future" : ""}`}
                onClick={() => !item.future && changeMonth(item.month)}
                disabled={item.future}
                aria-label={`${monthLabel(item.month)}: ${item.future ? "not available" : `${money(item.summary.earned)} earned, ${money(item.summary.expenses)} expenses`}`}
              >
                <span className="earnings-bars">
                  {series !== "expenses" && !item.future && (
                    <i
                      className="earned-bar"
                      style={{ height: `${barHeight(item.summary.earned)}px` }}
                    />
                  )}
                  {series !== "earned" && !item.future && (
                    <i
                      className="expense-bar"
                      style={{
                        height: `${barHeight(item.summary.expenses)}px`,
                      }}
                    />
                  )}
                  {item.future && <i className="future-bar" />}
                </span>
                <small>{monthLabel(item.month).slice(0, 3)}</small>
              </button>
            ))}
          </div>
          <p className="earnings-chart-caption">
            Future months are not shown as completed zero-income months.
          </p>
        </Card>

        <Card className="earnings-source-card">
          <header className="earnings-section-header">
            <div>
              <h2>Where earnings came from</h2>
              <p>
                {monthLabel(month)} · {summary.bySource.length} sources
              </p>
            </div>
          </header>
          {summary.bySource.length ? (
            <div className="earnings-source-list">
              {summary.bySource.map((item) => {
                const share = summary.earned
                  ? Math.max(
                      0,
                      Math.round((item.amount / summary.earned) * 100),
                    )
                  : 0;
                return (
                  <button
                    key={item.source}
                    className={`earnings-source-row${sourceFilter === item.source ? " active" : ""}`}
                    onClick={() => setSourceFilter(item.source)}
                  >
                    <span className="earnings-source-copy">
                      <span>{item.source}</span>
                      <i>
                        <b style={{ width: `${share}%` }} />
                      </i>
                    </span>
                    <strong>{money(item.amount)}</strong>
                    <small>{share}%</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="earnings-empty">
              <strong>No earnings recorded for this month</strong>
              <span>Income receipts will appear here by received date.</span>
            </div>
          )}
          {summary.unclassified !== 0 && (
            <p className="earnings-unclassified">
              Unclassified receipts: {money(summary.unclassified)}. Review them
              in Transactions to mark as earnings or other money received.
            </p>
          )}
        </Card>
      </section>

      <section className="earnings-secondary-grid">
        <Card className="earnings-compare-card">
          <header className="earnings-section-header">
            <div>
              <h2>Compared with last month</h2>
              <p>
                {comparison.periods.current?.start} to{" "}
                {comparison.periods.current?.end}
                {" · "}
                {comparison.periods.previous?.start} to{" "}
                {comparison.periods.previous?.end}
              </p>
            </div>
            <label className="earnings-toggle">
              <input
                type="checkbox"
                checked={fullMonthComparison}
                onChange={(event) =>
                  setFullMonthComparison(event.target.checked)
                }
              />
              Full months
            </label>
          </header>
          <strong className="earnings-change">{percentChange}</strong>
          <p>Earned amount in the selected comparison periods.</p>
        </Card>

        <Card className="earnings-target-card">
          <header className="earnings-section-header">
            <div>
              <h2>Monthly target</h2>
              <p>Optional goal for {monthLabel(month)}</p>
            </div>
          </header>
          <div className="earnings-target-input">
            <label>
              <span>Target amount in UGX</span>
              <input
                className="field"
                type="number"
                min="0"
                inputMode="numeric"
                value={targetDraft === "" ? storedTarget || "" : targetDraft}
                onChange={(event) => setTargetDraft(event.target.value)}
              />
            </label>
            <button className="btn btn-secondary" onClick={saveTarget}>
              Save target
            </button>
          </div>
          {target > 0 && (
            <div className="earnings-goal-progress">
              <div>
                <b>{money(summary.earned)}</b>
                <span>of {money(target)}</span>
              </div>
              <i>
                <b
                  style={{
                    width: `${Math.min(100, (summary.earned / target) * 100)}%`,
                  }}
                />
              </i>
              <small>
                {money(Math.max(0, target - summary.earned))} remaining
              </small>
            </div>
          )}
        </Card>
      </section>

      <Card className="earnings-history-card">
        <header className="earnings-section-header">
          <div>
            <h2>{year.year} monthly history</h2>
            <p>
              Year total earned {money(year.total.earned)} · average{" "}
              {money(year.monthlyAverage.earned)}
              {` across ${year.monthlyAverage.denominator} reported months`}
            </p>
          </div>
        </header>
        <div className="earnings-history-table-wrap">
          <table className="earnings-history-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Earned</th>
                <th>Other received</th>
                <th>Expenses</th>
                <th>After expenses</th>
                <th>Compare</th>
              </tr>
            </thead>
            <tbody>
              {[...visibleMonths].reverse().map((item) => (
                <tr
                  key={item.month}
                  className={item.month === month ? "selected" : ""}
                >
                  <th>
                    <button onClick={() => changeMonth(item.month)}>
                      {monthLabel(item.month)}
                    </button>
                  </th>
                  <td>{money(item.summary.earned)}</td>
                  <td>{money(item.summary.otherReceived)}</td>
                  <td>{money(item.summary.expenses)}</td>
                  <td>{money(item.summary.afterExpenses)}</td>
                  <td>{item.month === month ? percentChange : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="earnings-history-mobile">
          {[...visibleMonths].reverse().map((item) => (
            <details
              key={item.month}
              className={item.month === month ? "selected" : ""}
            >
              <summary>
                <strong>{monthLabel(item.month)}</strong>
                <b>{money(item.summary.earned)}</b>
              </summary>
              <dl>
                <div>
                  <dt>Other received</dt>
                  <dd>{money(item.summary.otherReceived)}</dd>
                </div>
                <div>
                  <dt>Expenses</dt>
                  <dd>{money(item.summary.expenses)}</dd>
                </div>
                <div>
                  <dt>After expenses</dt>
                  <dd>{money(item.summary.afterExpenses)}</dd>
                </div>
              </dl>
              <button
                className="btn btn-ghost"
                onClick={() => changeMonth(item.month)}
              >
                View month
              </button>
            </details>
          ))}
        </div>
      </Card>

      <Card className="earnings-evidence-card">
        <header className="earnings-section-header">
          <div>
            <h2>Transactions for {monthLabel(month)}</h2>
            <p>These records make up the selected report values.</p>
          </div>
          <label className="earnings-filter-select">
            <span>Evidence filter</span>
            <select
              className="field"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option>All</option>
              <option>Expenses</option>
              {summary.bySource.map((item) => (
                <option key={item.source}>{item.source}</option>
              ))}
              {summary.unclassified !== 0 && <option>Unclassified</option>}
            </select>
          </label>
        </header>
        <div className="earnings-evidence-list">
          {transactions.length ? (
            transactions.map((transaction) => (
              <button
                key={transaction.id}
                className="earnings-evidence-row"
                onClick={() => onSelectTransaction?.(transaction)}
              >
                <span>
                  <strong>
                    {transaction.clientName ||
                      transaction.description ||
                      transaction.sourceType}
                  </strong>
                  <small>
                    {transaction.reportDate} ·{" "}
                    {transaction.sourceType || "Expense"}
                  </small>
                </span>
                <b className={transaction.type === "expense" ? "negative" : ""}>
                  {transaction.type === "expense" ? "−" : "+"}
                  {money(transaction.amount)}
                </b>
                {onSelectTransaction && (
                  <span className="evidence-open">Open</span>
                )}
              </button>
            ))
          ) : (
            <div className="earnings-empty">
              <strong>No transactions match this filter</strong>
              <button
                className="btn btn-ghost"
                onClick={() => setSourceFilter("All")}
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
