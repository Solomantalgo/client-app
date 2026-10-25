# Redesign verification

Automated browser screenshots were captured with isolated synthetic clients and payments in fresh Playwright
contexts. The dark theme captures are under `screenshots/redesign/dark-neon-final/`.

## Pause and resume regression check

- [x] Pause a synthetic ongoing client with UGX 400,000 due -> the client is removed from collectible totals and
  is listed under the Paused filter.
- [x] Reload -> the paused state persists, Resume client is visible, the Money Overview owing total is UGX 0,
  and the existing UGX 100,000 payment remains in October earnings.
- [x] Resume and reload -> status remains ongoing, paused is false, and the UGX 400,000 balance returns to
  Ongoing and Money Overview totals.
- [x] Compare before/after records -> services, agreed price, payment records and payment amount are unchanged.

## Borrowing workflow

- [x] Borrowing prompt: enter an expense of UGX 101 against an empty target bucket while three other buckets have UGX 100 each -> borrow is offered only in the expense form.
- [x] Even split: submit the expense -> lender buckets contribute UGX 34, UGX 34 and UGX 33, and no lender goes negative.
- [x] Insufficient funds: repeat with UGX 30 in each lender -> the shortfall cannot be submitted and the expense is not saved.
- [x] Repayment: add three future incomes of UGX 5, UGX 1 and UGX 2 -> outstanding loans repay evenly with rounding, including unequal remainders.
- [x] Delete and reload: delete the synthetic expense -> loan entries are removed and bucket balances reconcile; reload -> deletion remains persisted.

## Screenshots and visual review

- [x] Today at 375px and 1280px: greeting, session progress, next stop, needs-attention panel and money snapshot render without horizontal overflow.
- [x] Pipeline at 375px and 1280px: Outreach, Due and Ongoing render with synthetic records and no horizontal overflow.
- [x] Client detail at 375px and 1280px: identity, balances, service details and separate payment section render without horizontal overflow.
- [x] Money at 375px and 1280px: overview, transactions, purposes, accounts, client balances and monthly earnings render without horizontal overflow.
- [x] Captured Today, Pipeline, Client, Money and Monthly Earnings at 375px, 768px, 1280px and 1440px.
- [x] Captured Outreach, History, Stats, Playbook, More, Business Profile, Search, Quick add and editors at 375px and 1280px.
- [x] Reviewed the rendered screenshots for Today, Outreach, Due, Ongoing, History, Client, Money Overview, Transactions, Purposes, Monthly Earnings, Quick add, lead/client/service/payment forms and Print dialog. Applied charcoal surfaces, neon lime primary controls, electric blue secondary actions, mobile purpose controls and navigation refinements.
- [x] Browser capture reports no runtime errors, failed requests or horizontal overflow at 375px and 1280px.

## Manual checks still recommended

- [ ] Inspect every captured screen at 768px and 1440px with long production names and unusually large balances -> tablet and wide desktop layouts remain readable and unclipped.
- [ ] For each editor and print dialog, use keyboard only and Android/browser Back -> focus is usable and the topmost layer closes first. Confirm dialogs have keyboard focus trapping and Escape handling; verify these flows across every dialog type.
- [ ] With production data, test edits, deletes, merge/unmerge, pause/resume, backups, cloud sync and all empty/error/save states -> existing workflows and records remain correct.
- [ ] Print A4 and 58mm on real hardware or Save as PDF -> print output and paper behavior are correct.

## NOT VERIFIED BY THE AGENT

- [ ] The automated capture used representative synthetic records, not production records with extreme name and amount lengths.
- [ ] Real printer and operating-system Save as PDF output were not available to verify.
- [ ] The supplied A4 reference PDFs were not present in this workspace for side-by-side print comparison.
- [ ] Keyboard focus trapping/restoration was added for confirmations but was not manually audited across all dialogs; assistive-technology behavior, all cloud failure paths and production-data mutation workflows also remain unverified.
- [ ] The screens remain marked `partial` in `docs/UI-COVERAGE.md` where requirements exceed the interactions verified in this pass.
