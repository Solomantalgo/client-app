import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";

const records = [
  ["stats", "Stats", "Chart"],
  ["history", "History", "History"],
  ["flow", "Playbook", "Book"],
];

export default function MoreView({
  cloudStatus,
  onNavigate,
  onOpenProfile,
  onExportBackup,
  onOpenCloud,
  onReset,
  onClose,
}) {
  return (
    <>
      <button
        className="os-sheet-backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      <section className="os-more-sheet" aria-label="More navigation">
        <h2>More</h2>
        <Card className="more-group">
          <p className="label">Records</p>
          {records.map(([key, title, icon]) => (
            <button key={key} onClick={() => onNavigate(key)}>
              <Icon name={icon} size={20} />
              {title}
            </button>
          ))}
        </Card>
        <Card className="more-group">
          <p className="label">Settings</p>
          <button onClick={onOpenProfile}>
            <Icon name="Edit" size={20} />Business profile
          </button>
          <button onClick={onOpenCloud}>
            <Icon name="Sync" size={20} />
            Cloud sync <small>{cloudStatus}</small>
          </button>
          <button onClick={onExportBackup}>
            <Icon name="Download" size={20} />Export backup
          </button>
        </Card>
        <Card className="more-group more-danger">
          <p className="label">Danger zone</p>
          <button className="danger" onClick={onReset}>
            <Icon name="Trash" size={20} />Reset all data
          </button>
        </Card>
      </section>
    </>
  );
}
