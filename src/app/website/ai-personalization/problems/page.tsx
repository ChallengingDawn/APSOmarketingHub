// Problem pages is part of Insights since 09.11.2026 (SARCLA: "merge Insights and Problem pages, and only insights that
// propose different types of content change"): its pages losing buyers are under Insights' optimizations, by type of
// change. The old address - in links people kept, and Content's "What stops buyers" ideas - leads there.
import { redirect } from "next/navigation";

export default function ProblemPages() {
  redirect("/website/ai-personalization/insights");
}
