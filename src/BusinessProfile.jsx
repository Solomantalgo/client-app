import { useState } from "react";
import { Close } from "./icons.jsx";

const fields = [
  ["brandName", "Brand name"], ["tagline", "Tagline"], ["location", "Location"],
  ["website", "Website"], ["ownerName", "Owner name"], ["ownerTitle", "Owner title"],
  ["bankName", "Bank name"], ["bankAccountName", "Account name"], ["bankAccountNo", "Account number"],
  ["momoNumber", "Mobile Money number"], ["momoName", "Mobile Money name"], ["qrUrl", "QR link (optional)"],
  ["invoiceDueDays", "Invoice due days"], ["termsText", "Invoice terms"],
];

export default function BusinessProfile({ profile, onSave, onClose }) {
  const [draft, setDraft] = useState(profile || {});
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="profile-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="profile-sheet" onSubmit={(event) => { event.preventDefault(); onSave(draft); onClose(); }}>
        <header><h2>Business profile</h2><button type="button" className="iconbtn" onClick={onClose} aria-label="Close"><Close /></button></header>
        <div className="profile-grid">
          {fields.map(([key, label]) => (
            <label className="label" key={key}>{label}
              {key === "termsText" ? <textarea className="field" rows="3" value={draft[key] || ""}
                onChange={(event) => set(key, event.target.value)} /> :
                <input className="field" type={key === "invoiceDueDays" ? "number" : "text"}
                  value={draft[key] ?? ""} onChange={(event) => set(key,
                    key === "invoiceDueDays" ? Number(event.target.value) : event.target.value)} />}
            </label>
          ))}
          <label className="profile-check"><input type="checkbox" checked={draft.showLogoA4 !== false}
            onChange={(event) => set("showLogoA4", event.target.checked)} /> Show logo on A4</label>
          <label className="profile-check"><input type="checkbox" checked={draft.showLogoThermal === true}
            onChange={(event) => set("showLogoThermal", event.target.checked)} /> Show logo on thermal</label>
        </div>
        <footer><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Save profile</button></footer>
      </form>
    </div>
  );
}
