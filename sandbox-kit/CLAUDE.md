# APSOhub sandbox — how to work here

You are helping Diana or Daniel build on **APSOhub**, the internal hub of the APSOparts team. This repository is a
sandbox copy of the hub: the same code as the live release, running **on this computer**. **Claudio** owns the hub,
reviews every change before it goes live, and set every rule below. When you apply one, say so in the conversation
("Claudio's rule: KPI tiles show one unit"), and when a choice is his to make, say it goes to Claudio in the pull
request. In the hub's code comments, **SARCLA** is Claudio.

Claudio's name, dates and history never appear in anything a user of the app sees (titles, notes, buttons,
empty states, tooltips). They belong in code comments and commit messages only.

## Data: real, read only, and it stays on this computer

**Yes, you can pull data** — from HubSpot and from the microservices, as much as the work needs: in the running
sandbox's pages, and from the terminal with the two commands under "Pulling data" below. Do it whenever a page,
a rule or a question needs real records. The limits are only these: reads, never writes; and what you pull stays
on this computer, out of the repository.

- **HubSpot** is read with the person's own **private app** (its token in `.env.local`, read-only scopes). **The apps
  you build here read HubSpot live with it**: new pages, routes, rules and whole new apps call HubSpot exactly the
  way the hub's own pages do — `hubspotFetchJson({ path, method, body })` from `src/lib/integrations/hubspot.ts`,
  with `searchTurn()` before every search (`.../search`). No stub, no copy, no mock: real records, live. Every call
  that would change HubSpot is held back by the sandbox itself — answered "done", counted as "held back" in the
  band, never sent — whatever scopes the app has. Use that to check what a change *would* write.
- **The microservices** (search bar, Google Ads buckets, DirectUP, DirectCut, 3D files) are read through the
  **read-only door** on the Smart-Search gateway with the person's viewer key. It answers reads only; a page action
  that would change a live service gets "A sandbox only reads the microservices". The door's address and the viewer
  keys come with this repository in `sandbox-viewer.json` (`npm run sandbox` picks the key by `SANDBOX_PERSON`).
  Never copy those keys anywhere else - not into chats, issues, other repositories or code. The release step
  rewrites the file; leave it as it is.
- **Nothing else is reachable from the sandbox.** Its network guard lets the running app reach only its own
  database, HubSpot and the door; it refuses Magento, SFTP, mail, the ERP and the gateways themselves. Do not try to
  work around the guard, the held-back writes or the door. If something "needs" another real system, it goes to
  Claudio in the pull request.
- **The hub's own database** (ERP orders and revenue, what the hub's background jobs collect) is not reachable from
  here: pages built on it start empty. Write made-up rows into the sandbox's own database to test them, or ask
  Claudio.
- **Real data never goes into the repository.** No fixtures, seeds, screenshots, exports or tests with real names,
  addresses, e-mails or figures — tests use made-up values on reserved domains (`*.example`, `*.invalid`).
  `.env.local` holds the person's tokens and is never committed (it is in `.gitignore`).

## Pulling data

Two commands, run in this folder; both only read, and both print JSON (`--out <file>` writes it instead).

```
npm run hs -- GET /crm/v3/objects/companies?limit=5&properties=name,domain,hubspot_owner_id
npm run hs -- GET /crm/v3/properties/tickets
npm run hs -- POST /crm/v3/objects/tickets/search '{"limit":20,"sorts":["-createdate"]}'
npm run hs -- POST /crm/v3/objects/contacts/batch/read @ids.json --out .sandbox-data/contacts.json

npm run door -- search-bar /api/smart-bar/report?days=30
npm run door -- directup /usage?days=30
npm run door -- 3d /callers
```

- `npm run hs` reads HubSpot with the token in `.env.local`: any GET, and POSTs to `.../search` and
  `.../batch/read`. Anything that would change HubSpot is refused before it is sent. Mind HubSpot's limit of about
  5 searches a second.
- `npm run door` reads a microservice through the door with the person's viewer key. Services: `search-bar`, `ads`,
  `directup`, `directcut`, `3d`; the paths are the reads the hub's own pages make — find them in
  `src/lib/searchbar/gateway.ts`, `src/lib/adsbuckets/`, `src/lib/directup/`, `src/lib/directcut/` and
  `src/lib/threeD/calls.ts`. A path the door does not pass on answers 404.
- Keep what you pull in `.sandbox-data/` (git ignores it) or just in the terminal. Never commit it, never paste it
  into tests or fixtures: when a test needs data, copy the *shape* with made-up values.
- The hub's own database (ERP orders and revenue) is the one source you cannot pull from here — ask Claudio.

## Set up once

1. Node 22, Git and Claude Code.
2. Clone this repository, then `npm install`.
3. The person's own **HubSpot private app** (a HubSpot super admin creates it - ask Claudio): HubSpot → Settings →
   Integrations → Private Apps → Create, named "Sandbox <first name>", with **read scopes only**:
   `crm.objects.companies.read`, `crm.objects.contacts.read`, `crm.objects.deals.read`, `crm.objects.tickets.read`,
   `crm.objects.line_items.read`, `crm.objects.orders.read`, `crm.objects.owners.read`, `crm.objects.users.read`,
   `crm.objects.custom.read`, `crm.objects.feedback_submissions.read`, `crm.schemas.companies.read`,
   `crm.schemas.contacts.read`, `crm.schemas.deals.read`, `crm.schemas.tickets.read`, `crm.schemas.custom.read`,
   `crm.lists.read`, `conversations.read`, `files.read`, `sales-email-read`. Its access token is `HUBSPOT_TOKEN`.
   A page that needs a scope the app lacks gets HubSpot's 403 - add the read scope to the app.
4. Copy `.env.example` to `.env.local` and fill it in: `SANDBOX_PERSON` and `HUBSPOT_TOKEN`. The door to the
   microservices needs nothing: it comes with the repository.
5. `npm run sandbox`.

## Running it: `npm run sandbox`

- The sandbox opens on http://localhost:3000 (`npm run sandbox -- --port 3001` for another port). Ctrl+C stops it.
- Its database is PGlite (Postgres inside the `npm run sandbox` process), kept in the person's profile under
  `~/.apsohub-sandbox/`. Nothing to install.
- It has no sign-in: it runs on 127.0.0.1 for the person in `SANDBOX_PERSON` - an admin in their own sandbox - and
  answers nobody else.
- No background job runs. `SANDBOX_JOBS=mapAssign` (names in `src/lib/sandbox/boot.ts`) switches one on to test it;
  it still changes nothing real. `SANDBOX_AI=on` with the person's own capped `ANTHROPIC_API_KEY` lets background AI
  run.
- **Delete all** in the band empties the sandbox's own database (the person's account stays). HubSpot and the
  microservices are not touched.
- Keep the amber band, the "Sandbox" in the wordmark and the amber page tint on every page; a sandbox page must
  never pass for the live hub.
- On the hub the code runs at the hub's own address: never build absolute URLs from `window.location.origin` and
  never hard-code a host.

## Working rhythm

1. Branch from `base` — the hub's current release; only the release step writes it:
   `git fetch && git switch -c <topic> origin/base`. Commit small steps.
2. Before every pull request:
   - run `npm run typecheck` **and** `npm test` (`npm test`, not only tsx, because files the tests import must
     use relative imports, never `@/`).
   - when you touch a route file's exports, `next.config`, `package.json` or anything reachable from
     `src/instrumentation.ts`, also run `npm run build`.
3. Look at every changed screen yourself in the running sandbox before saying it is done: desktop and a 390 px
   phone width, no horizontal scroll, and the main column actually wide.
4. Push the branch and open a **pull request against `base`**: the title says what changed in user terms, naming
   the page; the description says why. Claudio reviews it and takes it into the hub; when he releases, `base` moves
   on — bring it into your branch with `git fetch && git merge origin/base`.

Never push to `base`, never push to the hub's own repository, and never deploy anything: the sandbox runs on this
computer only. New npm packages: ask Claudio first (use `npm install`, never `npm ci`).

## Claudio's coding style

- **Comments say why, in plain English.** A module starts with a short block: a capitalised headline of what it
  is, then why it exists, quoting the request with who and when, e.g.
  `// THE BAR ON TOP OF EVERY SANDBOX PAGE - ... (Claudio 27.10.2026: "...")`. Name the env switch that turns it
  off. Match the comment density of the file you are in.
- Names say what a thing is to the people using it ("Delete all", "held back"), not how it is built.
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
