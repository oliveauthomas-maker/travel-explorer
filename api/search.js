const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API manquante" });

  const bodyToSend = JSON.stringify({
    ...req.body,
    system: "You are a JSON API. Respond with ONLY raw valid JSON. No markdown, no backticks, no explanation.",
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(bodyToSend),
      },
    };

    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);

          if (response.statusCode !== 200) {
            res.status(response.statusCode).json({ error: parsed?.error?.message || "Erreur API" });
            return resolve();
          }

          // Extract text content from Claude response
          const rawText = (parsed.content || [])
            .filter(b => b.type === "text")
            .map(b => b.text)
            .join("");

          // Clean: find first { and last } to extract pure JSON
          const start = rawText.indexOf("{");
          const end = rawText.lastIndexOf("}");

          if (start === -1 || end === -1) {
            res.status(200).json({ ...parsed, _parsed: null, _error: "No JSON found in: " + rawText.substring(0, 100) });
            return resolve();
          }

          const jsonStr = rawText.slice(start, end + 1);

          try {
            const result = JSON.parse(jsonStr);
            // Return the parsed data directly
            res.status(200).json({ success: true, data: result });
          } catch (e) {
            res.status(200).json({ success: false, _error: "JSON parse failed: " + e.message, _raw: jsonStr.substring(0, 200) });
          }

        } catch (e) {
          res.status(500).json({ error: "Response parse error: " + e.message });
        }
        resolve();
      });
    });

    request.on("error", (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });

    request.write(bodyToSend);
    request.end();
  });
};
