export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API manquante" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        ...req.body,
        system: "You are a JSON API. Respond with ONLY raw valid JSON. No markdown, no backticks, no explanation.",
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "Erreur API" });

    // Extract and clean JSON server-side
    const rawText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.status(200).json({ success: false, _error: "No JSON in response", _raw: rawText.substring(0, 200) });
    }

    try {
      const result = JSON.parse(rawText.slice(start, end + 1));
      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      return res.status(200).json({ success: false, _error: e.message, _raw: rawText.substring(0, 200) });
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
