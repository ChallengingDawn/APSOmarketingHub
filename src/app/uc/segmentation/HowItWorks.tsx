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

/** The APIC product-fit multipliers, grouped (longest code prefix wins in the engine). */
const MULTIPLIERS: [string, string][] = [
  ["3.8", "wholesale & trading"], ["3.0", "pumps & valves"], ["2.5", "pharma, medical, chemicals"], ["2.2", "food"],
  ["2.0", "automotive, agriculture, aerospace, HVAC"], ["1.8", "machinery"], ["1.5", "processing & plastics, renewables, railway, shipbuilding"],
  ["1.4", "electronics, automation"], ["1.2", "construction, mining"], ["1.0", "everything else - research, no industry known"], ["0.8", "engineering"], ["0.7", "watch industry"],
];

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
        <CardTitle icon={<FunctionsOutlinedIcon />} title="1 · The yearly potential" note="Where each company's yearly potential comes from - three ways, and a person's number always wins" />
        <Box sx={flow}>
          <Node tint="blue" strong title="A person enters it">In a visit report or in HubSpot. Kept exactly as entered - the engine never changes it.</Node>
          <Node tint="green" strong title="It is empty: a starter value">
            With revenue: the average of the last three years × the product-fit multiplier - at least 1.3 × the best year ever, at most 1 M €.
            {" "}Without revenue: 300 € for a micro customer, otherwise 500 €, 600 € (multiplier ≥ 1.5) or 800 € (≥ 2.0).
          </Node>
          <Node tint="purple" strong title="The engine set it: recalculated every night">
            The same sum: last three years&apos; average × multiplier, at least 1.3 × the best year, at most 1 M € - and at most +40 % on the current value at a time.
            {" "}Only ever raised; a change under 10 % is left alone.
          </Node>
        </Box>
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: INK, mt: 2, mb: 0.75 }}>Product-fit multipliers (from the APIC industry code)</Typography>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {MULTIPLIERS.map(([m, what]) => (
            <Box key={m} sx={{ display: "flex", alignItems: "baseline", gap: 0.75, px: 1.25, py: 0.6, borderRadius: "10px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}` }}>
              <Typography sx={{ fontSize: "0.86rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>×{m}</Typography>
              <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{what}</Typography>
            </Box>
          ))}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<FunctionsOutlinedIcon />} tint="amber" title="2 · The priority" note="From the potential and the revenue - the same rule wherever the priority is set" />
        <Box sx={flow}>
          <Node tint="blue" strong title="Yearly potential">From step 1</Node>
          <Arrow plus />
          <Node tint="green" strong title="Best revenue year">The highest revenue of any year since 2015 - from Compass, every night</Node>
          <Arrow />
          <Node tint="purple" strong title="Basis = the higher of the two">A potential over 1 M € and 20× the best year is a typo - left out, never changed</Node>
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
