"use client";
import ChannelComposer from "@/app/components/ChannelComposer";

export default function BlogPage() {
  return (
    <ChannelComposer
      config={{
        channel: "Blog",
        title: "Blog Content Manager",
        subtitle: "Generate, review and schedule long-form blog articles",
        accentColor: "#ed1b2f",
        topicPlaceholder: "e.g. Complete guide to selecting o-ring materials for high-temperature chemical applications",
        fields: [
          { label: "Article Type", key: "type", options: ["Pillar Guide", "Listicle", "Case Study", "Comparison", "How-To"] },
          { label: "Length", key: "length", options: ["Short (600 words)", "Medium (1200 words)", "Long (2000+ words)"] },
          { label: "Target Keyword", key: "keyword", options: ["o-ring material selection", "PEEK vs POM-C", "FKM o-rings", "POM-C machining"] },
          { label: "Reading Level", key: "level", options: ["Engineer", "Procurement", "Beginner", "Expert"] },
        ],
        samplePost:
          "📰 Reading time: 8 min · Audience: design & maintenance professionals\n\nSelecting the right o-ring material for high-temperature, chemically aggressive environments is one of the most consequential decisions in mechanical design. Get it wrong, and a $0.50 elastomer ring can shut down a $500k production line.\n\n— Why material selection matters more than you think —\n\nAt sustained temperatures above 200 °C, standard elastomers begin to lose their mechanical properties. Compression set increases, chemical resistance drops, and the seal that worked perfectly in lab testing fails in the field within weeks.\n\n— FKM (Fluoroelastomer) — the workhorse —\n\nFKM remains the most popular high-performance choice for continuous service up to 200 °C. Excellent resistance to oils, fuels, and most acids. Standard FKM is the right choice for 80% of demanding applications.\n\n— FFKM — when failure is not an option —\n\nFFKM extends the operating window to 320 °C with near-universal chemical compatibility. Expensive, but the math works for critical applications in semiconductors, pharma, and aerospace.\n\n→ Browse the APSOparts o-ring catalog\n→ Request free samples",
        recent: [
          { title: "O-Ring Material Selection Guide: FKM, FFKM & Silicone", date: "2026-04-07", status: "Draft" },
          { title: "PEEK vs POM-C: Engineering Plastics Comparison", date: "2026-04-15", status: "Draft" },
          { title: "5 Common O-Ring Failure Modes", date: "2026-03-30", status: "Published" },
        ],
      }}
    />
  );
}
