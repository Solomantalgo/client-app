import { useContext, useState } from "react";
import {
  clientTotals,
  getClientServices,
  mergeServices,
  paymentsForService,
  removeService,
  serviceTotal,
  unmergeService,
  upsertService,
} from "../clients.js";
import { ClientActions } from "./ClientActions.js";
import { ClientInfoEditor, ServiceEditor } from "../ClientEditors.jsx";
import { useConfirm } from "../Confirm.jsx";
import { usePrintDialog } from "../PrintDialog.jsx";
import { buildInvoiceHtml, buildReceiptHtml } from "../documents.js";
import { getInvoiceNum, getReceiptNum } from "./documentNumbers.js";
import { Icon } from "../components/Icon.jsx";
import { addDays, fmtDate, fmtUGX, todayStr, toWaNumber } from "../lib/format.js";
import "../ClientCard.css";

const newPaymentId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `payment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function servicePayments(client, serviceId) {
  const payments = client.payments || [];
  return serviceId
    ? payments.filter(
        (p) =>
          p.serviceId === serviceId ||
          (!p.serviceId && serviceId === getClientServices(client)[0]?.id),
      )
    : payments;
}
function servicePaid(client, serviceId) {
  return servicePayments(client, serviceId).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );
}
function documentDueDate(issueDate, days = 14) {
  const date = new Date(`${issueDate}T00:00:00`);
  date.setDate(date.getDate() + (Number(days) || 14));
  return date.toISOString().slice(0, 10);
}
function printInvoice(
  client,
  service = null,
  assignNumber = null,
  profile = {},
  print = null,
  notify = () => {},
) {
  const activeService = service || getClientServices(client)[0];
  if (!activeService) {
    notify("Add a service before creating an invoice.");
    return;
  }
  if (!print) return;
  const number =
    activeService.invoiceNo ||
    assignNumber?.(client.date, client.id, "invoice", activeService.id) ||
    getInvoiceNum(client, activeService);
  const total = serviceTotal(activeService, client);
  const paid = servicePaid(client, activeService.id);
  const sourceItems = (activeService.items || []).length
    ? activeService.items
    : [
        {
          title: activeService.title || client.servicesToOffer || "Services",
          price: total,
        },
      ];
  const itemized = sourceItems.some((item) => Number(item.price) > 0);
  const items = itemized
    ? sourceItems.map((item) => ({
        title: item.title,
        amount: Number(item.price) || 0,
      }))
    : [
        {
          title:
            sourceItems
              .map((item) => item.title)
              .filter(Boolean)
              .join(", ") || activeService.title,
          amount: total,
        },
      ];
  const model = {
    number,
    date: activeService.createdAt || client.date || todayStr(),
    dueDate: documentDueDate(
      activeService.createdAt || client.date || todayStr(),
      profile.invoiceDueDays,
    ),
    clientName: client.name,
    business: client.business || "",
    items,
    total,
    paid,
    balance: total - paid,
    stamp:
      paid <= 0
        ? "AWAITING PAYMENT"
        : paid >= total
          ? "PAID IN FULL"
          : "PARTIAL PAYMENT",
  };
  print({
    docType: "Invoice",
    profile,
    build: (format, business) => buildInvoiceHtml(model, format, business),
  });
}

function printReceipt(
  client,
  payment,
  assignNumber = null,
  profile = {},
  print = null,
  notify = () => {},
) {
  const service =
    getClientServices(client).find((item) => item.id === payment.serviceId) ||
    getClientServices(client)[0];
  if (!service) {
    notify("This payment has no service to include on a receipt.");
    return;
  }
  if (!print) return;
  const number =
    payment.receiptNo ||
    assignNumber?.(client.date, client.id, "receipt", payment.id) ||
    getReceiptNum(payment);
  const model = {
    number,
    date: payment.date || client.date || todayStr(),
    invoiceNo: service.invoiceNo || getInvoiceNum(client, service),
    clientName: client.name,
    business: client.business || "",
    lines: [
      {
        title: payment.note || service.title || "Payment",
        amount: payment.amount,
      },
    ],
    total: payment.amount,
    received: payment.amount,
    invoiceTotal: serviceTotal(service, client),
    previouslyPaid: Math.max(
      0,
      servicePaid(client, service.id) - Number(payment.amount || 0),
    ),
    stamp: "PAYMENT RECEIVED",
    method:
      payment.accountName ||
      profile.accounts?.find((account) => account.id === payment.accountId)
        ?.name ||
      payment.accountId,
  };
  print({
    docType: "Receipt",
    profile,
    build: (format, business) => buildReceiptHtml(model, format, business),
  });
}

function printReceiptGroup(
  client,
  group,
  assignNumber,
  profile = {},
  print = null,
) {
  const payments = (client.payments || []).filter((payment) =>
    group.paymentIds.includes(payment.id),
  );
  if (!print || payments.length < 2) return;
  const number =
    group.receiptNo ||
    assignNumber?.(client.date, client.id, "receiptGroup", group.id) ||
    getReceiptNum(group);
  const total = payments.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  );
  const services = [...new Set(payments.map((payment) => payment.serviceId))]
    .map((serviceId) =>
      getClientServices(client).find((item) => item.id === serviceId),
    )
    .filter(Boolean);
  const invoiceTotal = services.reduce(
    (sum, service) => sum + serviceTotal(service, client),
    0,
  );
  const totalPaid = services.reduce(
    (sum, service) => sum + servicePaid(client, service.id),
    0,
  );
  const model = {
    number,
    date: group.createdAt?.slice(0, 10) || todayStr(),
    clientName: client.name,
    business: client.business || "",
    lines: payments.map((payment) => ({
      title: payment.note || "Payment",
      amount: payment.amount,
    })),
    total,
    received: total,
    invoiceTotal,
    previouslyPaid: Math.max(0, totalPaid - total),
    invoiceNo: services[0]?.invoiceNo || "",
    payments: payments.map((payment) => ({
      date: payment.date || "",
      method:
        payment.accountName ||
        profile.accounts?.find((account) => account.id === payment.accountId)
          ?.name ||
        payment.accountId,
      amount: payment.amount,
    })),
  };
  print({
    docType: "Receipt",
    profile,
    build: (format, business) => buildReceiptHtml(model, format, business),
  });
}

function printCombinedInvoice(
  client,
  services,
  assignNumber,
  profile = {},
  print = null,
) {
  if (services.length < 2) return;
  if (!print) return;
  const number =
    services[0].invoiceNo ||
    assignNumber?.(client.date, client.id, "invoice", services[0].id) ||
    getInvoiceNum(client, services[0]);
  const total = services.reduce(
    (sum, service) => sum + serviceTotal(service, client),
    0,
  );
  const paid = services.reduce(
    (sum, service) => sum + servicePaid(client, service.id),
    0,
  );
  const model = {
    number,
    date: todayStr(),
    dueDate: documentDueDate(todayStr(), profile.invoiceDueDays),
    clientName: client.name,
    business: client.business || "",
    items: services.map((service) => ({
      title: service.title,
      amount: serviceTotal(service, client),
    })),
    total,
    paid,
    balance: total - paid,
    stamp:
      paid >= total
        ? "PAID IN FULL"
        : paid > 0
          ? "PARTIAL PAYMENT"
          : "AWAITING PAYMENT",
  };
  print({
    docType: "Invoice",
    profile,
    build: (format, business) => buildInvoiceHtml(model, format, business),
  });
}
// ── Client Card
export default function ClientScreen({ client: c, date, onUpdate, onBack, packageTemplates = [] }) {
  const actions = useContext(ClientActions);
  const print = usePrintDialog();
  const ask = useConfirm();
  const [infoOpen, setInfoOpen] = useState(false);
  const [svcEditor, setSvcEditor] = useState(null);
  const [isWinForm, setIsWinForm] = useState(false);
  const [dealPrice, setDealPrice] = useState(
    c.quotedPrice ? c.quotedPrice.replace(/\D/g, "") : "",
  );
  const [deposit, setDeposit] = useState("0");
  const [isRescheduleForm, setIsRescheduleForm] = useState(false);
  const [newFollowDate, setNewFollowDate] = useState(
    c.followUpDate || todayStr(),
  );
  const [isPaymentForm, setIsPaymentForm] = useState(false);
  const [paymentAmt, setPaymentAmt] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentServiceId, setPaymentServiceId] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("No payment");
  const [pauseNote, setPauseNote] = useState("");
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [receiptMergeMode, setReceiptMergeMode] = useState(false);
  const [expandedReceiptGroups, setExpandedReceiptGroups] = useState([]);
  const today = todayStr();
  const isLead = c.status !== "ongoing";
  const services = getClientServices(c);
  const totals = clientTotals(c);
  const textToMatch = c.businessType || c.business || "";
  const packageMatch = packageTemplates.find((item) =>
    item.match.test(textToMatch),
  );
  const saveInfo = (fields) => {
    onUpdate(c.id, fields);
    setInfoOpen(false);
  };
  const saveService = (draft) => {
    onUpdate(c.id, upsertService(c, draft));
    setSvcEditor(null);
  };
  const saveMerge = () => {
    try {
      onUpdate(c.id, mergeServices(c, selectedServices, mergeTitle));
      setMergeOpen(false);
      setMergeMode(false);
      setSelectedServices([]);
      setMergeTitle("");
    } catch (error) {
      actions?.showBanner?.(error.message);
    }
  };
  const unmerge = async (service) => {
    const titles = (service.mergedFrom || [])
      .map((item) => item.title)
      .join(", ");
    if (
      !(await ask({
        title: "Unmerge this service?",
        body: `This restores ${titles}. Edits made to the merged service will be discarded.`,
        confirmLabel: "Unmerge",
      }))
    )
      return;
    onUpdate(c.id, unmergeService(c, service.id));
  };
  const mergeReceiptGroup = () => {
    if (selectedPayments.length < 2) return;
    const id = `receipt-group-${Date.now()}`;
    const group = {
      id,
      paymentIds: selectedPayments,
      createdAt: new Date().toISOString(),
      receiptNo: "",
    };
    onUpdate(c.id, { receiptGroups: [...(c.receiptGroups || []), group] });
    setSelectedPayments([]);
  };
  const unmergeReceiptGroup = async (group) => {
    if (
      !(await ask({
        title: "Unmerge this receipt group?",
        body: "The original payment entries remain unchanged in Money.",
        confirmLabel: "Unmerge receipts",
      }))
    )
      return;
    onUpdate(c.id, {
      receiptGroups: (c.receiptGroups || []).filter(
        (item) => item.id !== group.id,
      ),
    });
  };
  const deleteService = async (service) => {
    const linked = paymentsForService(c, service.id);
    const amount = linked.reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
    const message = linked.length
      ? `Delete "${service.title}"? This also deletes ${linked.length} payment(s) totalling ` +
        `${fmtUGX(amount)} from this client and the Money ledger. This cannot be undone.`
      : `Delete "${service.title}"? This cannot be undone.`;
    if (
      !(await ask({
        title: `Delete ${service.title}?`,
        body: message,
        confirmLabel: "Delete service",
        requireText: linked.length ? service.title : undefined,
      }))
    )
      return;
    onUpdate(
      c.id,
      removeService(c, service.id),
      `Deleted service ${service.title}`,
    );
    setSvcEditor(null);
  };
  const deleteThisClient = () => {
    actions?.deleteClient(date, c.id);
  };
  const openPaymentForm = (serviceId = "") => {
    if (c.paused) actions?.showBanner?.("Client is paused");
    setEditingPaymentId("");
    setPaymentAmt("");
    setPaymentNote("");
    setPaymentServiceId(serviceId || services[0]?.id || "");
    setIsPaymentForm(true);
  };
  const openEditPaymentForm = (payment, serviceId = "") => {
    setEditingPaymentId(payment.id);
    setPaymentAmt(String(payment.amount || ""));
    setPaymentNote(payment.note || "");
    setPaymentServiceId(
      serviceId || payment.serviceId || services[0]?.id || "",
    );
    setIsPaymentForm(true);
  };
  const savePayment = () => {
    const amount = Number(paymentAmt) || 0;
    if (amount <= 0) {
      actions?.showBanner?.("Please enter a valid payment amount.");
      return;
    }
    const serviceId = paymentServiceId || services[0]?.id || "";
    const payments = editingPaymentId
      ? (c.payments || []).map((payment) =>
          payment.id === editingPaymentId
            ? {
                ...payment,
                amount,
                note: paymentNote.trim() || "Payment",
                serviceId,
              }
            : payment,
        )
      : [
          ...(c.payments || []),
          {
            id: newPaymentId(),
            date: today,
            amount,
            note: paymentNote.trim() || "Payment",
            serviceId,
          },
        ];
    onUpdate(c.id, {
      payments,
      amountPaid: payments.reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0,
      ),
    });
    setIsPaymentForm(false);
  };
  const deleteClientPayment = async (payment) => {
    if (
      !(await ask({
        title: "Delete this payment?",
        body: "Its Money ledger entry will also be removed.",
      }))
    )
      return;
    const payments = (c.payments || []).filter(
      (item) => item.id !== payment.id,
    );
    onUpdate(
      c.id,
      {
        payments,
        receiptGroups: (c.receiptGroups || []).map((group) => ({
          ...group,
          paymentIds: group.paymentIds.filter((id) => id !== payment.id),
        })),
        amountPaid: payments.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0,
        ),
      },
      `Deleted payment ${payment.note || "entry"}`,
    );
  };
  const markDone = async () => {
    const followUp = c.followUp === "needed" ? "done" : "needed";
    if (followUp === "done" && c.followUpDate) {
      const keep = await ask({
        title: "Keep the follow-up reminder?",
        body: "Keep the current follow-up date or cancel to clear it.",
        confirmLabel: "Keep reminder",
      });
      onUpdate(c.id, { followUp, ...(keep ? {} : { followUpDate: "" }) });
    } else onUpdate(c.id, { followUp });
  };
  const convert = () => {
    const price = Number(dealPrice) || 0;
    const paid = Number(deposit) || 0;
    if (price <= 0) {
      actions?.showBanner?.("Please enter a valid agreed price.");
      return;
    }
    const serviceId = newPaymentId();
    const service = {
      id: serviceId,
      title:
        c.package && c.package !== "Undecided" ? c.package : "Client Service",
      categories: c.servicesToOffer || "",
      agreedPrice: price,
      dueDate: "",
      status: "active",
      createdAt: today,
    };
    const payments =
      paid > 0
        ? [
            {
              id: newPaymentId(),
              date: today,
              amount: paid,
              note: "Initial Deposit",
              serviceId,
            },
          ]
        : [];
    onUpdate(c.id, {
      status: "ongoing",
      totalAgreedPrice: price,
      amountPaid: paid,
      services: [service],
      payments,
      followUp: "done",
    });
    setIsWinForm(false);
  };
  const saveReschedule = () => {
    if (!newFollowDate) {
      actions?.showBanner?.("Please select a date.");
      return;
    }
    onUpdate(c.id, { followUp: "done", followUpDate: newFollowDate });
    setIsRescheduleForm(false);
  };
  const reschedule = (days) => {
    const followUpDate = addDays(days);
    onUpdate(c.id, { followUp: "done", followUpDate });
    setIsRescheduleForm(false);
  };
  const moveBack = async () => {
    const paid = (c.payments || []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0,
    );
    if (
      await ask({
        title: "Move back to lead?",
        body: `This wipes ${services.length} service(s) and ${c.payments?.length || 0} payments (${fmtUGX(paid)}).`,
        confirmLabel: "Move back",
        requireText: c.name,
      })
    ) {
      onUpdate(
        c.id,
        {
          status: "lead",
          totalAgreedPrice: "",
          amountPaid: 0,
          payments: [],
          services: [],
          followUp: "needed",
        },
        "Moved client back to lead",
      );
    }
  };
  const suggest = () => {
    if (!textToMatch) {
      actions?.showBanner?.(
        "This client needs a business name or type to auto-suggest.",
      );
      return;
    }
    if (packageMatch)
      onUpdate(c.id, {
        servicesToOffer: packageMatch.services,
        quotedPrice: packageMatch.price,
      });
    else
      actions?.showBanner?.(
        "No exact match found based on their business type.",
      );
  };
  return (
    <div className="cs">
      <header className="cs-bar">
        <button type="button" className="cs-back" onClick={onBack}>
          <Icon name="Back" size={18} /> Back
        </button>
        <div
          className={`cs-avatar${c.paused ? " paused" : ""}`}
          aria-hidden="true"
        >
          {String(c.name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="cs-title">
          <h2>{c.name}</h2>
          <p>
            {c.business || "No business"}
            {c.businessType ? ` · ${c.businessType}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setInfoOpen(true)}>
          Edit
        </button>
      </header>
      {!isLead && (
        <section className="cs-card cs-summary">
          <div className="cs-totals">
            {[
              ["Agreed", totals.total],
              ["Paid", totals.paid],
              ["Balance", totals.balance],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <b
                  className={
                    c.paused && label === "Balance" ? "paused-balance" : ""
                  }
                >
                  {c.paused && label === "Balance"
                    ? `${fmtUGX(value)} excluded from Money`
                    : fmtUGX(value)}
                </b>
              </div>
            ))}
          </div>
          <div className="cs-progress">
            <i
              style={{
                width: `${totals.total > 0 ? Math.min(100, (totals.paid / totals.total) * 100) : 0}%`,
              }}
            />
          </div>
        </section>
      )}
      <div className="cs-grid">
        <div className="cs-col">
          <div className="cs-chips">
            <span
              className={
                isLead ? (c.temp === "cold" ? "cold" : "warm") : "lime"
              }
            >
              {isLead ? "LEAD" : "ONGOING"}
            </span>
            <span>
              {isLead
                ? c.followUp === "needed"
                  ? "FOLLOW-UP NEEDED"
                  : "FOLLOW-UP DONE"
                : "CLIENT"}
            </span>
            <span>Demo {c.demoShown === "yes" ? "✓" : "×"}</span>
            {c.paused && <span className="cr-paused">PAUSED</span>}
          </div>
          {c.phone && (
            <div className="cs-contact">
              {c.hasWhatsApp !== "no" && (
                <a
                  href={`https://wa.me/${toWaNumber(c.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              )}
              <a href={`tel:${c.phone}`}>Call {c.phone}</a>
            </div>
          )}
          <div className="cs-actions cs-actionbar">
            {isLead ? (
              <>
                <button onClick={markDone}>
                  {c.followUp === "needed" ? "Mark done" : "Follow up"}
                </button>
                <button onClick={() => setIsRescheduleForm(true)}>
                  Timeline
                </button>
                <button
                  onClick={() =>
                    onUpdate(c.id, {
                      temp: c.temp === "warm" ? "cold" : "warm",
                    })
                  }
                >
                  {c.temp === "warm" ? "Warm" : "Cold"}
                </button>
                <button className="primary" onClick={() => setIsWinForm(true)}>
                  Won!
                </button>
                {(!c.quotedPrice || !c.servicesToOffer) && (
                  <button onClick={suggest}>Suggest</button>
                )}
              </>
            ) : (
              <>
                <button className="primary" onClick={() => openPaymentForm()}>
                  Record payment
                </button>
                <button onClick={() => setSvcEditor({ service: null })}>
                  + Add service
                </button>
                {c.paused ? (
                  <button
                    onClick={() =>
                      onUpdate(c.id, {
                        paused: false,
                        pausedAt: "",
                        pauseReason: "",
                      })
                    }
                  >
                    Resume client
                  </button>
                ) : (
                  <button onClick={() => setPauseOpen(true)}>
                    Pause client
                  </button>
                )}
              </>
            )}
          </div>
          <section className="cs-card">
            <header>
              <h3>Client details</h3>
              <button onClick={() => setInfoOpen(true)}>Edit</button>
            </header>
            <dl>
              <div>
                <dt>Phone</dt>
                <dd>{c.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt>Pitch method</dt>
                <dd>{c.pitchMethod || "Not provided"}</dd>
              </div>
              <div>
                <dt>Owner around</dt>
                <dd>{c.ownerAround || "unknown"}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{c.hasWhatsApp === "no" ? "No" : "Yes"}</dd>
              </div>
              {isLead && (
                <>
                  <div>
                    <dt>Temperature</dt>
                    <dd>{c.temp || "warm"}</dd>
                  </div>
                  <div>
                    <dt>Quoted price</dt>
                    <dd>{c.quotedPrice || "Not provided"}</dd>
                  </div>
                </>
              )}
            </dl>
            {isLead && c.servicesToOffer && (
              <div className="cs-tags">
                {c.servicesToOffer.split(",").map((item, index) => (
                  <span key={index}>{item.trim()}</span>
                ))}
              </div>
            )}
            {c.notes && <p className="cs-notes">{c.notes}</p>}
          </section>
        </div>
        <div className="cs-col">
          {isLead && (
            <section className="cs-card">
              <header>
                <h3>Follow-up</h3>
                <button onClick={() => setIsRescheduleForm(true)}>
                  Timeline
                </button>
              </header>
              <p>
                {c.followUpDate ? fmtDate(c.followUpDate) : "No timeline set"}
              </p>
              <p className="cs-notes">{c.notes || "No notes yet."}</p>
            </section>
          )}
          {!isLead && (
            <>
              <section className="cs-card cs-payments">
                <header>
                  <h3>Payments &amp; receipts</h3>
                  {(c.payments || []).length > 1 && (
                    <button
                      onClick={() => {
                        setReceiptMergeMode((value) => !value);
                        setSelectedPayments([]);
                      }}
                    >
                      {receiptMergeMode ? "Cancel receipts" : "Merge receipts"}
                    </button>
                  )}
                </header>
                <div className="cs-receipt-groups">
                  {(c.receiptGroups || []).map((group) => {
                    const grouped = (c.payments || []).filter((payment) =>
                      group.paymentIds.includes(payment.id),
                    );
                    const total = grouped.reduce(
                      (sum, payment) => sum + (Number(payment.amount) || 0),
                      0,
                    );
                    const expanded = expandedReceiptGroups.includes(group.id);
                    return (
                      <article className="cs-receipt-group" key={group.id}>
                        <strong>
                          Receipt {group.receiptNo || getReceiptNum(group)} ·{" "}
                          {grouped.length} payments · {fmtUGX(total)}
                        </strong>
                        <button
                          onClick={() =>
                            printReceiptGroup(
                              { ...c, date },
                              group,
                              actions?.assignDocumentNumber,
                              actions?.profile,
                              print,
                            )
                          }
                        >
                          Print
                        </button>
                        <button
                          onClick={() =>
                            setExpandedReceiptGroups((ids) =>
                              expanded
                                ? ids.filter((id) => id !== group.id)
                                : [...ids, group.id],
                            )
                          }
                        >
                          {expanded ? "Collapse" : "Expand"}
                        </button>
                        <button onClick={() => unmergeReceiptGroup(group)}>
                          Unmerge
                        </button>
                        {expanded &&
                          grouped.map((payment) => (
                            <div className="cs-group-payment" key={payment.id}>
                              {payment.note || "Payment"} ·{" "}
                              {fmtUGX(payment.amount)}
                            </div>
                          ))}
                      </article>
                    );
                  })}
                </div>
                {receiptMergeMode && (
                  <div className="cs-receipt-select">
                    {(c.payments || []).map((payment) => {
                      const grouped = (c.receiptGroups || []).some((group) =>
                        group.paymentIds.includes(payment.id),
                      );
                      return (
                        <label key={payment.id}>
                          <input
                            type="checkbox"
                            disabled={grouped}
                            checked={selectedPayments.includes(payment.id)}
                            onChange={(event) =>
                              setSelectedPayments((ids) =>
                                event.target.checked
                                  ? [...ids, payment.id]
                                  : ids.filter((id) => id !== payment.id),
                              )
                            }
                          />
                          {payment.note || "Payment"} · {fmtUGX(payment.amount)}
                        </label>
                      );
                    })}
                    <button
                      disabled={selectedPayments.length < 2}
                      onClick={mergeReceiptGroup}
                    >
                      Merge receipts ({selectedPayments.length})
                    </button>
                  </div>
                )}
                {(c.payments || []).map((payment) => {
                  const group = (c.receiptGroups || []).find((item) =>
                    item.paymentIds.includes(payment.id),
                  );
                  if (group && !expandedReceiptGroups.includes(group.id))
                    return null;
                  const serviceId = payment.serviceId || services[0]?.id || "";
                  return (
                    <div
                      className="cs-payment"
                      data-payment-id={payment.id}
                      key={payment.id}
                    >
                      <span>
                        {payment.date || "Date unknown"} ·{" "}
                        {payment.note || "Payment"} · {fmtUGX(payment.amount)}
                      </span>
                      <button
                        onClick={() => openEditPaymentForm(payment, serviceId)}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        onClick={() => deleteClientPayment(payment)}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() =>
                          printReceipt(
                            { ...c, date },
                            payment,
                            actions?.assignDocumentNumber,
                            actions?.profile,
                            print,
                            actions?.showBanner,
                          )
                        }
                      >
                        Receipt
                      </button>
                    </div>
                  );
                })}
              </section>
              <section className="cs-card cs-services">
                <header>
                  <h3>Services ({services.length})</h3>
                  <div className="cs-service-tools">
                    <button onClick={() => setSvcEditor({ service: null })}>
                      + Add service
                    </button>
                    {services.length > 1 && (
                      <button
                        onClick={() => {
                          setMergeMode((value) => !value);
                          setSelectedServices([]);
                        }}
                      >
                        {mergeMode ? "Cancel select" : "Select"}
                      </button>
                    )}
                  </div>
                </header>
                {mergeMode && (
                  <div className="cs-merge-tools">
                    <button
                      disabled={selectedServices.length < 2}
                      onClick={() => setMergeOpen(true)}
                    >
                      Merge ({selectedServices.length})
                    </button>
                    <button
                      disabled={selectedServices.length < 2}
                      onClick={() =>
                        printCombinedInvoice(
                          { ...c, date },
                          services.filter((service) =>
                            selectedServices.includes(service.id),
                          ),
                          actions?.assignDocumentNumber,
                          actions?.profile,
                          print,
                        )
                      }
                    >
                      Print combined invoice
                    </button>
                  </div>
                )}
                {services.length === 0 && (
                  <p className="cs-empty">No services yet. Add service.</p>
                )}
                {services.map((service) => {
                  const paid = servicePaid(c, service.id);
                  const total = serviceTotal(service, c);
                  const balance = total - paid;
                  return (
                    <article
                      className="cs-service"
                      data-service-id={service.id}
                      key={service.id}
                    >
                      {mergeMode && !service.mergedFrom?.length && (
                        <label className="cs-select-service">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={(event) =>
                              setSelectedServices((ids) =>
                                event.target.checked
                                  ? [...ids, service.id]
                                  : ids.filter((id) => id !== service.id),
                              )
                            }
                          />
                          Select service
                        </label>
                      )}
                      <header className="cs-service-head">
                        <div>
                          <h4>{service.title}</h4>
                          <small>
                            {service.dueDate
                              ? `Due ${fmtDate(service.dueDate)}`
                              : "No due date"}
                          </small>
                        </div>
                        {service.mergedFrom?.length > 0 && (
                          <span className="cs-merged-badge">
                            MERGED ×{service.mergedFrom.length}
                          </span>
                        )}
                        <b className={balance > 0 ? "warm" : "lime"}>
                          {balance > 0 ? fmtUGX(balance) : "Paid"}
                        </b>
                      </header>
                      <div className="cs-totals">
                        {[
                          ["FEE", total],
                          ["PAID", paid],
                          ["BALANCE", balance],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <small>{label}</small>
                            <b
                              className={
                                c.paused && label === "BALANCE"
                                  ? "paused-balance"
                                  : ""
                              }
                            >
                              {c.paused && label === "BALANCE"
                                ? `${fmtUGX(value)} excluded`
                                : fmtUGX(value)}
                            </b>
                          </div>
                        ))}
                      </div>
                      {(service.items || []).map((item) => (
                        <div className="cs-item" key={item.id}>
                          <span>{item.title}</span>
                          <span>
                            {Number(item.price) > 0
                              ? fmtUGX(item.price)
                              : "Included"}
                          </span>
                        </div>
                      ))}
                      <div className="cs-service-actions">
                        <button onClick={() => openPaymentForm(service.id)}>
                          Record payment
                        </button>
                        <button onClick={() => setSvcEditor({ service })}>
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            printInvoice(
                              { ...c, date },
                              service,
                              actions?.assignDocumentNumber,
                              actions?.profile,
                              print,
                              actions?.showBanner,
                            )
                          }
                        >
                          Invoice
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteService(service)}
                        >
                          Delete
                        </button>
                        {service.mergedFrom?.length > 0 && (
                          <button onClick={() => unmerge(service)}>
                            Unmerge
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </div>
      <section className="cs-danger">
        {!isLead && <button onClick={moveBack}>Move back to lead</button>}
        <button className="danger" onClick={deleteThisClient}>
          Delete client
        </button>
      </section>
      {c.paused && isPaymentForm && (
        <p className="cs-paused-note">Client is paused</p>
      )}
      {pauseOpen && (
        <div
          className="ce-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPauseOpen(false)
          }
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              onUpdate(c.id, {
                paused: true,
                pausedAt: today,
                pauseReason: [pauseReason, pauseNote.trim()]
                  .filter(Boolean)
                  .join(": "),
              });
              setPauseOpen(false);
            }}
          >
            <h2>Pause client</h2>
            <p>
              Their outstanding balance will be excluded from active totals.
            </p>
            <label className="ce-field">
              Reason
              <select
                value={pauseReason}
                onChange={(event) => setPauseReason(event.target.value)}
              >
                <option>No payment</option>
                <option>Waiting on client</option>
                <option>Dispute</option>
                <option>Other</option>
              </select>
            </label>
            <label className="ce-field">
              Note
              <textarea
                value={pauseNote}
                onChange={(event) => setPauseNote(event.target.value)}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setPauseOpen(false)}>
                Cancel
              </button>
              <button className="primary">Pause client</button>
            </footer>
          </form>
        </div>
      )}
      {mergeOpen && (
        <div
          className="ce-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setMergeOpen(false)
          }
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              saveMerge();
            }}
          >
            <h2>Merge services</h2>
            <label className="ce-field">
              Merged service title
              <input
                value={mergeTitle}
                onChange={(event) => setMergeTitle(event.target.value)}
                placeholder={services
                  .filter((service) => selectedServices.includes(service.id))
                  .map((service) => service.title)
                  .join(" + ")}
              />
            </label>
            <p>
              Total{" "}
              {fmtUGX(
                services
                  .filter((service) => selectedServices.includes(service.id))
                  .reduce((sum, service) => sum + serviceTotal(service, c), 0),
              )}
            </p>
            <footer>
              <button type="button" onClick={() => setMergeOpen(false)}>
                Cancel
              </button>
              <button className="primary">Merge services</button>
            </footer>
          </form>
        </div>
      )}
      {infoOpen && (
        <ClientInfoEditor
          client={c}
          onUpdate={(_id, fields) => saveInfo(fields)}
          onClose={() => setInfoOpen(false)}
        />
      )}
      {svcEditor && (
        <ServiceEditor
          service={svcEditor.service}
          fallbackTotal={
            svcEditor.service ? serviceTotal(svcEditor.service, c) : 0
          }
          paid={svcEditor.service ? servicePaid(c, svcEditor.service.id) : 0}
          onSave={saveService}
          onDelete={
            svcEditor.service
              ? () => deleteService(svcEditor.service)
              : undefined
          }
          onClose={() => setSvcEditor(null)}
        />
      )}
      {isWinForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsWinForm(false)
          }
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              convert();
            }}
          >
            <header>
              <h2>Convert to ongoing client</h2>
              <button type="button" onClick={() => setIsWinForm(false)}>
                ×
              </button>
            </header>
            <label className="ce-field">
              Agreed price (UGX)
              <input
                type="number"
                min="1"
                required
                value={dealPrice}
                onChange={(event) => setDealPrice(event.target.value)}
              />
            </label>
            <label className="ce-field">
              Initial deposit (UGX)
              <input
                type="number"
                min="0"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setIsWinForm(false)}>
                Cancel
              </button>
              <button className="primary">Confirm conversion</button>
            </footer>
          </form>
        </div>
      )}
      {isRescheduleForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsRescheduleForm(false)
          }
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              saveReschedule();
            }}
          >
            <header>
              <h2>Set follow-up timeline</h2>
              <button type="button" onClick={() => setIsRescheduleForm(false)}>
                ×
              </button>
            </header>
            <div className="cs-actions">
              {[3, 7, 14, 30].map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => reschedule(days)}
                >
                  +{days} days
                </button>
              ))}
            </div>
            <label className="ce-field">
              Date
              <input
                type="date"
                value={newFollowDate}
                onChange={(event) => setNewFollowDate(event.target.value)}
              />
            </label>
            <footer>
              <button type="button" onClick={() => setIsRescheduleForm(false)}>
                Cancel
              </button>
              <button className="primary">Save timeline</button>
            </footer>
          </form>
        </div>
      )}
      {isPaymentForm && (
        <div
          className="ce-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setIsPaymentForm(false)
          }
        >
          <form
            className="ce-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              savePayment();
            }}
          >
            <header>
              <h2>{editingPaymentId ? "Edit payment" : "Record payment"}</h2>
              <button type="button" onClick={() => setIsPaymentForm(false)}>
                ×
              </button>
            </header>
            {c.paused && <p className="cs-paused-note">Client is paused</p>}
            <label className="ce-field">
              Amount (UGX)
              <input
                type="number"
                min="1"
                required
                value={paymentAmt}
                onChange={(event) => setPaymentAmt(event.target.value)}
              />
            </label>
            <label className="ce-field">
              Note
              <input
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
              />
            </label>
            <label className="ce-field">
              Service
              <select
                required
                value={paymentServiceId}
                onChange={(event) => setPaymentServiceId(event.target.value)}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title} · {fmtUGX(serviceTotal(service, c))}
                  </option>
                ))}
              </select>
            </label>
            <footer>
              <button type="button" onClick={() => setIsPaymentForm(false)}>
                Cancel
              </button>
              <button className="primary">Save payment</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

