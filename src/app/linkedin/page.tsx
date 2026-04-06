"use client";
import ChannelComposer from "@/app/components/ChannelComposer";

export default function LinkedInPage() {
  return (
    <ChannelComposer
      config={{
        channel: "LinkedIn",
        title: "LinkedIn Content Manager",
        subtitle: "Generate, review and schedule LinkedIn posts",
        accentColor: "#0077b5",
        topicPlaceholder: "e.g. Why FKM o-rings outperform standard NBR in fuel applications",
        fields: [
          { label: "Tone", key: "tone", options: ["Professional", "Casual", "Technical", "Storytelling"] },
          { label: "Language", key: "language", options: ["English", "French", "German", "Italian"] },
          { label: "Target Audience", key: "audience", options: ["Engineers", "Procurement", "Maintenance", "Executives"] },
          { label: "Post Type", key: "type", options: ["Text Only", "With Image", "Carousel", "Video"] },
        ],
        samplePost:
          "Choosing the right o-ring material for your application? Here's what our engineers recommend:\n\n✅ FKM: Excellent heat & chemical resistance up to +200°C — ideal for fuel, oil & dynamic seals\n✅ FFKM: The ultimate chemical resistance — for the most aggressive media and high temperatures up to +325°C\n✅ Silicone: Best low-temperature flexibility (-60°C) and food-grade compliance\n\nThe right choice depends on temperature, media, pressure, and service life requirements.\n\nOur application engineers help you select the optimal o-ring for your sealing challenge.\n\n#ORings #Sealing #Engineering #FKM #FFKM #APSOparts",
        recent: [
          { title: "O-Ring Material Selection: FKM vs FFKM vs Silicone", date: "2026-04-02", status: "Draft" },
          { title: "PEEK Machined Components — new product range", date: "2026-04-05", status: "Draft" },
          { title: "FFKM o-rings for chemical resistance", date: "2026-03-28", status: "Published" },
        ],
      }}
    />
  );
}
