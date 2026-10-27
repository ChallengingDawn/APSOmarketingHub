"use client";

// APSOassistant Chat - the topic tabs (SARCLA 26-27.10.2026: "really steering tabs with the different topics";
// "follow the enquiry category really and the sub-categories"). One tab per Enquiry Category: what its chats did in the
// period, and the route its hand-overs take when the AI cannot solve them - for the topic and for each sub-category,
// changed here by an admin (rules: src/lib/chat/steeringRules.ts, kept in the hub: src/lib/chat/steering.ts). The
// chat does not use these routes until a topic is switched live; until then each tab shows what they would change.

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AltRouteOutlinedIcon from "@mui/icons-material/AltRouteOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import { full } from "@/app/charts/format";
import { Chip, Choice } from "@/app/connectors/parts";
import { CardTitle, GREEN, GlassCard, HsLink, INK, KpiTile, MUTED, Notice, bodyCell, headCell, type Tint } from "@/app/uc/report/ui";
import { ROUTE_LABEL, STEERING_TOPICS, type Route, type Steering, type SubRule } from "@/lib/chat/steeringRules";
import type { SteeringData, TopicFigures } from "@/lib/chat/steering";
import { pct, pill, post, when } from "./shared";

export type SteeringPage = SteeringData & { isAdmin: boolean };
const TINT: Record<Route, Tint> = { tsa: "green", bo: "blue", ecom: "purple" };
const SAYS: Record<Route, string> = {
  tsa: "Sales: an available TSA person takes the chat at once (Mon-Fri 08:00-17:00); otherwise the ticket waits in the TSA stage for someone to take it.",
  bo: "Not sales: the Back Office - stage CHAT/C2S Issue, the account's ERP sales agent (else the SA Sub, else the least busy) calls the customer within the hour; an older ticket on the same order is merged into the chat's.",
  ecom: "A shop bug: the E-Commerce team, as the chat's workflow does today.",
};
const ROUTES: { key: Route; label: string }[] = [{ key: "tsa", label: "TSA" }, { key: "bo", label: "Back Office" }, { key: "ecom", label: "E-Commerce" }];
export const RouteChip = ({ r }: { r: Route | null }) => (r ? <Chip tint={TINT[r]}>{ROUTE_LABEL[r]}</Chip> : <Chip tint="slate">AI keeps it</Chip>);

/** Save the routes (admins): the whole steering, checked on the server against HubSpot's options. */
function useSave(onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (s: Pick<Steering, "topics" | "orderNumberToBo">, what: string) => {
    if (!confirm(`Save ${what}?\n\nThe chat does not use these routes until a topic is switched live - the page shows what they would change.`)) return;
    setBusy(true); setMsg(null);
    const r = await post<Steering>({ action: "steering-save", steering: s });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) onSaved();
  };
  return { busy, msg, save };
}

/* ── one topic ───────────────────────────────────────────────────────────────────────────────────── */

export function TopicTab({ d, topic, label, reload }: { d: SteeringPage; topic: string; label: string; reload: () => void }) {
  const f = d.topics.find((t) => t.topic === topic)!;
  const handed = f.tsa + f.bo;
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<ForumOutlinedIcon />} tint="purple" label="Chats" value={full(f.chats)} note={`${label} - filed by the hub from the whole chat`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SmartToyOutlinedIcon />} tint="slate" label="Solved by the AI alone" value={pct(f.aiAlone, f.chats)} note={`${full(f.aiAlone)} of ${full(f.chats)} chats`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<SupportAgentOutlinedIcon />} tint="green" label="Handed to a person" value={full(handed)} note={`TSA ${full(f.tsa)} · Back Office ${full(f.bo)} - where the chat sent them`} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><KpiTile icon={<PendingActionsOutlinedIcon />} tint="amber" label="Still open" value={d.openRead ? full(f.openTotal) : "—"} note={d.openRead ? "hand-overs whose ticket is open in HubSpot now" : "HubSpot could not be read just now"} /></Grid>
      </Grid>
      <RouteCard key={`${topic}-${d.steering.version}`} d={d} f={f} reload={reload} />
      <OpenCard f={f} />
    </>
  );
}

function RouteCard({ d, f, reload }: { d: SteeringPage; f: TopicFigures; reload: () => void }) {
  const saved = d.steering.topics[f.topic];
  const [route, setRoute] = useState<Route>(saved.route);
  const [subs, setSubs] = useState<SubRule[]>(saved.subs);
  const [addLevel2, setAddLevel2] = useState("");
  const { busy, msg, save } = useSave(reload);
  const dirty = route !== saved.route || JSON.stringify(subs) !== JSON.stringify(saved.subs);
  const live = !!d.steering.live[f.topic];
  const handed = f.tsa + f.bo;
  const ruleOf = (level: 1 | 2, value: string) => subs.find((x) => x.level === level && x.value === value);
  const setRule = (level: 1 | 2, value: string, r: Route | "same") => setSubs((list) => {
    const rest = list.filter((x) => !(x.level === level && x.value === value));
    return r === "same" ? rest : [...rest, { level, value, route: r }];
  });
  // E-Commerce is the shop bug's team: offered on Website Issue (or where it is already set), not on every row
  const routes = f.topic === "Website Issue" || route === "ecom" || subs.some((x) => x.route === "ecom") ? ROUTES : ROUTES.filter((x) => x.key !== "ecom");
  const opts = d.options[f.topic] ?? { sub1: [], sub2: [] };
  const fig = (level: 1 | 2, value: string) => f.subs.find((x) => x.level === level && x.value === value);
  // level 2: the ones with a rule, then the ones that had chats - the rest can be added
  const level2 = opts.sub2.filter((v) => ruleOf(2, v));
  const addable = opts.sub2.filter((v) => !ruleOf(2, v));
  const rows: { level: 1 | 2; value: string }[] = [...opts.sub1.map((value) => ({ level: 1 as const, value })), ...level2.map((value) => ({ level: 2 as const, value }))];
  return (
    <GlassCard sx={{ display: "grid", gap: 1.25 }}>
      <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="When the AI cannot solve it"
        note="The AI always tries first. Only when a person is needed does this route apply - the topic's, unless its sub-category has its own." />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {live ? <Chip tint="green">The chat uses these routes</Chip> : <Chip tint="amber">Trial - the chat does not use these routes yet</Chip>}
        {handed > 0 && <Typography sx={{ fontSize: "0.8rem", color: f.elsewhere ? INK : MUTED }}>
          {f.elsewhere ? `${full(f.elsewhere)} of the ${full(handed)} hand-overs of the period would have gone to another team with these routes.` : `All ${full(handed)} hand-overs of the period went where these routes send them.`}
        </Typography>}
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.topic}</Typography>
        {d.isAdmin ? <Choice<Route> value={route} onChange={setRoute} options={routes} /> : <Box><RouteChip r={route} /></Box>}
        <Typography sx={{ fontSize: "0.8rem", color: MUTED }}>{SAYS[route]}</Typography>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead><TableRow>
            {["Sub-category", "Chats", "AI alone", "Handed (TSA · Back Office)", "Route"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i > 0 && i < 4 ? "right" : "left" }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {rows.map(({ level, value }) => {
              const x = fig(level, value);
              const rule = ruleOf(level, value);
              const eff: Route = rule?.route ?? route;
              return (
                <TableRow key={`${level}:${value}`}>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", color: INK, pl: level === 2 ? 3 : undefined }}>
                    {level === 2 ? <span style={{ color: MUTED }}>↳ </span> : null}{value}
                  </TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{x?.chats ? full(x.chats) : "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{x?.chats ? pct(x.aiAlone, x.chats) : "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{x && x.tsa + x.bo ? `${full(x.tsa)} · ${full(x.bo)}` : "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, minWidth: routes.length > 2 ? 400 : 300 }}>
                    {d.isAdmin
                      ? <Choice<Route | "same"> value={rule?.route ?? "same"} onChange={(r) => setRule(level, value, r)} options={[{ key: "same", label: "As the topic" }, ...routes]} />
                      : rule ? <RouteChip r={eff} /> : <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>as the topic</Typography>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
      {d.isAdmin && addable.length > 0 && (
        <TextField select size="small" label="Own route for a detail (sub-category 2)" value={addLevel2}
          onChange={(e) => { const v = e.target.value; setAddLevel2(""); if (v) setRule(2, v, route === "tsa" ? "bo" : "tsa"); }}
          sx={{ maxWidth: 520, "& .MuiInputBase-input": { fontSize: "0.82rem" } }}>
          {addable.map((v) => <MenuItem key={v} value={v} sx={{ fontSize: "0.82rem" }}>{v}{fig(2, v)?.chats ? ` · ${full(fig(2, v)!.chats)} chats` : ""}</MenuItem>)}
        </TextField>
      )}
      {d.isAdmin && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button size="small" variant="contained" disableElevation sx={pill} disabled={!dirty || busy}
            onClick={() => void save({ orderNumberToBo: d.steering.orderNumberToBo, topics: { ...d.steering.topics, [f.topic]: { route, subs } } }, `the routes of ${f.topic}`)}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>
            {busy ? "Saving…" : "Save the routes"}
          </Button>
          {dirty && <Button size="small" sx={pill} disabled={busy} onClick={() => { setRoute(saved.route); setSubs(saved.subs); }}>Undo</Button>}
          {d.steering.at && <Typography sx={{ fontSize: "0.74rem", color: MUTED }} title={`version ${d.steering.version}`}>Last change {when(d.steering.at)}{d.steering.by ? ` by ${d.steering.by}` : ""}</Typography>}
          {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
        </Box>
      )}
    </GlassCard>
  );
}

function OpenCard({ f }: { f: TopicFigures }) {
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<PendingActionsOutlinedIcon />} tint="amber" title={`Open hand-overs: ${full(f.openTotal)}`}
        note="Chats of this topic handed to a person whose ticket is still open in HubSpot, newest first" />
      {!f.open.length ? (
        <Typography sx={{ fontSize: "0.84rem", color: MUTED }}>None open in this period.</Typography>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead><TableRow>
              {["", "What the customer wanted", "Handed over", "Where it is", "Owner", "Sent to → with the routes"].map((h, i) => <TableCell key={i} sx={headCell}>{h}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {f.open.map((o) => (
                <TableRow key={o.ticketId}>
                  <TableCell sx={{ ...bodyCell, width: 36 }}><HsLink id={o.ticketId} /></TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", color: INK, maxWidth: 360 }}>{o.summary || "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem", whiteSpace: "nowrap" }}>{o.handedAt ? when(o.handedAt) : "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.78rem", color: MUTED }}>{o.stage ?? "–"}</TableCell>
                  <TableCell sx={{ ...bodyCell, fontSize: "0.8rem" }}>{o.owner ?? <span style={{ color: MUTED }}>nobody</span>}</TableCell>
                  <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><RouteChip r={o.today} /> → <RouteChip r={o.steering} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {f.openTotal > f.open.length && <Typography sx={{ fontSize: "0.72rem", color: MUTED, mt: 0.75 }}>{full(f.openTotal - f.open.length)} more open - the 50 newest are listed.</Typography>}
        </Box>
      )}
    </GlassCard>
  );
}

/* ── the Overview's summary ──────────────────────────────────────────────────────────────────────── */

export function RoutesCard({ d, onOpen, reload }: { d: SteeringPage; onOpen: (topic: string) => void; reload: () => void }) {
  const { busy, msg, save } = useSave(reload);
  const rows = useMemo(() => STEERING_TOPICS.map((t) => ({ t, f: d.topics.find((x) => x.topic === t)!, s: d.steering.topics[t] })), [d]);
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<AltRouteOutlinedIcon />} tint="blue" title="Routes by topic"
        note="When the AI cannot solve a chat: where each Enquiry Category goes. Click a topic to see it and change its routes." />
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 820 }}>
          <TableHead><TableRow>
            {["Topic", "Route", "Chats", "AI alone", "Handed (TSA · Back Office)", "Open", "Would go elsewhere"].map((h, i) => <TableCell key={h} sx={{ ...headCell, textAlign: i >= 2 ? "right" : "left" }}>{h}</TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {rows.map(({ t, f, s }) => (
              <TableRow key={t} hover onClick={() => onOpen(t)} sx={{ cursor: "pointer" }}>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", fontWeight: 600, color: INK }}>{t}</TableCell>
                <TableCell sx={{ ...bodyCell, whiteSpace: "nowrap" }}><RouteChip r={s.route} />{s.subs.length ? <span style={{ fontSize: "0.74rem", color: MUTED }}> +{s.subs.length} by sub-category</span> : null}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.84rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{full(f.chats)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{pct(f.aiAlone, f.chats)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{full(f.tsa)} · {full(f.bo)}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{d.openRead ? full(f.openTotal) : "—"}</TableCell>
                <TableCell sx={{ ...bodyCell, fontSize: "0.82rem", textAlign: "right" }}>{f.tsa + f.bo ? full(f.elsewhere) : "–"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {STEERING_TOPICS.some((t) => d.steering.live[t])
          ? <Chip tint="green">The chat uses the routes of {STEERING_TOPICS.filter((t) => d.steering.live[t]).join(", ")}</Chip>
          : <Chip tint="amber">Trial - the chat does not use these routes yet</Chip>}
      </Box>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Switch size="small" checked={d.steering.orderNumberToBo} disabled={!d.isAdmin || busy} slotProps={{ input: { "aria-label": "An order number always goes to the Back Office" } }}
          onChange={(e) => void save({ topics: d.steering.topics, orderNumberToBo: e.target.checked }, `"an order number always goes to the Back Office" ${e.target.checked ? "ON" : "OFF"}`)} />
        <Typography sx={{ fontSize: "0.82rem", color: INK }}>An order number in the chat always goes to the Back Office, whatever the topic</Typography>
        {d.noRequest > 0 && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>· {full(d.noRequest)} chats asked nothing at all - the AI keeps those</Typography>}
        {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
      </Box>
    </GlassCard>
  );
}
