"use client";

// ONE RULE, ADDED OR CHANGED. By country (the countries as HubSpot writes them, any
// case; country_custom with its own list) or by person (whose companies move). The
// owners are HubSpot's own - the person who left may be deactivated, the one who takes
// over may not. The server checks the whole list again before it saves anything.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { Choice } from "@/app/connectors/parts";
import { INK, MUTED } from "@/app/uc/report/ui";
import type { Rule } from "@/lib/ownerRules/rules";
import type { Owner } from "@/lib/ownerRules/hubspot";

type Kind = "country" | "owner";
export type Draft = {
  id: string | null; enabled: boolean; kind: Kind; countries: string; useCustom: boolean; customCountries: string;
  fromOwner: string; toOwner: string; contacts: boolean; tickets: boolean; tasks: boolean; note: string;
};

export const EMPTY_DRAFT: Draft = {
  id: null, enabled: true, kind: "country", countries: "", useCustom: false, customCountries: "",
  fromOwner: "", toOwner: "", contacts: true, tickets: true, tasks: true, note: "",
};

export function draftOf(r: Rule): Draft {
  return {
    id: r.id, enabled: r.enabled, kind: r.kind,
    countries: r.kind === "country" ? r.countries.join(", ") : "",
    useCustom: r.kind === "country" && r.customCountries.length > 0,
    customCountries: r.kind === "country" ? r.customCountries.join(", ") : "",
    fromOwner: r.kind === "owner" ? r.fromOwner : "", toOwner: r.toOwner,
    contacts: r.cascade.contacts, tickets: r.cascade.tickets, tasks: r.cascade.tasks, note: r.note,
  };
}

const list = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

/** What the server receives - small, far under the 8 KB a request may carry. */
function payload(d: Draft): Record<string, unknown> {
  const base = { ...(d.id ? { id: d.id } : {}), enabled: d.enabled, toOwner: d.toOwner, cascade: { contacts: d.contacts, tickets: d.tickets, tasks: d.tasks }, note: d.note };
  return d.kind === "country"
    ? { ...base, kind: "country", countries: list(d.countries), customCountries: d.useCustom ? list(d.customCountries) : [] }
    : { ...base, kind: "owner", fromOwner: d.fromOwner };
}

function OwnerPick({ label, value, owners, onChange, activeOnly }: {
  label: string; value: string; owners: Owner[]; onChange: (id: string) => void; activeOnly: boolean;
}) {
  const options = useMemo(() => owners.filter((o) => !activeOnly || o.active), [owners, activeOnly]);
  const current = owners.find((o) => o.id === value) ?? null;
  return (
    <Autocomplete
      size="small" options={options} value={current} onChange={(_, o) => onChange(o?.id ?? "")}
      getOptionLabel={(o) => `${o.name}${o.active ? "" : " (deactivated)"}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderOption={(props, o) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <Box>
              <Typography sx={{ fontSize: "0.86rem", color: INK }}>{o.name}{o.active ? "" : " · deactivated"}</Typography>
              <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{[o.email, o.team, `owner ${o.id}`].filter(Boolean).join(" · ")}</Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(p) => <TextField {...p} label={label} />}
    />
  );
}

export default function RuleEditor({ open, initial, owners, onClose, onSaved }: {
  open: boolean; initial: Draft; owners: Owner[]; onClose: () => void; onSaved: (note: string) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const fromName = owners.find((o) => o.id === d.fromOwner)?.name ?? "that person";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/uc/owner-redirection", {
        method: d.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d.id ? { rule: payload(d) } : { action: "add", rule: payload(d) }),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) onSaved(j.data?.note ?? "Saved.");
      else setError(j?.error ?? `The rule was not saved (HTTP ${r.status}).`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 600 }}>{d.id ? "Change the rule" : "Add a rule"}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "8px !important" }}>
        <Choice<Kind> value={d.kind} onChange={(k) => set("kind", k)} options={[
          { key: "country", label: "By country" }, { key: "owner", label: "By person" },
        ]} />
        {d.kind === "country" ? (
          <>
            <TextField size="small" label="Country is one of" value={d.countries} onChange={(e) => set("countries", e.target.value)}
              helperText="As HubSpot writes it, separated by commas - e.g. France, FR. Upper or lower case does not matter." />
            <Box>
              <FormControlLabel control={<Checkbox checked={d.useCustom} onChange={(e) => set("useCustom", e.target.checked)} />}
                label={<Typography sx={{ fontSize: "0.86rem" }}>Also when country_custom is one of</Typography>} />
              {d.useCustom && (
                <TextField size="small" fullWidth value={d.customCountries} onChange={(e) => set("customCountries", e.target.value)}
                  placeholder="France" helperText="Its own list - country_custom holds full names." />
              )}
            </Box>
          </>
        ) : (
          <OwnerPick label="Companies owned by" value={d.fromOwner} owners={owners} activeOnly={false} onChange={(id) => set("fromOwner", id)} />
        )}
        <OwnerPick label="Go to" value={d.toOwner} owners={owners} activeOnly onChange={(id) => set("toOwner", id)} />
        <Box>
          <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>
            {d.kind === "country"
              ? "Taken along - all of them, whoever owns them now:"
              : `Taken along - only those ${d.fromOwner ? fromName : "that person"} owns; everybody else's stay:`}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <FormControlLabel control={<Checkbox checked={d.contacts} onChange={(e) => set("contacts", e.target.checked)} />} label="Contacts" />
            <FormControlLabel control={<Checkbox checked={d.tickets} onChange={(e) => set("tickets", e.target.checked)} />} label="Open tickets" />
            <FormControlLabel control={<Checkbox checked={d.tasks} onChange={(e) => set("tasks", e.target.checked)} />} label="Open tasks" />
          </Box>
        </Box>
        <TextField size="small" label="Note" value={d.note} onChange={(e) => set("note", e.target.value.slice(0, 500))} multiline minRows={2}
          placeholder="Why - e.g. Sandra left on 30.09, her customers go to Marc" />
        <FormControlLabel control={<Switch checked={d.enabled} onChange={(e) => set("enabled", e.target.checked)} />}
          label={<Typography sx={{ fontSize: "0.86rem" }}>{d.enabled ? "On" : "Off - kept, but HubSpot ignores it"}</Typography>} />
        {error && <Typography sx={{ fontSize: "0.84rem", color: "#9e1b18" }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" disableElevation onClick={() => void save()} disabled={busy || !d.toOwner || (d.kind === "owner" ? !d.fromOwner : !list(d.countries).length && !(d.useCustom && list(d.customCountries).length))}>
          {busy ? "Saving and publishing…" : "Save and publish"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
