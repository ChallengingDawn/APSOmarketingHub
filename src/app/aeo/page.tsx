"use client";
// AI ANSWERS (AEO) - OVERVIEW: how often the AI assistants (ChatGPT, Gemini, Perplexity) name
// APSO when asked the prompts set up in HubSpot's AEO, against competitors, who they cite,
// and how often they cite our pages. The body is shared with Advanced reporting.

import { AeoHeader, AeoWaiting, useAeo } from "./AeoUi";
import { AeoOverviewBody } from "./OverviewBody";

export default function AeoOverview() {
  const { value: d, computing, progress, error } = useAeo();
  if (!d) return (<><AeoHeader title="AI answers (AEO)" data={null} /><AeoWaiting computing={computing} progress={progress} error={error} /></>);
  return (<><AeoHeader title="AI answers (AEO)" data={d} /><AeoOverviewBody d={d} computing={computing} progress={progress} /></>);
}
