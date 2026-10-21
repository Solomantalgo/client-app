# Manual verification

## Requested checks

- [ ] Converted client pricing: open a converted client's screen, open its first service, switch between One price and Price per item, save each mode -> service price and Money client balance update; item names remain visible.
- [ ] Merge services: open a client, select two services, choose Merge, enter a title, and confirm -> merged invoice shows the combined total, total paid is unchanged, and Unmerge restores both original services and their payment links.
- [ ] Merge receipts: select two client payments, choose Merge receipts, print the grouped receipt, then unmerge -> Money still shows the original individual payment lines and totals.
- [ ] Pause client: open a client with a balance, choose Pause client and a reason -> Money Outstanding drops by that balance, Paused lists the client, and received payments still count as income; choose Resume client -> outstanding returns.
- [ ] Print formats: print an invoice and receipt using A4 / PDF, then 58mm thermal -> each uses its selected layout; reload and choose Print again -> the last format is preselected.
- [ ] Delete guardrails: delete a payment, a service with payments, and a client -> each dialog explains the affected data and typed confirmation is required where specified; use Undo within 10 seconds -> data returns; unpaid client deletion offers Pause instead.
- [ ] Clear a bucket: choose Start fresh, keep opening balance at 0, enter its name to confirm -> bucket shows 0 and transaction history remains; Not assigned reconciles; add income -> new allocation counts from zero; choose Undo clear -> prior balance returns.
- [ ] Search: press `/` or Ctrl/Cmd+K, search a phone number, item name, payment amount, transaction note, and invoice number -> matching client/service/payment/transaction/invoice results appear and open the relevant view.
- [ ] Export backup: open More on phone or use the sidebar on desktop and choose Export backup -> a dated JSON file downloads with normalized data.
- [ ] Responsive layout: use 375px and 1280px widths and open a client screen and editor -> no horizontal overflow, client details adapt to the viewport, and modals become bottom sheets on phones.

## NOT VERIFIED BY THE AGENT

- [ ] Browser interaction and screenshots at 375px and 1280px were not run in this session.
- [ ] A physical 58mm printer and system Save as PDF output were not available for verification.
