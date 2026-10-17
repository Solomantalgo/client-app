import { useState } from "react";

function Seg({ value, options, onChange }) {
  return (
    <div className="ce-seg" role="group">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={option === value ? "active" : ""}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function ClientInfoEditor({ client, onClose, onUpdate }) {
  const [draft, setDraft] = useState(() => ({
    name: client.name || "",
    business: client.business || "",
    businessType: client.businessType || "",
    phone: client.phone || "",
    notes: client.notes || "",
    hasWhatsApp: client.hasWhatsApp || "yes",
    ownerAround: client.ownerAround || "unknown",
    pitchMethod: client.pitchMethod || "In-Person",
    temp: client.temp || "warm",
    servicesToOffer: client.servicesToOffer || "",
    quotedPrice: client.quotedPrice || "",
  }));
  const isLead = client.status !== "ongoing";
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const textField = (key, label, multiline = false) => (
    <label className="ce-field" key={key}>
      {label}
      {multiline ? (
        <textarea rows="3" value={draft[key]} onChange={(event) => set(key, event.target.value)} />
      ) : (
        <input
          required={key === "name"}
          value={draft[key]}
          onChange={(event) => set(key, event.target.value)}
        />
      )}
    </label>
  );
  const submit = (event) => {
    event.preventDefault();
    const fields = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value.trim()]),
    );
    if (!fields.name) return;
    if (!isLead) {
      delete fields.temp;
      delete fields.servicesToOffer;
      delete fields.quotedPrice;
    }
    onUpdate(client.id, fields);
    onClose();
  };

  return (
    <div className="ce-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="ce-dialog" onSubmit={submit}>
        <header>
          <h2>Edit client</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="ce-grid">
          {textField("name", "Name")}
          {textField("business", "Business")}
          {textField("businessType", "Business type")}
          {textField("phone", "Phone")}
          <label className="ce-field">
            WhatsApp
            <Seg value={draft.hasWhatsApp} options={["yes", "no"]} onChange={(value) => set("hasWhatsApp", value)} />
          </label>
          <label className="ce-field">
            Owner around
            <Seg
              value={draft.ownerAround}
              options={["yes", "no", "unknown"]}
              onChange={(value) => set("ownerAround", value)}
            />
          </label>
          <label className="ce-field">
            Pitch method
            <Seg
              value={draft.pitchMethod}
              options={["In-Person", "WhatsApp"]}
              onChange={(value) => set("pitchMethod", value)}
            />
          </label>
          {isLead && (
            <>
              <label className="ce-field">
                Temperature
                <Seg value={draft.temp} options={["warm", "cold"]} onChange={(value) => set("temp", value)} />
              </label>
              {textField("servicesToOffer", "Services to offer", true)}
              {textField("quotedPrice", "Quoted price")}
            </>
          )}
          {textField("notes", "Notes", true)}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save client</button>
        </footer>
      </form>
    </div>
  );
}

export function ServiceEditor({ service, fallbackTotal = 0, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(service?.title || "");
  const [dueDate, setDueDate] = useState(service?.dueDate || "");
  const [items, setItems] = useState(() => (
    service?.items?.length
      ? service.items.map((item) => ({ ...item }))
      : [{ id: "draft-item", title: service?.categories || "", price: fallbackTotal || service?.agreedPrice || "" }]
  ));
  const updateItem = (id, values) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  };
  const addItem = () => {
    setItems((current) => [...current, { id: `item-${Date.now()}-${Math.random()}`, title: "", price: "" }]);
  };
  const removeItem = (id) => {
    setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  };
  const submit = (event) => {
    event.preventDefault();
    const clean = items.map((item) => ({
      ...item,
      title: item.title.trim(),
      price: Number(item.price),
    }));
    const total = clean.reduce((sum, item) => sum + item.price, 0);
    if (!title.trim() || clean.some((item) => !item.title || item.price < 0) || total <= 0) return;
    onSave({
      ...(service || {}),
      id: service?.id,
      title: title.trim(),
      dueDate,
      items: clean,
      categories: clean.map((item) => item.title).join(", "),
      agreedPrice: total,
      status: service?.status || "active",
      createdAt: service?.createdAt || new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  return (
    <div className="ce-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="ce-dialog" onSubmit={submit}>
        <header>
          <h2>{service ? "Edit service" : "Add service"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <label className="ce-field">
          Service title
          <input required value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="ce-field">
          Due date
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <h3>Line items</h3>
        {items.map((item) => (
          <div className="ce-line" key={item.id}>
            <input
              required
              aria-label="Item name"
              placeholder="Item name"
              value={item.title}
              onChange={(event) => updateItem(item.id, { title: event.target.value })}
            />
            <input
              required
              aria-label="Price"
              type="number"
              min="0"
              step="1"
              placeholder="UGX"
              value={item.price}
              onChange={(event) => updateItem(item.id, { price: event.target.value })}
            />
            <button type="button" aria-label="Remove item" onClick={() => removeItem(item.id)}>×</button>
          </div>
        ))}
        <button type="button" onClick={addItem}>+ Add line item</button>
        <footer>
          {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete service</button>}
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save service</button>
        </footer>
      </form>
    </div>
  );
}
