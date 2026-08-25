"use client";

/**
 * Renders the seven check results. A score with no explanation is useless, so
 * every row carries: what was asked, what was measured, and the exact edit that
 * would raise it — plus the verbatim evidence the measurement came from.
 *
 * At cockpit width the three parts sit side by side (verdict · measurement ·
 * fix) instead of stacking, so a full audit reads as one table rather than a
 * column of paragraphs.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { geoCheckDefinition, type GeoAuditResult, type GeoCheckResult } from "@/lib/geo/audit";
import { recoverablePoints } from "@/lib/geo/fixQueue";
import { C, DISPLAY_FONT, SectionLabel, VERDICT_COLOR, VERDICT_LABEL } from "./geoUi";

function CheckRow({ check }: { check: GeoCheckResult }) {
  const def = geoCheckDefinition(check.id);
  const color = VERDICT_COLOR[check.verdict];
  const points = recoverablePoints(check);

  return (
    <Box
      sx={{
        display: "grid",
        columnGap: { sm: 2.5, xl: 3.5 },
        rowGap: 1,
        py: 1.75,
        borderTop: `1px solid ${C.hairline}`,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "minmax(170px, auto) minmax(0, 1fr)",
          xl: "minmax(190px, 230px) minmax(0, 1.25fr) minmax(0, 1fr)",
        },
        gridTemplateAreas: {
          xs: `"label" "measured" "fix"`,
          sm: `"label measured" "label fix"`,
          xl: `"label measured fix"`,
        },
        alignItems: "start",
      }}
    >
      <Box sx={{ gridArea: "label", display: "flex", alignItems: "flex-start", gap: 1.25 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, mt: 0.75, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
            {check.label}
          </Typography>
          <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.25 }}>
            {VERDICT_LABEL[check.verdict]} · {check.score}/100 · weight {check.weight}
          </Typography>
          {points > 0 && (
            <Typography sx={{ fontSize: 11, color, fontWeight: 700, mt: 0.25 }}>
              −{points.toFixed(1)} points of this piece&apos;s score
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ gridArea: "measured", minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
          <Typography sx={{ fontSize: 13, color: C.ink, lineHeight: 1.55 }}>{check.measured}</Typography>
          <Tooltip
            title={
              <Box sx={{ p: 0.5 }}>
                <Box sx={{ fontWeight: 700, mb: 0.5 }}>{def.question}</Box>
                <Box>{def.why}</Box>
              </Box>
            }
          >
            <InfoOutlinedIcon sx={{ fontSize: 14, color: C.muted, mt: 0.35, flexShrink: 0, cursor: "help" }} />
          </Tooltip>
        </Box>

        {check.evidence.length > 0 && (
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {check.evidence.map((e, i) => (
              <Typography
                key={`${check.id}-ev-${i}`}
                sx={{
                  fontSize: 11.5,
                  color: C.muted,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  border: `1px solid ${C.hairline}`,
                  borderRadius: "2px",
                  px: 0.875,
                  py: 0.375,
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                }}
              >
                {e}
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      {check.verdict !== "pass" && (
        <Box
          sx={{
            gridArea: "fix",
            minWidth: 0,
            px: 1.25,
            py: 1,
            borderLeft: `2px solid ${color}`,
            bgcolor: C.surface,
          }}
        >
          <SectionLabel sx={{ fontSize: 10, mb: 0.375 }}>Fix</SectionLabel>
          <Typography sx={{ fontSize: 12.5, color: C.ink, lineHeight: 1.55 }}>{check.fix}</Typography>
        </Box>
      )}
    </Box>
  );
}

export default function CheckResults({ audit, dense }: { audit: GeoAuditResult; dense?: boolean }) {
  return (
    <Box>
      {audit.tooShort && (
        <Typography sx={{ fontSize: 12.5, color: "#c77700", mb: 1, maxWidth: "78ch" }}>
          Only {audit.stats.words} words of body text — too little to judge reliably. The verdicts below
          describe exactly what was found, nothing is extrapolated.
        </Typography>
      )}
      {!dense && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(4, minmax(0, 1fr))",
              md: "repeat(8, minmax(0, 1fr))",
            },
            gap: 2,
            mb: 1.5,
          }}
        >
          {[
            { k: "Words", v: audit.stats.words },
            { k: "Paragraphs", v: audit.stats.paragraphs },
            { k: "Headings", v: audit.stats.headings },
            { k: "Quotable blocks", v: audit.stats.quotableBlocks },
            { k: "Walls", v: audit.stats.wallParagraphs },
            { k: "Figures w/ units", v: audit.stats.figuresWithUnits },
            { k: "Standards", v: audit.stats.standards },
            { k: "FAQ questions", v: audit.stats.faqQuestions },
          ].map((s) => (
            <Box key={s.k} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: 600, color: C.ink }}>
                {s.v}
              </Typography>
              <SectionLabel sx={{ fontSize: 10 }}>{s.k}</SectionLabel>
            </Box>
          ))}
        </Box>
      )}
      {audit.checks.map((c) => (
        <CheckRow key={c.id} check={c} />
      ))}
    </Box>
  );
}
