# Solo Sales OS UI redesign

The approved visual authority for the entire app is [`studio-handoff/IMPLEMENT-STUDIO.md`](../studio-handoff/IMPLEMENT-STUDIO.md),
with [`studio-handoff/studio-tokens.css`](../studio-handoff/studio-tokens.css) and the approved reference image beside it.
This file records the preserved business-data requirements; its visual directions are superseded by the Studio handoff.

Keep the existing extracted screen structure, responsive navigation, client workspace, search and monthly earnings
report. Preserve every existing business rule and storage workflow. This is UI work only.

## Baseline and scope

- The behavior baseline is commit `305011a` (`all`), the immediate parent of the uncommitted redesign work.
- Preserve client, service, payment, follow-up, outreach rotation, income, expense, allocation, purpose, account,
  borrowing, repayment, invoice, receipt, merge, backup and sync behavior from that baseline.
- Monthly earnings is a derived reporting layer over canonical income, payments and expenses. It may add
  backward-compatible reporting classifications and monthly targets; it must not change financial transactions,
  bucket allocations, account balances, collection rules or client state.
- Paused clients are excluded from collectible balances, owing totals, attention lists and follow-up reminders.
  Their balances may appear in an explicitly labelled paused/detail view. Resume restores the existing ongoing
  state without changing services, agreed amounts or payment records.
- Historical payments remain in earnings by their received date even when a client is paused later.

## Visual system

Follow the Studio handoff: warm neutral graphite panels, off-white sans-serif text, restrained violet selection and
primary actions, with small lime earnings/brand accents. Do not use the former navy, blue and lime theme.

| Token | Value | Use |
| --- | --- | --- |
| Background | `#141313` | Warm graphite canvas |
| Sidebar | `#171616` | Navigation shell |
| Surface | `#211F20` | Panels and dialogs |
| Inset | `#252225` | Inputs and raised areas |
| Border | `#383438` | Quiet dividers and control edges |
| Main text | `#F5F3F6` | Headings and body |
| Secondary text | `#B9B3BE` | Supporting copy |
| Violet | `#BB8CFF` | Primary actions, focus and selection |
| Lime | `#C3FF4D` | Small brand and earnings accents |
| Warning | `#FF9C70` | Warm leads and warnings |
| Danger | `#FF8585` | Destructive actions and overdue state |

Solid violet controls use dark text. Keep focus rings visible and use text or icons alongside semantic color. Use
sans-serif for headings and body; use tabular figures for money and dates. Keep body text readable at phone size,
touch targets at least 44px, and respect reduced motion.

## Navigation and composition

- Phone/tablet retains Today, Pipeline, Add, Money and More in the bottom navigation with safe-area padding.
- Desktop retains the grouped sidebar and compact top bar. Keep the main content centered and responsive.
- Today prioritizes greeting, outreach progress, next stop, attention and a compact money snapshot.
- Pipeline keeps Outreach, Follow-ups and Ongoing views with shared client rows and a responsive client detail pane.
- Client detail keeps identity, agreed/paid/balance, primary actions, services, payments/receipts and details.
- Money keeps Overview, Transactions, Monthly Earnings, Purposes, Accounts and Client balances. Distinguish
  purpose allocation from account location.
- Preserve existing invoice/receipt print-document styles and print dialog behavior.
- Use shared theme tokens and component styles rather than appending duplicate override layers.

## Monthly earnings

Monthly earnings is separate from outreach performance. Classify receipts as earned, other or unclassified. Use
integer UGX amounts and Kampala business dates; report earnings by the date funds were received. Keep expenses
separate and label earned minus expenses as an app cash summary, not profit. Surface inferred dates, invalid data
and unclassified totals for review. Targets and classifications must survive normalization and reload without
rewriting canonical payment or allocation records.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, `npm run check:ui` and `git diff --check`. Browser tests must use
isolated synthetic local data. Cover pause → reload → resume → reload, collectible totals, unchanged services and
payments, historical earnings while paused, and borrowing/repayment/deletion. Capture Today, Pipeline, Client and
Money at phone and desktop widths; do not claim uninspected workflows as verified. See `docs/UI-COVERAGE.md` and
`VERIFY.md` for current status and remaining manual checks.
