"use client";
// ONE PERSON'S ACCESS, APP BY APP AND SUB-APP BY SUB-APP.
//
// The tree is the menus' own (src/lib/auth/tree.ts): an app, and beneath it every sub-app its menu lists - a new
// sub-app is here the day it is in the menu, taking its app's access until somebody sets its own (SARCLA 01.11.2026:
// "sub hierarchy that needs to be updated at each new sub app"). Each row says what it comes to: set here, or "As
// <parent>" with the parent's level - so a View on Advanced reporting with No access on ESO Reports reads as exactly
// that.

import { Fragment, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { APPS } from "@/app/hubApps";
import { FAINT, INK, MUTED } from "@/app/uc/report/ui";
import { LEVELS, levelsFor, roleDefault, type Cross, type Level, type Role } from "@/lib/auth/access";
import { ACCESS_TREE, childrenOf, levelsOf, nodeByKey, type AccessNode, type Grants } from "@/lib/auth/tree";

/** What a row can be set to: a level, or its parent's. */
export type Choice = Level | "inherit";

const LABEL: Record<Level, string> = Object.fromEntries(LEVELS.map((l) => [l.value, l.label])) as Record<Level, string>;
const TONE: Record<Level, string> = { none: FAINT, read: "#4a5a70", write: "#0f7b4f" };

export default function AccessTree({ role, access, cross = null, busy, onSet }: {
  role: Role;
  access: Grants;
  /** Cross access (access.ts): a cross-user's tree views everything not taken, edits nothing, hides some reports. */
  cross?: Cross | null;
  /** The node being saved, if any. */
  busy: string | null;
  onSet: (nodeKey: string, choice: Choice) => void;
}) {
  const levels = useMemo(() => levelsOf(role, access, cross), [role, access, cross]);
  // an app opens when something beneath it was set on its own, so a grant made there is never out of sight
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const setBelow = (key: string): boolean => childrenOf(key).some((c) => access[c.key] !== undefined || setBelow(c.key));
  const isOpen = (key: string) => open[key] ?? setBelow(key);

  const row = (n: AccessNode) => {
    const kids = childrenOf(n.key);
    const app = APPS.find((a) => a.key === n.app);
    const own = access[n.key];
    const offered = levelsFor(role, n.app);
    const parent = n.parent ? nodeByKey(n.parent) : null;
    // an app not set is at the role's own (nothing for a user, View for a sales leader); a grant the role cannot hold -
    // a user's Edit kept from before they became a sales leader - shows as what it comes to
    const value: Choice = own === undefined ? (parent ? "inherit" : roleDefault(role))
      : offered.some((l) => l.value === own) ? own : levels[n.key];
    return (
      <Fragment key={n.key}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: n.depth === 0 ? 40 : 34, pl: n.depth * 2.25 }}>
          <Box component="button" type="button" onClick={() => setOpen((o) => ({ ...o, [n.key]: !isOpen(n.key) }))}
            aria-expanded={kids.length ? isOpen(n.key) : undefined} aria-label={kids.length ? `${isOpen(n.key) ? "Close" : "Open"} ${n.name}` : undefined}
            disabled={!kids.length}
            sx={{ width: 22, height: 22, p: 0, border: 0, background: "none", display: "grid", placeItems: "center", cursor: kids.length ? "pointer" : "default", color: MUTED, flexShrink: 0, visibility: kids.length ? "visible" : "hidden" }}>
            <ChevronRightIcon sx={{ fontSize: 18, transform: isOpen(n.key) ? "rotate(90deg)" : "none", transition: "transform .15s ease" }} />
          </Box>
          {n.depth === 0 && app && (
            <Box sx={{ width: 22, height: 22, borderRadius: "7px", flexShrink: 0, background: `linear-gradient(140deg, ${app.from}, ${app.to})` }} />
          )}
          <Typography sx={{
            flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            ...(n.heading
              ? { fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: FAINT }
              : { fontSize: n.depth === 0 ? "0.85rem" : "0.82rem", fontWeight: n.depth === 0 ? 600 : 400, color: INK }),
          }}>{n.name}</Typography>
          <Select size="small" value={value} disabled={busy === n.key}
            onChange={(e) => onSet(n.key, e.target.value as Choice)}
            renderValue={(raw) => {
              const v = raw as Choice;
              return v === "inherit"
                ? <Box component="span" sx={{ color: TONE[levels[n.key]] }}>{LABEL[levels[n.key]]} <Box component="span" sx={{ color: FAINT }}>· inherited</Box></Box>
                : <Box component="span" sx={{ color: TONE[v], fontWeight: 600 }}>{LABEL[v]}</Box>;
            }}
            sx={{ width: 168, flexShrink: 0, fontSize: "0.8rem", borderRadius: "10px", "& .MuiSelect-select": { py: 0.6, overflow: "hidden", textOverflow: "ellipsis" } }}>
            {parent && (
              <MenuItem value="inherit" sx={{ fontSize: "0.84rem" }}>
                As {parent.name} ({LABEL[levels[parent.key]]})
              </MenuItem>
            )}
            {offered.map((l) => <MenuItem key={l.value} value={l.value} sx={{ fontSize: "0.84rem" }}>{l.label}</MenuItem>)}
          </Select>
        </Box>
        {kids.length > 0 && isOpen(n.key) && kids.map(row)}
      </Fragment>
    );
  };

  return <Box sx={{ display: "grid", gap: 0.25 }}>{ACCESS_TREE.filter((n) => n.parent === null).map(row)}</Box>;
}
