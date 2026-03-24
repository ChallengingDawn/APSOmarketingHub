"use client";
import { useState } from "react";

export default function NewsletterPage() {
  const [topic, setTopic] = useState("");
  const [sections, setSections] = useState("3");
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "newsletter", topic, sections, language }),
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
      <div>
        <h1 className="text-2xl font-bold">Drive Newsletter Generator</h1>
        <p className="text-sm text-apso-text mt-1">Create compelling newsletter content for distribution</p>
      </div>

      <div className="bg-white rounded-lg border border-apso-border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-apso-dark mb-1">Newsletter Theme / Topics</label>
          <textarea
            className="w-full border border-apso-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-apso-red focus:border-transparent"
            rows={3}
            placeholder="e.g. Q1 product highlights, new sealing solutions, upcoming trade shows..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-apso-dark mb-1">Number of Sections</label>
            <select className="w-full border border-apso-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-apso-red" value={sections} onChange={(e) => setSections(e.target.value)}>
              <option value="2">2 Sections</option>
              <option value="3">3 Sections</option>
              <option value="4">4 Sections</option>
              <option value="5">5 Sections</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-apso-dark mb-1">Language</label>
            <select className="w-full border border-apso-border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-apso-red" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="fr">Francais</option>
              <option value="it">Italiano</option>
              <option value="nl">Nederlands</option>
              <option value="pl">Polski</option>
            </select>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!topic || loading}
          className="bg-apso-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-apso-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Generating..." : "Generate Newsletter"}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-lg border border-apso-border p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Generated Newsletter</h2>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="text-sm text-apso-teal hover:text-apso-teal-light font-medium hover:underline transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
          <div className="whitespace-pre-wrap text-sm bg-apso-gray rounded-lg p-4">{result}</div>
        </div>
      )}
    </div>
  );
}
