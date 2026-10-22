# UI coverage

Statuses describe the current repository state, not the target design. A screen is not marked done until its
required module imports shared components and `npm run check:ui` passes.

| Screen | File | Status | What changed | Not verified |
| --- | --- | --- | --- | --- |
| S1 App shell | `src/AppShell.jsx` | partial | Existing responsive shell retained; shared icon moved into components. | Error boundary, global toast stack, keyboard navigation, screen-reader pass. |
| S2 Quick add | `src/AppShell.jsx` | partial | Existing navigation remains available. | Center plus menu and all three quick-add flows. |
| S3 Search | `src/App.jsx`, `src/search.js` | partial | Existing search and routing remain in the monolith. | Search module extraction, keyboard and history-layer behavior. |
| S4 Today | `src/App.jsx` | partial | Existing Today view remains in the monolith. | Full S4 layout and 375px/1280px attention panel. |
| S5 Outreach | `src/App.jsx` | partial | Existing Outreach view remains in the monolith. | Scheduler sheets, responsive arrangement, keyboard flow. |
| S6 Due | `src/App.jsx` | partial | Existing follow-up view remains in the monolith. | Required grouped list and row overflow actions. |
| S7 Ongoing | `src/App.jsx` | partial | Existing Ongoing view remains in the monolith. | Owing/Paused/Paid up/All segments and row state. |
| S8 History | `src/App.jsx` | partial | Existing History view remains in the monolith. | Sticky month groups and drilled-in day layout. |
| S9 ClientRow | `src/App.jsx` | partial | Existing ClientRow remains in the monolith. | All list contexts, icon actions, and accessibility. |
| S10 Client screen | `src/App.jsx` | partial | Existing ClientScreen remains in the monolith. | Full S10 interactions and responsive layout. |
| S11 Forms | `src/ClientEditors.jsx`, `src/App.jsx` | partial | Existing editors retained. | Shared field system and all form flows. |
| S12 Money | `src/money/MoneyView.jsx` | partial | MoneyView moved without behavior changes. | Six extracted tabs and responsive visual audit. |
| S13 Stats | `src/App.jsx` | partial | Existing Stats view remains in the monolith. | Period selector, KPI/funnel layout, readability. |
| S14 Playbook | `src/App.jsx` | partial | Existing guide/system-flow view remains in the monolith. | New setup segmented controls and local checklist. |
| S15 More and Settings | `src/AppShell.jsx`, `src/BusinessProfile.jsx` | partial | Existing More sheet and Business profile remain. | Settings pages and complete sync/reset flows. |
| S16 Dialogs and sheets | `src/Confirm.jsx`, `src/PrintDialog.jsx` | partial | Existing confirmation and print providers retained. | Focus trap, full Back behavior, manual printer checks. |
| S17 States and feedback | `src/App.jsx`, `src/AppShell.jsx` | partial | Existing loading/banner/empty patterns retained. | Global toast, error boundary, every list state. |

The coverage script is wired as `npm run check:ui`. It intentionally reports missing extracted modules and legacy
style violations until the remaining screens are migrated; this matrix does not represent a passing coverage gate.
