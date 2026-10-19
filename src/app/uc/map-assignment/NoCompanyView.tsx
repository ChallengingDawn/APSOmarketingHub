"use client";

// MAP ASSIGNMENT - recent contacts with no company (SARCLA 19.10.2026: "contacts without a clear company listed for a
// person to pick"): what their e-mail domain says, the owner it suggests, and the companies that share the domain -
// "Link" associates the contact with one of them (admins), and the company's owner then follows.

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import { CardTitle, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell } from "@/app/uc/report/ui";
import { Chip, Choice, usePaged, when } from "@/app/connectors/parts";
import type { MapData, NoCompany } from "@/lib/mapAssign/api";
import { hsCompany, hsContact, send, type Names } from "./shared";

export function NoCompanyView({ d, names, onLinked }: { d: MapData; names: Names; onLinked: () => void }) {
  const [filter, setFilter] = useState<"all" | "candidates" | "none">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [linked, setLinked] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const has = (n: NoCompany) => n.candidates.length > 0;
  const rows = d.noCompany.filter((n) => filter === "all" || (filter === "candidates" ? has(n) : !has(n)));
  const { slice, pager } = usePaged(rows, 20);
  const link = async (n: NoCompany, companyId: string) => {
    setBusy(`${n.id}:${companyId}`);
    const r = await send("POST", { action: "link", contactId: n.id, companyId });
    setBusy(null);
    const got = (r.data ?? {}) as { linked?: boolean; note?: string };
    if (r.ok && got.linked !== false) { setLinked((x) => ({ ...x, [n.id]: companyId })); setErr((x) => { const y = { ...x }; delete y[n.id]; return y; }); onLinked(); }
    else setErr((x) => ({ ...x, [n.id]: r.ok ? `not linked${got.note ? `: ${got.note}` : ""}` : r.error ?? "failed" }));
  };
  return (
    <GlassCard sx={{ p: { xs: 2, md: 2.5 } }}>
      <CardTitle icon={<PersonSearchOutlinedIcon />} tint="green" title={`Contacts without a company · ${d.noCompany.length}`}
        note="Recent contacts whose e-mail domain does not point to one company - pick the right one" />
      <Box sx={{ mb: 1.5 }}>
        <Choice<"all" | "candidates" | "none"> value={filter} onChange={setFilter} options={[
          { key: "all", label: "All", count: d.noCompany.length },
          { key: "candidates", label: "Companies to pick from", count: d.noCompany.filter(has).length },
          { key: "none", label: "No company with the domain", count: d.noCompany.filter((n) => !has(n)).length },
        ]} />
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead><TableRow>{["Contact", "Created", "Why", "Suggested owner", "Companies with the domain"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {slice.map((n) => {
              const done = linked[n.id];
              return (
                <TableRow key={n.id} sx={{ verticalAlign: "top" }}>
                  <TableCell sx={bodyCell}>
                    <Box component="a" href={hsContact(n.id)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(240) }} title={n.name}>{n.name || n.email || n.id}</Box>
                    <Typography sx={{ fontSize: "0.74rem", color: MUTED, ...clip(240) }} title={n.email ?? ""}>{n.email || "no e-mail"}</Typography>
                    {n.ownerId && <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>owner now: {names.name(n.ownerId)}</Typography>}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{n.createdate ? when(n.createdate) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED, minWidth: 180 }}>{n.why}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{n.suggestedOwner ? names.name(n.suggestedOwner) : "—"}</TableCell>
                  <TableCell sx={{ ...bodyCell, minWidth: 300 }}>
                    {done && <Box sx={{ mb: 0.5 }}><Chip tint="green">linked to {n.candidates.find((c) => c.id === done)?.name ?? done}</Chip></Box>}
                    {err[n.id] && <Typography sx={{ fontSize: "0.76rem", color: RED, mb: 0.5 }}>{err[n.id]}</Typography>}
                    {!n.candidates.length && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>None in HubSpot</Typography>}
                    <Box sx={{ display: "grid", gap: 0.5 }}>
                      {n.candidates.map((c) => (
                        <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box component="a" href={hsCompany(c.id)} target="_blank" rel="noopener" sx={{ color: INK, fontSize: "0.82rem", fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(220) }} title={c.name}>{c.name || c.id}</Box>
                            <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{c.ownerId ? names.name(c.ownerId) : "no owner"}{c.erpId ? ` · ERP ${c.erpId}` : " · not an ERP customer"}</Typography>
                          </Box>
                          {n.link === c.id && <Chip tint="blue">clear match</Chip>}
                          {d.admin && !done && (
                            <Button size="small" variant="outlined" disabled={busy !== null} onClick={() => void link(n, c.id)} sx={{ textTransform: "none", minWidth: 0, px: 1.25 }}>
                              {busy === `${n.id}:${c.id}` ? <CircularProgress size={12} /> : "Link"}
                            </Button>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {pager}
      {!rows.length && <Typography sx={{ fontSize: "0.85rem", color: MUTED, mt: 1 }}>{d.noCompany.length ? "Nothing with this filter." : "Every recent contact has a company."}</Typography>}
      {!d.admin && d.noCompany.length > 0 && <Typography sx={{ fontSize: "0.74rem", color: MUTED, mt: 1 }}>Admins can link a contact here; everyone can open it in HubSpot.</Typography>}
    </GlassCard>
  );
}
