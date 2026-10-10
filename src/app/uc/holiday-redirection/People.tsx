"use client";

// PEOPLE AND THEIR DEPUTIES - who is in, who is away, and who stands in for them.
// SARCLA, 10.10: "it would be great to see the person, their deputy and their status;
// the Back Office people as well; and we should be able to change the deputy with a
// dropdown". Read live from HubSpot each time the page opens; a change writes the same
// user property the sweep reads, so it counts from its next run.

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { CardTitle, GlassCard, INK, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip, Choice } from "@/app/connectors/parts";
import { LoadingPanel } from "@/app/analytics/Shell";
import type { Person, Team } from "@/lib/holiday/people";

const TEAM_LABEL: Record<Team, string> = { ESO: "ESO", TSA: "TSA", "Backoffice Team": "Back Office" };
type Filter = "all" | Team;

const day = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** In, away (until when), or no HubSpot user at all - and the next absence, if one is set. */
function Status({ p }: { p: Person }) {
  if (!p.userObjectId) return <Chip tint="slate">No HubSpot user</Chip>;
  return (
    <Box sx={{ display: "grid", gap: 0.4, justifyItems: "start" }}>
      {p.away
        ? <Chip tint="amber">{p.now ? `Away until ${day(p.now.to)}` : "Out of office"}</Chip>
        : <Chip tint="green">In</Chip>}
      {!p.away && p.next && (
        <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>away {day(p.next.from)} → {day(p.next.to)}</Typography>
      )}
    </Box>
  );
}

function DeputyCell({ p, slot, byId, options, canEdit, busy, onChange }: {
  p: Person; slot: 1 | 2; byId: Map<string, Person>; options: Person[]; canEdit: boolean; busy: boolean;
  onChange: (deputy: string | null) => void;
}) {
  const current = slot === 1 ? p.deputy1 : p.deputy2;
  const d = current ? byId.get(current) : undefined;
  const state = d ? (d.away ? <Chip tint="amber">away</Chip> : <Chip tint="green">in</Chip>) : null;
  if (!canEdit || !p.userObjectId) {
    return (
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.84rem", color: current ? INK : MUTED }}>
          {current ? (d?.name ?? `owner ${current}`) : "none"}
        </Typography>
        {state}
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
      <Select size="small" value={current ?? ""} displayEmpty disabled={busy} onChange={(e) => onChange(e.target.value ? String(e.target.value) : null)}
        sx={{ minWidth: 190, fontSize: "0.84rem", "& .MuiSelect-select": { py: 0.6 } }}
        inputProps={{ "aria-label": `Deputy ${slot} of ${p.name}` }}
        renderValue={(v) => (v ? byId.get(String(v))?.name ?? `owner ${v}` : <em>none</em>)}>
        <MenuItem value=""><em>none</em></MenuItem>
        {/* a deputy who is no longer in these teams still shows, so the cell never lies */}
        {current && !d && <MenuItem value={current}>owner {current}</MenuItem>}
        {options.filter((o) => o.ownerId !== p.ownerId).map((o) => (
          <MenuItem key={o.ownerId} value={o.ownerId}>{o.name} · {TEAM_LABEL[o.team]}{o.away ? " · away" : ""}</MenuItem>
        ))}
      </Select>
      {state}
    </Box>
  );
}

export default function People() {
  const [data, setData] = useState<{ people: Person[]; canEdit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/uc/holiday-redirection/people").then((r) => r.json());
      if (j?.ok) { setData(j.data); setError(null); } else setError(j?.error ?? j?.detail ?? "HubSpot did not answer.");
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const people = data?.people ?? [];
  const byId = useMemo(() => new Map(people.map((p) => [p.ownerId, p])), [people]);
  const shown = filter === "all" ? people : people.filter((p) => p.team === filter);
  const count = (t: Team) => people.filter((p) => p.team === t).length;
  const awayNoCover = people.filter((p) => p.away && ![p.deputy1, p.deputy2].some((d) => d && byId.get(d) && !byId.get(d)!.away));

  const change = async (p: Person, slot: 1 | 2, deputy: string | null) => {
    setBusy(`${p.ownerId}:${slot}`);
    setNote(null);
    try {
      const j = await fetch("/api/uc/holiday-redirection/people", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: p.ownerId, slot, deputy }),
      }).then((r) => r.json());
      if (j?.ok) {
        setNote(`${p.name}: deputy ${slot} is now ${deputy ? byId.get(deputy)?.name ?? deputy : "nobody"}.`);
        await load();
      } else setNote(j?.error ?? j?.detail ?? "The change was not saved.");
    } catch (e) {
      setNote(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 }, overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 1.25, display: "grid", gap: 1.25 }}>
        <CardTitle icon={<GroupsOutlinedIcon />} tint="blue" title="People and their deputies"
          note="Live from HubSpot: who is in, who is away, and who takes their tickets" />
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Choice<Filter> value={filter} onChange={setFilter} options={[
            { key: "all", label: "Everyone", count: people.length },
            { key: "ESO", label: "ESO", count: count("ESO") },
            { key: "TSA", label: "TSA", count: count("TSA") },
            { key: "Backoffice Team", label: "Back Office", count: count("Backoffice Team") },
          ]} />
          {awayNoCover.length > 0 && (
            <Typography sx={{ fontSize: "0.8rem", color: "#a96a12", fontWeight: 600 }}>
              Away with no deputy who is in: {awayNoCover.map((p) => p.name).join(", ")}
            </Typography>
          )}
        </Box>
        {note && <Typography sx={{ fontSize: "0.82rem", color: note.includes("refused") || note.includes("not") ? "#9e1b18" : "#1b7a55" }}>{note}</Typography>}
        {error && <Typography sx={{ fontSize: "0.82rem", color: "#9e1b18" }}>{error}</Typography>}
      </Box>
      {!data && !error ? (
        <Box sx={{ p: 2 }}><LoadingPanel label="Reading the people from HubSpot…" /></Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headCell}>Person</TableCell>
                <TableCell sx={{ ...headCell, width: 110 }}>Team</TableCell>
                <TableCell sx={{ ...headCell, width: 190 }}>Status</TableCell>
                <TableCell sx={{ ...headCell, width: 270 }}>Deputy 1</TableCell>
                <TableCell sx={{ ...headCell, width: 270 }}>Deputy 2</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((p) => (
                <TableRow key={p.ownerId} hover>
                  <TableCell sx={bodyCell}>
                    <Typography sx={{ fontSize: "0.86rem", fontWeight: 600, color: INK }}>{p.name}</Typography>
                    {p.email && <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{p.email}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.82rem" }}>{TEAM_LABEL[p.team]}</TableCell>
                  <TableCell sx={bodyCell}><Status p={p} /></TableCell>
                  {([1, 2] as const).map((slot) => (
                    <TableCell key={slot} sx={bodyCell}>
                      <DeputyCell p={p} slot={slot} byId={byId} options={people} canEdit={!!data?.canEdit}
                        busy={busy === `${p.ownerId}:${slot}`} onChange={(d) => void change(p, slot, d)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {data && shown.length === 0 && (
                <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, textAlign: "center", py: 3 }}>Nobody in this team.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}
      <Typography sx={{ fontSize: "0.74rem", color: MUTED, px: { xs: 2, md: 2.75 }, py: 1.25 }}>
        Out of office and absence hours are set by each person in HubSpot (Profile → Working hours). Tickets are moved for ESO only.
      </Typography>
    </GlassCard>
  );
}
