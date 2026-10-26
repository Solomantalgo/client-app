import { useContext } from "react";
import { clientTotals, getClientServices } from "../clients.js";
import { ClientActions } from "./ClientActions.js";
import { fmtDate, fmtUGX, todayStr, toWaNumber } from "../lib/format.js";
import { Icon } from "../components/Icon.jsx";

export default function ClientRow({ client: c, date, highlight }) {
  const actions = useContext(ClientActions);
  const isLead = c.status !== "ongoing";
  const today = todayStr();
  const hot =
    highlight &&
    isLead &&
    (c.followUp === "needed" ||
      (c.followUp === "done" && c.followUpDate && today >= c.followUpDate));
  const balance = isLead ? 0 : clientTotals(c).balance;
  const excludedBalance = c.paused && !isLead ? balance : 0;
  const services = getClientServices(c);
  const due = services
    .map((service) => service.dueDate)
    .filter(Boolean)
    .sort()[0];
  const overdueDays =
    c.followUpDate && c.followUpDate < today
      ? Math.floor(
          (Date.parse(`${today}T00:00:00Z`) -
            Date.parse(`${c.followUpDate}T00:00:00Z`)) /
            86400000,
        )
      : 0;

  return (
    <article className={`cr${actions?.openId === c.id ? " selected" : ""}`}>
      <button
        type="button"
        className="cr-main"
        onClick={() => actions?.openClientScreen(date, c.id)}
      >
        <span
          className={`cr-avatar${c.paused ? " paused" : ""}`}
          aria-hidden="true"
        >
          {String(c.name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </span>
        <span className="cr-id">
          <b>{c.name}</b>
          <small>
            {c.business || "No business"}
            {c.businessType ? ` · ${c.businessType}` : ""}
          </small>
          {!isLead && (
            <small className="cr-service-count">
              {services.length} {services.length === 1 ? "service" : "services"}
            </small>
          )}
        </span>
        <span className="cr-meta">
          {c.paused && <em className="cr-paused">PAUSED</em>}
          {isLead ? (
            <>
              <b className={c.temp === "warm" ? "warm" : "cold"}>
                {c.temp || "warm"}
              </b>
              <small>
                {overdueDays > 0
                  ? `${overdueDays} days overdue`
                  : c.followUpDate
                    ? fmtDate(c.followUpDate)
                    : "No timeline"}
              </small>
            </>
          ) : (
            <>
              <b
                className={
                  c.paused ? "paused-balance" : balance > 0 ? "warm" : "lime"
                }
              >
                {c.paused
                  ? `${fmtUGX(excludedBalance)} excluded`
                  : balance > 0
                    ? fmtUGX(balance)
                    : "Paid"}
              </b>
              <small>{due ? fmtDate(due) : "No due date"}</small>
            </>
          )}
          {hot && !highlight && <em className="cr-due">FOLLOW-UP DUE</em>}
        </span>
        <span className="cr-chev" aria-hidden>
          ›
        </span>
      </button>
      {c.phone && (
        <div className="cr-quick">
          {c.hasWhatsApp !== "no" && (
            <a
              className="cr-contact-whatsapp"
              href={`https://wa.me/${toWaNumber(c.phone)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${c.name}`}
            >
              <Icon name="Message" size={18} />
              <span>WhatsApp</span>
            </a>
          )}
          <a
            className="cr-contact-call"
            href={`tel:${c.phone}`}
            aria-label={`Call ${c.name}`}
          >
            <Icon name="Phone" size={18} />
            <span>Call</span>
          </a>
        </div>
      )}
    </article>
  );
}
