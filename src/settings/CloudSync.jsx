import { useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";

export default function CloudSync({
  initialUrl,
  initialKey,
  cloudStatus,
  onSync,
  onClose,
  onSaved,
  onError,
  normalizeUrl,
}) {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);

  const save = () => {
    const cleanUrl = normalizeUrl(url);
    const cleanKey = key.trim();
    if (!cleanUrl || !cleanKey) {
      onError("Add your Supabase URL and anon key first.");
      return;
    }
    onSaved({ url: cleanUrl, key: cleanKey });
    onClose();
  };

  return (
    <div className="profile-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <Card className="profile-sheet cloud-sync-sheet" role="dialog" aria-modal="true" aria-labelledby="cloud-sync-title">
        <header className="m-section-head">
          <div><h2 id="cloud-sync-title">Cloud sync</h2><p>Use the same Supabase project on each device.</p></div>
          <button className="iconbtn" aria-label="Close cloud settings" onClick={onClose}><Icon name="Close" /></button>
        </header>
        <p className="cloud-sync-help">Settings are saved in this browser. The app uses the primary row in the sales_os_state table.</p>
        <div className="cloud-sync-status"><strong>Connection status</strong><span>{cloudStatus}</span><button className="btn btn-secondary" type="button" onClick={onSync}>Sync now</button></div>
        <label className="cloud-sync-field">Supabase URL<input className="field" value={url} onChange={(event) => setUrl(event.target.value)} autoComplete="url" /></label>
        <label className="cloud-sync-field">Anon key<div className="cloud-sync-key"><input className="field" type={showKey ? "text" : "password"} value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" /><button className="btn btn-ghost" type="button" onClick={() => setShowKey((shown) => !shown)}>{showKey ? "Hide" : "Show"}</button></div></label>
        <footer className="cloud-sync-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save and test</button></footer>
      </Card>
    </div>
  );
}
