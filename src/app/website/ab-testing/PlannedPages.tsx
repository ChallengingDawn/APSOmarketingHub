"use client";
// Website > A/B testing > PAGES (Content v7, 10.11.2026 - SARCLA: "Should you update the A/B testing link?"): the A/B
// tests planned in Content's Page builder - the page, its versions, the state, a link to the to-do. Read-only here: a test
// is planned and changed in its to-do (the Page builder's A/B test row links back here). Nothing runs on the shop yet -
// the gateway that would serve the versions is not switched on, and each row says so.
// src/lib/content/abPlanned.ts says what a row is; /api/website/ab-testing/planned reads them.

import { useEffect, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CompareOutlinedIcon from "@mui/icons-material/CompareOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { CardTitle, GlassCard, HAIRLINE, INK, MUTED, bodyCell, headCell } from "@/app/uc/report/ui";
import { Chip } from "@/app/website/ai-personalization/Tag";
import type { PlannedTest } from "@/lib/content/abPlanned";
import { readAnswer } from "@/lib/http/answer";

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** The page's versions as squared letters; the two that run are filled. */
function Letters({ t }: { t: PlannedTest }) {
  const runs = (l: string) => t.tested === `Version ${l}` || t.against === `Version ${l}`;
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
      {t.against === "The page as it is" && <Chip tint="slate">As it is</Chip>}
      {t.versions.map((l) => <Chip key={l} tint={runs(l) ? "pink" : "slate"}>{l}</Chip>)}
    </Box>
  );
}

/** The list itself - handed its rows (the page reads them; a static check renders it with its own). */
export function PlannedTable({ tests }: { tests: PlannedTest[] }) {
  if (!tests.length) {
    return (
      <Typography sx={{ fontSize: "0.86rem", color: MUTED }}>
        No page has an A/B test planned yet. Plan one in a Page builder to-do in Content - its A/B test row - and it shows here.
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" sx={{ minWidth: 860 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headCell}>Page</TableCell>
            <TableCell sx={headCell}>Versions</TableCell>
            <TableCell sx={headCell}>The test</TableCell>
            <TableCell sx={headCell}>State</TableCell>
            <TableCell sx={headCell} align="right">To-do</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tests.map((t) => (
            <TableRow key={t.pieceId} hover>
              <TableCell sx={{ ...bodyCell, maxWidth: 320 }}>
                <Typography sx={{ fontSize: "0.86rem", fontWeight: 650, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.url ? (
                    <Box component="a" href={t.url} target="_blank" rel="noopener noreferrer" sx={{ color: INK, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5, "&:hover": { textDecoration: "underline" } }}>
                      {t.path}<OpenInNewIcon sx={{ fontSize: 13, color: MUTED }} />
                    </Box>
                  ) : `${t.title} (a new page)`}
                </Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.storeName}{t.env === "acc" ? " · ACC" : ""}</Typography>
              </TableCell>
              <TableCell sx={bodyCell}><Letters t={t} /></TableCell>
              <TableCell sx={{ ...bodyCell, maxWidth: 340 }}>
                <Typography sx={{ fontSize: "0.84rem", color: INK, fontWeight: 600 }}>{t.tested} vs {t.against.charAt(0).toLowerCase() + t.against.slice(1)}</Typography>
                <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{t.plan}</Typography>
              </TableCell>
              <TableCell sx={bodyCell}>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                  <Chip tint="amber">Planned · not running</Chip>
                  <Chip tint={t.todo === "Approved" || t.todo === "Live" ? "green" : t.todo === "In review" ? "blue" : "slate"}>{t.todo}</Chip>
                </Box>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.4 }}>The shop&apos;s gateway is not on yet</Typography>
              </TableCell>
              <TableCell sx={bodyCell} align="right">
                <Button size="small" component={Link} href={t.href} sx={{ textTransform: "none", fontWeight: 650, borderRadius: "6px", whiteSpace: "nowrap", color: "#c22c6e" }}>Open the to-do</Button>
                <Typography sx={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{[t.project, t.owner, day(t.updatedAt)].filter(Boolean).join(" · ")}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export default function PlannedPages() {
  const [tests, setTests] = useState<PlannedTest[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void readAnswer(fetch("/api/website/ab-testing/planned")).then((r) => {
      if (r.ok) setTests((r.tests as PlannedTest[]) ?? []);
      else setErr(String(r.error));
    });
  }, []);
  return (
    <Box id="pages" sx={{ scrollMarginTop: 24 }}>
      <GlassCard>
        <CardTitle icon={<CompareOutlinedIcon />} tint="pink" title="Pages"
          note="A/B tests planned in Content's Page builder - read-only here; open the to-do to change one" />
        {err ? <Typography sx={{ fontSize: "0.86rem", color: "#c5221f" }}>{err}</Typography>
          : !tests ? <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: MUTED, fontSize: "0.86rem" }}><CircularProgress size={14} />Reading the planned tests…</Box>
            : <PlannedTable tests={tests} />}
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${HAIRLINE}` }}>
          <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>
            The tests of AI testing &amp; personalization are under <Box component={Link} href="/website/ab-testing/pages" sx={{ color: "#2459d1", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>Page tests</Box>.
          </Typography>
        </Box>
      </GlassCard>
    </Box>
  );
}
