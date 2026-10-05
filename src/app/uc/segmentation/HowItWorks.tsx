"use client";

// HOW SMART SEGMENTATION WORKS - the logic as a picture: the formula, when each
// part runs, and who wins when a person and the engine disagree.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddIcon from "@mui/icons-material/Add";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import FunctionsOutlinedIcon from "@mui/icons-material/FunctionsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, type Tint } from "@/app/uc/report/ui";

function Node({ tint = "slate", title, children, strong }: { tint?: Tint; title: string; children?: React.ReactNode; strong?: boolean }) {
  const t = TINT[tint];
  return (
    <Box sx={{
      flex: "1 1 0", minWidth: 0, borderRadius: "14px", p: 1.5,
      bgcolor: strong ? t.bg : "rgba(255,255,255,.75)", border: `1px solid ${strong ? t.fg + "33" : HAIRLINE}`,
    }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: strong ? t.fg : INK, mb: children ? 0.5 : 0 }}>{title}</Typography>
      {children && <Typography component="div" sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{children}</Typography>}
    </Box>
  );
}

function Arrow({ down = false, plus = false }: { down?: boolean; plus?: boolean }) {
  const Icon = plus ? AddIcon : down ? ArrowDownwardIcon : ArrowForwardIcon;
  return (
    <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, color: FAINT, px: { xs: 0, md: 0.25 }, py: { xs: 0.25, md: 0 } }}>
      <Icon sx={{ fontSize: 20, transform: { xs: plus ? "none" : "rotate(90deg)", md: "none" } }} />
    </Box>
  );
}

const flow = { display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "stretch", gap: 1 } as const;

function Lane({ icon, tint, title, when, steps }: { icon: React.ReactNode; tint: Tint; title: string; when: string; steps: { title: string; text: React.ReactNode }[] }) {
  const t = TINT[tint];
  return (
    <Box sx={{ flex: "1 1 0", minWidth: 0, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", p: 1.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", bgcolor: t.bg, color: t.fg, "& svg": { fontSize: 18 } }}>{icon}</Box>
        <Box>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: INK, lineHeight: 1.2 }}>{title}</Typography>
          <Typography sx={{ fontSize: "0.74rem", color: MUTED }}>{when}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.75 }}>
        {steps.map((s, i) => (
          <Box key={s.title}>
            {i > 0 && <Box sx={{ display: "grid", placeItems: "center", color: FAINT, my: -0.25 }}><ArrowDownwardIcon sx={{ fontSize: 16 }} /></Box>}
            <Node title={s.title}>{s.text}</Node>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function HowItWorks() {
  return (
    <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
      <GlassCard>
        <CardTitle icon={<FunctionsOutlinedIcon />} title="The formula" note="The CEO formula - the same everywhere the priority is computed" />
        <Box sx={flow}>
          <Node tint="blue" strong title="Yearly potential">A person&apos;s number (visit report, typed, bulk) - or the engine&apos;s starter / recalculated value</Node>
          <Arrow plus />
          <Node tint="green" strong title="Best revenue year">The highest revenue of any year since 2015 - from Compass, every night</Node>
          <Arrow />
          <Node tint="purple" strong title="Basis = the higher of the two">A potential over 1 M € and 20× the best year is a typo - left out of the maths, never changed</Node>
          <Arrow />
          <Node tint="amber" strong title="Priority">P1 ≥ 25,000 € · P2 ≥ 2,500 € · P3 ≥ 500 € · below: no priority</Node>
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<BoltOutlinedIcon />} tint="green" title="When it runs" note="Three moments - each one keeps the priority in step with the potential and the revenue" />
        <Box sx={{ ...flow, gap: 1.5 }}>
          <Lane icon={<BoltOutlinedIcon />} tint="blue" title="Watcher" when="every 2 minutes" steps={[
            { title: "A new company appears", text: "3 minutes to 48 hours after it was created" },
            { title: "Industry and APIC from its name", text: "when empty - DE / FR / IT / EN keywords" },
            { title: "A starter potential, only if empty", text: "300 € micro · 500–800 € by product fit · revenue × multiplier when it has revenue" },
            { title: "Its priority", text: "from the formula above" },
            { title: "A person changes a potential", text: "the priority follows at once - up or down" },
          ]} />
          <Lane icon={<NightsStayOutlinedIcon />} tint="purple" title="Nightly" when="after the Compass load" steps={[
            { title: "1 · Potential recalculation", text: "only the engine's own values, raise-only; a person's number is never touched (one we overwrote is put back)" },
            { title: "2 · Full sweep - all companies", text: "fills an empty priority, upgrades (never downgrades), refreshes the facts, recovers APSOlost that bought this year" },
            { title: "3 · Website reading", text: "200 sites: description, size, address - empty fields only, each site once per 30 days" },
          ]} />
          <Lane icon={<TouchAppOutlinedIcon />} tint="amber" title="By hand" when="admins, on the Runs tab" steps={[
            { title: "Preview first", text: "every run shows what it would change - nothing written" },
            { title: "Then run", text: "segment new companies · full sweep · website batch · recalculation" },
          ]} />
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<ShieldOutlinedIcon />} tint="amber" title="Who wins" note="When a person and the engine disagree" />
        <Box sx={flow}>
          <Node tint="blue" strong title="A person sets the potential">Visit report, typed in HubSpot, a bulk edit</Node>
          <Arrow />
          <Node title="It is never overwritten">The recalculation skips it; the sweep never lowers a priority it set</Node>
          <Arrow />
          <Node tint="green" strong title="The priority follows it">Within two minutes - up or down. Measured on the Potential changes tab</Node>
        </Box>
        <Box sx={{ ...flow, mt: 1.25 }}>
          <Node tint="slate" strong title="The engine's own values">Starter potentials and recalculated ones</Node>
          <Arrow />
          <Node title="Filled when empty, raised when the formula says more">Never lowered - a value above the formula is kept</Node>
        </Box>
      </GlassCard>
    </Box>
  );
}
