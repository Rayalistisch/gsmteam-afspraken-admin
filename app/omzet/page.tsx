"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function buildClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const n = parseFloat(text.replace(/[€\s]/g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function eur(n: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

type GroupRow = { label: string; total: number; count: number };

function groupBy(rows: any[], key: string): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const r of rows) {
    const price = parsePrice(r.price_text);
    if (price === null) continue;
    const label = (r[key] as string) || "Onbekend";
    const cur = map.get(label) ?? { label, total: 0, count: 0 };
    map.set(label, { label, total: cur.total + price, count: cur.count + 1 });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function groupByMonth(rows: any[]): GroupRow[] {
  const map = new Map<string, GroupRow & { key: string }>();
  for (const r of rows) {
    const price = parsePrice(r.price_text);
    if (price === null) continue;
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
    const cur = map.get(key) ?? { key, label, total: 0, count: 0 };
    map.set(key, { ...cur, total: cur.total + price, count: cur.count + 1 });
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-12);
}

function Bars({ data, limit = 8, color = "#3B82F6" }: { data: GroupRow[]; limit?: number; color?: string }) {
  const items = data.slice(0, limit);
  const max = items[0]?.total || 1;
  if (items.length === 0) return <div className="oEmpty">Geen data beschikbaar</div>;
  return (
    <div className="oBars">
      {items.map((item) => (
        <div key={item.label} className="oBarRow">
          <div className="oBarLabel" title={item.label}>{item.label}</div>
          <div className="oBarTrack">
            <div className="oBarFill" style={{ width: `${(item.total / max) * 100}%`, background: color }} />
          </div>
          <div className="oBarMeta">
            <span className="oBarValue">{eur(item.total)}</span>
            <span className="oBarCount">{item.count}×</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OmzetPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supabase = useMemo(() => buildClient(), []);

  useEffect(() => {
    if (!supabase) { setError("Supabase env ontbreekt."); setLoading(false); return; }
    supabase
      .from("repair_requests")
      .select("id, created_at, brand, model, issue, price_text")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError("Fout bij laden."); setLoading(false); return; }
        setRows(data || []);
        setLoading(false);
      });
  }, [supabase]);

  const withPrice = useMemo(() => rows.filter((r) => parsePrice(r.price_text) !== null), [rows]);
  const totalOmzet = useMemo(() => withPrice.reduce((s, r) => s + (parsePrice(r.price_text) ?? 0), 0), [withPrice]);
  const gemiddeld = withPrice.length ? totalOmzet / withPrice.length : 0;

  const byBrand = useMemo(() => groupBy(withPrice, "brand"), [withPrice]);
  const byIssue = useMemo(() => groupBy(withPrice, "issue"), [withPrice]);
  const byMonth = useMemo(() => groupByMonth(withPrice), [withPrice]);

  return (
    <DashboardShell>
      <style>{css}</style>

      <header className="oHeader">
        <div className="oTitle">Omzet</div>
        {loading && <span className="oStatusText">Laden…</span>}
        {error && <span className="oStatusText" style={{ color: "#EF4444" }}>{error}</span>}
      </header>

      <main className="oMain">
        <div className="oKpiGrid">
          <div className="oKpi">
            <div className="oKpiLabel">Totale omzet</div>
            <div className="oKpiValue">{loading ? "–" : eur(totalOmzet)}</div>
            <div className="oKpiSub">{withPrice.length} reparaties met prijs</div>
          </div>
          <div className="oKpi">
            <div className="oKpiLabel">Afgeronde reparaties</div>
            <div className="oKpiValue">{loading ? "–" : rows.length}</div>
            <div className="oKpiSub">{rows.length - withPrice.length} zonder prijs</div>
          </div>
          <div className="oKpi">
            <div className="oKpiLabel">Gemiddelde prijs</div>
            <div className="oKpiValue">{loading ? "–" : withPrice.length ? eur(gemiddeld) : "–"}</div>
            <div className="oKpiSub">per reparatie</div>
          </div>
        </div>

        <div className="oCard">
          <div className="oCardTitle">Omzet per maand</div>
          <Bars data={byMonth} limit={12} color="#3B82F6" />
        </div>

        <div className="oTwoCol">
          <div className="oCard">
            <div className="oCardTitle">Per merk</div>
            <Bars data={byBrand} color="#8B5CF6" />
          </div>
          <div className="oCard">
            <div className="oCardTitle">Per reparatietype</div>
            <Bars data={byIssue} color="#10B981" />
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}

const css = `
.oHeader {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255,255,255,0.82);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid #E2E8F0;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.oTitle {
  font-size: 17px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.02em;
}

.oStatusText {
  font-size: 13px;
  color: #94A3B8;
}

.oMain {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.oKpiGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.oKpi {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px 24px;
}

.oKpiLabel {
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 8px;
}

.oKpiValue {
  font-size: 30px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 6px;
}

.oKpiSub {
  font-size: 12px;
  color: #94A3B8;
}

.oCard {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px 24px;
}

.oCardTitle {
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.01em;
  margin-bottom: 16px;
}

.oTwoCol {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.oBars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oBarRow {
  display: grid;
  grid-template-columns: 150px 1fr 150px;
  align-items: center;
  gap: 12px;
}

.oBarLabel {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oBarTrack {
  height: 8px;
  background: #F1F5F9;
  border-radius: 4px;
  overflow: hidden;
}

.oBarFill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.oBarMeta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.oBarValue {
  font-size: 13px;
  font-weight: 700;
  color: #0F172A;
}

.oBarCount {
  font-size: 11px;
  color: #94A3B8;
  min-width: 20px;
  text-align: right;
}

.oEmpty {
  font-size: 13px;
  color: #94A3B8;
  padding: 20px 0;
  text-align: center;
}

@media (max-width: 900px) {
  .oTwoCol { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .oKpiGrid { grid-template-columns: 1fr; }
  .oMain { padding: 16px; }
  .oBarRow { grid-template-columns: 90px 1fr 110px; }
}
`;
