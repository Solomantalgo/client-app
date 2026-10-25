# Client app: complete UI redesign and monthly earnings

Copy everything below into the implementation agent, or attach this file and ask the agent to execute it in full.

---

You are redesigning my existing client-app, a personal workspace for Solomantalgo: outreach, follow-ups, clients, services, payments, expenses, allocations and earnings.

Repository: https://github.com/Solomantalgo/client-app.git
Local project: C:\Solomon\Projects\Personal\client-app

## 1. Outcome and authority

Implement a complete, visibly different interface, with a coherent desktop and mobile experience. Add a dependable monthly earnings report. The current design is rejected. Changing colours, extracting components or passing overflow checks will not satisfy this task.

This brief supersedes earlier visual/layout instructions in docs/UI-REDESIGN.md, including the dark/lime-first presentation and permanent empty split panels. Preserve the established business requirements and workflows except for the reporting additions explicitly described here. Update the repository design document around this brief so there is one current specification.

Work section by section and continue until all sections are implemented and checked. Take the time necessary to inspect the result and revise weak layouts. Do not stop merely because the previous session took 15 or 25 minutes. Keep a completion checklist and give concise progress updates. Make routine design decisions autonomously. Ask only about genuine blockers that cannot be resolved from the code or this brief.

Do not push or deploy. Do not reset, discard, overwrite or stash away unrelated local work. Do not alter live client records while testing.

## 2. Inspect before editing

- Read applicable AGENTS.md and repository instructions. Inspect git status, current branch, local changes and recent commits. Refresh refs if available; preserve local work even if the branch differs from remote.
- Read App.jsx, AppShell, all style entry points, MoneyView, money.js, clients.js, storage/sync, document generation, existing tests, UI coverage and verification documents.
- Start the current app and inspect all pages and representative dialogs at 390px and 1440px. Use additional 360px, 768px and 1280px checks during verification.
- Record baseline test/lint/build/coverage failures. Do not describe baseline failures as newly introduced regressions, but complete the unfinished redesign requirements.
- Map every existing action and data field before replacing its UI. Preserve less frequent operations behind accessible overflow menus or settings.
- Produce a short design plan and screen inventory in the repo, then proceed to implementation without waiting for another approval.

## 3. Problems the replacement must solve

The supplied screenshots show overly dark, similar surfaces; inconsistent typography; repeated page titles; uppercased technical labels; sparse desktop pages; oversized empty client-detail panels; truncated names competing with contact buttons; overlapping status/actions; long pill controls; unstyled-looking links; redundant search; a visible horizontal scrollbar in Money; and small mobile text.

On mobile, much of the desktop arrangement has simply been compressed. The user must scan too many layers before reaching useful content. Lists and forms need their own mobile composition.

Do not reproduce these arrangements with a different palette. Change structure, proportions, information order and interaction patterns.

## 4. New visual system

Build a modern light workspace with a dark branded sidebar. Keep the existing Solomantalgo logo and product name. The default app experience must look substantially different from the screenshots.

### Palette

| Role | Colour |
| --- | --- |
| Workspace background | #F5F7FA |
| Main surfaces | #FFFFFF |
| Subtle inset/hover surface | #EEF2F6 |
| Sidebar | #111827 |
| Sidebar elevated/selected surface | #1F2937 |
| Main text | #172033 |
| Secondary text | #526176 |
| Borders | #DCE3EC |
| Primary action/selected information | #2457D6 |
| Primary hover | #1D46AD |
| Soft primary background | #EAF0FF |
| Success text | #157347 |
| Warning text | #965A08 |
| Danger text | #B42318 |
| Brand lime | #C3F83E |

Use white text on solid blue actions. Lime is a small brand accent, not the default button, link, chart and status colour simultaneously. Use semantic pale backgrounds with readable foregrounds. Check actual contrast, including hover, disabled, selected and error states. Avoid gradients, glow, glass, excessive shadows and coloured outlines around every card.

Use one readable sans-serif such as Inter, bundled/self-hosted with sensible fallbacks. No serif-looking search text or monospace form values. Use tabular numerals for money and charts; monospace only for IDs where useful.

- Desktop page heading: 28–32px, weight 600–700. Mobile: 23–26px.
- Section heading: 17–20px. Body: 14–16px. Supporting text: 12–14px; essential information at least 14px.
- Form inputs: 16px. Buttons: 14–15px. No tiny uppercase operational labels.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48px.
- Controls: 10px radius. Major panels: 14–16px. Chips can be pill shaped; normal buttons must not all be giant pills.
- Main controls: 40–44px desktop, at least 44px effective touch target on mobile. Icons: consistent 18–20px stroke icons from the shared system.
- Use subtle borders and sparse shadows. Rows belong in a shared list/table surface, not one bordered card per record.

If a theme preference already exists, preserve its data and keep dark mode coherent. Do not make adding a new theme switch a prerequisite; deliver the specified light default first.

## 5. App shell and navigation

### Desktop

Use a fixed approximately 232–248px dark sidebar. Brand at top, a clear New button, then grouped navigation:
- Work: Today, Outreach, Follow-ups, Ongoing.
- Money: Overview, Transactions, Monthly earnings, Purposes, Accounts, Client balances.
- Insights and reference: Performance, History, Playbook.
- Footer: Settings and a compact sync status.

These may share existing routes internally; select the correct Money subsection from sidebar entries. Use unique meaningful icons. Use a restrained selected background and one small accent marker. Do not repeat identical dots icons for unrelated pages.

Use a 64–72px top bar with a compact breadcrumb/context, global search and sync/profile controls. Put each page's heading and action once in its content header. Do not duplicate Money or Playbook in both a large top-bar title and content title.

Content: fluid grid, up to around 1360px, 24–32px padding; intentional narrower widths for forms/reference material. Avoid both narrow content stranded in vast blank areas and full-width stretched paragraphs. At 1280px adapt panel count/width instead of squeezing rows.

### Mobile/tablet

Keep Today, Pipeline, Add, Money, More as the bottom destinations. Keep Add integrated with the navigation at an accessible size; no oversized floating circle obscuring content. Reserve bottom space including safe areas. Use a compact top bar with a legible brand mark/title, search and sync icon.

Pipeline has one local selector: Outreach, Follow-ups, Ongoing. Money has a compact current-section picker opening a labelled list of its six sections. Do not fit six tabs in an overflowing strip or show a horizontal scrollbar. The selected section and its purpose must be obvious.

One page scroll by default. Sidebar navigation may scroll independently when needed. Selected client details can scroll within a deliberate desktop detail panel, but eliminate accidental nested page scrollbars. At tablet widths use one column or a drawer when a split view becomes cramped.

## 6. Today: a useful daily workspace

Heading: Today, date and a brief greeting. One clear Log lead action.

Below it, a compact summary strip: pitches logged / target, follow-ups due, active projects, earned this month. Each figure opens the relevant view; do not turn the entire page into KPI cards.

Desktop main region: roughly two-thirds daily outreach and one-third attention. The outreach panel contains a clear progress display, current area, physical/remote selector, next-stop context and compact Mark stop done action. Keep target adjustment behind an edit control or popover. Sequence/month/week metadata is secondary and should use readable labels rather than prominent technical codes.

Show today's leads as rows below the session. Attention shows up to four urgent follow-ups and a few balances due, with See all links. Avoid listing the same information in multiple large panels.

Mobile order: heading, compact summary, next outreach action, urgent follow-ups, today's activity. Keep the next useful action near the top. Provide useful no-plan, no-activity and caught-up states.

## 7. Outreach scheduler

Separate running today's outreach from maintaining the rotation plan. Header with Log lead; date context and today's lead list below.

Show physical and remote rotation as two compact plan sections, with area name, progress and View plan. Full area lists and history open in dedicated drawers/pages with search. Avoid large gaps separating a summary and empty list.

Do not render a permanent empty client-detail column. Open details only when a row is selected. Preserve existing area sequence, rotation and undo behaviour. Completing a stop and logging a lead must remain distinct actions.

## 8. Follow-ups

Header with due count and a short purpose description. Toolbar: local client search, All/Warm/Cold filter and appropriate date grouping. Group Overdue, Today, Upcoming. Sort by urgency with readable counts.

Desktop: use a properly aligned list/table: Client/business, Due/status, Temperature, Actions. Give identity the largest share of space. Keep contact buttons compact with accessible names. Rows open details; contact actions must be separate interactive siblings, not nested links/buttons.

Mobile: two-line identity at left and urgency at right; put contact and overflow actions on a stable second row if needed. Do not truncate most names after a few letters to make room for two long buttons. Status chips must never overlap contacts.

Selecting a client opens a drawer, or a split panel only at widths that support readable columns. Show a subtle selected row. Reschedule, mark complete and open client remain available.

## 9. Ongoing projects

Start with active-project count and current collectible balance; label paused balances separately. Segments: Owing, Paid up, Paused, All. Preserve the existing meaning of client/service states and do not invent task statuses unsupported by the data.

Desktop rows: client/business, service count, next due date, agreed/paid/balance context, status and overflow. Show Paid up quietly; reserve emphasis for money owing or overdue work. Do not let WhatsApp and Call dominate the list.

Mobile shows client identity, balance/status and next action on separate aligned lines. Open details as a full page with Back. Preserve pause/resume and related exclusions.

## 10. Client workspace

Use a coherent client detail page/drawer, not stacked legacy sections with new colours. Header: avatar, full name/business, contact and edit. Below, agreed, received and balance with a simple payment progress indicator.

Main tabs/sections: Overview, Services, Payments & receipts, Activity where real data supports it. Do not invent activity records. Overview contains next action and client information. Services show title, items, dates, amount and service operations. Payments appear once in Payments & receipts, with links back to the relevant service.

Keep Record payment and Add service clear. Put pause, merge and destructive operations in labelled overflow/danger controls. Preserve all existing invoice, receipt, merge and print flows. Give merge mode an explicit start/cancel/selection summary.

Mobile detail needs a compact action area and readable vertical sections, with no nested desktop grid. Long names, multi-service clients, paid-up clients, partial payments and paused clients must all look intentional.

## 11. Money overview and transactions

### Overview

Answer: what is currently available, how is it assigned, and what happened this month?

Use one dominant current recorded balance, with smaller received/spent context. Label this as a recorded cash balance derived from the app, not a bank-verified balance. Keep outstanding client money separate: it is not cash received.

Add a compact monthly earnings summary linking to the dedicated report. Below, use a desktop two-column layout for Purposes and Accounts, followed by recent transactions and relevant reconciliation warnings. On mobile stack these in that order.

Purpose balance and account balance describe the same underlying money from different viewpoints. Do not add them together. Show unassigned amounts and internal borrowing clearly without pretending they are new income.

### Transactions

Replace redundant Income/Expenses nesting with one Transactions view and All, Income, Expenses filters. Retain direct links that preselect Income or Expenses. Toolbar: date/month, search, source/account filters and Add transaction.

Desktop table: date, description/client, source/category, account, amount, overflow. Mobile rows: description, readable secondary details, signed amount, date/account; tap to open details. Group by month with subtotals when viewing multiple months.

Remove permanent Edit/Delete buttons scattered under every transaction. Use a details sheet and a proper row overflow menu. Delete is destructive, never lime/blue success styling. Unknown account becomes Not assigned with a helpful action; it must not prevent inclusion in earnings.

## 12. Monthly earnings: report design

Create a dedicated Monthly earnings screen under Money, directly reachable on desktop and from the mobile Money section picker. This must make it easy to answer: How much did I earn in a given month? Where did it come from? How does it compare? What remains after recorded expenses?

### Screen order

1. Heading, short explanation and month selector with previous/next arrows and year picker. Default to the current Kampala calendar month. Persist the selected period sensibly during navigation; support a direct URL/query state.
2. Four summary values: Earned, Other money received, Expenses, After expenses. Make Earned visually dominant; show transaction counts and concise definitions in detail/tooltips. If classification is unresolved, show the amount needing review and label earnings provisional.
3. A 12-month bar chart for the selected year. Default series is earnings. A selector can switch to expenses or show both with a clear legend. Use a zero baseline, UGX axis, readable tooltips and selected-month indication. Tap/click a bar selects that month. Do not present future months as completed zero-income months; render them as future/unavailable.
4. Source breakdown for the selected month: client work, salary, business, commission and user-defined sources as present. Show amount and percentage of earnings. Prefer labelled horizontal bars and a list over a decorative doughnut.
5. Monthly history table: month, earned, other receipts, expenses, after expenses, comparison. Include a selected-year total and monthly average with a clearly stated denominator. Mobile uses stacked month rows with expandable details, not a squeezed six-column table.
6. Transactions behind the selected month's figures. Clicking a summary/source filters this evidence list visibly, with a clear reset. Editing a client payment opens its existing payment editor; manual income opens its income editor.

Desktop: summary row, wide trend chart, then source breakdown alongside concise comparisons; detail/history below. Mobile: selected month, summary in a readable 2x2 arrangement, trend, source list, monthly history and transactions. All report totals reconcile under consistent filters.

### Comparisons and targets

For a completed month compare against the previous completed calendar month. For the current month compare month-to-date against the same elapsed local-calendar-day range in the previous month, clamped for shorter months; label both date ranges. Allow the user to choose a full-month comparison, labelled explicitly. Never compare a partial month to a full month without saying so.

Show absolute difference and percentage where meaningful. If previous earnings are zero, use No prior earnings or New income instead of infinity/100% growth. If both are zero, show no change. No invented insights or unsupported predictions.

Provide an optional monthly earnings target with progress, amount remaining and clear Set/Edit target. Store targets by YYYY-MM so changing October's target does not rewrite September. A target is a goal, not revenue. No target should be invented for the user.

Provide CSV export of monthly summaries and filtered underlying transactions. Include date range, currency and report basis. Quote CSV safely, including protection against spreadsheet formula injection in user text.

## 13. Monthly earnings: data and calculation contract

Use a cash-received basis and label it plainly: earnings are grouped by the date money was received, not the date a client was added, an invoice created, work started or money assigned to a purpose.

Build a pure reporting layer over the canonical normalized transaction stream. The repository already has getTransactions(data); inspect and reuse its deduplication and canonical identifiers, extending it carefully rather than scanning unrelated stores independently in every screen.

- Client payments count once per stable payment ID. Payment snapshots/allocations enrich a payment; they are not additional receipts. Receipt groups and merges are presentation relationships, not additional income.
- Salary, freelance/contract, business and commission receipts normally count as earnings. Custom sources can be classified by the user.
- Gifts, external loan principal, opening balances and owner transfers are other money received, not earnings. Bucket loans, repayments between purposes, transfers between own accounts, allocations and bucket resets are internal movements and count as neither earnings nor external receipts/expenses.
- An expense refund is normally other money received unless an existing supported linked-refund model provides a more precise treatment. A customer refund reduces earnings once on its actual outflow date, if supported. Do not silently infer refund direction from text or build a new accounting subsystem. Document and preserve the existing treatment where no refund model exists.
- If a customer refund is deducted from earnings, exclude that same outflow from ordinary Expenses in the After expenses calculation; never subtract it twice. Display refunds as a separate reconciling line. Preserve signed receipt corrections already supported by the app.
- Add a small reporting classification field/control where required, without replacing existing source names or changing allocation rules. Known sources may receive deterministic defaults. Unknown legacy/custom sources must be flagged for review; show total receipts and unclassified amounts so the user understands provisional earnings. Do not silently drop transactions.
- Classification affects reporting, not whether the existing receipt is allocated or saved. Existing cash/allocation behaviour must remain stable. Persist the classification so a source rename does not unexpectedly change historical reports. Use backward-compatible migration and stable references.
- Sum integer whole UGX values. Invalid amounts/dates are surfaced as data-quality issues. Missing account or purpose must not exclude a valid receipt.
- YYYY-MM-DD dates are local business dates. Do not parse them in a way that shifts the day/month with browser timezone. For timestamps use Africa/Kampala. Handle year boundaries, leap years and short months. Avoid toISOString-derived local dates around midnight.
- If a legacy payment has no reliable received date and normalization falls back to its client's creation date, flag that date as inferred for review rather than silently presenting an exact historical earnings month. Reports must expose the amount whose month is uncertain.
- Apply edits, deletions, backdating and sync updates to all affected summaries. A valid amount received while a client is later paused remains historical earnings. Pausing affects current collectible balances, not money already received.
- Keep current outstanding balances distinct from historical reporting. Do not show today's balance as month-end historical outstanding unless a genuine as-of calculation exists. Label it Current outstanding when shown.
- Earned = classified earnings receipts minus supported customer refunds. Other money received = classified non-earning external inflows. Show unclassified received separately when present. Total external inflows reconcile to those categories.
- Expenses = recorded expense outflows for the selected period, excluding internal movements. After expenses = earned minus recorded expenses; this can be negative. Label it as an app cash summary, not accounting profit, especially because personal and business spending may coexist. Show the other-receipts/refund exclusions in the definition. Do not mix account balance or allocation balance into this metric.
- An expense funded by bucket borrowing remains one expense. Later internal repayment does not create a second expense and does not reduce monthly earnings.

Add focused tests for these rules, using hand-calculated expected totals. Test month boundaries in multiple runtime timezones. Ensure overview, chart, table, source totals, drill-down and CSV use the same aggregation rules.

## 14. Purposes, accounts and borrowing

Use the user-facing term Purposes consistently, with the existing bucket IDs retained internally. Show name, allocation percentage, available balance and optional goal progress. Arrange desktop purposes in a compact grid; mobile cards have one clear amount and Manage overflow.

Provide a clear allocation-total indicator and preview before saving percentages. Show archived purposes separately, preserving their history. Explain Start fresh and its effects before confirmation.

Accounts show where money is held: name, type, recorded balance and recent activity. Historical transactions in archived accounts remain in reports. Keep accounts and purposes conceptually separate.

Preserve the recently implemented expense borrowing rules. Show the shortfall and lender contribution preview during new expense entry, when needed. If combined available balances are insufficient, explain why submission/borrowing is unavailable. Show outstanding borrowed/lent amounts within purpose details.

Retain existing safeguards for editing borrowing-linked expenses. Explain locked amount/purpose fields in context; keep safe fields editable if supported. Do not casually delete/recreate a real expense behind the scenes. If improving edit/recalculation, implement atomic reconciliation with meaningful tests covering existing repayments; otherwise preserve the restriction and explain the supported delete/re-enter path with its consequences.

## 15. Performance, history and playbook

Performance is for outreach results; Monthly earnings is for money. Do not make users hunt in outreach Stats for income.

Performance: one period selector, compact KPI row, pitches/warm/won/conversion, readable trend and source/method breakdowns. Define denominators. Replace This month (30d) ambiguity with either Calendar month or Last 30 days, correctly calculated. Keep existing yearly totals accessible. Avoid giant cards with one small value and empty space.

History: group by month/year, add date filters/search where useful, and use a timeline/list surface with consistent date, count and status columns. Open a day/session detail without losing period/scroll position. No card-per-day stretching across the entire desktop.

Playbook: readable reference layout with compact principles, a connected process timeline and a separate setup checklist. Use a constrained reading width, not a dashboard grid of oversized text cards. Preserve existing useful content. If checklist state is saved locally, state that accurately and persist it; do not say both stays on this device and is not saved.

## 16. Forms, search, settings and global states

Use one shared accessible field, button, menu, dialog, drawer and toast system. Properly style all controls, including anchor-based contacts. Remove default underlines from button-like links while preserving semantic links and focus indicators.

Lead form: essentials first (name/business, contact, temperature, next follow-up), secondary details collapsed. Payment/income/expense form: amount first, date, source/account/purpose as applicable, description and a clear save summary. Prevent double submissions and show save errors without losing the draft.

Desktop dialogs: reasonable width, logical two-column fields only where helpful, sticky footer and one intentional scrolling region. Mobile complex editors use a full-height sheet/page with Back/Close, safe-area footer and keyboard-safe scrolling. No underlying body scroll while modal. Focus trap, Escape, focus restoration and unsaved-change handling must work.

Global search: one obvious desktop entry, one mobile icon; local list search stays local. Keyboard shortcut where supported; grouped results with useful context. Opening a record restores the correct view/filter.

Settings: dedicated grouped page for Business profile, Cloud sync, Backup and danger zone. More on mobile is a normal navigable page or coherent sheet, not a stack of nested cards with tiny list widths. Cloud sync/settings must not be duplicated. Show connected/offline/error and last successful sync if tracked; protect credential fields.

Every page must have intentional populated, empty, loading and error states. Use concise toasts; do not replace a screen with a bright success banner. Destructive actions use clear confirmation and consequences, including linked records. Respect reduced motion. No essential hover-only controls.

## 17. Engineering approach and progress checkpoints

Build shared tokens/components first, then fully implement the shell plus Today and Monthly earnings as the design foundation. Inspect them at mobile/desktop and refine before propagating. Continue through Follow-ups, Ongoing, Client, remaining Money, Outreach, Performance, History, Playbook, Settings and dialogs.

Extract actual screens and money sections into maintainable modules as they are redesigned. App.jsx should coordinate data/providers/navigation. Do not spend the task only mechanically moving code. Do not create empty wrapper modules or imports solely to satisfy check:ui.

Remove conflicting legacy styles at their source. Do not append another huge override stylesheet, solve layout by hiding content, or apply overflow:hidden to conceal broken widths. Consolidate global form/link/button rules that currently leak inconsistent typography.

Preserve persisted keys, IDs, backup compatibility, sync, hybrid income and document output. Migrate new report fields safely and validate reload/sync round trips. Report remote-access failures but continue authorized local work. Keep report functions pure and views derived from canonical data.

Keep a visible section checklist in docs/UI-COVERAGE.md and meaningful incremental commits only where repo practice permits. Never claim complete because code moved or a screen opened. Update VERIFY.md with manual flows and evidence.

## 18. Acceptance and evidence

Run npm test, npm run lint, npm run build, npm run check:ui and git diff --check. Fix failures relevant to this task without weakening checks. Investigate the bundle warning and use route/module splitting where justified; do not add a large library for one small chart if the existing stack can render an accessible chart cleanly.

Use isolated browser contexts with synthetic representative data. Do not reset production storage or write synthetic data to the live cloud. Inspect every redesigned screen at 390px and 1440px; check layout at 360px, 768px and 1280px. Review all important editors, menus, confirmations and empty states, not just the four easiest pages.

Specifically verify:
- Long client/business names and large/negative UGX values remain readable.
- Status/action columns never overlap; no essential information disappears merely to fit.
- Navigation, browser Back, keyboard focus, touch controls and sheet footers work.
- No page-level horizontal overflow or accidental nested scrollbars. Charts reflow with readable axes.
- Money filters are meaningful, no duplicated Income/Expenses controls or repeated large page titles.
- Monthly totals reconcile to evidence rows, source breakdowns, annual chart and CSV.
- January/December, leap February, zero months, unknown classifications, gifts/refunds, duplicate payments, paused clients, deleted/edited/backdated income, archived accounts/purposes and borrowed expenses behave as specified.
- Saving/refreshing retains report classification and monthly targets.
- Existing client payment, separate income, expense, allocation, borrowing, repayment, deletion, invoice and receipt preview flows remain functional. Keep generated invoice/receipt layouts unchanged unless a real regression needs fixing.
- No browser console errors or unexplained failed requests in tested flows.

Before finishing, compare before/after screenshots side by side. Reject a result that preserves the same cramped rows, empty split panels, repeated headings and uniformly bordered boxes. Fix it instead of explaining it away as taste.

Deliver a concise completion report: sections finished, exact checks, known limitations, monthly calculation basis and representative screenshots of all major pages plus report/drill-down/form states. Include real design improvements and verified workflows, not just a module-extraction tally. Clearly separate unverified printer hardware output from verified preview behaviour. Do not call this complete with known unfinished screen modules or uninspected major screens. Do not push or deploy.
