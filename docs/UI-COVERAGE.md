# UI coverage

This table reports the implemented surface and remaining gaps against the Studio visual authority in
`studio-handoff/IMPLEMENT-STUDIO.md`. Shared warm graphite and violet tokens now apply across the app, and Today
uses the Studio bento layout. Rows remain `partial` where screen-specific refinements or interaction/accessibility
review are incomplete. The static `npm run check:ui` gate is not a substitute for visual review.

| Screen | File | Status | What changed | Not verified or incomplete |
| --- | --- | --- | --- | --- |
| S1 App shell | `src/AppShell.jsx`, `src/AppShell.css`, `src/styles/theme.css`, `src/styles/studio.css` | partial | Responsive sidebar/bottom navigation, icons, search, sync, More and Quick add use warm graphite surfaces and violet active/primary states. | Full keyboard routing, error boundary and global toast stack. |
| S2 Quick add | `src/QuickAdd.jsx` | partial | New lead, income and expense choices open existing forms. | Focus management and every save/error state. |
| S3 Search | `src/SearchPanel.jsx`, `src/search.js` | partial | Search index, type filter, recent searches, matched-token rendering and target resolution. | Back/focus behavior for every result type and accessibility audit. |
| S4 Today | `src/views/TodayView.jsx`, `src/views/TodayView.css` | partial | Rebuilt as a Studio bento: outreach area, pitch progress, monthly earnings, today’s leads, attention and supplementary balances. Mobile puts earnings first. Existing selectors and callbacks are reused. | Handoff sample comparison uses synthetic data; unusual empty-plan combinations need manual review. |
| S5 Outreach | `src/views/OutreachView.jsx`, `src/views/OutreachView.css` | partial | Today's session, track progress, plan/log sheets and shared client rows. | Rotation history undo and all sheet interactions. |
| S6 Due | `src/views/DueView.jsx`, `src/views/PipelineViews.css` | partial | Follow-up groups, search/filter controls, overdue labels and client rows. | Row overflow actions and all date boundary cases. |
| S7 Ongoing | `src/views/OngoingView.jsx`, `src/views/PipelineViews.css` | partial | Owing, paused, paid-up and all filters with balances. | Large-data sorting and all paused/resume interactions. |
| S8 History | `src/views/HistoryView.jsx` | partial | History list and empty state, with client screen navigation. | Month grouping and back/scroll behavior with saved history. |
| S9 ClientRow | `src/clients/ClientRow.jsx`, `src/ClientCard.css` | partial | Shared responsive row, avatar, contact links, state and balance. | Screen-reader and every list-context interaction. |
| S10 Client screen | `src/clients/ClientScreen.jsx`, `src/ClientCard.css` | partial | Identity, balances, services, payments, editors and action flows. | Full merge, delete, pause, payment and long-record workflows. |
| S11 Forms | `src/ClientEditors.jsx`, `src/clients/ClientForm.jsx`, `src/money/MoneyView.jsx` | partial | Client/service editors, lead form, money forms and shortfall borrowing UI. | Validation and save/error behavior for every field and form. |
| S12 Money | `src/money/MoneyView.jsx`, `src/money/Overview.jsx`, `src/money/Transactions.jsx`, `src/money/Purposes.jsx`, `src/money/Accounts.jsx`, `src/money/ClientBalances.jsx`, `src/money/MonthlyEarnings.jsx` | partial | Overview, transactions, purpose, accounts, client balances and monthly earnings; borrowing and repayments retained. | Full historical data review and every destructive/settings workflow. |
| S13 Stats | `src/views/StatsView.jsx`, `src/views/StatsView.css` | partial | Period metrics, summaries and analysis layout. | Every metric against larger historical datasets. |
| S14 Playbook | `src/views/PlaybookView.jsx` | partial | Playbook rules, steps and local checklist. | Checklist variants and keyboard-only review. |
| S15 More and Settings | `src/views/MoreView.jsx`, `src/settings/BusinessProfile.jsx`, `src/settings/CloudSync.jsx` | partial | More groups, business profile and cloud settings are extracted and styled. | Save/connection failure states and reset flow. |
| S16 Dialogs and sheets | `src/Confirm.jsx`, `src/PrintDialog.jsx`, `src/ClientEditors.jsx` | partial | Confirm, editor and print surfaces use responsive dialog styling. Confirm dialogs now lock body scroll, trap keyboard focus, restore focus, and close with Escape. | Focus and Back behavior across every editor/print layer, plus printer/OS PDF output. |
| S17 States and feedback | `src/App.jsx`, `src/AppShell.jsx`, view modules | partial | Loading, empty, banner, confirmation and error feedback are present in existing workflows. | Error-boundary recovery and global toast/undo coverage for every mutation. |

## Browser review

Playwright captures use an isolated browser context with synthetic client, payment and purpose records. Cloud calls
are intercepted at the isolated host and unexpected external requests are blocked before app navigation. Captures
were made at 360px, 375px, 390px, 768px, 1280px and 1440px and inspected for Today, Pipeline, Client, Money, Monthly
Earnings, editors, settings and other screens. Automated capture reported no page overflow or runtime errors.

Screens remain marked `partial` where the full specification includes interactions or accessibility behavior not
verified in this pass. The coverage checker was not weakened.
