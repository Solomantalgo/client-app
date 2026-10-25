# Redesign plan and screen inventory

The current specification is [UI-REDESIGN.md](./UI-REDESIGN.md). It uses charcoal surfaces, a dark sidebar,
neon lime primary actions, electric blue supporting actions, semantic status colors, and shared cards, rows and fields.

## Implementation order

1. Shared dark tokens, button roles, fields, icons, shell, mobile navigation and settings sheets are implemented.
2. Today and Monthly Earnings are the layout references; both have been captured at phone and desktop widths.
3. Shared row and page patterns are applied to Outreach, Follow-ups, Ongoing, Client, History, Performance and Playbook.
4. Money is split into Overview, Transactions, Purposes, Accounts, Client balances and Monthly Earnings while preserving the ledger.
5. Expense borrowing was verified in an isolated browser context. Keyboard and browser Back behavior still need broader manual review.

See [UI-COVERAGE.md](./UI-COVERAGE.md) for per-screen completion and verification gaps.

## Screen inventory

| Area | Current implementation |
| --- | --- |
| Shell and navigation | `src/AppShell.jsx`, `src/AppShell.css` |
| Today | `src/views/TodayView.jsx`, `src/views/TodayView.css` |
| Outreach | `src/views/OutreachView.jsx`, `src/views/OutreachView.css` |
| Follow-ups and Ongoing | `src/views/DueView.jsx`, `src/views/OngoingView.jsx`, `src/views/PipelineViews.css` |
| Client row and workspace | `src/clients/ClientRow.jsx`, `src/clients/ClientScreen.jsx`, `src/ClientCard.css` |
| Lead and service editors | `src/clients/ClientForm.jsx`, `src/ClientEditors.jsx` |
| Money Overview and sections | `src/money/MoneyView.jsx`, `src/money/Overview.jsx`, `src/money/Transactions.jsx`, `src/money/Purposes.jsx`, `src/money/Accounts.jsx`, `src/money/ClientBalances.jsx` |
| Monthly earnings | `src/money/MonthlyEarnings.jsx`, `src/reporting/earnings.js` |
| History, Performance and Playbook | `src/views/HistoryView.jsx`, `src/views/StatsView.jsx`, `src/views/PlaybookView.jsx` |
| More and settings | `src/views/MoreView.jsx`, `src/settings/BusinessProfile.jsx`, `src/settings/CloudSync.jsx` |
| Search and create flows | `src/SearchPanel.jsx`, `src/QuickAdd.jsx` |
| Confirmation and printing | `src/Confirm.jsx`, `src/PrintDialog.jsx`, `src/documents.js` |
