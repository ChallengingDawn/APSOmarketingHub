"use client";
// WHETHER THIS PAGE IS A SANDBOX'S, FOR THE PARTS THAT LOOK DIFFERENT THERE (SARCLA 27.10.2026: a sandbox must never
// pass for the live hub - its own name, an amber band, a tinted page). The root layout decides it once, from
// APSOHUB_SANDBOX; the real hub renders every part exactly as before.

import { createContext, useContext } from "react";

const Ctx = createContext(false);

export function SandboxMode({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <Ctx.Provider value={on}>{children}</Ctx.Provider>;
}

export const useSandbox = () => useContext(Ctx);

/** The page under a sandbox: the hub's surface with an amber cast, so no screen of it reads as the live hub. */
export const SANDBOX_BASE = "#fbf3e2";
