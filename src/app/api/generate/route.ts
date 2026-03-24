import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { channel, topic, tone, language, audience, theme, sections } = body;

  // Stub response until n8n webhook is connected
  if (channel === "linkedin") {
    return NextResponse.json({
      content: `[LinkedIn Draft]\n\nTopic: ${topic}\nTone: ${tone}\nLanguage: ${language}\nAudience: ${audience}\n\n🚧 This is a placeholder. Connect n8n webhook to generate real content.`,
    });
  }

  if (channel === "newsletter") {
    return NextResponse.json({
      content: `[Newsletter Draft]\n\nTheme: ${theme}\nSections: ${sections}\nLanguage: ${language}\n\n🚧 This is a placeholder. Connect n8n webhook to generate real content.`,
    });
  }

  return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
}
