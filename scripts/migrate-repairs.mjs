// Eenmalig migratiescript: repairs.json → Supabase repair_catalog tabel
// Gebruik: node scripts/migrate-repairs.mjs

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://dusbkrzgsdwboemdahrn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1c2Jrcnpnc2R3Ym9lbWRhaHJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTM1NzcxMCwiZXhwIjoyMDgwOTMzNzEwfQ.kocpjWaCGvgoOTrICoKJvp4mrd8WdiLhiW-5nUT7m4E";

const jsonPath = join(__dirname, "../../Desktop/gsm-team-shopify/assets/repairs.json");
const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

const rows = raw
  .filter(r =>
    r.brand && r.brand !== "`brand`" &&
    r.model && r.model !== "`model`" &&
    r.color && r.color !== "`color`" &&
    r.repair_type && r.repair_type !== "`repair_type`"
  )
  .map(r => ({
    brand: String(r.brand).trim(),
    model: String(r.model).trim(),
    color: String(r.color).trim(),
    repair_type: String(r.repair_type).trim(),
    quality: String(r.quality || "Standaard").trim(),
    price: (r.price !== null && r.price !== "" && r.price !== undefined)
      ? (Number(String(r.price).replace(",", ".")) || null)
      : null,
  }));

console.log(`${rows.length} rijen klaar voor import.`);

const BATCH = 500;
let ok = 0, fail = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/repair_catalog`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(batch),
  });

  if (res.ok) {
    ok += batch.length;
    process.stdout.write(`\r✓ ${ok} / ${rows.length} ingevoegd`);
  } else {
    const err = await res.text();
    console.error(`\nBatch ${Math.floor(i / BATCH) + 1} fout (${res.status}):`, err);
    fail += batch.length;
  }
}

console.log(`\nKlaar: ${ok} ingevoegd, ${fail} mislukt.`);
