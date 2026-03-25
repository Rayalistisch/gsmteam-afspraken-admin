// Eenmalig migratiescript: quality 'Standaard' → 'Officieel' voor niet-servicereparaties
// Gebruik: node scripts/migrate-quality.mjs

const SUPABASE_URL = "https://dusbkrzgsdwboemdahrn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1c2Jrcnpnc2R3Ym9lbWRhaHJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM1NzcxMCwiZXhwIjoyMDgwOTMzNzEwfQ.kocpjWaCGvgoOTrICoKJvp4mrd8WdiLhiW-5nUT7m4E";

// Service-types (exact zoals opgeslagen in DB, eerste letter hoofdletter)
const SERVICE_TYPES_DB = ["Onderzoeken", "Reinigen", "Softwarereset", "Overige"];
const notInFilter = SERVICE_TYPES_DB.join(",");

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ── Stap 1: Standaard → Officieel ──────────────────────────────────────────
console.log("Stap 1: 'Standaard' → 'Officieel' voor niet-servicereparaties…");
const patchRes = await fetch(
  `${SUPABASE_URL}/rest/v1/repair_catalog?quality=eq.Standaard&repair_type=not.in.(${notInFilter})`,
  {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal,count=exact" },
    body: JSON.stringify({ quality: "Officieel" }),
  }
);
if (!patchRes.ok) {
  console.error("Fout bij stap 1:", await patchRes.text());
  process.exit(1);
}
console.log(`Stap 1 klaar. (Content-Range: ${patchRes.headers.get("content-range") ?? "onbekend"})`);

// ── Stap 2: Pulled-kopieën aanmaken ────────────────────────────────────────
console.log("\nStap 2: 'Pulled'-kopieën aanmaken voor alle niet-servicereparaties…");

const PAGE = 1000;
let offset = 0;
let totalInserted = 0;

while (true) {
  // Haal pagina van Officieel-rijen op
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/repair_catalog?quality=eq.Officieel&repair_type=not.in.(${notInFilter})&select=brand,model,color,repair_type,quality&limit=${PAGE}&offset=${offset}`,
    { headers }
  );
  if (!getRes.ok) {
    console.error("Fout bij ophalen pagina:", await getRes.text());
    process.exit(1);
  }
  const page = await getRes.json();
  if (page.length === 0) break;

  // Maak Pulled-kopieën (price blijft null = op aanvraag)
  const pulled = page.map(r => ({
    brand: r.brand,
    model: r.model,
    color: r.color,
    repair_type: r.repair_type,
    quality: "Pulled",
    price: null,
  }));

  const insRes = await fetch(
    `${SUPABASE_URL}/rest/v1/repair_catalog`,
    {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify(pulled),
    }
  );
  if (!insRes.ok) {
    console.error("Fout bij invoegen batch:", await insRes.text());
    process.exit(1);
  }

  totalInserted += pulled.length;
  offset += PAGE;
  process.stdout.write(`\r${totalInserted} Pulled-rijen ingevoegd…`);
}

console.log(`\nStap 2 klaar: ${totalInserted} 'Pulled'-rijen aangemaakt (price = op aanvraag).`);
console.log("\nMigratie volledig afgerond.");
