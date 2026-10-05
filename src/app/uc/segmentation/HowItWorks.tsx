"use client";

// HOW SMART SEGMENTATION WORKS - the logic as a picture: the potential with its
// multipliers, the priority, how a company is classified (creation workflow,
// industry, keywords, website, the yearly waterfall), when each part runs, and
// who wins when a person and the engine disagree. The tables are read from the
// engine's own rule lists, so the page cannot drift from what runs.

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddIcon from "@mui/icons-material/Add";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import FunctionsOutlinedIcon from "@mui/icons-material/FunctionsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { CardTitle, FAINT, GlassCard, HAIRLINE, INK, MUTED, TINT, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { GENERIC_DOMAINS, INDUSTRY_TO_APIC_CODE, KEYWORD_RULES, KEYWORD_TAGS } from "@/lib/segmentation/engine";
import { YEARLY_RULES } from "@/lib/segmentation/yearly";

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

function Pill({ strong, children }: { strong: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, px: 1.25, py: 0.6, borderRadius: "10px", bgcolor: "rgba(255,255,255,.75)", border: `1px solid ${HAIRLINE}` }}>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{strong}</Typography>
      <Typography sx={{ fontSize: "0.76rem", color: MUTED }}>{children}</Typography>
    </Box>
  );
}

function Sub({ n, title, note }: { n: string; title: string; note?: string }) {
  return (
    <Box sx={{ mt: 2.25, mb: 1 }}>
      <Typography sx={{ fontSize: "0.86rem", fontWeight: 700, color: INK }}>{n} · {title}</Typography>
      {note && <Typography sx={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5 }}>{note}</Typography>}
    </Box>
  );
}

/** The APIC product-fit multipliers, grouped (longest code prefix wins in the engine). */
const MULTIPLIERS: [string, string][] = [
  ["3.8", "wholesale & trading"], ["3.0", "pumps & valves"], ["2.5", "pharma, medical, chemicals"], ["2.2", "food"],
  ["2.0", "automotive, agriculture, aerospace, HVAC"], ["1.8", "machinery"], ["1.5", "processing & plastics, renewables, railway, shipbuilding"],
  ["1.4", "electronics, automation"], ["1.2", "construction, mining"], ["1.0", "everything else - research, no industry known"], ["0.8", "engineering"], ["0.7", "watch industry"],
];

const words = (s: string) => s.toLowerCase().replace(/_/g, " ");
const apicName = (code: string) => `${code}${KEYWORD_TAGS[code] ? ` ${KEYWORD_TAGS[code]}` : ""}`;

/** What each yearly rule turns a company into, as a tint. */
const SEGMENT_TINT: Record<string, Tint> = {
  erp: "slate", ghost: "slate", micro: "purple", lost: "pink", churned: "green", new: "blue", growth: "green", core: "green",
  budget: "green", small: "amber", engaged_budget: "amber", engaged: "green", dead: "slate", default: "blue",
};

function Lane({ icon, tint, title, when, steps }: { icon: React.ReactNode; tint: Tint; title: string; when: string; steps: { title: string; text: React.ReactNode }[] }) {
  const t = TINT[tint];
  return (
    <Box sx={{ minWidth: 0, borderRadius: "16px", border: `1px solid ${HAIRLINE}`, bgcolor: "rgba(255,255,255,.6)", p: 1.75 }}>
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
          {MULTIPLIERS.map(([m, what]) => <Pill key={m} strong={`×${m}`}>{what}</Pill>)}
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
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.5 }}>
          <Pill strong="Nightly">only raises a priority, never lowers it</Pill>
          <Pill strong="A person changes the potential">the priority follows at once - up or down</Pill>
          <Pill strong="Once a year">every priority set exactly to the rule - up or down</Pill>
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<CategoryOutlinedIcon />} tint="purple" title="3 · How a company is classified"
          note="APSO segment, APIC code, industry and keyword tag - five sources. The first four only fill what is empty; the yearly run decides the segment again" />

        <Sub n="a" title="At creation, in HubSpot (the COMPANYSEG workflow)" note="The moment a company is created, before the hub sees it" />
        <Box sx={flow}>
          <Node tint="purple" strong title="APSOmicro">The domain is a free mail address ({GENERIC_DOMAINS.size} domains: gmail, bluewin, gmx, outlook …) or it has 1–5 employees</Node>
          <Node tint="blue" strong title="APSOprospect">Every other new company</Node>
          <Node tint="slate" strong title="APIC from its industry">When the APIC is empty and the industry is one of the pairs below</Node>
        </Box>

        <Sub n="b" title="Industry → APIC" note={`${Object.keys(INDUSTRY_TO_APIC_CODE).length} pairs - an empty APIC is filled from the industry`} />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {Object.entries(INDUSTRY_TO_APIC_CODE).map(([ind, code]) => <Pill key={ind} strong={code}>{words(ind)}</Pill>)}
        </Box>

        <Sub n="c" title="Keywords in the name and description"
          note={`${KEYWORD_RULES.length} rules in German, French, Italian and English, the specific ones first - the first that fits gives the APIC, the industry and a keyword tag, each only where empty`} />
        <Box sx={{ overflowX: "auto", border: `1px solid ${HAIRLINE}`, borderRadius: "12px", bgcolor: "rgba(255,255,255,.6)" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCell, width: 36 }}>#</TableCell>
                <TableCell sx={headCell}>The name or description contains</TableCell>
                <TableCell sx={headCell}>APIC</TableCell>
                <TableCell sx={headCell}>Industry</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {KEYWORD_RULES.map(([pats, code, ind], i) => (
                <TableRow key={pats.join()} hover>
                  <TableCell sx={{ ...bodyCell, color: MUTED, fontSize: "0.78rem" }}>{i + 1}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: INK }}>{pats.map((p) => p.trim()).join(" · ")}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{apicName(code)}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: MUTED }}>{ind ? words(ind) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Sub n="d" title="Its own website" note="When the company has a real domain (not a free mail one) - each site at most once per 30 days" />
        <Box sx={flow}>
          <Node title="Description">The site&apos;s meta description or its schema.org text</Node>
          <Node title="Size and address">Employees, city, postcode and country from schema.org - the country falls back to the domain ending (.ch → Switzerland)</Node>
          <Node title="APIC and industry">The page text runs through the same keyword rules as above</Node>
        </Box>

        <Sub n="e" title="Once a year: the APSO segment decided again"
          note="Every company runs down this list in January; the first rule that fits decides. APIC and industry are made to agree first: a generic 1.1 is corrected from the industry (pharma → 1.9 …) or cleared when the industry is law, banking, insurance …; resellers (3.x) never change; an empty industry is filled from the APIC" />
        <Box sx={{ display: "grid", gap: 0.6 }}>
          {YEARLY_RULES.map((r, i) => {
            const t = TINT[SEGMENT_TINT[r.key] ?? "slate"];
            return (
              <Box key={r.key} sx={{ display: "grid", gridTemplateColumns: { xs: "28px minmax(0,1fr)", md: "28px 230px minmax(0,1fr)" }, gap: 1.25, alignItems: "center", px: 1.25, py: 0.75, borderRadius: "10px", bgcolor: "rgba(255,255,255,.7)", border: `1px solid ${HAIRLINE}` }}>
                <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: FAINT, fontVariantNumeric: "tabular-nums" }}>{i + 1}</Typography>
                <Box sx={{ justifySelf: "start", px: 1, py: 0.25, borderRadius: "8px", bgcolor: t.bg, color: t.fg, fontSize: "0.76rem", fontWeight: 700 }}>{r.segment}</Box>
                <Typography sx={{ fontSize: "0.8rem", color: MUTED, gridColumn: { xs: "2", md: "auto" } }}>{r.text}</Typography>
              </Box>
            );
          })}
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<BoltOutlinedIcon />} tint="green" title="When it runs" note="Four moments - each one keeps the classification and the priority in step with the potential and the revenue" />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
          <Lane icon={<BoltOutlinedIcon />} tint="blue" title="Watcher" when="every 2 minutes" steps={[
            { title: "A new company appears", text: "3 minutes to 48 hours after it was created, still missing a priority or a potential" },
            { title: "Classified", text: "APIC from its industry (3b) · otherwise the keywords in its name and description (3c) · a keyword tag when empty" },
            { title: "Its website, if switched on", text: "8 sites per pass: description, size, address, and the site's text through the same keywords (3d)" },
            { title: "APSOlost that buys again", text: "becomes APSOcore (≥ 500 € this year) or APSOprospect" },
            { title: "A starter potential, only if empty", text: "revenue × multiplier when it has revenue · otherwise 300 € micro, 500–800 € by product fit" },
            { title: "Its priority", text: "from the rule in step 2 - filled or raised" },
            { title: "A person changes a potential", text: "checked every 2 minutes: the priority follows at once - up or down" },
          ]} />
          <Lane icon={<NightsStayOutlinedIcon />} tint="purple" title="Nightly" when="after the Compass load" steps={[
            { title: "1 · Potential recalculation", text: "only the engine's own values, raise-only; a person's number is never touched (one we overwrote is put back)" },
            { title: "2 · Full sweep - all companies", text: "fills an empty priority, raises (never lowers), refreshes the helper fields, classifies what is still empty, recovers APSOlost that bought this year" },
            { title: "3 · Website reading", text: "200 sites: description, size, address - empty fields only, each site once per 30 days" },
          ]} />
          <Lane icon={<EventRepeatOutlinedIcon />} tint="amber" title="Once a year" when="January, by hand after a preview" steps={[
            { title: "1 · Preview", text: "nothing written - an Excel of every company that would change, with its rule and reason" },
            { title: "2 · APIC and industry agree", text: "generic 1.1 corrected or cleared from the industry, empty industry filled (3e)" },
            { title: "3 · APSO segment decided again", text: "the 14 rules of 3e - prospects become core, growth, micro, lost or no sales focus" },
            { title: "4 · Priority exactly to the rule", text: "up or down - the only run that lowers a priority" },
            { title: "Never", text: "a potential, an ERP segment (ESO, DS, Growth Engine), a reseller APIC" },
          ]} />
          <Lane icon={<TouchAppOutlinedIcon />} tint="slate" title="By hand" when="admins, on the Runs tab" steps={[
            { title: "Preview first", text: "every run shows what it would change - nothing written" },
            { title: "Then run", text: "segment new companies · full sweep · website batch · recalculation · yearly reclassification" },
          ]} />
        </Box>
      </GlassCard>

      <GlassCard>
        <CardTitle icon={<ShieldOutlinedIcon />} tint="amber" title="Who wins" note="When a person and the engine disagree" />
        <Box sx={flow}>
          <Node tint="blue" strong title="A person sets the potential">Visit workflow, typed in HubSpot, a bulk edit</Node>
          <Arrow />
          <Node title="It is never overwritten">The recalculation skips it, and the yearly run reads it but never writes it</Node>
          <Arrow />
          <Node tint="green" strong title="The priority follows it">Within two minutes - up or down. Measured on the Potential changes tab</Node>
        </Box>
        <Box sx={{ ...flow, mt: 1.25 }}>
          <Node tint="slate" strong title="The engine's own values">Starter potentials and recalculated ones</Node>
          <Arrow />
          <Node title="Filled when empty, raised when the rule says more">Never lowered - a value above the rule is kept</Node>
        </Box>
      </GlassCard>
    </Box>
  );
}
