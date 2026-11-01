"use client";
// THE + - A SMALL WINDOW TO MAKE WHAT GOES UNDER A ROW (SARCLA 01.11.2026: "when I click the plus under [an action] this
// should only lead me to create a sub-action inside this main one"; "if I click the plus on [a sub-category] an action
// needs to be created, and here we need the boxes we get on the graph"; "new action should be the +"). Opened by the +
// beside a row in the Gantt and by the + tile in a category's window. Under an action: a sub-action - SubActions' form,
// with Digital Growth its ticket's properties at once. Under a sub-category: an action with the Gantt's boxes - status,
// priority, assigned to, planned and go-live - and its country (with Digital Growth also the channel and the agency).
// Under a main category: an action or a sub-category; under the goal: a main category. Nothing is made until Create:
// no row named "New action" left behind.

import { useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import CloseIcon from "@mui/icons-material/Close";

import { FAINT, HAIRLINE, INK, MUTED, RED, TINT } from "@/app/uc/report/ui";
import { IDEA, PRIORITIES, STAGES, type Opt, type PlanItem, type PlanKind, type PlanOwner } from "@/lib/reporting/actionPlanRules";
import { send } from "@/app/reporting/marketing-kpis/tiles/store";
import { useTileActions } from "@/app/reporting/marketing-kpis/tiles/ActionsPanel";
import { NewSub, planTile } from "./SubActions";
import { PRIORITY_COLOR, stageColor, type PlanData } from "./planUi";

const field = { "& .MuiInputBase-root": { fontSize: "0.9rem", borderRadius: "8px", bgcolor: "#fff" }, "& .MuiInputLabel-root": { fontSize: "0.88rem" } };
const label = { fontSize: "0.78rem", color: MUTED, fontWeight: 600 } as const;
const cta = { textTransform: "none", fontWeight: 700, borderRadius: "6px", fontSize: "0.9rem" } as const;
const square = (on: boolean, fg: string, bg: string) => ({
  border: `1px solid ${on ? fg : HAIRLINE}`, bgcolor: on ? bg : "#fff", color: on ? fg : MUTED, font: "inherit", fontSize: "0.78rem",
  fontWeight: on ? 800 : 600, px: 1, py: 0.4, borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" as const,
});
const NAME: Record<PlanKind, string> = { goal: "the goal", topic: "main category", group: "sub-category", action: "action" };

/** Several square choices (country, channel, agency). */
function Pick({ title, options, value, set }: { title: string; options: Opt[]; value: string[]; set: (v: string[]) => void }) {
  return (
    <Box sx={{ display: "grid", gap: 0.5 }}>
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

/** A sub-action under an action: its form, with the action's tickets. */
function SubUnder({ parent, people, onDone }: { parent: PlanItem; people: PlanOwner[]; onDone: (said: string) => void }) {
  const [tile] = useState(() => planTile(parent));
  const { t, tErr, loadTickets } = useTileActions(tile, true);
  const owners: Opt[] = people.length ? people.map((p) => ({ value: p.id, label: p.name })) : t?.form.owners ?? [];
  return <NewSub item={parent} tile={tile} t={t} tErr={tErr} retry={loadTickets} owners={owners} tickets={parent.dg} focus done={async () => onDone(`Sub-action added under “${parent.title}”`)} />;
}

/** An action (or a category) under a category: its name and, for an action, the Gantt's boxes. */
function RowUnder({ parent, people, choices, onDone }: { parent: PlanItem; people: PlanOwner[]; choices: PlanData["choices"]; onDone: (said: string) => void }) {
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
  const [dg, setDg] = useState(false);
  const [channel, setChannel] = useState<string[]>([]);
  const [agency, setAgency] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const action = kind === "action";
  const ready = !!title.trim() && !busy && (!start || !due || start <= due);

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
            country, dg, ...(dg ? { channel, agency } : {}), ...(owners.length ? { owners: owners.map((o) => o.id) } : {}),
          });
        } catch (e) { onDone(`${said} - but its details were not saved (${(e as Error).message}); open it to fill them in`); return; }
      }
      onDone(said);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Box sx={{ display: "grid", gap: 1.4 }}>
      {can.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {can.map((k) => <Box key={k} component="button" type="button" aria-pressed={kind === k} onClick={() => setKind(k)} sx={{ ...square(kind === k, TINT.blue.fg, TINT.blue.bg), fontSize: "0.84rem", px: 1.4, py: 0.6 }}>New {NAME[k]}</Box>)}
        </Box>
      )}
      <TextField size="small" autoFocus label={action ? "Action" : `The ${NAME[kind]}'s name`} placeholder={action ? "What will be done - written as an action" : ""} value={title}
        onChange={(e) => setTitle(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true } }} onKeyDown={(e) => { if (e.key === "Enter" && !action && ready) void create(); }} />
      {action && (
        <>
          <TextField size="small" label="Description (optional)" value={detail} onChange={(e) => setDetail(e.target.value)} multiline minRows={2} maxRows={6} sx={field} slotProps={{ inputLabel: { shrink: true } }} />
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Typography sx={label}>Status</Typography>
            <Box role="radiogroup" aria-label="Status" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {STAGES.map((s) => {
                const on = stage === s.id;
                const c = stageColor(s.id);
                return <Box key={s.id} component="button" type="button" role="radio" aria-checked={on} onClick={() => setStage(s.id)} sx={{ ...square(on, c.ink, c.soft), ...(on ? { bgcolor: c.bar, color: "#fff", borderColor: c.bar } : {}) }}>{s.label}</Box>;
              })}
            </Box>
          </Box>
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Typography sx={label}>Priority</Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {[...PRIORITIES].reverse().map((p) => {
                const on = priority === p.value;
                const c = PRIORITY_COLOR[p.value];
                return <Box key={p.value} component="button" type="button" aria-pressed={on} onClick={() => setPriority(on ? "" : p.value)} sx={square(on, c.fg, c.bg)}>{p.label}</Box>;
              })}
            </Box>
          </Box>
          <Box sx={{ display: "grid", gap: 1.2, gridTemplateColumns: { xs: "1fr", sm: "1.6fr 1fr 1fr" } }}>
            <Autocomplete multiple size="small" options={people} value={owners} getOptionLabel={(o) => o.name} isOptionEqualToValue={(a, b) => a.id === b.id} filterSelectedOptions
              onChange={(_, v) => setOwners(v)} renderInput={(p) => <TextField {...p} label="Assigned to" placeholder={owners.length ? "" : "HubSpot users"} sx={field} />} />
            <TextField size="small" type="date" label="Planned date" value={start} onChange={(e) => setStart(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: due || undefined } }} />
            <TextField size="small" type="date" label="Go-live date" value={due} onChange={(e) => setDue(e.target.value)} sx={field} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: start || undefined } }} />
          </Box>
          <Pick title="Implementation country" options={choices.country} value={country} set={setCountry} />
          <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: "8px", border: `1px solid ${dg ? TINT.blue.fg : HAIRLINE}`, bgcolor: dg ? TINT.blue.bg : "#fff", cursor: "pointer" }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: dg ? TINT.blue.fg : INK }}>Led by Digital Growth</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>Its sub-actions take “From Scroll to Sale” tickets; the marketing channel and the agency</Typography>
            </Box>
            <Switch checked={dg} onChange={(e) => setDg(e.target.checked)} />
          </Box>
          {dg && <Pick title="Marketing channel" options={choices.channel} value={channel} set={setChannel} />}
          {dg && <Pick title="Agency" options={choices.agency} value={agency} set={setAgency} />}
        </>
      )}
      {err && <Typography sx={{ fontSize: "0.86rem", color: RED }}>{err}</Typography>}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "flex-end" }}>
        {start && due && start > due && <Typography sx={{ flex: 1, fontSize: "0.82rem", color: RED }}>The go-live date comes before the planned date</Typography>}
        <Button variant="contained" disableElevation disabled={!ready} onClick={() => void create()} sx={{ ...cta, px: 2.5 }}>{busy ? "Creating…" : `Create the ${NAME[kind]}`}</Button>
      </Box>
    </Box>
  );
}

export function AddDialog({ parent, people, choices, onClose, onDone }: {
  parent: PlanItem; people: PlanOwner[]; choices: PlanData["choices"];
  onClose: () => void;
  /** made: the plan reads itself again and opens the parent */
  onDone: (said: string) => void;
}) {
  const sub = parent.kind === "action";
  return (
    <Dialog open onClose={onClose} maxWidth={false} scroll="paper" aria-label={sub ? "New sub-action" : "Add under it"}
      slotProps={{ paper: { sx: { width: "min(880px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", m: 2, borderRadius: "16px", bgcolor: "#f7f9fc" } } }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: 2.5, pt: 2, pb: 1.5, bgcolor: "#fff", borderBottom: `1px solid ${HAIRLINE}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: FAINT, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {sub ? "New sub-action of" : parent.kind === "goal" ? "New main category under" : `New in this ${NAME[parent.kind]}`}
          </Typography>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 750, color: INK, lineHeight: 1.3, mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{parent.title}</Typography>
          {sub && <Typography sx={{ fontSize: "0.78rem", color: parent.dg ? TINT.blue.fg : FAINT, mt: 0.25 }}>{parent.dg ? "Led by Digital Growth - the sub-action can carry its “From Scroll to Sale” ticket" : "A sales action - no ticket (Digital Growth is off on the action)"}</Typography>}
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ bgcolor: "rgba(21,34,58,.05)" }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ overflowY: "auto", p: 2.5 }}>
        {sub ? <SubUnder parent={parent} people={people} onDone={onDone} /> : <RowUnder parent={parent} people={people} choices={choices} onDone={onDone} />}
      </Box>
    </Dialog>
  );
}
