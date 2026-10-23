import { useState } from "react";
import Card from "../components/Card.jsx";
import { Icon } from "../components/Icon.jsx";
import "./PlaybookView.css";

const rules = [
  "Don't pressure clients",
  "Focus on business benefits",
  "Guide confidently with short follow-ups",
];

const processSteps = [
  ["Meet the client", "Understand the problem and the result they need."],
  ["Show a relevant demo", "Connect the demo to their day-to-day business."],
  ["Collect the details", "Write down the content, contact and delivery needs."],
  ["Build and customize", "Prepare the solution around the agreed scope."],
  ["Review and launch", "Check the work with the client before launch."],
  ["Offer monthly support", "Agree on ongoing updates and small improvements."],
];

const setupLists = {
  Restaurant: [
    "Menu and prices are ready",
    "Opening hours and location are confirmed",
    "Ordering and contact options are agreed",
    "Food and venue photos are available",
  ],
  Salon: [
    "Services and prices are ready",
    "Booking method is confirmed",
    "Opening hours and location are confirmed",
    "Portfolio photos are available",
  ],
};

export default function PlaybookView({ packageTemplates = [] }) {
  const [setup, setSetup] = useState("Restaurant");
  const [checked, setChecked] = useState({});

  return (
    <div className="playbook-page">
      <header className="page-heading">
        <p className="label">Reference</p>
        <h2>Playbook</h2>
        <p>Keep client conversations clear, useful and easy to follow.</p>
      </header>

      <section className="playbook-rules" aria-label="Golden rules">
        {rules.map((rule) => (
          <Card className="playbook-rule" key={rule}>
            <Icon name="Check" size={20} />
            <strong>{rule}</strong>
          </Card>
        ))}
      </section>

      <section className="playbook-section">
        <h3>Client process</h3>
        <ol className="playbook-steps">
          {processSteps.map(([title, description], index) => (
            <li key={title}>
              <span className="playbook-step-number">{index + 1}</span>
              <Card>
                <h4>{title}</h4>
                <p>{description}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="playbook-section">
        <header className="playbook-section-head">
          <div>
            <h3>Setup checklist</h3>
            <p>Checklist selections stay on this device and are not saved.</p>
          </div>
          <div className="playbook-segment" role="group" aria-label="Business type">
            {Object.keys(setupLists).map((type) => (
              <button
                type="button"
                className={setup === type ? "active" : ""}
                key={type}
                onClick={() => setSetup(type)}
              >
                {type} setup
              </button>
            ))}
          </div>
        </header>
        <Card className="playbook-checklist">
          {setupLists[setup].map((item) => {
            const id = `${setup}:${item}`;
            return (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={Boolean(checked[id])}
                  onChange={(event) =>
                    setChecked({ ...checked, [id]: event.target.checked })
                  }
                />
                <span>{item}</span>
              </label>
            );
          })}
        </Card>
      </section>

      <section className="playbook-section">
        <h3>Recommended pricing</h3>
        <div className="playbook-pricing">
          {packageTemplates.map((item) => (
            <Card key={item.name}>
              <h4>{item.name}</h4>
              <p>{item.services}</p>
              <strong>{item.price}</strong>
            </Card>
          ))}
          <Card>
            <h4>Monthly support</h4>
            <p>Updates, small edits, promo banners, monitoring and help.</p>
            <strong>UGX 50,000–150,000 per month</strong>
          </Card>
        </div>
      </section>

      <section className="playbook-section">
        <h3>Reusable assets</h3>
        <Card>
          <p>
            Keep demos, logos, QR templates, flyer templates and code templates
            organized so each project starts faster.
          </p>
        </Card>
      </section>
    </div>
  );
}
