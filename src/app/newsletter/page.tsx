"use client";
import ChannelComposer from "@/app/components/ChannelComposer";

export default function NewsletterPage() {
  return (
    <ChannelComposer
      config={{
        channel: "Newsletter",
        title: "Newsletter Content Manager",
        subtitle: "Generate, review and schedule email newsletters",
        accentColor: "#274e64",
        topicPlaceholder: "e.g. Q2 product update featuring the new FFKM range and PEEK catalog expansion",
        fields: [
          { label: "Subject Style", key: "subject", options: ["Curiosity", "Direct", "Question", "News-style"] },
          { label: "Segment", key: "segment", options: ["All Subscribers", "Engineers", "Procurement", "Existing Customers"] },
          { label: "Length", key: "length", options: ["Short (200 words)", "Medium (400 words)", "Long (600+ words)"] },
          { label: "Language", key: "language", options: ["English", "French", "German", "Italian"] },
        ],
        samplePost:
          "📬 Subject: Q2 at APSOparts — what's new in sealings & plastics\n\nHi {first_name},\n\nSpring is here and so is a fresh batch of products in our catalog to help you build better, seal tighter, and ship faster.\n\n— What's new this quarter —\n\n🔹 FFKM o-ring range — ultra-high chemical resistance for the most demanding aggressive media\n🔹 Expanded PEEK catalog — 40+ new references for aerospace, semiconductor and medical applications\n🔹 POM-C stock expanded — rod & sheet now in stock across all standard dimensions\n\n→ Browse the catalog\n→ Request samples\n\nTo your next perfect seal,\nThe APSOparts Team",
        recent: [
          { title: "Q2 2026 — New FFKM range & PEEK catalog", date: "2026-04-10", status: "Draft" },
          { title: "[New Guide] How to choose the right o-ring material", date: "2026-04-21", status: "Draft" },
          { title: "March highlights — POM-C in stock", date: "2026-03-25", status: "Published" },
        ],
      }}
    />
  );
}
