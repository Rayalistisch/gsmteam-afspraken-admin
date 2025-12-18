"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Row = any;

function fmtNL(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("nl-NL");
  } catch {
    return d;
  }
}

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

/** Heuristiek: herken "nieuw" vs "gebruikt" */
function getNewness(row: any): "new" | "used" | "unknown" {
  const hay = [row.condition, row.quality, row.warranty, row.notes, row.issue]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    hay.includes("nieuw") ||
    hay.includes("nieuw in doos") ||
    hay.includes("sealed") ||
    hay.includes("ongebruikt") ||
    hay.includes("new")
  )
    return "new";

  if (
    hay.includes("gebruikt") ||
    hay.includes("tweedehands") ||
    hay.includes("refurb") ||
    hay.includes("refurbished") ||
    hay.includes("used") ||
    hay.includes("b-grade") ||
    hay.includes("c-grade")
  )
    return "used";

  return "unknown";
}

// Maak client pas aan tijdens runtime (en niet tijdens build/prerender)
function buildSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [status, setStatus] = useState("Laden…");
  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const supabase = useMemo(() => buildSupabaseClient(), []);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const hay = [
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        r.brand,
        r.model,
        r.color,
        r.issue,
        r.price_text,
        r.preferred_date,
        r.preferred_time,
        r.status,
        r.condition,
        r.quality,
        r.warranty,
        r.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, query]);

  async function load(silent = false) {
    if (!supabase) {
      setRows([]);
      setStatus("Supabase env ontbreekt (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY).");
      return;
    }

    if (!silent) setStatus("Aanvragen laden…");

    let q = supabase
      .from("repair_requests")
      .select(
        "id, created_at, customer_name, customer_email, customer_phone, brand, model, color, issue, price_text, preferred_date, preferred_time, status, condition, quality, warranty, notes"
      )
      .order("created_at", { ascending: false });

    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setRows([]);
      setStatus("Fout bij ophalen.");
      return;
    }

    setRows(data || []);
    setStatus(silent ? `Live (${(data || []).length})` : `Aanvragen geladen (${(data || []).length}).`);
  }

  async function approve(id: string) {
    if (!confirm("Weet je zeker dat je deze aanvraag wilt goedkeuren?")) return;

    setBusyId(id);
    setStatus("Goedkeuren…");

    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(j);
        setStatus("Fout bij goedkeuren.");
        setBusyId(null);
        return;
      }

      setStatus("Goedgekeurd.");
      setBusyId(null);
      load(true);
    } catch (e) {
      console.error(e);
      setStatus("Netwerkfout bij goedkeuren.");
      setBusyId(null);
    }
  }

  useEffect(() => {
    load(false);

    if (!autoRefresh) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 10000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, autoRefresh]);

  return (
    <div className="wrap">
      <style>{styles}</style>

      {/* Topbar */}
      <header className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div className="brandText">
              <div className="brandTitle">GSM Team</div>
              <div className="brandSub">Afspraken • Beheer</div>
            </div>
          </div>

          <div className="topRight">
            <span className="chip chipSoft" title="Status">
              {status}
            </span>
            <button className="btn btnSoft" onClick={() => load(false)}>
              Refresh
            </button>
          </div>
        </div>

        <div className="controls">
          <div className="segmented">
            <button className={cx("segBtn", filter === "pending" && "segActive")} onClick={() => setFilter("pending")}>
              Openstaand
            </button>
            <button className={cx("segBtn", filter === "approved" && "segActive")} onClick={() => setFilter("approved")}>
              Goedgekeurd
            </button>
            <button className={cx("segBtn", filter === "all" && "segActive")} onClick={() => setFilter("all")}>
              Alles
            </button>
          </div>

          <div className="rightControls">
            <label className="toggle">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              <span>Auto-refresh</span>
            </label>

            <div className="searchWrap">
              <input
                className="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam, toestel, mail, notitie…"
              />
              {query ? (
                <button className="clear" onClick={() => setQuery("")} aria-label="Wis zoekterm">
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="content">
        <div className="metaRow">
          <div className="muted">
            {visibleRows.length} zichtbaar / {rows.length} totaal
          </div>
        </div>

        <section className="list">
          {visibleRows.length === 0 ? (
            <div className="emptyCard">Geen aanvraag gevonden.</div>
          ) : (
            visibleRows.map((r: any) => {
              const toestel = [r.brand || "", r.model || "", r.color ? `(${r.color})` : ""].join(" ").trim();
              const contact = `${r.customer_email || ""}${r.customer_phone ? ` / ${r.customer_phone}` : ""}`;
              const voorkeur = `${r.preferred_date || ""}${r.preferred_time ? ` ${r.preferred_time}` : ""}`.trim();

              const newness = getNewness(r);
              const statusBadge =
                r.status === "approved"
                  ? { cls: "badge badgeOk", label: "Goedgekeurd" }
                  : { cls: "badge badgeWarn", label: "Openstaand" };

              return (
                <details key={r.id} className="card">
                  <summary className="cardSum">
                    <div className="left">
                      <div className="titleRow">
                        <div className="name">{r.customer_name || "Aanvraag"}</div>
                        <div className="badges">
                          <span className={statusBadge.cls}>{statusBadge.label}</span>
                          {/* newness badge (optioneel) */}
                          {newness === "new" ? <span className="badge badgeNew">Nieuw</span> : null}
                          {newness === "used" ? <span className="badge badgeUsed">Gebruikt</span> : null}
                        </div>
                      </div>

                      <div className="subRow">
                        <span className="mono">{fmtNL(r.created_at)}</span>
                        <span className="dot">•</span>
                        <span className="strong">{toestel || "-"}</span>
                        {r.issue ? (
                          <>
                            <span className="dot">•</span>
                            <span className="muted">{r.issue}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="right">
                      {r.status === "approved" ? (
                        <span className="chip chipOk">✔ Klaar</span>
                      ) : (
                        <button
                          className="btn btnPrimary"
                          onClick={(e) => {
                            e.preventDefault();
                            approve(r.id);
                          }}
                          disabled={busyId === r.id}
                        >
                          {busyId === r.id ? "Bezig…" : "Goedkeuren"}
                        </button>
                      )}

                      <span className="chev" aria-hidden="true">
                        ▾
                      </span>
                    </div>
                  </summary>

                  <div className="cardBody">
                    <div className="grid">
                      <div className="field">
                        <div className="label">Contact</div>
                        <div className="value">{contact || "-"}</div>
                      </div>

                      <div className="field">
                        <div className="label">Voorkeur</div>
                        <div className="value mono">{voorkeur || "-"}</div>
                      </div>

                      <div className="field">
                        <div className="label">Richtprijs</div>
                        <div className="value mono">{r.price_text || "-"}</div>
                      </div>

                      <div className="field">
                        <div className="label">Conditie</div>
                        <div className="value">{r.condition || "-"}</div>
                      </div>

                      <div className="field">
                        <div className="label">Kwaliteit</div>
                        <div className="value">{r.quality || "-"}</div>
                      </div>

                      <div className="field">
                        <div className="label">Garantie</div>
                        <div className="value">{r.warranty || "-"}</div>
                      </div>

                      <div className="field full">
                        <div className="label">Notities</div>
                        <div className="value pre">{r.notes || "-"}</div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

const styles = `
:root{
  --bg: #F6F8FC;
  --card: #FFFFFF;
  --line: #E6ECF5;
  --text: #0B1320;
  --muted: #0066ffff;

  --brand: #1E63FF;
  --brandSoft: rgba(30,99,255,0.10);
  --brandLine: rgba(30,99,255,0.18);

  --ok: #16A34A;
  --okSoft: rgba(22,163,74,0.10);

  --warn: #F59E0B;
  --warnSoft: rgba(245,158,11,0.12);

  --new: #2563EB;
  --newSoft: rgba(37,99,235,0.10);

  --used: #0EA5E9;
  --usedSoft: rgba(14,165,233,0.10);

  --shadow: 0 12px 28px rgba(16,24,40,0.08);
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.wrap{ min-height:100vh; overflow-x:hidden; }

.topbar{
  position: sticky;
  top:0;
  z-index: 20;
  background: rgba(246,248,252,0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}

.topbarInner{
  max-width: 1100px;
  margin: 0 auto;
  padding: 14px 16px 10px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.brand{ display:flex; align-items:center; gap:12px; min-width: 0; }
.logo{
  width:40px; height:40px; border-radius: 14px;
  background: linear-gradient(135deg, var(--brand), #52D0FF);
  box-shadow: 0 10px 22px rgba(30,99,255,0.18);
}
.brandText{ min-width:0; }
.brandTitle{ font-weight: 900; line-height: 1.1; }
.brandSub{ font-size: 12px; color: var(--muted); margin-top: 2px; }

.topRight{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }

.controls{
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 16px 14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

.segmented{
  display:flex;
  gap:6px;
  padding: 6px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(16,24,40,0.04);
}

.segBtn{
  border:0;
  background: transparent;
  padding: 9px 12px;
  border-radius: 12px;
  cursor:pointer;
  font-weight: 800;
  color: var(--muted);
}
.segBtn:hover{ background: #F2F6FF; color: var(--text); }
.segActive{
  background: var(--brandSoft);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--brandLine);
}

.rightControls{
  display:flex;
  align-items:center;
  gap:10px;
  flex: 1;
  justify-content:flex-end;
  min-width: 260px;
}

.toggle{
  display:flex;
  align-items:center;
  gap:8px;
  color: var(--muted);
  font-size: 13px;
  user-select:none;
  white-space: nowrap;
}
.toggle input{ transform: translateY(1px); }

.searchWrap{
  position:relative;
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}
.search{
  width:100%;
  padding: 10px 42px 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  outline: none;
}
.search:focus{
  box-shadow: 0 0 0 4px rgba(30,99,255,0.14);
  border-color: rgba(30,99,255,0.35);
}
.search::placeholder{ color: rgba(90,107,133,0.75); }

.clear{
  position:absolute;
  right:10px;
  top:50%;
  transform: translateY(-50%);
  width:28px;height:28px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  cursor:pointer;
}

.content{
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}

.metaRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin: 4px 0 10px;
}
.muted{
  color: var(--muted);
  font-size: 1.1rem;
  font-weight: 700;
}

.list{
  display:grid;
  gap: 10px;
}

.card{
  border: 1px solid var(--line);
  background: var(--card);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow:hidden;
}

.cardSum{
  list-style: none;
  cursor: pointer;
  padding: 12px 12px;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.cardSum::-webkit-details-marker{ display:none; }

.left{ min-width:0; }
.titleRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.name{
  font-weight: 950;
  font-size: 15px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 560px;
}
.badges{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

.subRow{
  margin-top: 6px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.3;
}
.dot{ opacity: 0.5; }
.strong{ color: var(--text); font-weight: 800; font-size: 1.1rem; }
.mono{ font-variant-numeric: tabular-nums; }

.right{
  display:flex;
  align-items:center;
  gap:10px;
  flex-shrink: 0;
}
.chev{
  color: var(--muted);
  font-size: 16px;
  transform: translateY(1px);
}
details[open] .chev{ transform: rotate(180deg) translateY(-1px); }

.cardBody{
  border-top: 1px solid var(--line);
  padding: 12px;
}

.grid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.field{
  border: 1px solid var(--line);
  background: #FBFCFF;
  border-radius: 14px;
  padding: 10px;
  min-width: 0;
}
.field.full{ grid-column: 1 / -1; }
.label{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-bottom: 6px;
}
.value{
  font-size: 14px;
  color: var(--text);
  word-break: break-word;
  font-weight: 800;
}
.pre{ white-space: pre-wrap; }

.badge{
  display:inline-flex;
  align-items:center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 950;
  border: 1px solid var(--line);
  background: #fff;
  white-space: nowrap;
}
.badgeOk{ border-color: rgba(22,163,74,0.25); background: var(--okSoft); color: #0B5A23; }
.badgeWarn{ border-color: rgba(245,158,11,0.25); background: var(--warnSoft); color: #7A4A00; }
.badgeNew{ border-color: rgba(37,99,235,0.25); background: var(--newSoft); color: #0B2E9E; }
.badgeUsed{ border-color: rgba(14,165,233,0.25); background: var(--usedSoft); color: #045B7C; }

.chip{
  display:inline-flex;
  align-items:center;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}
.chipOk{ background: var(--okSoft); border-color: rgba(22,163,74,0.25); color: #0B5A23; }
.chipSoft{ background: #fff; }

.btn{
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  padding: 9px 12px;
  border-radius: 14px;
  cursor:pointer;
  font-weight: 900;
}
.btn:disabled{ opacity:0.55; cursor:not-allowed; }

.btnSoft:hover{ background: #F3F6FB; }
.btnPrimary{
  border: 0;
  background: linear-gradient(135deg, var(--brand), #52D0FF);
  color: #fff;
  box-shadow: 0 12px 22px rgba(30,99,255,0.20);
}
.btnPrimary:hover{ filter: brightness(1.03); }

.emptyCard{
  border: 1px dashed var(--line);
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  color: var(--muted);
  text-align:center;
}

@media (max-width: 720px){
  .topRight .chip{ display:none; }
  .name{ max-width: 240px; }
  .grid{ grid-template-columns: 1fr; }
  .rightControls{ width:100%; justify-content:space-between; }
  .searchWrap{ max-width: none; }
}
`;
