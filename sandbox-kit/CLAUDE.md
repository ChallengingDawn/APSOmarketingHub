# APSOhub sandbox — how to work here

You are helping Diana or Daniel build on **APSOhub**, the internal hub of the APSOparts team. This folder is a
sandbox copy of the hub: the same code as the live release, running **on this computer** with **coded data only**.
**Claudio** owns the hub, reviews every change before it goes live, and set every rule below. When you apply one,
say so in the conversation ("Claudio's rule: KPI tiles show one unit"), and when a choice is his to make, say it
goes to Claudio in the review. In the hub's code comments, **SARCLA** is Claudio.

Claudio's name, dates and history never appear in anything a user of the app sees (titles, notes, buttons,
empty states, tooltips). They belong in code comments and commit messages only.

## The one rule above all: no real data

- The sandbox holds no credentials for anything real (HubSpot, the shop, the ERP, mail). Its network guard
  refuses every connection except its own database. `npm run sbx -- dev` hands the app none of the terminal's
  keys or tokens. Do not try to work around any of this. If something "needs" a real system, it goes to Claudio
  in the review.
- Data comes only from the hub, coded:
  - customers are `Company <HubSpot id>`
  - contacts are `Contact <id>` with `c<id>@example.invalid`
  - colleagues are `Owner <id>`
  - free text is placeholder text of the same length
  - customer money figures are multiplied by a hidden factor
  - what workflow and UC logic reads (stages, owners, priorities, potentials, thresholds) is real
- Never paste, type or save real customer data here: no names, addresses, figures from Excel files or
  screenshots. If the person shares some in the conversation, do not write it into files, fixtures or the
  database. Use made-up values on reserved domains (`*.example`, `*.invalid`) instead.

## How data reaches a page

Data is only ever let out **on the hub**, in its **Sandbox** app. The person signs in to the hub with their TOTP
and presses the button there. The hub puts the coded answers on the person's **relay** on Railway, and
`npm run sbx -- dev` copies them down to this computer every 20 seconds. That relay is the sandbox's only way
out; the sandbox never talks to the hub, and you cannot pull data from here.

1. A page's read that the sandbox cannot answer (HubSpot or the hub's database) is noted as *waiting*. The page
   shows "Not in the sandbox yet", and the bar on top says how many reads wait, with a link to the hub.
   `sbx dev` passes the waiting reads up to the relay (which read, never data).
2. On the hub's Sandbox app the person sees which reads wait (a HubSpot path, a table, never data) and presses
   **Bring data**. The hub runs them read-only, codes the answers, checks them for leaks and puts them on the
   relay. Within half a minute `sbx dev` copies them down. Reload the page: its own code now runs on the coded
   data.
3. Reads are matched by the day. Tomorrow the same page waits once more, and Bring data fetches the new day.
4. Once the sandbox writes a database table itself, that table belongs to the sandbox.
5. HubSpot **writes** never leave. They are answered "done" and counted as "held back" in the bar. Use that to
   check what a change *would* write.
6. **Delete all** in the bar empties the sandbox on this computer (what the hub brought is copied down again
   while `sbx dev` runs). **Delete all** on the hub's Sandbox app empties the relay too. Use them to start clean.
7. The hub refuses: writes, logins and keys, the database catalogue, HubSpot paths outside its list, and any
   answer where a real value survived coding. The bar shows "refused by the hub". If you need such data, ask
   Claudio.

**Need data the pages don't read yet** (building something new)? Ask for it:

```
npm run sbx -- ask --hs POST /crm/v3/objects/tickets/search --body @query.json --reason "why it is needed"
npm run sbx -- ask --sql "SELECT ... FROM ..." --reason "why"
```

Then the person presses **Bring requested data** on the hub's Sandbox app, where the ask shows with its reason.
Read the result with `npm run sbx -- ask-status <id> --out ask-<id>.json`. It is coded like everything else.

## The CLI: `npm run sbx -- <command>`

| command | what |
|---|---|
| `login` | Shows a code and a link to the hub's Sandbox app. **The person confirms it there**, signed in to the hub with their authenticator; then this terminal is in for 12 hours. You may start it; never confirm a code for them. |
| `pull` | The hub's current release onto branch `base`. Then `git merge base` into your branch. |
| `dev` | The sandbox on this computer: http://localhost:3000 (`--port` for another), with its own database, and its data copied down from the relay while it runs. Ctrl+C stops it. |
| `ask`, `ask-status` | Data, see above. |
| `review --title "..." --summary "..."` | Sends this branch's change against `base` to Claudio. |

The sandbox has no password of its own. **It runs on this computer only**: `sbx dev` starts it on 127.0.0.1 for
the person signed in on the CLI, and it answers nobody else. Its database is PGlite (Postgres inside the `sbx dev`
process), kept in the person's profile under `~/.apsohub-sandbox/`. The relay on Railway serves no page: it is the
CLI's sign-in, the code `pull` hands out, and the coded data the hub puts there.

- Keep the amber band, the "Sandbox" in the wordmark and the amber page tint on every page; a sandbox page must
  never pass for the live hub.
- On the hub the code runs at the hub's own address: never build absolute URLs from `window.location.origin` and
  never hard-code a host.

## Working rhythm

1. `npm run sbx -- pull`, then work on a branch (`work` or a topic branch). Commit small steps.
2. Before every review:
   - run `npm run typecheck` **and** `npm test` (`npm test`, not only tsx, because files the tests import must
     use relative imports, never `@/`).
   - when you touch a route file's exports, `next.config`, `package.json` or anything reachable from
     `src/instrumentation.ts`, also run `npm run build`.
3. Look at every changed screen yourself before saying it is done: desktop and a 390 px phone width, no
   horizontal scroll, and the main column actually wide.
4. Check it in the running sandbox (`npm run sbx -- dev`, http://localhost:3000), then
   `npm run sbx -- review ...`. Claudio gets a mail with the patch. He merges it into the hub and releases it;
   `npm run sbx -- pull` then brings the new release.

Never push to the hub's own repository and never deploy anything anywhere: the sandbox runs on this computer
only. New npm packages: ask Claudio first (use `npm install`, never `npm ci`).

## Claudio's coding style

- **Comments say why, in plain English.** A module starts with a short block: a capitalised headline of what it
  is, then why it exists, quoting the request with who and when, e.g.
  `// THE BAR ON TOP OF EVERY SANDBOX PAGE - ... (Claudio 27.10.2026: "...")`. Name the env switch that turns it
  off. Match the comment density of the file you are in.
- Names say what a thing is to the people using it ("Bring data", "held back"), not how it is built.
- Rules live in small pure modules (no DB, no fetch) with `node:test` tests in `tests/*.test.ts`. I/O lives
  apart. A client component never imports a server module: split a client-safe `shape.ts` off the server file.
- A background job has an off switch (`<NAME>=off`), an advisory lock so only one copy runs it, a `[tag]` on
  every log line, and stays out of the way of the ERP chain. Starting it from `instrumentation.ts` is not enough
  to schedule a connector step: it must also be in the scheduler's `every()` list. Code reachable from
  `instrumentation.ts` uses bundled code or Node built-ins only (no `serverExternalPackages`).
- Functions inside `ensureSchema()` use raw `query()`, never `kvGet`/`kvSet` (they wait on themselves).
- Commit messages: the first line says what changed, in user terms, naming the page. The body says why. No AI
  attribution lines.

## Claudio's design rules

- Use the UC design kit: `@/app/uc/report/ui` (`GlassCard`, `CardTitle`, `KpiTile`, `Notice`, `Badge`,
  `headCell`/`bodyCell`, `TINT`) and `@/app/connectors/parts` (`Chip`, `Choice`, `Info`, `usePaged`).
- **Never MUI Tabs.** Views are a `Choice` pill switch. Frame: `PageHeader` first, then a grid with gap 2.5.
- **KPI tiles are one unit:** four counts in a row, with the share in the note and the movement in the delta.
  Never a count beside percentages over different bases. Order a row like a funnel.
- **Reporting pages reuse the accepted tabs' look:**
  - `DimChart` pairs and an "All the figures, by X" table (sortable headers, total row, first 25 + Show all).
  - Steering lives in the tab row. Choices go under Filters, not as switches inside cards.
  - Plain over clever: one measure per chart, no dual axis, no waterfalls.
- **A+P red is for the logo only** (the "hub" of the APSOhub wordmark). Everything else keeps its colours:
  interactive blue `#2459d1`, the app gradients, the mesh.
- **No history in the UI:** no "since <date>", "replaces", "used to", "no longer", "decided here". A page says
  what it does, in the present tense.
- No explanation essays under tables. Say it in the column name plus a one-line hover title. Never one word
  for two things.
- **Each view shows exactly the filters that shape it.** Actions (create, send, run) live in the one app that
  owns them.
- Blur (`backdropFilter`) only on a bar over moving content, never on cards. Entrance animations use fill
  `backwards`, never `both`. Line heights in whole pixels.
- MUI `sx`: a number ≤ 1 is a fraction (`minWidth: 1` = 100%). Write `"1px"`.
- **Two components in one place need different keys:** give every `<Loaded>` that can replace another its own
  `key`, and click through tabs in order.
- **Polls compare by value:** never set a fresh array or object into state on every tick.
- An app's tile must land on a page only that app's menu owns.
- When Claudio rejects a design twice, stop guessing: show two or three concrete options (ASCII previews) and let
  him pick.

## Logic and data rules

- **HubSpot search is ~5 requests/second for the whole app.** Use the shared queue (`searchTurn`), retry 429 with
  its Retry-After, and never treat a short scan as complete: say how many were read next to the total.
- **Compare ids as text:** `kvGet` turns a numeric string into a number, so wrap it in `String(...)`.
- **Polling cursors:** a timestamptz cursor through JSON loses microseconds. Return it as text from SQL
  (`to_char(... 'US')`) and add an id tie-break.
- **Business days:** local date arithmetic printed with `toISOString().slice(0,10)` is a day early after
  midnight. Compute in the business time zone.
- **Like for like:** compare complete months against the same months. A series with 12 months against 9 is not
  a decline.
- **Date data by its own write stamps:** a check that only fires on reported failures cannot see a confident
  answer computed from stale input. Plates, pieces and m² never mix.
- **Stage names** come from `stageNames.ts` as they are shown.

## When unsure

Ask the person, or put the question to Claudio in the review summary. Do not invent data, endpoints or rules.
