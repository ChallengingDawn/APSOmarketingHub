"use client";
// THE + - A SMALL WINDOW TO MAKE WHAT GOES UNDER A ROW (SARCLA 01.11.2026: "when I click the plus under [an action] this
// should only lead me to create a sub-action inside this main one"; "if I click the plus on [a sub-category] an action
// needs to be created, and here we need the boxes we get on the graph"; "new action should be the +"). Opened by the +
// beside a row in the Gantt and by the + tile in a category's window. Under an action: a sub-action - SubActions' form,
// with Digital Growth its ticket's properties at once. Under a sub-category: an action with the Gantt's boxes - status,
// priority, assigned to, planned and go-live - and its country (with Digital Growth also the channel and the agency).
// Under a main category: an action or a sub-category; under the goal: a main category. Nothing is made until Create:
// no row named "New action" left behind. A sub-action's window carries the action's "Led by Digital Growth": turned on
// there, the ticket - new or linked - comes at once ("on sub creation we should be able to create a ticket too - the
// Digital Growth toggle"). A new action under a sub-category behaves the same ("even on sub-category it should allow to
// create or associate the ticket"); under a main category there is no Digital Growth to pick. With Digital Growth on the
// window widens, the ticket beside the rest ("the window should expand to display everything correctly"). A new action
// has "Create with AI" as a sub-action has (SARCLA 02.11.2026: "here should have also create with AI"), and its status
// note, KPIs and next steps with or without Digital Growth ("KPI, next steps and status note should appear on the action
// creation form with or without Digital Growth") - with it they are the ticket's too.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { IDEA, PRIORITIES, STAGES, type Opt, type PlanFields, type PlanItem, type PlanKind, type PlanOwner } from "@/lib/reporting/actionPlanRules";
import type { AiFill } from "@/lib/reporting/scrollToSaleRules";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import { FindTickets, TicketFields, useTileActions } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { AiBox, AiButton, NewSub, planTile, ticketText, useTicketFill } from "./SubActions";
import { PRIORITY_COLOR, stageColor, type PlanData } from "./planUi";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const label = { fontSize: "0.78rem", color: MUTED, fontWeight: 600 } as const;
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "6px", fontSize: "0.9rem" } as const;
const square = (on: boolean, fg: string, bg: string) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.78rem",
  fontWeight: on ? 800 : 600, px: 1, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});
const NAME: Record<PlanKind, string> = { goal: "the goal", topic: "main category", group: "sub-category", action: "action" };
/** The ticket fields the new action gives itself (and the plan's place, written by the hub once it is made). */
const GIVEN = ["subject", "content", "hs_pipeline_stage", "hs_ticket_priority", "hubspot_owner_id", "mkt_planned_date", "mkt_golive_date",
  "mkt_implementation_country", "mkt_channel", "mkt_agency", "mkt_status_note", "mkt_kpis", "mkt_next_steps",
  "mkt_plan_category", "mkt_plan_subcategory", "mkt_plan_action"];
const PLACE = ["mkt_plan_category", "mkt_plan_subcategory", "mkt_plan_action"];
const without = (v: Record<string, string>, keys: string[]) => Object.fromEntries(Object.entries(v).filter(([k]) => !keys.includes(k)));

/** Several square choices (country, channel, agency). */
function Pick({ title, options, value, set }: { title: string; options: Opt[]; value: string[]; set: (v: string[]) => void }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={label}>{title}</Typography>
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return <Box key={o.value} component="button" type="button" aria-pressed={on} onClick={() => set(on ? value.filter((x) => x !== o.value) : [...value, o.value])} sx={square(on, TINT.blue.fg, TINT.blue.bg)}>{o.label}</Box>;
        })}
      </Box>
    </Box>
  );
}

/** "Led by Digital Growth", one switch: the action's in a sub-action's window, the new action's in its own. */
function DgSwitch({ on, set, hint }: { on: boolean; set: (on: boolean) => void; hint: string }) {
  return (
    <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.1, borderRadius: "8px", border: `1px solid ${on ? TINT.blue.fg : HAIRLINE}`, bgcolor: on ? TINT.blue.bg : "#fff", cursor: "pointer" }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: on ? TINT.blue.fg : INK }}>Led by Digital Growth</Typography>
        <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{hint}</Typography>
      </Box>
      <Switch checked={on} onChange={(e) => set(e.target.checked)} />
    </Box>
  );
}

/** A sub-action under an action: its form, with the action's tickets. */
function SubUnder({ parent, people, wide, onDone }: { parent: PlanItem; people: PlanOwner[]; wide: boolean; onDone: (said: string) => void }) {
  const [tile] = useState(() => planTile(parent));
  const { t, tErr, loadTickets } = useTileActions(tile, true);
  const owners: Opt[] = people.length ? people.map((p) => ({ value: p.id, label: p.name })) : t?.form.owners ?? [];
  return <NewSub item={parent} tile={tile} t={t} tErr={tErr} retry={loadTickets} owners={owners} tickets={parent.dg} focus wide={wide} done={async () => onDone(`Sub-action added under “${parent.title}”`)} />;
}

/** An action (or a category) under a category: its name and, for an action, the Gantt's boxes - and, under a
 *  sub-category with Digital Growth, its ticket made or linked with it. */
function RowUnder({ parent, people, choices, dg, setDg, onDone }: {
  parent: PlanItem; people: PlanOwner[]; choices: PlanData["choices"]; dg: boolean; setDg: (on: boolean) => void; onDone: (said: string) => void;
}) {
  const can: PlanKind[] = parent.kind === "goal" ? ["topic"] : parent.kind === "topic" ? ["action", "group"] : ["action"];
  const [kind, setKind] = useState<PlanKind>(can[0]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [stage, setStage] = useState<string>(IDEA);
  const [priority, setPriority] = useState("");
  const [owners, setOwners] = useState<PlanOwner[]>([]);
  const [start, setStart] = useState("");
  const [due, setDue] = useState("");
  const [country, setCountry] = useState<string[]>([]);
  const [channel, setChannel] = useState<string[]>([]);
  const [agency, setAgency] = useState<string[]>([]);
  const [statusNote, setStatusNote] = useState("");
  const [kpis, setKpis] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [ticket, setTicket] = useState<"none" | "new" | "link">("new");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [fromTicket, setFromTicket] = useState(false);
  const action = kind === "action";
  // a ticket linked: what it says becomes the new action's - its name and description where none is typed yet (SARCLA
  // 02.11.2026: "here it doesn't inherit the fields from the ticket")
  useTicketFill(ticket === "link" ? pick : [], (f) => {
    const list = (x: string | undefined, opts: Opt[]) => (x ?? "").split(";").filter((y) => opts.some((o) => o.value === y));
    setTitle((x) => x.trim() || f.subject || "");
    setDetail((x) => x.trim() || ticketText(f.content));
    if (STAGES.some((x) => x.id === f.hs_pipeline_stage)) setStage(f.hs_pipeline_stage);
    if (PRIORITIES.some((x) => x.value === f.hs_ticket_priority)) setPriority(f.hs_ticket_priority);
    const who = people.find((x) => x.id === f.hubspot_owner_id);
    if (who) setOwners((o) => (o.some((x) => x.id === who.id) ? o : [who, ...o]));
    if (f.mkt_planned_date) setStart(f.mkt_planned_date.slice(0, 10));
    if (f.mkt_golive_date) setDue(f.mkt_golive_date.slice(0, 10));
    if (list(f.mkt_implementation_country, choices.country).length) setCountry(list(f.mkt_implementation_country, choices.country));
    if (list(f.mkt_channel, choices.channel).length) setChannel(list(f.mkt_channel, choices.channel));
    if (list(f.mkt_agency, choices.agency).length) setAgency(list(f.mkt_agency, choices.agency));
    setStatusNote((x) => x.trim() || f.mkt_status_note || "");
    setKpis((x) => x.trim() || f.mkt_kpis || "");
    setNextSteps((x) => x.trim() || f.mkt_next_steps || "");
    setFromTicket(true);
  });
  // Digital Growth only for an action under a sub-category (none to pick under a main category)
  const dgOk = action && parent.kind === "group";
  const withTicket = dgOk && dg;
  // the ticket's form, read only when a ticket is on the way
  const [tile] = useState(() => planTile(parent));
  const { t, tErr, loadTickets } = useTileActions(tile, withTicket);
  const values = useMemo(() => ({
    ...without(t?.prefill ?? {}, [...PLACE, "content"]), ...extra,
    subject: title.trim().slice(0, 200), content: detail.trim() || title.trim(),
    ...(stage ? { hs_pipeline_stage: stage } : {}), ...(priority ? { hs_ticket_priority: priority } : {}),
    ...(owners[0] ? { hubspot_owner_id: owners[0].id } : {}), ...(start ? { mkt_planned_date: start } : {}), ...(due ? { mkt_golive_date: due } : {}),
    ...(country.length ? { mkt_implementation_country: country.join(";") } : {}), ...(channel.length ? { mkt_channel: channel.join(";") } : {}),
    ...(agency.length ? { mkt_agency: agency.join(";") } : {}),
    // the action's own, even empty: never the prefill's, hidden under them
    mkt_status_note: statusNote.trim(), mkt_kpis: kpis.trim(), mkt_next_steps: nextSteps.trim(),
  }) as Record<string, string>, [t, extra, title, detail, stage, priority, owners, start, due, country, channel, agency, statusNote, kpis, nextSteps]);
  const missing = withTicket && ticket === "new" && t ? t.form.fields.filter((f) => f.required && !String(values[f.name] ?? "").trim()).map((f) => f.label) : [];
  const ready = !!title.trim() && !busy && (!start || !due || start <= due) && (!withTicket || ticket === "none" || (ticket === "new" ? !!t && !missing.length : pick.length > 0));

  // "Create with AI": the new action's fields from a description, its ticket's too with Digital Growth - nothing saved
  const fill = async (text: string): Promise<string> => {
    const j = await send("/api/reporting/kpi-actions/ai", "POST", { tile: tile.key, kind: "action", dg: withTicket, describe: text, ctx: { title: parent.title, summary: tile.summary }, values });
    const f = j.fill as AiFill;
    const g = f.values ?? {};
    const of = (x: string | undefined, opts: Opt[]) => (x ?? "").split(";").filter((y) => opts.some((o) => o.value === y));
    let n = 0;
    const take = (ok: unknown, apply: () => void) => { if (ok) { apply(); n++; } };
    take(f.title, () => setTitle(f.title));
    take(f.note, () => setDetail(f.note));
    take(STAGES.some((x) => x.id === g.hs_pipeline_stage), () => setStage(g.hs_pipeline_stage));
    take(PRIORITIES.some((x) => x.value === g.hs_ticket_priority), () => setPriority(g.hs_ticket_priority));
    take(g.mkt_planned_date, () => setStart(g.mkt_planned_date));
    take(f.due || g.mkt_golive_date, () => setDue(f.due || g.mkt_golive_date));
    const who = people.find((x) => x.id === f.owner);
    take(who, () => setOwners([who!]));
    take(of(g.mkt_implementation_country, choices.country).length, () => setCountry(of(g.mkt_implementation_country, choices.country)));
    take(g.mkt_status_note, () => setStatusNote(g.mkt_status_note));
    take(g.mkt_kpis, () => setKpis(g.mkt_kpis));
    take(g.mkt_next_steps, () => setNextSteps(g.mkt_next_steps));
    if (withTicket) {
      take(of(g.mkt_channel, choices.channel).length, () => setChannel(of(g.mkt_channel, choices.channel)));
      take(of(g.mkt_agency, choices.agency).length, () => setAgency(of(g.mkt_agency, choices.agency)));
      // the ticket's own fields, each one counted
      const rest = without(g, GIVEN);
      setExtra((x) => ({ ...x, ...rest }));
      n += Object.keys(rest).length;
      if (f.ticket) setTicket("new");
    }
    return `${n} field${n === 1 ? "" : "s"} filled in - check each one before creating. Nothing is saved yet.`;
  };

  const create = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    try {
      const j = await send("/api/action-plan", "POST", { action: "add", parentId: parent.id, kind, title: title.trim() });
      const made = j.item as PlanItem;
      const said = `${NAME[kind][0].toUpperCase()}${NAME[kind].slice(1)} “${title.trim()}” added in “${parent.title}”`;
      if (action) {
        // made already: a failure here must not leave the window open for a second Create (a second row)
        try {
          await send("/api/action-plan", "PATCH", {
            id: made.id, detail: detail.trim() || title.trim(), stage, priority, start: start || null, due: due || null,
            country, dg: withTicket, ...(withTicket ? { channel, agency } : {}), ...(owners.length ? { owners: owners.map((o) => o.id) } : {}),
            statusNote: statusNote.trim(), kpis: kpis.trim(), nextSteps: nextSteps.trim(),
          });
        } catch (e) { onDone(`${said} - but its details were not saved (${(e as Error).message}); open it to fill them in`); return; }
        if (withTicket && ticket !== "none") {
          try {
            if (ticket === "new") await send("/api/reporting/kpi-actions/tickets", "POST", { action: "create", tile: `plan:${made.id}`, values: without(values, PLACE) });
            else await send("/api/reporting/kpi-actions/tickets", "POST", { action: "link", tile: `plan:${made.id}`, ids: pick });
          } catch (e) { onDone(`${said} - but its ticket was not ${ticket === "new" ? "made" : "linked"} (${(e as Error).message}); open it to try again`); return; }
          onDone(`${said}, ${ticket === "new" ? "with its ticket in HubSpot" : "with its linked tickets"}`);
          return;
        }
      }
      onDone(said);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  // the sub-action window's spacing (SubActions.tsx SmallFields, SubEditor): 1.9 between blocks, 0.75 from a label to its tags
  // (SARCLA 02.11.2026: "the design rules are still so wrong")
  return (
    <Box sx={{ display: "grid", gap: 1.9 }}>
      {(can.length > 1 || action) && (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {can.length > 1 && can.map((k) => <Box key={k} component="button" type="button" aria-pressed={kind === k} onClick={() => setKind(k)} sx={{ ...square(kind === k, TINT.blue.fg, TINT.blue.bg), fontSize: "0.84rem", px: 1.4, py: 0.6 }}>New {NAME[k]}</Box>)}
          <Box sx={{ flex: 1 }} />
          {action && <AiButton on={aiOpen} toggle={() => setAiOpen((o) => !o)} />}
        </Box>
      )}
      {action && aiOpen && (
        <AiBox placeholder={`What the action is, who does it, by when, how urgent, in which countries${withTicket ? " - and what its ticket needs" : ""}`}
          hint="The AI fills in the new action from your words - only choices the form offers, nothing made up. You check it, then create it." fill={fill} />
      )}
      {dgOk && <DgSwitch on={dg} set={setDg} hint={dg ? "The action and its sub-actions carry “From Scroll to Sale” tickets - make one or link one now" : "Turn on for a “From Scroll to Sale” ticket, the marketing channel and the agency"} />}
      <Box sx={{ display: "grid", gap: 1.75, alignItems: "start", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: withTicket ? "minmax(0, 1fr) minmax(0, 1.15fr)" : "minmax(0, 1fr)" } }}>
        <Box sx={{ display: "grid", gap: 1.9, minWidth: 0 }}>
          <TextField size="small" autoFocus label={action ? "Action" : `The ${NAME[kind]}'s name`} placeholder={action ? "What will be done - written as an action" : ""} value={title}
            onChange={(e) => setTitle(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true } }} onKeyDown={(e) => { if (e.key === "Enter" && !action && ready) void create(); }} />
          {action && (
            <>
              <TextField size="small" label="Description" placeholder="What the action is about, what done looks like" value={detail} onChange={(e) => setDetail(e.target.value)} multiline minRows={2} sx={field} slotProps={{ inputLabel: { shrink: true } }} />
              <Box sx={{ display: "grid", gap: 0.75 }}>
                <Typography sx={label}>Status</Typography>
                <Box role="radiogroup" aria-label="Status" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {STAGES.map((s) => {
                    const on = stage === s.id;
                    const c = stageColor(s.id);
                    return <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} onClick={() => setStage(s.id)} sx={{ ...square(on, c.ink, c.soft), ...(on ? { bgcolor: c.bar, color: "#fff", borderColor: c.bar } : {}) }}>{s.label}</Box>;
                  })}
                </Box>
              </Box>
              <TextField size="small" label="Status note" placeholder="Where it stands - what is done, what is in the way" value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                multiline minRows={1} sx={field} slotProps={{ inputLabel: { shrink: true } }} />
              <Box sx={{ display: "grid", gap: 0.75 }}>
                <Typography sx={label}>Priority</Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {[...PRIORITIES].reverse().map((p) => {
                    const on = priority === p.value;
                    const c = PRIORITY_COLOR[p.value];
                    return <Box key={p.value} component="button" type="button" aria-pressed={on} onClick={() => setPriority(on ? "" : p.value)} sx={square(on, c.fg, c.bg)}>{p.label}</Box>;
                  })}
                </Box>
              </Box>
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1.6fr 1fr 1fr" } }}>
                <Autocomplete multiple size="small" options={people} value={owners} getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id} filterSelectedOptions
                  onChange={(_, v) => setOwners(v)} renderInput={(p) => <TextField {...p} label="Assigned to" placeholder={owners.length ? "" : "HubSpot users"} sx={field} InputLabelProps={{ ...p.InputLabelProps, shrink: true }} />} />
                <TextField size="small" type="date" label="Planned date" value={start} onChange={(e) => setStart(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: due || undefined } }} />
                <TextField size="small" type="date" label="Go-live date" value={due} onChange={(e) => setDue(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: start || undefined } }} />
              </Box>
              <Pick title="Implementation country" options={choices.country} value={country} set={setCountry} />
              {withTicket && <Pick title="Marketing channel" options={choices.channel} value={channel} set={setChannel} />}
              {withTicket && <Pick title="Agency" options={choices.agency} value={agency} set={setAgency} />}
              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                <TextField size="small" label="KPIs" placeholder="How success is measured" value={kpis} onChange={(e) => setKpis(e.target.value)}
                  multiline minRows={3} sx={field} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" label="Next steps / milestones" placeholder="The first steps, one per line" value={nextSteps} onChange={(e) => setNextSteps(e.target.value)}
                  multiline minRows={3} sx={field} slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
            </>
          )}
        </Box>
        {/* its Scroll to Sale ticket, made or linked with it */}
        {withTicket && (
          <Box sx={{ display: "grid", gap: 1, p: 1.25, borderRadius: "8px", bgcolor: "#fff", border: `1px solid ${HAIRLINE}` }}>
            <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", flexWrap: "wrap" }}>
              <ConfirmationNumberOutlinedIcon sx={{ fontSize: 19, color: FAINT }} />
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK, mr: 0.5 }}>Scroll to Sale ticket</Typography>
              {([["none", "None"], ["new", "New ticket"], ["link", "Link existing"]] as const).map(([id, l]) => (
                <Box key={id} component="button" type="button" onClick={() => setTicket(id)} sx={square(ticket === id, TINT.blue.fg, TINT.blue.bg)}>{l}</Box>
              ))}
            </Box>
            {ticket !== "none" && !t && (
              tErr ? <Typography sx={{ fontSize: "0.84rem", color: RED }}>HubSpot could not be read: {tErr} <Button size="small" onClick={() => void loadTickets()}>Try again</Button></Typography>
                : <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}><CircularProgress size={16} /><Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Reading the pipeline…</Typography></Box>
            )}
            {ticket === "new" && t && <TicketFields form={{ ...t.form, fields: t.form.fields.filter((f) => !GIVEN.includes(f.name)) }} values={values} set={(k, x) => setExtra((o) => ({ ...o, [k]: x }))} />}
            {ticket === "link" && <FindTickets pick={pick} setPick={(f) => setPick((x) => f(x).slice(-1))} already={[]} />}
            {ticket === "link" && fromTicket && <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>Filled in from the ticket - check it at the left, then create it.</Typography>}
          </Box>
        )}
      </Box>
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "flex-end" }}>
        <Typography sx={{ flex: 1, fontSize: "0.82rem", color: RED }}>
          {start && due && start > due ? "The go-live date comes before the planned date" : missing.length ? `For the ticket, still to fill in: ${missing.join(", ")}` : ""}
        </Typography>
        <Button variant="contained" disableElevation disabled={!ready} onClick={() => void create()} sx={{ ...cta, px: 2.5 }}>
          {busy ? "Creating…" : withTicket && ticket === "new" ? "Create it and its ticket" : withTicket && ticket === "link" ? "Create it and link" : `Create the ${NAME[kind]}`}
        </Button>
      </Box>
    </Box>
  );
}

export function AddDialog({ parent, people, choices, onPatch, onClose, onDone }: {
  parent: PlanItem; people: PlanOwner[]; choices: PlanData["choices"];
  /** the action's Digital Growth, switched from here */
  onPatch: (id: number, p: Partial<PlanFields>) => Promise<void>;
  onClose: () => void;
  /** made: the plan reads itself again and opens the parent */
  onDone: (said: string) => void;
}) {
  const sub = parent.kind === "action";
  // a new action's own Digital Growth, before it exists
  const [rowDg, setRowDg] = useState(false);
  const wide = sub ? parent.dg : rowDg && parent.kind === "group";
  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label={sub ? "New sub-action" : "Add under it"}
      slotProps={{ paper: { sx: { width: wide ? "min(1400px, calc(100vw - 32px))" : "min(880px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", m: 2, borderRadius: "16px", bgcolor: "#f7f9fc", transition: "width .2s" } } }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 2.5, pt: 2, pb: 1.5, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {sub ? "New sub-action of" : parent.kind === "goal" ? "New main category under" : `New in this ${NAME[parent.kind]}`}
          </Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, lineHeight: 1.3, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{parent.title}</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ overflowY: "auto", p: 2.5, display: "grid", gap: 1.5 }}>
        {sub && (
          <DgSwitch on={parent.dg} set={(on) => void onPatch(parent.id, { dg: on })}
            hint={parent.dg ? "The sub-action can carry its “From Scroll to Sale” ticket - a new one or one linked" : "Turn on for a “From Scroll to Sale” ticket - a sales action has no pipeline. It is the action's switch"} />
        )}
        {sub ? <SubUnder parent={parent} people={people} wide={wide} onDone={onDone} /> : <RowUnder parent={parent} people={people} choices={choices} dg={rowDg} setDg={setRowDg} onDone={onDone} />}
      </Box>
    </Dialog>
  );
}
