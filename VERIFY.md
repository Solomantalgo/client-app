# Manual verification

## Documents

- [ ] Print dialog: open an invoice and receipt -> an in-app print dialog appears without a browser prompt.
- [ ] Format preview: change the format dropdown between A4 and 58mm -> the live preview structure and width change.
- [ ] A4 reference: open the A4 receipt and invoice beside the supplied reference PDF -> sections, rules, bands, stamp, QR, signature, and footer match.
- [ ] A4 fit: print an invoice with two line items and terms -> the footer is visible and no content is clipped; long invoices flow to another page.
- [ ] A4 lime: inspect paper previews -> lime appears only as a filled band or stamp, never as text.
- [ ] Thermal: print a 58mm receipt -> single-column pure black on white output with no clipped sections.
- [ ] Payment method: print a receipt for Bank, MTN MoMo, and Cash -> each shows the actual account method.
- [ ] Payment details: configure bank or MoMo fields in Business profile and print -> only configured blocks appear.
- [ ] QR: scan the printed QR -> it opens the configured website.
- [ ] PDF filename: save a receipt as PDF -> the suggested name is `Receipt-<number>-<client>`.
- [ ] Remember format: print, reload, and open the dialog -> the last selected format remains selected.

## Search and navigation

- [ ] Search icon: visit every phone screen -> the top bar always shows the search icon.
- [ ] Close search: open search, use Back, Escape, X, and browser Back -> each closes the panel and restores the screen.
- [ ] Recent searches: run searches, close and reopen -> the last five appear; Clear removes them.
- [ ] Search routing: find a client by phone, a service by item name, a payment by amount, a transaction by note, and an invoice by number -> each opens the correct view; service/payment results flash briefly.
- [ ] Logo: inspect desktop sidebar, phone top bar, loading screen, and favicon -> the supplied logo appears, with text fallback if it cannot load.

## Client management and Money

- [ ] Converted service pricing: edit the first service in One price and Price per item modes -> the service total and Money balance update; item names remain.
- [ ] Merge services: select two services and merge -> invoice total combines them, paid amount is unchanged, and Unmerge restores both services and original payment links.
- [ ] Merge receipts: select two payments, merge, print, then unmerge -> the grouped receipt prints and the Money ledger retains both original entries.
- [ ] Pause and resume: pause a client with a balance -> Outstanding drops, the Paused list shows the amount, and existing payments remain income; resume -> balance returns.
- [ ] Delete guardrails: delete a payment, service with payments, and client -> dialogs explain consequences and typed confirmation appears where required; Undo restores data within 10 seconds; unpaid client deletion offers Pause instead.
- [ ] Clear bucket: start fresh with opening balance 0 -> balance is zero, history stays, Not assigned reconciles, new income counts from zero, and Undo restores the previous balance.
- [ ] Money layout: inspect Overview and transaction tabs -> there is one Log income primary button, full-width section tabs, and an unassigned client payment shows an Assign account chip that opens the account sheet.
- [ ] Due rows: open Due -> rows show the number of days overdue, sorted warm then most overdue, without orange card borders.
- [ ] Today desktop: open Today at desktop width -> Needs attention appears at right with overdue leads and largest outstanding balances.
- [ ] Backup: choose Export backup -> a dated JSON file downloads with normalized data.

## Responsive and visual

- [ ] Palette: inspect screens -> palette matches lime, blue, off-white, charcoal, danger red, and warning amber; contrast remains readable outdoors.
- [ ] Client screen: inspect a client -> payments are separate from services; checkboxes appear only after entering a merge mode.
- [ ] Phone and desktop: use 375x800 and 1280x800 -> no horizontal overflow and dialogs use bottom sheets on phone.

## NOT VERIFIED BY THE AGENT

- [ ] Browser screenshot and interaction checks at 375x800 and 1280x800 were not run in this session.
- [ ] A physical 58mm printer and operating-system Save as PDF output were not available for verification.
- [ ] The supplied A4 reference files were not visible in the workspace, so visual comparison against them was not run.
