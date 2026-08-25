"use client";

/**
 * Renders the seven check results. A score with no explanation is useless, so
 * every row carries: what was asked, what was measured, and the exact edit that
 * would raise it — plus the verbatim evidence the measurement came from.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { geoCheckDefinition, type GeoAuditResult, type GeoCheckResult } from "@/lib/geo/audit";
import { C, DISPLAY_FONT, SectionLabel, VERDICT_COLOR, VERDICT_LABEL } from "./geoUi";

function CheckRow({ check }: { check: GeoCheckResult }) {
  const def = geoCheckDefinition(check.id);
  const color = VERDICT_COLOR[check.verdict];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" },
        gap: { xs: 1, sm: 2 },
        py: 1.75,
        borderTop: `1px solid ${C.hairline}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: { sm: 150 } }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, mt: 0.75, flexShrink: 0 }} />
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>
            {check.label}
          </Typography>
          <Typography sx={{ fontSize: 11, color: C.muted, mt: 0.25 }}>
            {VERDICT_LABEL[check.verdict]} · {check.score}/100 · weight {check.weight}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
          <Typography sx={{ fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{check.measured}</Typography>
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

        {check.verdict !== "pass" && (
          <Box
            sx={{
              mt: 1,
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
    </Box>
  );
}

export default function CheckResults({ audit, dense }: { audit: GeoAuditResult; dense?: boolean }) {
  return (
    <Box>
      {audit.tooShort && (
        <Typography sx={{ fontSize: 12.5, color: "#c77700", mb: 1 }}>
          Only {audit.stats.words} words of body text — too little to judge reliably. The verdicts below
          describe exactly what was found, nothing is extrapolated.
        </Typography>
      )}
      {!dense && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 1.5 }}>
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
            <Box key={s.k}>
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
