// WHICH AP-LINK THE 3D FILES COME FROM (SARCLA, 06.11.2026: "put the switch on settings on the HUB
// itself"). That morning production AP-Link refused the gateway's login and every download failed;
// the test system - a copy of production, some files older - served them. The gateway holds both
// logins and switches in memory; it starts on its PLM_TARGET variable. The hub keeps the choice and,
// at every collection, sets it again if the gateway restarted on the other system.

import { kvGet, kvSet } from "@/lib/db/init";
import { isSandbox } from "@/lib/sandbox/mode";
import { gw, gwPost, saveStatus, type AplinkTarget, type GatewayStatus } from "./gwApi";

const KV = "threeD:aplink-target";

export type AplinkSetting = { target: AplinkTarget; by: string; at: string };

export async function aplinkSetting(): Promise<AplinkSetting | null> {
  return (await kvGet<AplinkSetting>(KV).catch(() => null)) ?? null;
}

/** The gateway's status, read now; refresh=1 makes it ask both systems again. */
export async function liveStatus(refresh = false): Promise<GatewayStatus> {
  return gw<GatewayStatus>(`/status${refresh ? "?refresh=1" : ""}`);
}

/** Switch the gateway, then remember the choice. The gateway refuses a system it holds no login for. */
export async function switchAplink(target: AplinkTarget, by: string): Promise<{ setting: AplinkSetting; status: GatewayStatus }> {
  await gwPost<{ ok: boolean }>("/aplink", { target, by });
  const setting = { target, by, at: new Date().toISOString() };
  await kvSet(KV, setting);
  const status = await liveStatus();
  await saveStatus(status).catch(() => {});
  return { setting, status };
}

/** After a collection: a gateway that restarted on the other system is set back to the hub's choice. */
export async function keepAplink(status: GatewayStatus | null): Promise<void> {
  const now = status?.aplink?.target;
  if (!now || isSandbox()) return;
  const s = await aplinkSetting();
  if (!s || s.target === now) return;
  await gwPost("/aplink", { target: s.target, by: `${s.by} (set again by the hub)` });
  console.log(`[3d] the 3D Gateway was on ${now} AP-Link - set back to ${s.target}, as ${s.by} chose`);
}
