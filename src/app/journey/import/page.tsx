"use client";

// IMPORTING THE WORKBOOK — deliberately a two-step screen.
//
// Choose the file, see exactly what it would change, then apply it. The
// workbook is a business document several people edit; an upload that silently
// replaced the definition would be worse than no import at all.

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { HAIRLINE, INK, MUTED, Section } from "@/app/analytics/Shell";
import type { ImportPreview } from "@/lib/journey/model";
import type { JourneyHistoryEntry } from "@/lib/journey/store";

type Result = { ok: boolean; applied: boolean; preview?: ImportPreview; error?: string };

const COUNT_LABELS: { key: keyof ImportPreview["counts"]; label: string }[] = [
  { key: "stagesCreated", label: "stages created" },
  { key: "stagesUpdated", label: "stages updated" },
  { key: "stagesUnchanged", label: "stages unchanged" },
  { key: "stagesRemoved", label: "stages no longer in the file" },
  { key: "stepsCreated", label: "steps created" },
  { key: "stepsUpdated", label: "steps updated" },
  { key: "stepsUnchanged", label: "steps unchanged" },
  { key: "stepsRemoved", label: "steps no longer in the file" },
  { key: "funnels", label: "funnels read" },
];

export default function JourneyImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<JourneyHistoryEntry[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/journey").then((r) => r.json()).then((j) => setHistory(j?.history ?? [])).catch(() => {});
  }, [result?.applied]);

  async function send(apply: boolean) {
    if (!file) return;
    setBusy(apply ? "apply" : "preview");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`/api/journey/import${apply ? "?apply=1" : ""}`, { method: "POST", body });
      setResult((await res.json()) as Result);
    } catch (err) {
      setResult({ ok: false, applied: false, error: String((err as Error)?.message ?? err) });
    } finally {
      setBusy(null);
    }
  }

  const preview = result?.preview;
  const errors = preview?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Section>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK, mb: 0.5 }}>Where this data comes from</Typography>
        <Typography sx={{ fontSize: "0.85rem", color: MUTED, mb: 2 }}>
          The journey is defined in <strong>Customer Journey APSOparts-&lt;date&gt;.xlsx</strong>, kept on the shared drive by
          Alexandre. This screen reads one sheet of it, <strong>Customer Journey</strong>, plus <strong>KPIsNeeded</strong> for the
          lifecycle funnels. It is an <strong>upload, not a synchronisation</strong>: the file is read once, here, when someone
          chooses it. Later edits in Excel do not reach the application until the file is uploaded again.
        </Typography>

        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          />
          <Button variant="outlined" onClick={() => input.current?.click()} sx={{ textTransform: "none" }}>
            Choose workbook…
          </Button>
          <Typography sx={{ fontSize: "0.82rem", color: file ? INK : MUTED }}>
            {file ? `${file.name} · ${(file.size / 1e6).toFixed(1)} MB` : "No file chosen"}
          </Typography>
          <Button
            variant="contained"
            disabled={!file || busy !== null}
            onClick={() => send(false)}
            sx={{ textTransform: "none" }}
          >
            {busy === "preview" ? "Reading…" : "See what would change"}
          </Button>
        </Box>
      </Section>

      {result && !result.ok && !preview && (
        <Section sx={{ borderColor: "#f0c4c2" }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#9e1b18", mb: 0.5 }}>The file was not read</Typography>
          <Typography sx={{ fontSize: "0.84rem", color: INK }}>{result.error}</Typography>
        </Section>
      )}

      {preview && (
        <Section>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: INK }}>
              {result?.applied ? "Imported" : "What this file would change"}
            </Typography>
            {result?.applied && <Chip size="small" label="applied" sx={{ bgcolor: "#e5f3ea", color: "#155d33", fontWeight: 600 }} />}
            {errors.length > 0 && <Chip size="small" label={`${errors.length} error${errors.length > 1 ? "s" : ""}`} sx={{ bgcolor: "#fdf3f2", color: "#9e1b18", fontWeight: 600 }} />}
            {warnings.length > 0 && <Chip size="small" label={`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`} sx={{ bgcolor: "#fdf6e3", color: "#7a5b12", fontWeight: 600 }} />}
          </Box>

          <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", mb: 2 }}>
            {COUNT_LABELS.filter((c) => preview.counts[c.key] > 0).map((c) => (
              <Box key={String(c.key)}>
                <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: INK }}>{preview.counts[c.key]}</Typography>
                <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{c.label}</Typography>
              </Box>
            ))}
          </Box>

          {(errors.length > 0 || warnings.length > 0) && (
            <Box sx={{ display: "grid", gap: 0.75, mb: 2 }}>
              {[...errors, ...warnings].map((issue, i) => (
                <Typography key={i} sx={{ fontSize: "0.8rem", color: issue.severity === "error" ? "#9e1b18" : "#7a5b12" }}>
                  <strong>{issue.where}:</strong> {issue.message}
                </Typography>
              ))}
            </Box>
          )}

          {preview.changes.length > 0 && (
            <Box sx={{ overflowX: "auto", mb: 2 }}>
              <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.8rem", verticalAlign: "top" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: MUTED }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: MUTED }}>Field</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: MUTED }}>Now</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: MUTED }}>After import</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.changes.slice(0, 40).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: INK, fontWeight: 600 }}>{c.stage}</TableCell>
                      <TableCell sx={{ color: MUTED }}>{c.field}</TableCell>
                      <TableCell sx={{ color: MUTED }}>{c.before ?? "—"}</TableCell>
                      <TableCell sx={{ color: INK }}>{c.after ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.changes.length > 40 && (
                <Typography sx={{ fontSize: "0.76rem", color: MUTED, mt: 1 }}>
                  …and {preview.changes.length - 40} more changes.
                </Typography>
              )}
            </Box>
          )}

          {!result?.applied && (
            <Button
              variant="contained"
              disabled={!preview.ok || busy !== null}
              onClick={() => send(true)}
              sx={{ textTransform: "none" }}
            >
              {busy === "apply" ? "Applying…" : `Apply this import`}
            </Button>
          )}
          {!preview.ok && (
            <Typography sx={{ fontSize: "0.8rem", color: "#9e1b18", mt: 1 }}>
              The errors above have to be fixed in the workbook first.
            </Typography>
          )}
        </Section>
      )}

      <Section>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: INK, mb: 1 }}>Import history</Typography>
        {history.length === 0 ? (
          <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>Nothing imported yet.</Typography>
        ) : (
          <Table size="small" sx={{ "& td, & th": { borderColor: HAIRLINE, fontSize: "0.8rem" } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: MUTED }}>When</TableCell>
                <TableCell sx={{ fontWeight: 600, color: MUTED }}>File</TableCell>
                <TableCell sx={{ fontWeight: 600, color: MUTED }}>By</TableCell>
                <TableCell sx={{ fontWeight: 600, color: MUTED }} align="right">Stages</TableCell>
                <TableCell sx={{ fontWeight: 600, color: MUTED }} align="right">Steps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ color: INK }}>{new Date(h.importedAt).toLocaleString("en-GB")}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{h.fileName}</TableCell>
                  <TableCell sx={{ color: MUTED }}>{h.importedBy}</TableCell>
                  <TableCell sx={{ color: INK }} align="right">{h.stages}</TableCell>
                  <TableCell sx={{ color: INK }} align="right">{h.steps}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </Box>
  );
}
