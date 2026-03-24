"use client";
import { useState } from "react";

export default function LinkedInPage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("engineers");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "linkedin", topic, tone, language, audience }),
      });
      const data = await res.json();
      setResult(data.content || data.error || "No content generated");
    } catch (e) {
      setResult("Error connecting to generation service");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">LinkedIn Post Generator</h1>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Topic / Key Message</label>
          <textarea
            className="w-full border rounded-lg p-3 text-sm"
            rows={3}
            placeholder="e.g. New EPDM o-ring range for food & beverage industry..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tone</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="technical">Technical</option>
              <option value="inspiring">Inspiring</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Francais</option>
              <option value="it">Italiano</option>
              <option value="nl">Nederlands</option>
              <option value="pl">Polski</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Audience</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="engineers">Engineers</option>
              <option value="procurement">Procurement</option>
              <option value="management">Management</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!topic || loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Generating..." : "Generate Post"}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Generated Post</h2>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-sm text-blue-600 hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
          <div className="whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-4">{result}</div>
        </div>
      )}
    </div>
  );
}
