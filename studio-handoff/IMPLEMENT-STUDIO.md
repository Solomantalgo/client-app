# Approved Studio direction: entire-app UI/UX implementation

## Authority and scope

The user selected Option 3, Studio. Implement the attached `studio-approved-reference.png` faithfully. It is the approved visual target, not loose inspiration. This brief replaces prior light/blue, cyan-console and lime-editorial directions for this work.

Apply this design system across the ENTIRE APP: home/Today, outreach, follow-ups, ongoing, client details, all money sections including monthly earnings, performance, history, playbook, settings, search, quick add, every form/dialog/menu and every responsive state. The home reference establishes the visual system; all other screens must feel like the same product. Reuse the established app logo; the leaf symbol in the generated concept is not an authorised replacement logo.

UI/UX ONLY. Preserve all current business logic, calculations, handlers, selector semantics, records, migrations, dates/timezone rules, storage keys, sync, recovery safeguards, borrowing, pause/resume, payments, allocations and monthly reporting. Do not refactor these systems. Do not revert logic to an older commit or add new reporting logic. Preserve uncommitted work.

The sample names/amounts/date in the reference illustrate layout. Render existing live view-model values instead. Never seed the real app to match this picture. Do not change how pitches, follow-ups, earnings or next area are calculated. This is not permission to access or alter real records.

## Deliverables supplied

- `studio-approved-reference.png`: approved combined desktop/mobile visual. Left is desktop; right is mobile. Treat the product surface inside each frame as the target. Do not reproduce the surrounding presentation canvas, device frame, clock/notch, battery, desktop display border or Concept/sample-data caption in the app.
- `studio-tokens.css`: explicit proposed colour, spacing and type values. These are implementation starting values chosen for the reference, not claims of exact font or pixel measurements extracted from the image. Tune proportions to the actual reference while preserving the design.
- This implementation brief, layout constraints and acceptance checklist.

## 1. Non-negotiable visual identity

Warm neutral near-black, warm graphite panels, off-white type, restrained neon violet primary actions, and tiny lime brand/earnings accents. Do not turn the workspace navy, blue, light or predominantly lime. No cyan controls. No serif or body monospace fonts.

The visual character is soft, premium and controlled: asymmetric bento layout, broad outreach panel, compact progress and earnings columns, two balanced lower panels. Mobile uses a different order. Keep the large area-name typography, subtle panel contrast, calm empty state and violet active navigation.

Use a locally bundled Inter font where available, or bundle an equivalent permitted sans-serif. Typical weights: body 400, labels 500, titles/amounts 600–700. Use tabular numerals on amounts/counts. Avoid making every line bold.

No strong outer glows, heavy gradients, bouncing elements, decorative charts, new notifications, account dropdowns or invented maps. The faint lines inside the outreach card may be reproduced as an optional low-opacity non-interactive CSS/SVG contour texture; never use a map API or make location claims. Keep it behind text, decorative and aria-hidden.

## 2. Desktop composition

Target a real 1440x960 CSS viewport first, and verify 1280x800. Use approximately 224px sidebar, main padding 28–36px, 16–20px panel gaps. Content uses the available width up to about 1360px excluding the sidebar. Do not centre a tiny mockup inside the browser.

### Sidebar

Warm dark surface, slim right separator, actual logo/wordmark at top. Navigation rows roughly 44–48px tall with readable 14px labels and 18–20px consistent icons. Selected Today row: soft violet fill, violet icon, off-white label. Match the reference's compact rhythm.

Retain all existing destinations and callback mappings. The image's shortened navigation does not authorise removing Outreach, Follow-ups, Ongoing, Money subsections, Stats/Performance, History, Playbook, settings, backup or sync. Group lower-frequency items under the existing More/Settings structure or a clear accessible overflow so the sidebar remains calm. Preserve their exact current behaviour. Do not move destructive reset into a prominent routine action.

### Page heading

At top: `Today` as the largest heading, then greeting and date in the reference arrangement. Approximate desktop sizes: Today 36px/700; greeting 26px/600; date 14px in muted text. Use the existing name/date source. Preserve search and sync access as small quiet controls in the header; do not invent a profile/account feature from the decorative avatar in the concept.

### Top bento row

Use a 12-column grid. Outreach spans 6 columns, progress spans 3, earnings spans 3. Align heights, approximately 260–290px at 1440px. The outreach panel should be clearly wider than either summary panel. Main region gap 16–20px.

Outreach card:
- Warm graphite with a restrained violet tint and fine violet border. Padding 22–24px, radius 16px.
- Small sentence-case `Next outreach area` label.
- Violet location icon beside large area name, 32–36px desktop. Division beneath, 14px muted.
- Physical / Remote selector across the lower region. Selected Physical uses soft violet, readable text and an icon. Bind to the existing mode state.
- Bottom row: solid violet `Mark stop done`, dark secondary `Log lead`. Buttons 44px high, 10–12px radius, balanced widths, no giant pill shape. Reuse existing handlers. Preserve any existing confirmation before completion.

Progress card:
- Heading `Pitches today`, large live `completed / target`, then a subtle track proportional to that existing target.
- Quiet divider and `Follow-ups due` with its actual count.
- Do NOT draw the follow-up progress bar seen in the concept: a count has no meaningful denominator. Leave that area calm or use a small Open follow-ups text action wired to the existing view.
- Preserve Edit target via a small labelled icon/control adjacent to the target; reuse the existing target editor. Do not create new target logic.

Earnings card:
- Small lime wallet icon, muted `Earned this month`, readable live UGX amount and neutral bordered `View earnings` action.
- Reuse the currently implemented monthly earnings selector and route. If unavailable or loading, show its existing loading/unavailable state; never invent a total or alter classification.
- Large amounts must wrap/scale within sensible type limits, not disappear with ellipsis.

### Lower bento row

Two equal 6-column panels. Left `Today's leads`, right `Needs attention`, 22–24px padding, radius 16px, quiet neutral border. Align their tops; no forced viewport height or giant fixed empty box. Empty reference heights around 260–300px are a guide, not a reason to create wasteful blank space.

Today's leads:
- Match reference empty state: small neutral document icon, `No leads logged yet`, one helpful line, solid violet `Log lead` button.
- When populated, display real existing Today lead rows with status and record-opening behaviour. Empty-state layout must not replace populated content.

Needs attention:
- Title left, violet View all right.
- Compact inset rows with subtle surfaces: urgency icon, full client/business name, overdue text in warm orange/red, chevron. Row opens the existing client/follow-up view. Contact actions, if currently supported here, remain accessible in row details or compact sibling icon buttons.
- Show at most a few previews, not a full-height overdue directory.
- Preserve current balance/attention information that exists on Today, including paused-aware exclusions. If it does not fit this first row, place it in a compact `Balances to collect` subsection below attention or a supplementary lower section using the same design. Never hide data/functions merely because absent from the concept.

## 3. Mobile composition

Target 390px and 375px wide. Page padding 16px, gaps 12–16px. Do not render a small desktop view. No phone frame, canvas border or fake status bar.

Order must match the approved mobile visual:
1. Compact header: actual brand, existing search/sync access.
2. `Good morning, Solomon` using real name, then date. Greeting 23–25px/600, date 13–14px.
3. Full-width compact earnings strip: lime wallet, Earned this month, live amount, chevron to the existing earnings screen. Around 70–80px high. This replaces the desktop earnings card on mobile; do not duplicate it.
4. Full-width violet-accent outreach card: label, location/name, division, mode selector and two actions. Area name 28–32px. Padding 18px, radius 16px. Selector about 42–44px high, actions at least 44px. At 360px, allow actions to stack only if needed for readable labels; 375/390px should use the reference's two-button row where it fits.
5. Two small summary cards side by side: Pitches today with value/target and meaningful track; Follow-ups due with count and navigation affordance. Equal width, 110–128px high. No fake follow-up progress bar. Preserve target-edit access.
6. Needs attention heading and View all, followed by compact urgency rows.
7. Today's leads and any existing balance attention content below, in the same visual system. These may require normal page scroll; do not remove them to fake a one-screen composition.
8. Fixed bottom navigation: Today, Pipeline, Add, Money, More. Soft violet Today selection and violet Add control integrated in the bar, approximately 44px, not a huge floating object. Keep existing navigation destinations/actions and badges. Reserve actual bar height plus safe-area padding so content is never covered.

Retain the reference's clear vertical hierarchy and compact earning strip. Avoid reproducing the old long stack of equally prominent cards with repeated labels, oversized pills and empty panels.

## 4. Responsive rules

- Below 768px: mobile composition, no sidebar. Real document scrolling.
- 768–1179px: tablet composition. Use compact existing navigation, outreach full width with progress/earnings as a coherent next row, lower panels stacked or two columns only if readable.
- 1180px and above: desktop sidebar and 6/3/3 top grid, 6/6 lower row.
- Check 360, 375, 390, 768, 1280, 1440px. At short viewport heights, allow scrolling. Never hide content with overflow:hidden to pass a check.
- Long names/areas, many leads, large money values, zero activity and no urgent follow-ups must fit. Prefer wrapping to squeezing fonts.

## 5. Interaction and accessibility fidelity

Keep physical/remote, stop completion, lead creation, target edit, record opening, view-all, earnings link, navigation, sync and search functional through their existing handlers. Do not add account or notification logic to match a decorative image element.

Use semantic buttons/links; action icons need accessible names. One clear h1. Violet focus ring, good contrast, keyboard access, 44px effective touch targets. Preserve Back/focus/unsaved-draft behaviour. No nested interactive row controls. Respect reduced motion; transitions only about 120–180ms and no looping effects.

## 6. Data and testing boundary: critical

Earlier automated testing wrote synthetic records to the real cloud. This must not recur.

- Do not open an automated app session until cloud calls are mocked and unexpected network access is blocked BEFORE navigation/app initialization.
- Use a separate disposable browser profile/context with synthetic records. Never use the user's normal Chrome profile, live localStorage or production cloud credentials.
- No import, seed, reset, migration, manual sync, cloud write or recovery operation on real data is authorised here.
- Do not reproduce sample figures by changing real records. Do not persist prototype layout state into business data.
- Do not change persistence/sync/recovery logic as part of this UI task. If an unrelated bug blocks work, explain it rather than silently changing it.
- Review the diff specifically for accidental domain/data changes. Structural React rendering and CSS changes are expected; changes to financial/status rules are not.

## 7. Implementation order and visual acceptance

1. Read this entire brief and open the approved reference image before editing. Preserve current local work. Inventory existing home controls/data to retain.
2. Introduce app-wide Studio tokens and shared presentational components, migrate screens deliberately and remove conflicting legacy styles at their source. Establish the reference home first, then implement every remaining screen below without pausing for another approval. Reuse existing domain code; do not replace it with a new model.
3. Implement desktop structure and mobile-specific ordering with live existing props/selectors. Avoid a second set of business computations for mobile.
4. Render isolated synthetic-data screenshots at 1440x960 and 390x844. Compare product regions to the reference side by side. Inspect the actual images; a screenshot tool returning successfully is not a visual review.
5. Refine widths, type scale, panel contrast, button treatment, spacing, alignment and content order until the design clearly matches Studio. Document any necessary departure, especially the actual logo, real controls, no meaningless follow-up bar and supplemental populated content.
6. Verify 360/375/768/1280px, keyboard/touch, populated and empty states across EVERY screen and editor. Run existing appropriate tests, lint, build, UI checks and diff check. Do not add implementation-mirroring tests; check preserved interactions and relevant existing regressions.

Reject the work yourself if it looks like the earlier dark navy/lime stack with purple substituted. The required result has warm graphite, violet selection, asymmetric desktop bento, mobile earnings-first ordering, a dominant next-action card and compact lower content.

Do not replace the home page with the mockup image or use image slices for text, controls or panels. This must be real responsive HTML/CSS/React. Decorative contours can be CSS/SVG only; do not regenerate or alter branding.

Before declaring completion, provide:
- Desktop and mobile screenshots, each compared to the approved reference.
- Files changed and a brief explanation of deliberate visual deviations.
- A list confirming the original handlers/selectors were reused and no business/data/sync logic changed.
- Checks run and any unverified items.

Complete the entire-app scope defined below. Do not push, deploy or start new functional features. The only authorised changes are UI/UX; monthly earnings already exists and must retain its current logic.

## 8. Shared system for all screens

The approved image is the strict home target and the authority for the rest of the app's visual language. Other pages must adapt its components to their task, not blindly repeat its bento layout everywhere. Do not invent a second visual direction for Money, Settings or client screens.

Create/reuse shared presentational PageHeader, Panel, Button, IconButton, Tabs/Segmented, StatusChip, ClientRow, TransactionRow, Field, AmountDisplay, Drawer/Dialog, Menu, EmptyState, Skeleton and Toast. They must share the warm graphite/violet tokens, font, spacing and corner treatment. Keep components separate from business rules. Existing callbacks remain responsible for actions.

Page heading 28–32px desktop and 23–26px mobile; section heading 18–20px; body 14–16px; supporting copy at least 12px. Panels 16px radius, controls 10–12px. No default blue links, lime primary buttons, light panels or serif/monospace input values left over from previous themes. Lime remains a restrained brand/financial emphasis, not a second competing action colour. Semantic overdue/warning colours retain readable labels.

Normal list screens use one well-structured surface with dividers, not a separate giant card per row. Use bento panels for summaries and overview screens, as the reference does. Long tables use readable aligned columns on desktop and deliberately composed rows on mobile. Avoid nested panels, repetitive headings and permanent empty details columns.

## 9. Work screens

### Outreach

Use a Studio page header with a visible Log lead action. Place the current outreach/session summary and real today's leads first. Show the two existing physical/remote rotation summaries as compact related panels. Full plan and outreach history use styled drawers/pages with their existing search/filter/action functionality. Keep the sequence/rotation/completion behaviour exactly as currently implemented. Selecting a real client can open its details; never reserve half the desktop for an empty placeholder.

### Follow-ups

Header, count, local search and existing filters. Desktop list columns align identity, due/urgency, temperature and actions. Prioritise full client/business names. Violet selected row, warm overdue text, compact contact icons and explicit overflow. Mobile rows allow two-line identity, due information and separately aligned contact actions; no cramped name/status/action collision. Preserve actual grouping, ordering, rescheduling and completion semantics; visual redesign is not permission to change them.

### Ongoing

Compact summary of existing current totals, existing status filters and a readable project/client list. Clearly distinguish active, paused, owing and paid-up states using existing selectors. Preserve exclusions and original filter semantics. Provide Resume wherever the current app supports it; styling must not hide or disconnect the action. Balance figures and due dates align; paid-up clients are visually quiet. Mobile details open as a full page/drawer with working Back.

### Client details

Header with full name/business, contact actions and edit. Studio summary panels for current agreed/paid/balance data and meaningful payment progress. Organise services and Payments & receipts into readable sections/tabs using existing data relationships. Client payments appear once, with service references. Keep all existing service, payment, pause/resume, merge, invoice and receipt actions accessible. Desktop can use an identity/summary column and a larger services/payments region; mobile uses a clear vertical order and compact action area. Do not modify any calculations or merge logic to make a layout easier.

## 10. Every Money section

### Overview

Use the same asymmetric Studio summary style: primary recorded-available amount, compact earned-this-month panel linking to the existing report, smaller received/spent information, purpose balances, accounts and recent transactions. Keep collectible client balances separate and respect current paused exclusions. Do not relabel cash balance as profit. Do not add account totals to purpose totals.

### Transactions / Income / Expenses

Preserve the current routes, filters and semantics. Present their controls cleanly without unnecessary duplicated navigation. Desktop table: date, description/source, account/purpose where relevant, amount, overflow. Mobile row: strong description, amount, readable date/context and details action. Use violet selection and quiet dividers. Editing/deleting flows call existing handlers and confirmations. Maintain signs and existing income/expense meanings; do not infer classification from presentation text.

### Monthly earnings

Restyle the existing month/year picker, targets, summary figures, chart, source breakdown, month history, drill-down transactions and export controls in Studio. Violet for selected month/main earnings series, lime only secondary monetary emphasis, warning colours for data review. Use readable labels/axes/tooltips on warm graphite. Mobile summary 2x2, responsive chart and expandable month rows. All values, classifications, date rules, comparisons and exports must use current reporting functions unchanged. Do not add a new target/forecast or invent missing data.

### Purposes / allocations

Compact desktop grid, single-column mobile cards. Each shows current name, percentage, balance and actual goal/borrowing data where supported. Violet meaningful progress, quiet management overflow, clear total-allocation indicator. Style percentage editors and any existing allocation previews. Archived sections remain accessible. Preserve borrowing, repayment, archive and Start fresh rules. Do not add or remove financial functionality.

### Accounts and client balances

Accounts show existing name/type/balance/activity in Studio panels. Client balances use readable rows and service breakdowns with current paused-state handling. Preserve archived account history and current source selectors. Distinguish accounts from purposes with headings and explanations rather than new calculations.

## 11. Performance, history, playbook

Performance: compact real period controls, coherent KPI row and existing analytical charts/breakdowns. Violet primary series; restrained comparison tones. Use accurate existing labels and values; no made-up progress denominators or new metrics. Preserve current period logic and all existing metrics.

History: month/date headings, tidy session rows in one surface, count/status summaries and clear detail drill-down. Preserve filters, ordering and navigation state. Desktop avoids huge stretched cards; mobile keeps dates and counts readable.

Playbook: warm graphite reading surface, compact principles, clean process timeline and existing setup checklists. Constrain text width and retain useful content. Style checkbox and segmented controls in violet. Preserve existing checklist persistence behaviour; do not invent changes under a UI task.

## 12. Settings, search, quick add and all editors

Settings/More: coherent grouped rows for profile, cloud, backup and separate danger actions. Preserve every current action and credential handling. Show actual sync status without changing when or how sync occurs.

Business profile: grouped labelled fields with consistent sans-serif values, helpful spacing and visible Save/Cancel footer. Cloud settings keep current validation and show/hide controls. Backup/import/reset retain exact existing safeguards and effects; do not exercise them against real records during verification.

Search: Studio command palette on desktop and full-screen mobile search, legible matches, quiet group labels, violet focused/selected result, current result routing and keyboard behaviours preserved.

Quick add: compact desktop menu and mobile bottom sheet with the existing New lead, Log income, Add expense actions. Violet provides action hierarchy; do not introduce new forms or data types.

Apply the shared design to ALL existing lead/client/service/payment/income/expense/purpose/account/source/target/pause/merge/reset/print dialogs. Amount-first financial inputs remain clear; labels above fields, inline errors, consistent save/cancel hierarchy. Borrowing/repayment previews use current calculated values. Preserve existing locked fields and validations. Complex mobile editors use a keyboard-safe full-height sheet/page; short actions use compact sheets. Focus trap, restoration, Escape, Back and unsaved changes must respect current behaviour. Do not change mutation logic to simplify a form.

Print/PDF preview controls can match Studio; generated invoice/receipt documents and print CSS remain unchanged. Never apply dark backgrounds to printed output.

## 13. Whole-app completion sequence

Maintain a screen/action inventory with status and evidence. Implement in this order:
1. Shared Studio foundation, shell and faithful home desktop/mobile.
2. Outreach, Follow-ups, Ongoing and Client details.
3. All Money sections and existing earnings charts/drill-down.
4. Performance, History, Playbook and Settings/More.
5. Search, Quick add, every form/dialog/menu and feedback state.
6. Whole-app visual comparison and regression verification.

Continue through the entire list, not just the first phase. Avoid unnecessary domain refactors or broad component extraction unrelated to visual delivery. Do not leave half the app on previous themes. Shared shell refinements must preserve navigation to every existing page.

## 14. Whole-app acceptance

Inspect every route and important editor in empty/populated/loading/error states at desktop and mobile widths. Verify short viewports, long names, large/negative amounts, paused records and existing uncommon workflows using isolated mocked data only. Ensure all supported actions remain reachable; visual decluttering must not remove them.

Check colour/spacing/type consistency, chart labels, keyboard focus, scroll ownership, touch targets, footer safe areas and no clipped actions. Run existing tests/lint/build/UI checks without weakening them. Audit the final diff for business-rule/storage/sync changes and remove unneeded ones.

Deliver a completion matrix for the entire app, screenshots of each main page and representative modal states at desktop/mobile, and a concise statement of remaining unverified items. Passing UI-module checks alone is insufficient. Keep the home very close to the approved reference and use its exact visual language everywhere else. No push or deploy.
