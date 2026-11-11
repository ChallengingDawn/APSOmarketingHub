# The UC12 Revenue drop card

One more card for the hub's HubSpot app, "SARCLA - APSOMarketingHub" (the CLI project `hubspot-apsomarketinghub`),
for the ticket's **Sales Teams** tab beside the Erosion card. It is not in this repository's build and has never run in
HubSpot: written in a sandbox, for review.

Everything it shows comes from HubSpot - nothing from APSOhub, no hub route, no secret:

- **When the ticket was written**: the ticket's own Revenue drop fields (`revenue_drop_key`, `_last_12`, `_prev_12`,
  `_window`, `_amount_at_risk`), which UC12 writes with the ticket.
- **Today**: the linked company's monthly fields - `rev_<y>_pc_monthly`, `oi_<y>_<month>` (the `oi_<y>_pc_monthly`
  blob where a total is empty), `order_last_order_date`, `major_profit_center` - to the month before
  `erp_rev_as_of` ("ERP figures as of").
- On any ticket without a Revenue Drop Key it draws nothing.

Files:

- `RevenueDropCard.jsx` - the card: `actions.fetchCrmObjectProperties` for the ticket, `useAssociations` from
  `@hubspot/ui-extensions/crm` for its company.
- `revenueDropFigures.ts` - the figures, no imports. It mirrors UC12's rules in `src/lib/lifecycle/revenueDrop.ts`;
  `tests/revenue-drop-card-figures.test.ts` (run by the hub's `npm test`) checks they agree.
- `revenue-drop-card-hsmeta.json` - its definition; give it the shape of the Erosion card's `-hsmeta.json`.

To take it in: copy the three files into the project's cards folder; if the other cards read a linked record another
way than `useAssociations`, use theirs; `hs project upload --account 26492587`; then put the card on the ticket's
Sales Teams tab in HubSpot's record customization, as the Erosion card is.
