# Solo Sales OS: whole-site UI/UX redesign spec

This is the single source of truth for the redesign. It covers every screen. Business logic, data shape,
and sync do not change. Invoice and receipt document layouts are specified separately; their print dialog
is covered in S16. Where this document conflicts with earlier UI prompts, this document wins.

## 1. Users, jobs, and design principles

One freelancer in Kampala runs outreach on foot with a phone, follows up on WhatsApp, delivers client work,
and tracks money by purpose. Phone use is often one-handed and outdoors; desktop is for admin, invoices,
receipts, and money review.

Jobs, by frequency: run today's outreach session and log a lead quickly; follow up with warm leads; manage
clients, services, payments, invoices, and receipts; track money received, purpose allocations, and balances
owed; review performance.

Design principles:

1. Field-first and thumb-first. Primary actions sit in the bottom 40% of a phone screen. Targets are at least 44px.
2. One screen, one job, one primary action. The top answers “what do I do next?”.
3. State before detail. Overdue, owing, paused, and unassigned states appear on rows.
4. Calm density. Use spacing and surface steps, not nested borders and cards.
5. One accent system: lime for action or good, blue for information or selection, red for danger or overdue,
   amber for warning. Never communicate state by colour alone.
6. Reuse the same page header, row, sheet, confirm, chip, and field patterns.
7. Progressive disclosure. Rare controls belong behind Manage or in a sheet.
8. Money uses monospace tabular figures; destructive actions are separate and guarded.
9. Sunlight-readable copy: body contrast at least 7:1, dimmest text at least 4.5:1.

Reference screens: Today, Pipeline (Due), Client, Money, Stats, More, and Quick add. The mockup is direction,
not a pixel specification.

## 2. Tokens and shared components

Palette: Lime `#C3F83E`, Blue `#428CFF`, Charcoal `#070A09`, Off-white `#F2F5F6`. Derive all other surfaces and
states from these colors.

```css
:root {
  --bg:#070A09; --s1:#0D1211; --s2:#131A19; --s3:#1B2523;
  --line:#222D2B; --line-2:#33423F;
  --text:#F2F5F6; --text-2:#B9C3C5; --text-3:#8A9698;
  --lime:#C3F83E; --on-lime:#070A09; --lime-soft:rgba(195,248,62,.12); --lime-line:rgba(195,248,62,.35);
  --blue:#428CFF; --blue-text:#6FA8FF; --on-blue:#070A09; --blue-soft:rgba(66,140,255,.14); --blue-line:rgba(66,140,255,.40);
  --danger:#FF5D5D; --danger-soft:rgba(255,93,93,.12);
  --warn:#FFB54D; --warn-soft:rgba(255,181,77,.12);
  --r-card:16px; --r-ctl:12px; --r-pill:999px;
  --font-ui:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"DM Mono",ui-monospace,Menlo,Consolas,monospace;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px;
  color-scheme:dark;
}
```

Lime on charcoal is about 16:1. Solid blue fills use dark text (`--on-blue`); on dark surfaces use `--blue-text`
for blue text and links. UI copy uses `--font-ui`; money, numbers, IDs, dates in tables, and small eyebrow labels
use `--font-mono` and tabular numerals. Page titles are 22px/600, section titles 16px/600, body 14–15px, secondary
13px, and `.label` eyebrows 11px uppercase with `.08em` letter spacing. Do not use uppercase monospace for page
or card titles. No text below 12px except `.label` at 11px.

Build reusable `Icon`, `Avatar`, `Chip`, `Button`, `IconButton`, `Segmented`, `Pills`, `Card`, `ListRow`,
`SectionHeader`, `Stat`, `ProgressBar`, `Field`/`MoneyInput`, `Sheet`, `Toast`, `EmptyState`, `Skeleton`, and
`Menu` components in `src/components/`. Icons are inline SVG, 24px, stroke 1.75, `currentColor`, with no icon
package. Required names: today, pipeline, money, more, search, back, close, plus, sync, edit, trash, print, pause,
merge, check, chevron, whatsapp, phone, filter, calendar, alert, cloud, download, user, building, chart, history,
and book.

Use one lime button per screen. Secondary actions are blue-soft or ghost. Danger appears in danger zones, confirm
dialogs, and overflow menus. Focus ring is 2px lime with 2px offset. Respect reduced motion; sheets slide up in
220ms, press feedback scales to .98, and avoid other animation.

## 3. Navigation and information architecture

Breakpoints: phone below 600px, large phone/tablet 600–899px, laptop 900–1179px, desktop 1180px+, wide 1600px+.

Phone and tablet navigation (<900px) is `Today | Pipeline | (+) | Money | More`. The raised 46px lime center
button opens Quick add with New lead, Log income, and Add expense. Pipeline has Outreach, Due (n), Ongoing and
remembers the last sub-tab. Stats, History, Playbook, and settings are in More. The Due badge sits at the Pipeline
icon's top right without touching its label. Tablet content is centered and max 680px.

Desktop navigation (>=900px) is a 248px sidebar with logo and wordmark, a lime `+ New` menu, Work (Today, Outreach,
Due, Ongoing), Money, Records (Stats, History, Playbook), and a footer for Settings and sync. The top bar has an
eyebrow, title, 320px search field (`/` or Ctrl/Cmd+K), and sync chip. Content is max-width 1120px, or 1280px at
1600px+. At >=1180px, Due, Ongoing, History, and Outreach use split view: list left (360–460px), details right;
empty detail says “Select a client to see details” and has Search.

Phone top bar is 56px: logo tile, one-line ellipsized title, search icon, sync dot (lime synced, amber pending,
grey local/offline). Tap sync dot to sync. Full status is in More > Cloud sync. Show Offline when `navigator.onLine`
is false. Drilled-in screens have Back. Browser/Android Back closes the topmost layer first (sheet, client, search)
through `pushState`/`popstate`.

## 4. Screen specifications

### S1. App shell

Use the navigation above, a global toast stack above the bottom bar (6s, optional action such as Undo) instead of
the lime banner, full-screen loading with logo, wordmark, and skeleton rows, plus an error boundary with “Something
broke”, Reload, and Export backup.

### S2. Quick add

A sheet over the current screen with three large icon rows: New lead (lime-soft), Log income (blue-soft), Add
expense (amber-soft), each with a one-line hint. Selecting opens its form sheet. Desktop `+ New` uses the same menu.

### S3. Search

Phone uses a full-screen page with Back, input, and clear. Desktop uses a centered 640px palette. Escape and Android
Back close it. Type pills: All, Clients, Services, Payments, Money. Empty input shows five recent searches and Clear.
Results group by type and include icon, title, subtitle, and PAUSED/OVERDUE chips. Highlight matches using string
slices and `<mark>`, never `dangerouslySetInnerHTML`. Support arrow keys and Enter. Selecting closes search, opens the
target, scrolls to and flashes service/payment for 1.5s. Phone access is the top-bar icon and full-width fields at
the top of Today and Pipeline.

### S4. Today

Phone order: greeting with date and “Good morning, <first name or Solo>”; session card with progress ring, pitches,
target/remaining, warm and cold chips, and target stepper; next-stop card with Physical/Remote segmented selector,
area, division/month/week tags, Mark done and + Lead; Needs attention with See all N, up to five overdue follow-ups
(avatar, name, temp, days overdue, WhatsApp) and up to three largest non-paused balances with Record payment; money
snapshot strip for received this month, available, and owing. Desktop uses left 720px session/next-stop and right
320px attention/snapshot columns. Desktop Mark done maxes at 360px. Show a caught-up empty state and a CTA if no
outreach plan exists.

### S5. Outreach scheduler

Header Outreach and Add client. Show today's ClientRows or “No pitches logged yet” CTA. Rotation plan has Remote
forward and Physical backward rows, progress, “27 of 120 · next Kansanga”, and lap chip. Full 120-area plan opens a
searchable sheet with current positions and completed states. History logs opens a sheet with All/Physical/Remote
filters, timeline, and Undo for latest entry using existing logic. No inline expanders. Desktop uses two columns.

### S6. Due

Search and All/Warm/Cold count pills. Group Overdue, Due today, Upcoming with counts. Sort each group warm first,
then most overdue. Rows show avatar, name, business/type, temp, and N days overdue; do not repeat FOLLOW-UP DUE.
No colored card borders. WhatsApp lime-soft and Call blue-soft 44px icon buttons; row opens client. Overflow menu:
Reschedule (+3 days, +1 week, date), Mark done, Open. Desktop split view at 1180px.

### S7. Ongoing

Summary: owing total and client count; paused amount not counted. Segments Owing, Paused, Paid up, All. Owing means
positive balance and not paused; Paid up means zero balance and not paused. Row has avatar, name, business, service
count, mono balance with paid-share progress, and next due chip (danger if overdue). Paused row shows blue PAUSED
chip and muted excluded balance. Desktop split view at 1180px.

### S8. History

Sessions grouped by month with sticky month headers. Day rows show weekday/date, client count, warm/pending chips.
Tap opens day detail with Back, date, summary chips, ClientRows. Desktop split view. Empty state: “No past sessions
yet”.

### S9. ClientRow

Used in every list. Min-height 64px; avatar, 15px/600 name, 13px secondary business/type, right temp or balance,
optional icon buttons, hairline separators, no card border. Paused uses blue avatar and chip. Selected split row uses
lime-soft background and 3px lime left bar. WhatsApp/Call are siblings, not nested in row button.

### S10. Client screen

Phone order: Back, 48px avatar, name/business/type, Edit, chips (Ongoing/Lead, PAUSED, WARM/COLD, service count);
summary card (Agreed/Paid/Balance mono, lime progress; paused balance says excluded); sticky action bar with Record
payment, + Service, overflow (Pause/Resume, Merge services, Merge receipts, Edit client), or lead actions Mark done,
Won, overflow; Services (n), each expanded card with title/due/status/items/Edit/Invoice and Delete in overflow;
separate Payments and receipts rows with method/date/receipt number/amount and overflow Edit/Receipt/Delete; receipt
groups with Print/Expand/Unmerge; checkboxes only in merge mode; Details with phone/pitch/WhatsApp/owner/notes/services
and lead quoted price; collapsed danger zone. Desktop container >=720px has summary/actions/details left and services/
payments right; actions are static.

### S11. Forms and field system

Field label above, 44px control, helper below, inline danger error; proper `inputMode`. MoneyInput is mono with UGX
prefix, live grouping, and 28px amount-first variant. Segmented for short fixed option lists.

New lead sheet: required name; Name, Business, Phone + WhatsApp toggle, Pitched via, warm/cold. Collapsed More details
has business type, services, quoted price, package, demo shown, decision maker, notes, follow-up date and +2 days/
+1 week chips. Sticky Save lead/Cancel; validate on blur/save.

Money forms are sheets. Income/Expense: amount first, date pills, account chips, purpose for expense or allocation
preview/custom toggle for income, note, sticky Save. Purpose: name/icon/percentage/100% indicator/target. Account:
name and Bank/Mobile money/Cash/Other segmented. Source type: name field from Income overflow. Client info, Service,
Pause, Merge, Start fresh, Business profile all use the same sheet/field system. Service editor has One price and
Price per item segments.

### S12. Money

Scrollable tabs Overview, Income, Expenses, Purposes, Accounts, Clients; internal keys may remain Allocations and
Client balances. Quick add supplies Log income; Source type lives in menu.

Overview: Available hero with 30px mono amount and Received/Spent/Owing; two-column purpose cards with icon/name/
balance/progress/reset chip/overflow Edit, Start fresh, Archive; Where money accounts; Needs attention with
unassigned-account count, overpaid services, paused excluded amount, and Not assigned to a purpose reconciliation.

Income/Expenses: filter pills and searchable field with clear; month-grouped rows with sticky month subtotal.
TransactionRow has icon, one-line title, service/date subtitle, mono amount and account chip below. Missing account
shows amber Assign account; tap opens account sheet. Tap row opens edit sheet.

Purposes: rows with name, percent stepper, balance, Counting since, overflow; total allocation indicator; archived
purposes collapsed below. Accounts: cards with type icon/name/balance/archive menu. Clients: owing list grouped by
client with service subrows, progress and balance; collapsed Paused section. Desktop overview uses two columns.

### S13. Stats

Performance with Today/7 days/30 days/Year segmented selector. KPI grid: Pitches, Warm leads, Won, Conversion,
today's target, Leads to Ongoing. Funnel horizontal bars: lime won, blue others. Outreach analysis stacked bars and
legend for pitch method, lead temperature, decision-maker presence. CSS only, no chart library. Keep all existing
metrics, including yearly pitch total. EmptyState when period has no data.

### S14. Playbook

Rename Guide/System Flow to Playbook. Three golden rules: Don't pressure clients; Focus on business benefits; Guide
confidently with short follow-ups. Six-step vertical timeline: Meet client/understand problem; show relevant demo;
collect details; build/customize; review and launch; offer monthly support. Restaurant/Salon setup segmented checklist
uses local-only state. Keep existing text.

### S15. More and Settings

Phone More page groups Records (Performance, History, Playbook), Settings (Business profile, Cloud sync with status,
Export backup), and a separate danger card for Reset all data. Desktop equivalents are in sidebar footer.

Business profile is a fields page. Cloud sync replaces CloudSetupModal presentation with status/last sync/Sync now,
Supabase URL, show/hide key, Save and test, and helper text, preserving existing validation. Reset uses the existing
typed confirmation in a danger sheet.

### S16. Dialogs and sheets

Phone sheet has drag handle, 20px rounded top, max-height 92vh, scrollable content, sticky footer, safe-area padding.
Desktop centered dialog max 560px/92vw. Dialog has dialog role, aria-modal, focus trap, Escape, body scroll lock, and
backdrop dismissal (except typed confirm/unsaved forms).

Confirm tiers follow the main prompt: verb-phrase title, consequences and amounts, red confirm, Cancel focused by
default, optional safer action. Print dialog has format dropdown, live iframe preview, Print, and fallback link.
Merge/Pause/Start fresh/editors show summary and outcome preview with sticky footer.

### S17. States and feedback

Empty states name the space, give one-line help, and one CTA. Loading uses skeletons, not blank UI. Errors say what
happened and what to do; save errors offer Retry. Success uses concise toasts and Undo when reversible. Sentence-case
copy, verb-first buttons, no emoji anywhere in UI; use Icon.

## 5. Engineering plan

### Phase 0: safe mechanical split

Move code without behavior changes, one commit per move, and run build/tests/lint after each:

```text
src/lib/format.js: fmtUGX, fmtDate, todayStr, addDays, dueDateStr, number helpers
src/components/*.jsx: shared components
src/views/: TodayView, OutreachView, DueView, OngoingView, HistoryView, StatsView, PlaybookView, MoreView
src/clients/: ClientRow, ClientScreen, ClientForm (ClientEditors.jsx stays)
src/money/: MoneyView, Overview, Transactions, Purposes, Accounts, ClientBalances, forms
src/settings/: BusinessProfile, CloudSync
src/styles/: theme.css, ui.css, shell.css and view styles
```

App.jsx keeps state, data loading, routing, and providers. Shared helpers go in `src/lib/`; avoid circular imports.

### Phase 1: design system

Tokens, theme.css, ui.css, shared components, icons, and replace all old palette hexes.

### Phase 2: shell and global flows

Shell, navigation, Quick add, toasts, loading/error states, and Search.

### Phase 3: screen order

Today, Due, Ongoing, ClientRow, Client screen, New lead/editors, Money and forms, Outreach, History, Stats, Playbook,
More/Settings, dialogs, print dialog. For every screen remove inline color styles, use shared components/classes, keep
logic and props, and keep tests passing. Add tests when logic changes.

### Phase 4: coverage

Create `scripts/ui-coverage.mjs` and `docs/UI-COVERAGE.md`. The checker scans `src/**/*.{jsx,js,css}` excluding
`src/documents.js` and `src/styles/theme.css`, and fails on hex colors outside theme, old `aaff00`/`080808`, more
than three `style={{` uses in a view file (dynamic width/transform only), emoji (`\p{Extended_Pictographic}`),
`confirm(`/`prompt(`/`alert(`, inline font size below 12, or uppercase text transform outside `.label`. Assert files
exist and import `src/components` for TodayView, OutreachView, DueView, OngoingView, HistoryView, StatsView,
PlaybookView, MoreView, ClientRow, ClientScreen, ClientForm, MoneyView and six tabs, BusinessProfile, CloudSync,
SearchPanel, QuickAdd, PrintDialog. Wire `npm run check:ui` and include it in the gate. Coverage docs have one row
per S1–S17: file, done/partial/skipped, changes, unverified. Do not mark done unless the checker passes.

`VERIFY.md` must provide per-screen manual steps at 375px and 1280px: no horizontal overflow, named icon buttons,
Back layer order, no emoji, correct palette, and empty/loading/error states for every list.

## Visual QA refinements

The current responsive audit uses isolated Playwright contexts with synthetic records. It checks Today, Pipeline,
Client details, and Money at 375px, 768px, 1280px, and 1440px, recording page-level horizontal overflow, console
errors, and failed requests. The audit caught two presentation issues that were corrected: Today’s Mark done
button now uses the primary lime token, and Client details renders one Services section with payment rows only
in the separate Payments & receipts section. The screen modules and remaining `check:ui` findings are still
tracked as partial in `docs/UI-COVERAGE.md`.

The separately run borrowing browser verification submitted an expense above the selected bucket balance, confirmed
even lender distribution and nonnegative balances, blocked an expense when combined funds were insufficient,
repaid lenders over several later allocations with unequal outstanding amounts, deleted the expense and checked
loan cleanup, then reloaded to verify persistence. The browser used synthetic-only local data and intercepted cloud
requests, so the user's saved records were not read or changed.

The latest visual pass additionally captured Outreach, Due, Ongoing, Stats, History, Playbook, Search, Quick add,
More, and Business profile at 375, 768, 1280, and 1440px. The automated audit found no page-level horizontal
overflow, console errors, or failed requests. `ClientRow`, `QuickAdd`, `SearchPanel`, and `PlaybookView` are now
real extracted components; remaining screen modules are still marked partial.
