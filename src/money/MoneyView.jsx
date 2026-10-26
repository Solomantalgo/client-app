import { useMemo, useState } from "react";
import {
  DEFAULT_FINANCE,
  allocateAmount,
  applyBucketLoanRepayment,
  createBucketLoans,
  getBalances,
  getTransactions,
} from "../money.js";
import { outstandingBalances, pausedBalances } from "../clients.js";
import { useConfirm } from "../Confirm.jsx";
import Card from "../components/Card.jsx";
import Overview from "./Overview.jsx";
import Transactions from "./Transactions.jsx";
import Purposes from "./Purposes.jsx";
import Accounts from "./Accounts.jsx";
import ClientBalances from "./ClientBalances.jsx";
import MonthlyEarnings from "./MonthlyEarnings.jsx";
import "./MoneyView.css";
import "./MonthlyEarnings.css";



const money = (n) => `UGX ${Math.round(n || 0).toLocaleString("en-UG")}`;
const uid = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function MoneyView({
  data,
  onSave,
  onUpdateClient,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onDeleteIncome,
  query = "",
  initialTab = "Income",
  initialForm = "",
  initialMonth = "",
  onSelectMoneySection,
  onInitialFormConsumed,
}) {
  const ask = useConfirm();
  const finance = data.finance || DEFAULT_FINANCE;
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("All");
  const [searchText, setSearchText] = useState(query);
  const [message, setMessage] = useState("");
  const [paymentEdit, setPaymentEdit] = useState(null);
  const [paymentEditError, setPaymentEditError] = useState("");
  const [resetBucket, setResetBucket] = useState(null);
  const [resetOpening, setResetOpening] = useState("0");
  const [resetNote, setResetNote] = useState("");
  const [borrowShortfall, setBorrowShortfall] = useState(false);
  const [draft, setDraft] = useState({
    date: today(),
    amount: "",
    description: "",
    note: "",
    sourceType: "Freelance / Contract",
    accountId: "",
    bucketId: "",
  });
  const activeBuckets = finance.buckets
    .filter((b) => b.status !== "archived")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const transactions = useMemo(() => getTransactions(data), [data]);
  const totals = useMemo(
    () => getBalances(transactions, finance),
    [transactions, finance],
  );
  const allocationTotal = activeBuckets.reduce(
    (n, b) => n + (Number(b.percentage) || 0),
    0,
  );
  const assignedBalance = Object.values(totals.buckets).reduce(
    (sum, bucket) => sum + bucket.balance,
    0,
  );
  const expenseAmount = Math.round(Number(draft.amount) || 0);
  const expenseBorrowingLocked =
    form === "expense" &&
    Boolean(editing?.rawId) &&
    (finance.bucketLoans || []).some(
      (loan) => loan.expenseId === editing.rawId,
    );
  const expenseBucketBalance = totals.buckets[draft.bucketId]?.balance || 0;
  const expenseShortfall =
    form === "expense" && !editing && draft.bucketId
      ? Math.max(0, expenseAmount - expenseBucketBalance)
      : 0;
  const otherBucketFunds = activeBuckets
    .filter((bucket) => bucket.id !== draft.bucketId)
    .reduce(
      (sum, bucket) =>
        sum + Math.max(0, totals.buckets[bucket.id]?.balance || 0),
      0,
    );
  const startForm = (type, item = null) => {
    setEditing(item);
    setForm(type);
    setMessage("");
    setBorrowShortfall(false);
    setDraft(
      item
        ? {
            ...draft,
            ...item,
            custom: item.allocationMode === "custom",
            customAllocations:
              item.allocationMode === "custom"
                ? (item.allocations || []).map((a) => ({
                    id: a.bucketId,
                    percentage: a.percentage,
                  }))
                : null,
            amount: item.amount ?? "",
            description: item.description || item.note || "",
            date: item.date ?? "",
          }
        : {
            date: today(),
            amount: "",
            description: "",
            note: "",
            sourceType: finance.sources[0] || "Other",
            accountId: "",
            bucketId: "",
            custom: false,
            customAllocations: null,
          },
    );
  };
  const closeForm = () => {
    setForm("");
    setEditing(null);
    setMessage("");
    setBorrowShortfall(false);
    onInitialFormConsumed?.();
  };
  const submit = () => {
    const amount = Math.round(Number(draft.amount));
    if ((form === "income" || form === "expense") && !(amount > 0))
      return setMessage("Enter an amount greater than zero.");
    if ((form === "income" || form === "expense") && !draft.description?.trim())
      return setMessage("Add a description.");
    if (form === "income") {
      try {
        const savedRules =
          editing && !draft.custom
            ? (editing.allocations || []).map((a) => ({
                id: a.bucketId,
                percentage: a.percentage,
              }))
            : undefined;
        const override = draft.custom ? draft.customAllocations : savedRules;
        let split = override
          ? allocateAmount(amount, finance.buckets, override)
          : allocateAmount(amount, finance.buckets);
        let nextFinance = finance;
        if (!editing) {
          const applied = applyBucketLoanRepayment(split, finance);
          split = applied.split;
          nextFinance = applied.finance;
        }
        if (editing) {
          const updated = {
            ...editing,
            amount,
            date: draft.date,
            description: draft.description.trim(),
            note: draft.note || "",
            sourceType: draft.sourceType,
            reportingClass: draft.reportingClass || "",
            accountId: draft.accountId,
            allocationMode: draft.custom
              ? "custom"
              : editing.allocationMode || "default",
            allocations: split.allocations,
            unallocated: split.unallocated,
            origin: editing.origin || "current",
          };
          onSave({
            ...data,
            finance: {
              ...nextFinance,
              manualIncome: finance.manualIncome.map((x) =>
                x.id === editing.id ? updated : x,
              ),
            },
          });
        } else {
          const income = {
            id: uid(),
            amount,
            date: draft.date,
            description: draft.description.trim(),
            note: draft.note || "",
            sourceType: draft.sourceType,
            reportingClass: draft.reportingClass || "",
            accountId: draft.accountId,
            allocationMode: draft.custom ? "custom" : "default",
            allocations: split.allocations,
            unallocated: split.unallocated,
            origin: "current",
          };
          onSave({
            ...data,
            finance: {
              ...nextFinance,
              manualIncome: [...finance.manualIncome, income],
            },
          });
        }
        closeForm();
      } catch (e) {
        setMessage(e.message);
      }
    } else if (form === "expense") {
      let loans = [];
      const expenseId = editing?.rawId || uid();
      if (expenseShortfall > 0) {
        if (!borrowShortfall) {
          return setMessage(
            `This bucket is short by ${money(expenseShortfall)}. Choose even borrowing from other buckets to continue.`,
          );
        }
        if (otherBucketFunds < expenseShortfall) {
          return setMessage(
            `Other buckets have ${money(otherBucketFunds)} available, which is not enough to cover this shortfall.`,
          );
        }
        try {
          loans = createBucketLoans(
            finance,
            draft.bucketId,
            expenseShortfall,
            totals.buckets,
            uid,
            expenseId,
          );
        } catch (error) {
          return setMessage(error.message);
        }
      }
      const fields = {
        id: expenseId,
        amount,
        date: draft.date,
        note: draft.description.trim(),
        description: draft.description.trim(),
        bucketId: draft.bucketId,
        accountId: draft.accountId,
        notes: draft.note || "",
      };
      if (editing) onUpdateExpense(editing.rawId, fields);
      else onAddExpense(fields, loans);
      closeForm();
    } else if (form === "bucket") {
      if (!draft.name?.trim()) return setMessage("Enter a bucket name.");
      const percentage = Math.max(0, Number(draft.percentage) || 0);
      const next = finance.buckets.map((b) =>
        b.id === editing?.id
          ? {
              ...b,
              name: draft.name.trim(),
              icon: draft.icon || b.icon || "◇",
              percentage,
              target: Math.max(0, Number(draft.target) || 0),
            }
          : b,
      );
      if (!editing)
        next.push({
          id: uid(),
          name: draft.name.trim(),
          icon: draft.icon || "◇",
          percentage,
          target: Math.max(0, Number(draft.target) || 0),
          status: "active",
          sortOrder: next.length,
          createdAt: new Date().toISOString(),
        });
      onSave({ ...data, finance: { ...finance, buckets: next } });
      closeForm();
    } else if (form === "account") {
      if (!draft.name?.trim()) return setMessage("Enter an account name.");
      const next = finance.accounts.map((a) =>
        a.id === editing?.id
          ? {
              ...a,
              name: draft.name.trim(),
              type: draft.accountType || editing?.type || "Other",
            }
          : a,
      );
      if (!editing)
        next.push({
          id: uid(),
          name: draft.name.trim(),
          type: draft.accountType || "Other",
          status: "active",
          createdAt: new Date().toISOString(),
        });
      onSave({ ...data, finance: { ...finance, accounts: next } });
      closeForm();
    } else if (form === "source") {
      if (!draft.name?.trim()) return setMessage("Enter a source type.");
      if (
        finance.sources.some(
          (x) =>
            x.toLocaleLowerCase() === draft.name.trim().toLocaleLowerCase(),
        )
      )
        return setMessage("That source type already exists.");
      onSave({
        ...data,
        finance: {
          ...finance,
          sources: [...finance.sources, draft.name.trim()],
        },
      });
      closeForm();
    }
  };
  const archiveBucket = async (bucket) => {
    if (
      !(await ask({
        title: `Archive ${bucket.name}?`,
        body: "Past allocations remain in history. This bucket will stop receiving new allocations.",
        requireText: bucket.name,
        confirmLabel: "Archive bucket",
      }))
    )
      return;
    onSave({
      ...data,
      finance: {
        ...finance,
        buckets: finance.buckets.map((b) =>
          b.id === bucket.id
            ? { ...b, status: "archived", archivedAt: new Date().toISOString() }
            : b,
        ),
      },
    });
  };
  const restoreBucket = (bucket) =>
    onSave({
      ...data,
      finance: {
        ...finance,
        buckets: finance.buckets.map((b) =>
          b.id === bucket.id ? { ...b, status: "active", archivedAt: null } : b,
        ),
      },
    });
  const reorderBucket = (bucket, direction) => {
    const ordered = activeBuckets.slice();
    const index = ordered.findIndex((b) => b.id === bucket.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const current = ordered[index];
    const next = ordered[target];
    onSave({
      ...data,
      finance: {
        ...finance,
        buckets: finance.buckets.map((b) =>
          b.id === current.id
            ? { ...b, sortOrder: next.sortOrder }
            : b.id === next.id
              ? { ...b, sortOrder: current.sortOrder }
              : b,
        ),
      },
    });
  };
  const archiveAccount = async (account) => {
    if (
      !(await ask({
        title: `Archive ${account.name}?`,
        body: "The account will be hidden from new transactions. Existing history remains.",
        confirmLabel: "Archive account",
      }))
    )
      return;
    onSave({
      ...data,
      finance: {
        ...finance,
        accounts: finance.accounts.map((a) =>
          a.id === account.id
            ? { ...a, status: "archived", archivedAt: new Date().toISOString() }
            : a,
        ),
      },
    });
  };
  const clearBucket = async (bucket) => {
    const current = totals.buckets[bucket.id] || { allocated: 0, spent: 0 };
    if (
      !(await ask({
        title: `Start fresh for ${bucket.name}?`,
        body: "Past transactions stay in history. This only stops counting the old balance under this purpose.",
        requireText: bucket.name,
        confirmLabel: "Start fresh",
      }))
    )
      return;
    const reset = {
      id: uid(),
      bucketId: bucket.id,
      at: new Date().toISOString(),
      allocated: current.allocated,
      spent: current.spent,
      opening: Math.max(0, Number(resetOpening) || 0),
      note: resetNote.trim(),
    };
    onSave({
      ...data,
      finance: {
        ...finance,
        bucketResets: [...(finance.bucketResets || []), reset],
      },
    });
    setResetBucket(null);
    setResetOpening("0");
    setResetNote("");
  };
  const undoBucketClear = (reset) =>
    onSave({
      ...data,
      finance: {
        ...finance,
        bucketResets: (finance.bucketResets || []).filter(
          (item) => item.id !== reset.id,
        ),
      },
    });
  const setPaymentAccount = (transaction, accountId) => {
    const entry = Object.entries(data.clients).find(([, clients]) =>
      clients.some((c) => c.id === transaction.clientId),
    );
    if (!entry) return;
    const [date, clients] = entry;
    const client = clients.find((c) => c.id === transaction.clientId);
    onUpdateClient(date, client.id, {
      payments: (client.payments || []).map((p) =>
        p.id === transaction.paymentId ? { ...p, accountId } : p,
      ),
    });
  };
  const openClientPaymentEdit = (row, payment) => {
    setPaymentEdit({
      date: row.date,
      clientId: row.clientId,
      paymentId: payment.id,
      amount: String(payment.amount || ""),
      dateReceived: payment.date || row.date,
      note: payment.note || "",
    });
    setPaymentEditError("");
  };
  const saveClientPaymentEdit = (event) => {
    event.preventDefault();
    const amount = Math.round(Number(paymentEdit.amount));
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return setPaymentEditError("Enter a valid amount greater than zero.");
    const clients = data.clients[paymentEdit.date] || [];
    const client = clients.find((item) => item.id === paymentEdit.clientId);
    if (!client)
      return setPaymentEditError(
        "This client could not be found. Refresh and try again.",
      );
    const payments = (client.payments || []).map((payment) =>
      payment.id === paymentEdit.paymentId
        ? {
            ...payment,
            amount,
            date: paymentEdit.dateReceived,
            note: paymentEdit.note.trim() || "Payment",
          }
        : payment,
    );
    onUpdateClient(paymentEdit.date, client.id, {
      payments,
      amountPaid: payments.reduce(
        (sum, payment) => sum + (Number(payment.amount) || 0),
        0,
      ),
    });
    setPaymentEdit(null);
  };
  const archiveTransaction = (t) => {
    if (t.type === "income" && t.sourceType !== "client_payment")
      onDeleteIncome(t.id.replace("income:", ""));
    if (t.type === "expense") onDeleteExpense(t.id.replace("expense:", ""));
  };
  const visible = transactions
    .filter(
      (t) =>
        filter === "All" ||
        (filter === "Income" ? t.type === "income" : t.type === "expense"),
    )
    .filter(
      (transaction) =>
        !searchText ||
        [
          transaction.description,
          transaction.note,
          transaction.sourceType,
          transaction.amount,
          transaction.date,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(searchText.toLocaleLowerCase()),
    )
    .slice()
    .sort((first, second) =>
      String(second.date || "").localeCompare(String(first.date || "")),
    );
  const createManualIncome = () => startForm("income");
  const createManualExpense = () => startForm("expense");
  const changeTab = (next) => {
    setTab(next);
    onSelectMoneySection?.(next);
  };
  const selectReportTransaction = (transaction) => {
    if (transaction.sourceType === "client_payment") {
      for (const [date, clients] of Object.entries(data.clients || {})) {
        const client = clients.find((item) => item.id === transaction.clientId);
        const payment = client?.payments?.find((item) => item.id === transaction.paymentId);
        if (client && payment) {
          openClientPaymentEdit({ date, clientId: client.id }, payment);
          return;
        }
      }
      return;
    }
    editTransaction(transaction, startForm);
  };
  return (
    <main className="money-app">
      <header className="money-header">
        <h1>Money</h1>
        <nav className="money-nav" aria-label="Money sections">
          {[
            "Overview",
            "Income",
            "Expenses",
            "Allocations",
            "Accounts",
            "Client balances",
            "Monthly earnings",
          ].map((item) => (
            <button
              key={item}
              className={tab === item ? "selected" : ""}
              onClick={() => changeTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        {!['Allocations', 'Accounts', 'Client balances'].includes(tab) && (
          <button
            className="m-primary"
            onClick={tab === 'Expenses' ? createManualExpense : createManualIncome}
          >
            {tab === 'Expenses' ? '＋ Log expense' : '＋ Log income'}
          </button>
        )}
      </header>
      {message && !form && <Card className="m-notice">{message}</Card>}
      {tab === "Monthly earnings" ? (
        <MonthlyEarnings data={data} initialMonth={initialMonth} onSave={onSave} onSelectTransaction={selectReportTransaction} />
      ) : (
        <section className="money-content">
          {tab === "Overview" && (
            <Overview totals={totals} transactions={transactions} clients={data.clients || {}} activeBuckets={activeBuckets} finance={finance} assignedBalance={assignedBalance} onChangeTab={changeTab} onEditBucket={(bucket) => startForm("bucket", bucket)} onResetBucket={(bucket) => { setResetBucket(bucket); setResetOpening("0"); }} onArchiveBucket={archiveBucket} onUndoBucketClear={undoBucketClear} onEditTransaction={(row) => editTransaction(row, startForm)} onSetAccount={setPaymentAccount} />
          )}
          {["Income", "Expenses"].includes(tab) && (
            <Transactions rows={visible} filter={filter} setFilter={setFilter} searchText={searchText} setSearchText={setSearchText} onCreateExpense={createManualExpense} showExpenseAction onEdit={(row) => editTransaction(row, startForm)} onDelete={archiveTransaction} finance={finance} onSetAccount={setPaymentAccount} onAddSource={() => startForm("source")} />
          )}
          {tab === "Allocations" && (
            <Purposes buckets={finance.buckets.slice().sort((a, b) => a.sortOrder - b.sortOrder)} totals={totals} allocationTotal={allocationTotal} assignedBalance={assignedBalance} available={totals.available} onAdd={() => startForm("bucket")} onEdit={(bucket) => startForm("bucket", bucket)} onArchive={archiveBucket} onRestore={restoreBucket} onReset={(bucket) => { setResetBucket(bucket); setResetOpening("0"); }} onUndo={undoBucketClear} onReorder={reorderBucket} />
          )}
          {tab === "Accounts" && (
            <Accounts accounts={finance.accounts} totals={totals} onAdd={() => startForm("account")} onEdit={(account) => startForm("account", account)} onArchive={archiveAccount} />
          )}
          {tab === "Client balances" && (
            <ClientBalances rows={outstandingBalances(data.clients)} pausedRows={pausedBalances(data.clients)} onEditPayment={openClientPaymentEdit} />
          )}
        </section>
      )}
      {form && (
        <div
          className="m-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
        >
          <form
            className="m-dialog"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="m-section-head">
              <div>
                <div className="money-eyebrow">
                  {editing ? "UPDATE" : "NEW"} {form.toUpperCase()}
                </div>
                <h2>
                  {form === "income"
                    ? "Log income"
                    : form === "expense"
                      ? "Log expense"
                      : form === "bucket"
                        ? editing
                          ? "Edit bucket"
                          : "Add bucket"
                        : form === "source"
                          ? "Add source type"
                          : editing
                            ? "Edit account"
                            : "Add account"}
                </h2>
              </div>
              <button type="button" className="m-close" onClick={closeForm}>
                ×
              </button>
            </div>
            <div className="m-dialog-content">
            {(form === "income" || form === "expense") && (
              <>
                <label>
                  Amount (UGX)
                  <input
                    required
                    min="1"
                    type="number"
                    inputMode="numeric"
                    disabled={expenseBorrowingLocked}
                    value={draft.amount}
                    onChange={(e) =>
                      setDraft({ ...draft, amount: e.target.value })
                    }
                    placeholder="e.g. 250000"
                  />
                  {form === "expense" && expenseBorrowingLocked && (
                    <small className="m-muted">
                      Borrowed expenses keep their amount and bucket fixed.
                      Delete and re-enter this expense to recalculate the split.
                    </small>
                  )}
                </label>
                <label>
                  {form === "income"
                    ? "Source / description"
                    : "Expense description"}
                  <input
                    required
                    value={draft.description || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder={
                      form === "income"
                        ? "What was this income for?"
                        : "What did you spend on?"
                    }
                  />
                </label>
                <div className="m-form-grid">
                  <label>
                    Date
                    <input
                      type="date"
                      value={draft.date}
                      onChange={(e) =>
                        setDraft({ ...draft, date: e.target.value })
                      }
                    />
                  </label>
                  {form === "income" ? (
                    <label>
                      Source type
                      <select
                        value={draft.sourceType}
                        onChange={(e) =>
                          setDraft({ ...draft, sourceType: e.target.value })
                        }
                      >
                        {finance.sources.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label>
                      Bucket
                      <select
                        value={draft.bucketId || ""}
                      disabled={expenseBorrowingLocked}
                        onChange={(e) =>
                          setDraft({ ...draft, bucketId: e.target.value })
                        }
                      >
                        <option value="">Uncategorized</option>
                        {finance.buckets
                          .filter(
                            (b) =>
                              b.status !== "archived" ||
                              draft.bucketId === b.id,
                          )
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                              {b.status === "archived" ? " (archived)" : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
                {form === "income" && (
                  <label className="m-reporting-class">
                    Earnings report category
                    <select
                      value={draft.reportingClass || ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          reportingClass: event.target.value,
                        })
                      }
                    >
                      <option value="">Use source default or review later</option>
                      <option value="earned">Earnings</option>
                      <option value="other">Other money received</option>
                    </select>
                    <small>
                      This changes monthly reporting only, not how this income
                      is allocated.
                    </small>
                  </label>
                )}
                {form === "expense" && expenseShortfall > 0 && (
                  <div className="m-borrow-prompt">
                    <strong>Bucket short by {money(expenseShortfall)}</strong>
                    <p>
                      Cover the shortfall evenly from{" "}
                      {
                        activeBuckets.filter(
                          (bucket) =>
                            bucket.id !== draft.bucketId &&
                            (totals.buckets[bucket.id]?.balance || 0) > 0,
                        ).length
                      }{" "}
                      other buckets with available funds. Future money allocated
                      to this bucket will repay them evenly.
                    </p>
                    {otherBucketFunds < expenseShortfall && (
                      <p className="m-error">
                        Other buckets only have {money(otherBucketFunds)}{" "}
                        available.
                      </p>
                    )}
                    <label className="m-borrow-choice">
                      <input
                        type="checkbox"
                        checked={borrowShortfall}
                        disabled={otherBucketFunds < expenseShortfall}
                        onChange={(event) =>
                          setBorrowShortfall(event.target.checked)
                        }
                      />
                      Borrow the shortfall
                    </label>
                  </div>
                )}
                <label>
                  Account
                  <select
                    value={draft.accountId || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, accountId: e.target.value })
                    }
                  >
                    <option value="">Unknown / not selected</option>
                    {finance.accounts
                      .filter(
                        (a) =>
                          a.status !== "archived" || draft.accountId === a.id,
                      )
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.status === "archived" ? " (archived)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                {form === "income" && (
                  <details className="m-custom">
                    <summary>Customize this income allocation</summary>
                    <p className="m-hint">
                      Defaults are applied automatically. Set a one-off split
                      below; remaining funds stay unallocated.
                    </p>
                    {activeBuckets.map((b) => (
                      <label className="m-split" key={b.id}>
                        {b.name}
                        <span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={
                              draft.customAllocations?.find(
                                (x) => x.id === b.id,
                              )?.percentage ?? b.percentage
                            }
                            onChange={(e) => {
                              const cur =
                                draft.customAllocations ||
                                activeBuckets.map((x) => ({
                                  id: x.id,
                                  percentage: x.percentage,
                                }));
                              setDraft({
                                ...draft,
                                custom: true,
                                customAllocations: cur.map((x) =>
                                  x.id === b.id
                                    ? {
                                        ...x,
                                        percentage: Number(e.target.value),
                                      }
                                    : x,
                                ),
                              });
                            }}
                          />{" "}
                          %
                        </span>
                      </label>
                    ))}
                  </details>
                )}
                <label>
                  Notes (optional)
                  <textarea
                    rows="2"
                    value={draft.note || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {form === "bucket" && (
              <>
                <label>
                  Name
                  <input
                    value={draft.name || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Icon or symbol
                  <input
                    maxLength="4"
                    value={draft.icon || editing?.icon || "◇"}
                    onChange={(e) =>
                      setDraft({ ...draft, icon: e.target.value })
                    }
                  />
                </label>
                <div className="m-form-grid">
                  <label>
                    Default percentage
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.percentage ?? 0}
                      onChange={(e) =>
                        setDraft({ ...draft, percentage: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Optional target (UGX)
                    <input
                      type="number"
                      min="0"
                      value={draft.target ?? 0}
                      onChange={(e) =>
                        setDraft({ ...draft, target: e.target.value })
                      }
                    />
                  </label>
                </div>
              </>
            )}
            {form === "account" && (
              <>
                <label>
                  Name
                  <input
                    value={draft.name || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <input
                    value={draft.accountType || editing?.type || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, accountType: e.target.value })
                    }
                    placeholder="Bank, Mobile money, Cash…"
                  />
                </label>
              </>
            )}
            {form === "source" && (
              <label>
                Source type name
                <input
                  value={draft.name || ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Royalties"
                  autoFocus
                />
              </label>
            )}
            {message && <p className="m-error">{message}</p>}
            </div>
            <div className="m-dialog-actions">
              <button type="button" className="m-secondary" onClick={closeForm}>
                Cancel
              </button>
              <button className="m-primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
      {resetBucket && (
        <div
          className="m-overlay"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setResetBucket(null)
          }
        >
          <form
            className="m-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void clearBucket(resetBucket);
            }}
          >
            <h2>Start fresh: {resetBucket.name}</h2>
            <p>
              Current balance:{" "}
              {money(
                (totals.buckets[resetBucket.id]?.allocated || 0) -
                  (totals.buckets[resetBucket.id]?.spent || 0),
              )}
            </p>
            <p>
              Past transactions stay in history. This only stops counting the
              old balance under this purpose.
            </p>
            <label>
              Opening balance (UGX)
              <input
                type="number"
                min="0"
                value={resetOpening}
                onChange={(event) => setResetOpening(event.target.value)}
              />
            </label>
            <label>
              Note
              <input
                value={resetNote}
                onChange={(event) => setResetNote(event.target.value)}
              />
            </label>
            <div className="m-dialog-actions">
              <button
                type="button"
                className="m-secondary"
                onClick={() => setResetBucket(null)}
              >
                Cancel
              </button>
              <button className="m-primary">Continue</button>
            </div>
          </form>
        </div>
      )}
      {paymentEdit && (
        <div
          className="m-overlay"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setPaymentEdit(null)
          }
        >
          <form className="m-dialog" onSubmit={saveClientPaymentEdit}>
            <div className="m-section-head">
              <div>
                <div className="money-eyebrow">CLIENT PAYMENT</div>
                <h2>Edit payment</h2>
                <p className="m-muted">
                  The amount owed and Money ledger will update when you save.
                </p>
              </div>
              <button
                type="button"
                className="m-close"
                aria-label="Close"
                onClick={() => setPaymentEdit(null)}
              >
                ×
              </button>
            </div>
            <label>
              Amount received (UGX)
              <input
                autoFocus
                required
                min="1"
                step="1"
                type="number"
                inputMode="numeric"
                value={paymentEdit.amount}
                onChange={(e) =>
                  setPaymentEdit({ ...paymentEdit, amount: e.target.value })
                }
              />
            </label>
            <label>
              Date received
              <input
                required
                type="date"
                value={paymentEdit.dateReceived}
                onChange={(e) =>
                  setPaymentEdit({
                    ...paymentEdit,
                    dateReceived: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Payment note
              <input
                value={paymentEdit.note}
                onChange={(e) =>
                  setPaymentEdit({ ...paymentEdit, note: e.target.value })
                }
                placeholder="Payment details"
              />
            </label>
            {paymentEditError && <p className="m-error">{paymentEditError}</p>}
            <div className="m-dialog-actions">
              <button
                type="button"
                className="m-secondary"
                onClick={() => setPaymentEdit(null)}
              >
                Cancel
              </button>
              <button className="m-primary" type="submit">
                Save payment
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function editTransaction(t, start) {
  if (t.type === "income" && t.sourceType !== "client_payment")
    start("income", { ...t, id: t.id.replace("income:", "") });
  if (t.type === "expense")
    start("expense", { ...t, rawId: t.id.replace("expense:", "") });
}
