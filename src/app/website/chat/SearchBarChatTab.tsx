"use client";

// APSOassistant Chat > Search bar chat (SARCLA 18.10.2026: "integrate here the search bar chat with toggles"). The
// search bar's AI assistant is APSOassistant too, so its conversations sit beside the HubSpot chat's: the switch for
// its button on the bar (the same one as Search bar > Setup, the gateway's widget config), and its conversations
// (Search bar > AI chat, read from the smart-bar gateway). Nothing new is stored; both pages change the same switch.

import { useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import SmartButtonOutlinedIcon from "@mui/icons-material/SmartButtonOutlined";
import { Chip } from "@/app/connectors/parts";
import { CardTitle, GlassCard, GREEN, MUTED, Notice } from "@/app/uc/report/ui";
import type { Switches } from "@/lib/searchbar/gateway";
import { Loaded, post } from "@/app/website/search-bar/shared";
import AiTab from "@/app/website/search-bar/AiTab";

type Setup = { switches: Switches; isAdmin: boolean };

export default function SearchBarChatTab() {
  return (
    <>
      <Loaded<Setup> url="/api/website/search-bar?part=setup" what="the bar's switches">
        {(s, reload) => <ButtonSwitch s={s} reload={reload} />}
      </Loaded>
      <AiTab />
    </>
  );
}

function ButtonSwitch({ s, reload }: { s: Setup; reload: () => void }) {
  const on = s.switches.buttons.ai;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flip = async (next: boolean) => {
    if (!next && !confirm("Hide the AI button on the search bar?\n\nCustomers can no longer open APSOassistant from the bar; the bar's search itself stays.")) return;
    setBusy(true); setMsg(null);
    const r = await post({ action: "buttons", ai: next });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: next ? "The AI button is on the bar." : "The AI button is hidden." } : { ok: false, text: r.error ?? "Did not work." });
    if (r.ok) reload();
  };
  return (
    <GlassCard sx={{ display: "grid", gap: 1 }}>
      <CardTitle icon={<SmartButtonOutlinedIcon />} tint={on ? "green" : "slate"} title="APSOassistant on the search bar"
        note="The AI button at the right of the shop's search bar opens APSOassistant. The same switch as Search bar > Setup."
        right={
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {busy && <CircularProgress size={14} />}
            <Chip tint={on ? "green" : "slate"}>{on ? "On the bar" : "Hidden"}</Chip>
            <Switch checked={on} disabled={!s.isAdmin || busy || s.switches.killSwitch} onChange={(e) => void flip(e.target.checked)}
              slotProps={{ input: { "aria-label": "AI button on the search bar" } }} />
          </Box>
        } />
      {s.switches.killSwitch && <Notice tone="warn">The whole search bar is switched off (Search bar &gt; Setup), so the AI button is not on the shop either.</Notice>}
      {!s.isAdmin && <Typography sx={{ fontSize: "0.78rem", color: MUTED }}>Only an admin can switch it.</Typography>}
      {msg && (msg.ok ? <Typography sx={{ fontSize: "0.8rem", color: GREEN }}>{msg.text}</Typography> : <Notice tone="bad">{msg.text}</Notice>)}
    </GlassCard>
  );
}
