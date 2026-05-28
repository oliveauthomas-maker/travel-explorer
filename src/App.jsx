import { useState, useRef } from "react";

const TABS = [
  { id: "activities", icon: "🎠", label: "Activités",  color: "#FF6B35" },
  { id: "events",     icon: "🎪", label: "Événements", color: "#E91E8C" },
  { id: "walks",      icon: "🌿", label: "Balades",    color: "#00C896" },
  { id: "vintage",    icon: "👗", label: "Vintage",    color: "#9B59B6" },
];
const RADIUS_OPTIONS = [10, 20, 30, 40];

// ── Distance calculation (Haversine) ──────────────────────────────────────
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Parse JSON from Claude response ───────────────────────────────────────
function parseJSON(text) {
 try {
   // Try direct parse first
   return JSON.parse(text.trim());
 } catch {}
 try {
   // Extract JSON between first { and last }
   const start = text.indexOf("{");
   const end = text.lastIndexOf("}");
   if (start !== -1 && end !== -1) {
     return JSON.parse(text.slice(start, end + 1));
   }
 } catch {}
 try {
   // Remove markdown code blocks
   const cleaned = text.replace(/```json|```/g, "").trim();
   const start = cleaned.indexOf("{");
   const end = cleaned.lastIndexOf("}");
   if (start !== -1 && end !== -1) {
     return JSON.parse(cleaned.slice(start, end + 1));
   }
 } catch {}
 return null;
}

// ── Components ────────────────────────────────────────────────────────────
function Card({ item, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 18px", marginBottom: 8, position: "relative", overflow: "hidden", animation: "fadeUp 0.3s ease" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.3 }}>{item.title}</p>
      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>{item.description}</p>
      {item.dist != null && (
        <span style={{ display: "inline-block", marginTop: 8, background: "rgba(255,255,255,0.07)", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          ~{Math.round(item.dist)} km
        </span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 20px" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.12)", borderTopColor: "#FF6B35", animation: "spin 0.9s linear infinite" }} />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Exploration en cours…</p>
    </div>
  );
}

function LocationSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef(null);

  const search = (q) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=fr`);
        const data = await r.json();
        setSuggestions(data.features || []);
        setOpen((data.features || []).length > 0);
      } catch { setSuggestions([]); }
    }, 300);
  };

  const pick = (feature) => {
    const p = feature.properties;
    const label = [p.name, p.city || p.town || p.village, p.country].filter(Boolean).join(", ");
    const [lng, lat] = feature.geometry.coordinates;
    setQuery(label); setOpen(false);
    onSelect({ lat, lng }, p.name || p.city || label);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "11px 15px" }}>
        <span>🔍</span>
        <input value={query} onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Saisissez une ville, un lieu…"
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, fontFamily: "inherit" }} />
        {query && <button onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#1a1a28", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, overflow: "hidden", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {suggestions.map((s, i) => {
            const p = s.properties;
            const main = [p.name, p.city || p.town || p.village].filter(Boolean).join(", ");
            const sub = [p.county, p.country].filter(Boolean).join(", ");
            return (
              <button key={i} onClick={() => pick(s)}
                style={{ width: "100%", textAlign: "left", padding: "12px 16px", background: "none", border: "none", borderBottom: i < suggestions.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none", cursor: "pointer", fontFamily: "inherit", display: "block" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff" }}>{main}</p>
                {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{sub}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [location, setLocation]   = useState(null);
  const [cityName, setCityName]   = useState("");
  const [radius, setRadius]       = useState(40); // default 40km
  const [activeTab, setActiveTab] = useState("activities");
  const [loading, setLoading]     = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError]   = useState("");
  const [allData, setAllData]     = useState({}); // raw data with coords
  const [lastFetch, setLastFetch] = useState(null);
  const [locMode, setLocMode]     = useState("auto");
  const [apiError, setApiError]   = useState("");

  // Filter items by current radius using their stored coordinates
  const filterByRadius = (items, rad) => {
    if (!location || !items?.length) return items || [];
    return items.filter(item => {
      if (item.lat == null || item.lng == null) return true; // keep if no coords
      const d = distanceKm(location.lat, location.lng, item.lat, item.lng);
      item.dist = d;
      return d <= rad;
    });
  };

  // Compute filtered data reactively
  const data = {};
  TABS.forEach(t => { data[t.id] = filterByRadius(allData[t.id], radius); });

  const hasResults = Object.values(data).some(v => v?.length);
  const activeColor = TABS.find(t => t.id === activeTab)?.color || "#FF6B35";

  const getLocation = () => {
    setLocLoading(true); setLocError("");
    if (!navigator.geolocation) { setLocError("Non supporté."); setLocLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setLocation({ lat, lng });
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d = await r.json();
          setCityName(d.address?.city || d.address?.town || d.address?.village || `${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        } catch { setCityName(`${lat.toFixed(3)}, ${lng.toFixed(3)}`); }
        setLocLoading(false);
      },
      () => { setLocError("Position refusée. Autorisez la géolocalisation."); setLocLoading(false); },
      { timeout: 10000 }
    );
  };

  const fetchData = async () => {
    if (!location) return;
    setLoading(true); setAllData({}); setApiError("");

    const prompt = `You are a local travel expert. User GPS position: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} (${cityName}). Search radius: 40km (return everything within 40km so the user can filter dynamically).

Return ONLY a valid JSON object, no markdown, no text before or after:
{
  "activities": [
    {"title": "Place name", "description": "Short practical description for a family with a 3-year-old child.", "lat": 0.0000, "lng": 0.0000},
    ... up to 10 items
  ],
  "events": [
    {"title": "Event name – date or period", "description": "Short description.", "lat": 0.0000, "lng": 0.0000},
    ... up to 10 items
  ],
  "walks": [
    {"title": "Walk name – distance", "description": "Easy walk or hike, max 15km, stroller-friendly if possible.", "lat": 0.0000, "lng": 0.0000},
    ... up to 10 items
  ],
  "vintage": [
    {"title": "Shop name", "description": "Short description of the thrift/vintage shop.", "lat": 0.0000, "lng": 0.0000},
    ... up to 10 items
  ]
}

Rules:
- activities: museums, points of interest, family attractions
- events: local events happening soon in the region
- walks: hikes, walks, nature paths — max 15km distance
- vintage: thrift stores, second-hand shops, vintage clothing stores
- Include real, verifiable place names
- Always include accurate lat/lng coordinates for each item
- Search across ALL towns within 40km, not just the exact city
- Works worldwide, not just France`;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : JSON.stringify(err.error));
      }

      const json = await res.json();
      const text = json.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
      const parsed = parseJSON(text);

      if (!parsed) throw new Error("Format de réponse invalide. Réessayez.");

      // Pre-compute distances
      TABS.forEach(t => {
        if (parsed[t.id]) {
          parsed[t.id] = parsed[t.id].map(item => ({
            ...item,
            dist: item.lat && item.lng ? distanceKm(location.lat, location.lng, item.lat, item.lng) : null,
          }));
        }
      });

      setAllData(parsed);
      setLastFetch(new Date());

      // Auto-switch to first tab with results
      const firstWithData = TABS.find(t => parsed[t.id]?.length > 0);
      if (firstWithData) setActiveTab(firstWithData.id);

    } catch (e) {
      setApiError(e.message || "Erreur lors de la recherche.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D14", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@900&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.35} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        button { -webkit-tap-highlight-color: transparent; }
        body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: -120, left: -120, width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,107,53,0.1) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(155,89,182,0.09) 0%, transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 500, margin: "0 auto", padding: "0 0 80px" }}>

        {/* Header */}
        <div style={{ padding: "48px 24px 20px" }}>
          <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Guide de voyage</p>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 900, lineHeight: 1.1, marginBottom: 24, background: "linear-gradient(135deg,#fff 30%,rgba(255,255,255,0.45))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Explorer<br />autour de moi
          </h1>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[["auto","📍 GPS"],["manual","✏️ Manuel"]].map(([mode, label]) => (
              <button key={mode} onClick={() => setLocMode(mode)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: locMode === mode ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: locMode === mode ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: locMode === mode ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* GPS */}
          {locMode === "auto" && (
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: location ? "rgba(0,200,150,0.18)" : "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                {locLoading ? <span style={{ animation: "pulse 1s infinite" }}>📍</span> : location ? "✅" : "📍"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {location
                  ? <><p style={{ fontSize: 13, fontWeight: 600, color: "#00C896", marginBottom: 1 }}>{cityName}</p><p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p></>
                  : <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{locError || "Appuyez pour vous localiser"}</p>}
              </div>
              <button onClick={getLocation} disabled={locLoading} style={{ background: location ? "rgba(0,200,150,0.15)" : "linear-gradient(135deg,#FF6B35,#E91E8C)", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                {locLoading ? "…" : location ? "Actualiser" : "Localiser"}
              </button>
            </div>
          )}

          {/* Manuel */}
          {locMode === "manual" && (
            <div style={{ marginBottom: 14 }}>
              <LocationSearch onSelect={(loc, name) => { setLocation(loc); setCityName(name); }} />
              {location && <p style={{ fontSize: 11, color: "rgba(0,200,150,0.8)", marginTop: 8, paddingLeft: 4 }}>✓ {cityName}</p>}
            </div>
          )}

          {/* Rayon */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Rayon de recherche</p>
            <div style={{ display: "flex", gap: 8 }}>
              {RADIUS_OPTIONS.map(r => (
                <button key={r} onClick={() => setRadius(r)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", background: radius === r ? activeColor : "rgba(255,255,255,0.06)", color: radius === r ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: radius === r ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button onClick={fetchData} disabled={!location || loading} style={{ width: "100%", padding: "16px", background: (!location || loading) ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#FF6B35,#E91E8C)", border: "none", borderRadius: 16, color: (!location || loading) ? "rgba(255,255,255,0.25)" : "#fff", fontSize: 15, fontWeight: 700, cursor: (!location || loading) ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.25s", boxShadow: (!location || loading) ? "none" : "0 4px 24px rgba(255,107,53,0.3)" }}>
            {loading ? "🔍 Recherche en cours…" : "🔍 Rechercher"}
            {lastFetch && !loading && <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.55 }}>· {lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
          </button>

          {apiError && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)", borderRadius: 12 }}>
              <p style={{ color: "#ff6b6b", fontSize: 13, margin: 0 }}>⚠️ {apiError}</p>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!location && !loading && (
          <div style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🗺️</div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 15, lineHeight: 1.7 }}>
              Localisez-vous ou saisissez une ville<br />pour découvrir les meilleures adresses
            </p>
          </div>
        )}

        {loading && <Spinner />}

        {/* Tabs + results */}
        {!loading && hasResults && (
          <>
            <div style={{ padding: "4px 24px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
              {TABS.map(t => {
                const count = data[t.id]?.length || 0;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 50, border: "none", background: activeTab === t.id ? t.color : "rgba(255,255,255,0.06)", color: activeTab === t.id ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
                    {t.icon} {t.label}
                    <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "1px 7px", fontSize: 11 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "0 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: activeColor }} />
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" }}>
                  {data[activeTab]?.length || 0} résultat{(data[activeTab]?.length || 0) > 1 ? "s" : ""} · {radius} km
                </p>
              </div>

              {data[activeTab]?.length > 0
                ? data[activeTab].map((item, i) => <Card key={i} item={item} color={activeColor} />)
                : <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14, padding: "40px 0" }}>Aucun résultat dans ce rayon.</p>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}
