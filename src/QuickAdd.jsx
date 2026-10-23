import { Icon } from "./components/Icon.jsx";

const options = [
  ["lead", "Plus", "New lead", "Save a new prospect from today"],
  ["income", "Money", "Log income", "Record money received"],
  ["expense", "Money", "Add expense", "Track a business expense"],
];

export default function QuickAdd({ onClose, onLead, onIncome, onExpense }) {
  const actions = { lead: onLead, income: onIncome, expense: onExpense };
  return (
    <div className="os-quick-overlay" role="presentation">
      <button
        className="os-quick-backdrop"
        aria-label="Close quick add"
        onClick={onClose}
      />
      <section
        className="os-quick-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
      >
        <header>
          <div>
            <p className="label">Quick add</p>
            <h2 id="quick-add-title">What would you like to add?</h2>
          </div>
          <button className="iconbtn" aria-label="Close quick add" onClick={onClose}>
            <Icon name="Close" size={19} />
          </button>
        </header>
        {options.map(([key, icon, title, hint]) => (
          <button
            className={`os-quick-option ${key}`}
            key={key}
            onClick={() => actions[key]?.()}
          >
            <span className="os-quick-icon"><Icon name={icon} /></span>
            <span><b>{title}</b><small>{hint}</small></span>
            <Icon name="ChevronRight" size={18} />
          </button>
        ))}
      </section>
    </div>
  );
}
