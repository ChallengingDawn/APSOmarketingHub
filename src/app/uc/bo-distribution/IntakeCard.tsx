"use client";

// THE WAY IN - "SARCLA | Back Office Ticket Created | Notification" in the hub (SARCLA 05.11.2026: "This is the one we
// need to migrate"), at the top of Back Office distribution > Settings. While the workflow runs: what it wrote against
// what the hub would write, ticket by ticket. Once it is off: what the hub wrote and mailed.

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import { CardTitle, FAINT, GlassCard, INK, MUTED, RED, bodyCell, clip, headCell, hsTicket } from "@/app/uc/report/ui";
import { Chip, usePaged, when } from "@/app/connectors/parts";
import { full } from "@/app/charts/format";
import type { IntakeLast, IntakeRow } from "@/lib/boDistribution/intakeRun";

type State = {
  workflow: { on: boolean; updatedAt: string | null } | null; workflowName: string; offAt: string | null; last: IntakeLast | null; mailReady: boolean;
  figures: { compared: number; same: number; byBranch: Record<string, { n: number; same: number }>; done: number; failed: number };
  rows: IntakeRow[];
};
const BRANCH: Record<string, string> = {
  "MAIL TO CUSTOMER": "Back Office's own - mail to customer / A+P team", FORM: "Form", "EMAIL TEAM": "E-mail from an A+P team",
  EMAIL: "E-mail", CERTIFICATE: "Certificate request", "BY HAND": "Created by hand",
};
const WRITTEN: Record<string, string> = { subject: "subject", back_office_ticket_requester: "requester", hubspot_owner_id: "owner", hs_pipeline_stage: "stage" };

export function IntakeCard() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/uc/bo-distribution/intake").then((r) => r.json()).then((j: { ok: boolean; data?: State; error?: string }) => {
      if (!live) return;
      if (j.ok && j.data) setS(j.data); else setErr(j.error ?? "could not be read");
    }).catch((e) => live && setErr(String((e as Error).message)));
    return () => { live = false; };
  }, []);
  const rows = s?.rows ?? [];
  const { slice, pager } = usePaged(rows, 15);
  const hub = !!s?.offAt;
  const f = s?.figures;
  const status = !s ? "" : !s.workflow
    ? `${s.workflowName} could not be read - the hub keeps the last state it saw.`
    : hub
      ? `The hub writes the way in since ${when(s.offAt)} - the workflow is off. Each new ticket: subject, requester, owner Backoffice Team (or stage Assigned for the Back Office's own mails) and the mail "❗Back Office Ticket Created", then the distribution assigns it. Switching the workflow back on is the roll-back.`
      : `The workflow still writes it. The hub works out the same for every ticket that enters New and compares, 10 minutes later. Switch the workflow off in HubSpot and the hub writes it from that moment - before the distribution assigns, in the same minute.`;
  return (
    <GlassCard sx={{ p: 0, pt: { xs: 2, md: 2.5 } }}>
      <Box sx={{ px: { xs: 2, md: 2.75 }, display: "grid", gap: 1 }}>
        <CardTitle icon={<LoginOutlinedIcon />} tint={hub ? "green" : "amber"} title={`The way in - ${s?.workflowName ?? "Back Office Ticket Created | Notification"}${hub ? ": the hub's" : ""}`}
          note="Every ticket that enters Back Office New, before the distribution gives it a person" />
        {err && <Typography sx={{ fontSize: "0.82rem", color: RED }}>{err}</Typography>}
        {s && <Typography sx={{ fontSize: "0.82rem", color: INK }}>{status}</Typography>}
        {s && !s.mailReady && <Typography sx={{ fontSize: "0.82rem", color: RED }}>The hub cannot send mail here - the &quot;❗Back Office Ticket Created&quot; mail would not go out.</Typography>}
        {f && (
          <Typography sx={{ fontSize: "0.82rem", color: MUTED }}>
            {f.compared ? `Compared with the workflow, 7 days: ${full(f.same)} of ${full(f.compared)} the same` : "Nothing compared yet - the first tickets show 10 minutes after they enter New"}
            {Object.keys(f.byBranch).length ? ` (${Object.entries(f.byBranch).map(([k, v]) => `${BRANCH[k] ?? k} ${v.same}/${v.n}`).join(" · ")})` : ""}
            {f.done ? ` · written by the hub: ${full(f.done)}` : ""}{f.failed ? ` · failed: ${full(f.failed)}` : ""}
            {s?.last ? ` · last look ${when(s.last.at)}${s.last.error ? ` - ${s.last.error}` : ""}` : ""}
          </Typography>
        )}
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "grid", gap: 0.25, fontSize: "0.8rem", color: INK, listStyleType: "disc", "& > li": { display: "list-item" } }}>
          <li>An e-mail: the sender names the A+P team (finance, AVOR, CAD, the country units …) - &quot;BO | EMAIL | team | e-mail subject |&quot;; any other sender &quot;BO | Email | e-mail subject |&quot;. Requester = the owner, owner = Backoffice Team, the mail.</li>
          <li>Created by hand: &quot;BO | category | owner&quot;, the same three; a certificate request only the requester (the Certificates app takes it on).</li>
          <li>Created by the Back Office itself: &quot;BO | MAIL TO CUSTOMER or A+P TEAMS&quot;, stage Assigned, owner = the e-mail&apos;s. A form: the mail only.</li>
        </Box>
      </Box>
      <Box sx={{ overflowX: "auto", mt: 1 }}>
        <Table size="small">
          <TableHead><TableRow>{["Entered New", "Ticket", "Way in", "The hub writes", "Result"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {!rows.length && <TableRow><TableCell colSpan={5} sx={{ ...bodyCell, color: MUTED, fontSize: "0.84rem" }}>None yet.</TableCell></TableRow>}
            {slice.map((r) => (
              <TableRow key={`${r.ticketId}-${r.at}`} hover>
                <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED, whiteSpace: "nowrap" }}>{when(r.enteredAt)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem" }}>
                  <Box component="a" href={hsTicket(r.ticketId)} target="_blank" rel="noopener" sx={{ color: INK, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" }, display: "block", ...clip(300) }}>
                    {r.subjectBefore || `Ticket ${r.ticketId}`}
                  </Box>
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>{r.branch ? BRANCH[r.branch] ?? r.branch : "-"}{r.team ? <Typography sx={{ fontSize: "0.72rem", color: MUTED }}>{r.team}</Typography> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.76rem", color: MUTED }}>
                  {r.props.subject ? <Typography sx={{ fontSize: "0.76rem", color: INK, ...clip(320) }}>{r.props.subject}</Typography> : null}
                  {Object.keys(r.props).filter((k) => k !== "subject").map((k) => WRITTEN[k] ?? k).join(" · ")}{r.mail ? `${Object.keys(r.props).length > 1 ? " · " : ""}mail` : ""}
                  {!Object.keys(r.props).length && !r.mail ? "nothing" : ""}
                </TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.78rem" }}>
                  {r.what === "shadow" && r.actual ? (
                    <>
                      <Chip tint={r.actual.same ? "green" : "pink"}>{r.actual.same ? "same as the workflow" : r.actual.wrote ? "differs" : "the workflow wrote nothing"}</Chip>
                      {r.actual.diffs.map((x) => <Typography key={x} sx={{ fontSize: "0.7rem", color: FAINT, ...clip(360) }}>{x}</Typography>)}
                    </>
                  ) : (
                    <>
                      <Chip tint={r.what === "done" ? "green" : r.what === "failed" ? "pink" : "slate"}>{r.what === "done" ? "written" : r.what}</Chip>
                      {(r.error || r.why || r.mailText) && <Typography sx={{ fontSize: "0.72rem", color: r.error ? RED : MUTED }}>{r.error ?? r.why ?? r.mailText}</Typography>}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ px: 2, py: 1 }}>{pager}</Box>
    </GlassCard>
  );
}
