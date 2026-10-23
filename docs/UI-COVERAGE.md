# UI coverage

Statuses describe the current repository state, not the target design. A screen is not marked done until its
required module imports shared components and `npm run check:ui` passes.

| Screen | File | Status | What changed | Not verified |
| --- | --- | --- | --- | --- |
| S1 App shell | `src/AppShell.jsx` | partial | Existing responsive shell retained; shared icon moved into components. | Error boundary, global toast stack, keyboard navigation, screen-reader pass. |
| S2 Quick add | `src/QuickAdd.jsx`, `src/AppShell.jsx` | partial | Quick add sheet is extracted and wired to the existing lead, income, and expense flows. | All three save paths and keyboard focus handling. |
| S3 Search | `src/SearchPanel.jsx`, `src/App.jsx`, `src/search.js` | partial | Search dialog is extracted with recent queries, type filters, highlighted results, and keyboard selection. | Browser history layer, focus restoration, and result routing across every type. |
| S4 Today | `src/App.jsx` | partial | Existing Today view remains in the monolith; primary Mark done action now uses lime. | Full S4 layout and screen-module extraction. Visual audit passed at 375, 768, 1280, and 1440px using synthetic data. |
| S5 Outreach | `src/App.jsx` | partial | Existing Outreach view remains in the monolith. | Scheduler sheets, responsive arrangement, keyboard flow. |
| S6 Due | `src/App.jsx` | partial | Existing follow-up view remains in the monolith. | Required grouped list and row overflow actions. Visual audit passed at 375, 768, 1280, and 1440px using synthetic data. |
| S7 Ongoing | `src/App.jsx` | partial | Existing Ongoing view remains in the monolith. | Owing/Paused/Paid up/All segments and row state. |
| S8 History | `src/App.jsx` | partial | Existing History view remains in the monolith. | Sticky month groups and drilled-in day layout. |
| S9 ClientRow | `src/clients/ClientRow.jsx` | partial | ClientRow is extracted and uses the shared client action context and icon component. | Every list context and assistive technology interaction. |
| S10 Client screen | `src/App.jsx` | partial | Removed duplicate Services section and repeated payment rows; payments now appear only in Payments & receipts. | Full S10 interactions and screen-module extraction. Screenshots at 375px and 1280px use synthetic data. |
| S11 Forms | `src/ClientEditors.jsx`, `src/App.jsx` | partial | Existing editors retained. | Shared field system and all form flows. |
| S12 Money | `src/money/MoneyView.jsx` | partial | MoneyView retained; expense shortfalls can borrow evenly from funded buckets and future allocations repay them. | Six extracted tabs and complete money workflows. Visual audit passed at 375, 768, 1280, and 1440px using synthetic data. |
| S13 Stats | `src/App.jsx` | partial | Existing Stats view remains in the monolith. | Period selector, KPI/funnel layout, readability. |
| S14 Playbook | `src/views/PlaybookView.jsx` | partial | Playbook content is extracted with rules, six steps, setup checklist, and reusable pricing references. Navigation label is Playbook. | At-a-glance readability and all setup checklists at every viewport. |
| S15 More and Settings | `src/views/MoreView.jsx`, `src/settings/BusinessProfile.jsx` | partial | More navigation is grouped into Records, Settings, and Danger Zone; profile fields use the existing settings shape. | Cloud sync redesign and all settings/save states. |
| S16 Dialogs and sheets | `src/Confirm.jsx`, `src/PrintDialog.jsx` | partial | Existing confirmation and print providers retained. | Focus trap, full Back behavior, manual printer checks. |
| S17 States and feedback | `src/App.jsx`, `src/AppShell.jsx` | partial | Existing loading/banner/empty patterns retained. | Global toast, error boundary, every list state. |

The coverage script is wired as `npm run check:ui`. It reports 14 required view modules that have not yet been
extracted from App.jsx and MoneyView.jsx. The checker is unchanged; the remaining monolith screens are marked partial.
