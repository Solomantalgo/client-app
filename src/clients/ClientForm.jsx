import { useMemo, useState } from "react";
import { Icon } from "../components/Icon.jsx";
import "./ClientForm.css";

const initialClient = (initialValues) => ({
  name: "",
  business: "",
  businessType: "",
  phone: "",
  pitchMethod: "In-Person",
  package: "Undecided",
  servicesToOffer: "",
  quotedPrice: "",
  demoShown: "no",
  temp: "warm",
  followUp: "needed",
  notes: "",
  status: "lead",
  ownerAround: "unknown",
  followUpDate: "",
  hasWhatsApp: "yes",
  totalAgreedPrice: "",
  amountPaid: 0,
  payments: [],
  ...(initialValues || {}),
});

function Field({ label, children, helper, error }) {
  return (
    <label className="cf-field">
      <span>{label}</span>
      {children}
      {helper && <small>{helper}</small>}
      {error && <small className="cf-error">{error}</small>}
    </label>
  );
}

function Segmented({ label, value, options, onChange }) {
  return (
    <fieldset className="cf-segment-field">
      <legend>{label}</legend>
      <div className="cf-segmented">
        {options.map((option) => (
          <button
            type="button"
            className={value === option ? "active" : ""}
            key={option}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ClientForm({
  onAdd,
  onClose,
  onError,
  initialValues,
  packageTemplates,
}) {
  const [form, setForm] = useState(() => initialClient(initialValues));
  const [moreOpen, setMoreOpen] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const matchedPackage = useMemo(
    () => packageTemplates.find((item) => item.match.test(form.businessType || "")),
    [form.businessType, packageTemplates],
  );
  const chosenServices = String(form.servicesToOffer || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const submit = (event) => {
    event.preventDefault();
    setNameTouched(true);
    if (!form.name.trim()) return;
    onAdd({ ...form, name: form.name.trim() });
  };

  const suggest = () => {
    if (!form.businessType.trim()) {
      onError("Please enter a business type first.");
      return;
    }
    if (!matchedPackage) {
      onError("No exact match found. You can enter services and price manually.");
      return;
    }
    setForm((current) => ({
      ...current,
      servicesToOffer: matchedPackage.services,
      quotedPrice: matchedPackage.price,
      package: matchedPackage.name,
    }));
  };

  const toggleService = (service) => {
    const next = chosenServices.includes(service)
      ? chosenServices.filter((item) => item !== service)
      : [...chosenServices, service];
    set("servicesToOffer", next.join(", "));
  };

  return (
    <div className="ce-overlay cf-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form
        className="ce-dialog cf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-title"
        onSubmit={submit}
      >
        <header className="cf-header">
          <div>
            <p>Pipeline</p>
            <h2 id="cf-title">Log a lead</h2>
            <span>Save the key details while the conversation is fresh.</span>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close lead form">
            <Icon name="Close" size={20} />
          </button>
        </header>
        <div className="cf-form-scroll">
          <div className="cf-fields">
            <Field label="Client name *" error={nameTouched && !form.name.trim() ? "Enter a client name." : ""}>
              <input className="field" autoFocus value={form.name} onBlur={() => setNameTouched(true)} onChange={(event) => set("name", event.target.value)} required />
            </Field>
            <Field label="Business name">
              <input className="field" value={form.business} onChange={(event) => set("business", event.target.value)} />
            </Field>
            <Field label="Phone" helper="Use the number you call or message.">
              <input className="field" type="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} />
            </Field>
            {form.phone && (
              <Segmented label="WhatsApp available" value={form.hasWhatsApp} options={["yes", "no"]} onChange={(value) => set("hasWhatsApp", value)} />
            )}
            <Segmented label="Pitched via" value={form.pitchMethod} options={["In-Person", "WhatsApp"]} onChange={(value) => set("pitchMethod", value)} />
            <Segmented label="Lead temperature" value={form.temp} options={["warm", "cold"]} onChange={(value) => set("temp", value)} />
          </div>
          <details className="cf-more" open={moreOpen} onToggle={(event) => setMoreOpen(event.currentTarget.open)}>
            <summary>More details</summary>
            <div className="cf-fields">
              <Field label="Business type">
                <div className="cf-inline-field">
                  <input className="field" value={form.businessType} onChange={(event) => set("businessType", event.target.value)} />
                  <button className="btn btn-secondary" type="button" onClick={suggest}>Suggest</button>
                </div>
              </Field>
              {matchedPackage && (
                <div className="cf-suggestions">
                  <strong>{matchedPackage.name}</strong>
                  <div>{matchedPackage.services.split(",").map((service) => (
                    <button type="button" className={chosenServices.includes(service.trim()) ? "active" : ""} key={service} onClick={() => toggleService(service.trim())}>
                      {chosenServices.includes(service.trim()) && <Icon name="Check" size={15} />}{service.trim()}
                    </button>
                  ))}</div>
                </div>
              )}
              <Field label="Suggested services">
                <textarea className="field cf-textarea" value={form.servicesToOffer} onChange={(event) => set("servicesToOffer", event.target.value)} />
              </Field>
              <Field label="Quoted price">
                <input className="field" inputMode="numeric" value={form.quotedPrice} onChange={(event) => set("quotedPrice", event.target.value)} />
              </Field>
              <Field label="Follow-up date">
                <input className="field" type="date" value={form.followUpDate} onChange={(event) => set("followUpDate", event.target.value)} />
              </Field>
              <Segmented label="Owner available" value={form.ownerAround} options={["yes", "no", "unknown"]} onChange={(value) => set("ownerAround", value)} />
              <Segmented label="Demo shown" value={form.demoShown} options={["yes", "no"]} onChange={(value) => set("demoShown", value)} />
              <Segmented label="Follow-up status" value={form.followUp} options={["needed", "done"]} onChange={(value) => set("followUp", value)} />
              <Field label="Notes">
                <textarea className="field cf-textarea" value={form.notes} onChange={(event) => set("notes", event.target.value)} />
              </Field>
            </div>
          </details>
        </div>
        <footer className="cf-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit">Save lead</button>
        </footer>
      </form>
    </div>
  );
}
