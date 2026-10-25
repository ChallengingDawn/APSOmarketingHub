// MAP ASSIGNMENT - a "Fix" of one topic of the Differences, as the page sees it (fixTopic.ts writes it, GET ?topics=1
// shows it). Types only.

import type { TopicId } from "./topics";

/** One fix: the topic, the country it was narrowed to (null = all), who asked, when, and how far it is. */
export type FixRun = {
  topic: TopicId; country: string | null; by: string; at: string;
  /** companies to fix, companies looked at so far, and what was written */
  companies: number; done: number; wrote: number; contacts: number; failed: number;
  seconds?: number; error?: string;
};
export type FixState = { running: boolean; now: FixRun | null; last: FixRun | null };
