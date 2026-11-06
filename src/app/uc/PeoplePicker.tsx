"use client";

// A list of HubSpot people, picked one by one (Certificates > Console, Back Office distribution > Way in): the order
// shown is the order kept; × takes one out; "Add…" puts one at the end. single = exactly one, changed in place.

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { FAINT, HAIRLINE, MUTED, RED } from "@/app/uc/report/ui";

export function PeoplePicker({ label, ids, choices, names, single, onSave, disabled, allowEmpty }: {
  label: string; ids: string[]; choices: { id: string; name: string }[]; names: Record<string, string>; single?: boolean;
  onSave: (ids: string[]) => void; disabled: boolean; allowEmpty?: boolean;
}) {
  const [add, setAdd] = useState("");
  return (
    <Box>
      <Typography sx={{ fontSize: "0.8rem", color: MUTED, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {!ids.length && allowEmpty && <Typography sx={{ fontSize: "0.8rem", color: RED }}>nobody - not sent</Typography>}
        {ids.map((id, i) => (
          <Box key={id} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.8)", fontSize: "0.8rem" }}>
            {single ? "" : `${i + 1}. `}{names[id] ?? `Owner ${id}`}
            {!single && (ids.length > 1 || allowEmpty) && !disabled && (
              <Box component="button" type="button" aria-label={`Take ${names[id] ?? id} out`} onClick={() => onSave(ids.filter((x) => x !== id))} sx={{ all: "unset", cursor: "pointer", color: FAINT, px: 0.25, "&:hover": { color: RED } }}>×</Box>
            )}
          </Box>
        ))}
        {!disabled && (
          <Box component="select" value={add} aria-label={`${label}: add`} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { const v = e.target.value; setAdd(""); if (v) onSave(single ? [v] : [...ids.filter((x) => x !== v), v]); }}
            sx={{ fontSize: "0.8rem", px: 1, py: 0.4, borderRadius: "999px", border: `1px solid ${HAIRLINE}`, bgcolor: "#fff", color: MUTED, maxWidth: 220 }}>
            <option value="">{single ? "Change…" : "Add…"}</option>
            {choices.filter((c) => !ids.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Box>
        )}
      </Box>
    </Box>
  );
}
