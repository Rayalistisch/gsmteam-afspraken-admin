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

  if (hay.includes("nieuw") || hay.includes("nieuw in doos") || hay.includes("sealed") || hay.includes("ongebruikt") || hay.includes("new"))
    return "new";

  if (hay.includes("gebruikt") || hay.includes("tweedehands") || hay.includes("refurb") || hay.includes("refurbished") || hay.includes("used") || hay.includes("b-grade") || hay.includes("c-grade"))
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

type Draft = {
  price_text: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
};

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [status, setStatus] = useState("Laden…");
  const [query, setQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    price_text: "",
    preferred_date: "",
    preferred_time: "",
    notes: "",
  });

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
      if (editId === id) cancelEdit();
      load(true);
    } catch (e) {
      console.error(e);
      setStatus("Netwerkfout bij goedkeuren.");
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Waarom afwijzen? (optioneel)\nTip: zet ook een alternatief tijdstip/datum in de reden.");
    if (reason === null) return;
    if (!confirm("Weet je zeker dat je deze aanvraag wilt afwijzen?")) return;

    setBusyId(id);
    setStatus("Afwijzen…");

    try {
      const res = await fetch("/api/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason: (reason || "").trim() }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        console.error(j);
        setStatus("Fout bij afwijzen.");
        setBusyId(null);
        return;
      }

      setStatus("Afgewezen.");
      setBusyId(null);
      if (editId === id) cancelEdit();
      load(true);
    } catch (e) {
      console.error(e);
      setStatus("Netwerkfout bij afwijzen.");
      setBusyId(null);
    }
  }

  function startEdit(r: any) {
    setEditId(r.id);
    setDraft({
      price_text: r.price_text || "",
      preferred_date: r.preferred_date || "",
      preferred_time: r.preferred_time || "",
      notes: r.notes || "",
    });
    setStatus("Bewerken… (pas prijs/datum/tijd/notitie aan en klik Opslaan)");
  }

  function cancelEdit() {
    setEditId(null);
    setDraft({ price_text: "", preferred_date: "", preferred_time: "", notes: "" });
    setStatus("Bewerken geannuleerd.");
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    setStatus("Opslaan…");

    try {
      const res = await fetch("/api/update-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch: draft }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        console.error(j);
        setStatus("Fout bij opslaan.");
        setBusyId(null);
        return;
      }

      setStatus("Opgeslagen.");
      setBusyId(null);
      setEditId(null);
      setDraft({ price_text: "", preferred_date: "", preferred_time: "", notes: "" });
      load(true);
    } catch (e) {
      console.error(e);
      setStatus("Netwerkfout bij opslaan.");
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
          <div className="segmented" role="tablist" aria-label="Filters">
            <button className={cx("segBtn", filter === "pending" && "segActive")} onClick={() => setFilter("pending")}>
              Openstaand
            </button>
            <button className={cx("segBtn", filter === "approved" && "segActive")} onClick={() => setFilter("approved")}>
              Goedgekeurd
            </button>
            <button className={cx("segBtn", filter === "rejected" && "segActive")} onClick={() => setFilter("rejected")}>
              Afgewezen
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
                  : r.status === "rejected"
                  ? { cls: "badge badgeBad", label: "Afgewezen" }
                  : { cls: "badge badgeWarn", label: "Openstaand" };

              const isEditing = editId === r.id;

              return (
                <details key={r.id} className={cx("card", isEditing && "cardEditing")}>
                  <summary className="cardSum">
                    <div className="left">
                      <div className="titleRow">
                        <div className="name">{r.customer_name || "Aanvraag"}</div>
                        <div className="badges">
                          <span className={statusBadge.cls}>{statusBadge.label}</span>
                          {newness === "new" ? <span className="badge badgeNew">Nieuw</span> : null}
                          {newness === "used" ? <span className="badge badgeUsed">Gebruikt</span> : null}
                          {isEditing ? <span className="badge badgeEdit">Bewerken</span> : null}
                        </div>
                      </div>

                      <div className="subRow">
                        <span className="mono">{fmtNL(r.created_at)}</span>
                        <span className="dot">•</span>
                        <span className="strong">{toestel || "-"}</span>
                        {r.issue ? (
                          <>
                            <span className="dot">•</span>
                            <span className="mutedText">{r.issue}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="right">
                      {isEditing ? (
                        <div className="actions">
                          <button
                            className="btn btnSoft"
                            onClick={(e) => {
                              e.preventDefault();
                              cancelEdit();
                            }}
                            disabled={busyId === r.id}
                          >
                            Annuleren
                          </button>

                          <button
                            className="btn btnPrimary"
                            onClick={(e) => {
                              e.preventDefault();
                              saveEdit(r.id);
                            }}
                            disabled={busyId === r.id}
                          >
                            {busyId === r.id ? "Bezig…" : "Opslaan"}
                          </button>
                        </div>
                      ) : (
                        <div className="actions">
                          <button
                            className="btn btnSoft"
                            onClick={(e) => {
                              e.preventDefault();
                              if (editId) cancelEdit();
                              startEdit(r);
                            }}
                          >
                            Bewerken
                          </button>

                          {r.status === "approved" ? (
                            <span className="chip chipOk">✔ Klaar</span>
                          ) : r.status === "rejected" ? (
                            <span className="chip chipBad">✖ Afgewezen</span>
                          ) : (
                            <>
                              <button
                                className="btn btnBad"
                                onClick={(e) => {
                                  e.preventDefault();
                                  reject(r.id);
                                }}
                                disabled={busyId === r.id}
                              >
                                {busyId === r.id ? "Bezig…" : "Afwijzen"}
                              </button>

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
                            </>
                          )}
                        </div>
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
                        <div className="label">Datum (aanpassen)</div>
                        {isEditing ? (
                          <input
                            className="input"
                            value={draft.preferred_date}
                            onChange={(e) => setDraft((d) => ({ ...d, preferred_date: e.target.value }))}
                            placeholder="YYYY-MM-DD"
                          />
                        ) : (
                          <div className="value mono">{r.preferred_date || "-"}</div>
                        )}
                      </div>

                      <div className="field">
                        <div className="label">Tijd (aanpassen)</div>
                        {isEditing ? (
                          <input
                            className="input"
                            value={draft.preferred_time}
                            onChange={(e) => setDraft((d) => ({ ...d, preferred_time: e.target.value }))}
                            placeholder="bijv. 14:30"
                          />
                        ) : (
                          <div className="value mono">{r.preferred_time || "-"}</div>
                        )}
                      </div>

                      <div className="field">
                        <div className="label">Richtprijs (aanpassen)</div>
                        {isEditing ? (
                          <input
                            className="input"
                            value={draft.price_text}
                            onChange={(e) => setDraft((d) => ({ ...d, price_text: e.target.value }))}
                            placeholder="Bijv. €79 of Op aanvraag"
                          />
                        ) : (
                          <div className="value mono">{r.price_text || "-"}</div>
                        )}
                      </div>

                      <div className="field">
                        <div className="label">Kwaliteit</div>
                        <div className="value">{r.quality || "-"}</div>
                      </div>

                      <div className="field full">
                        <div className="label">Notities / Opmerking (intern)</div>
                        {isEditing ? (
                          <textarea
                            className="textarea"
                            value={draft.notes}
                            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                            placeholder="Bijv. alternatief tijdstip: 15:30 / klant gebeld / prijs besproken…"
                          />
                        ) : (
                          <div className="value pre">{r.notes || "-"}</div>
                        )}
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
  --bg:#F6F8FC;
  --card:#FFFFFF;
  --line:#E6ECF5;
  --text:#0B1320;

  --muted:#54657A;

  --brand:#1E63FF;
  --brandSoft: rgba(30,99,255,0.10);
  --brandLine: rgba(30,99,255,0.18);

  --ok:#16A34A;
  --okSoft: rgba(22,163,74,0.10);

  --warn:#F59E0B;
  --warnSoft: rgba(245,158,11,0.12);

  --bad:#DC2626;
  --badSoft: rgba(220,38,38,0.10);

  --new:#2563EB;
  --newSoft: rgba(37,99,235,0.10);

  --used:#0EA5E9;
  --usedSoft: rgba(14,165,233,0.10);

  --edit:#7C3AED;
  --editSoft: rgba(124,58,237,0.10);

  --shadow: 0 12px 28px rgba(16,24,40,0.08);
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  background:var(--bg);
  color:var(--text);
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
  max-width: 1180px;
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
  flex: 0 0 auto;
}
.brandText{ min-width:0; }
.brandTitle{ font-weight: 950; line-height: 1.1; font-size: 15px; }
.brandSub{ font-size: 12px; color: var(--muted); margin-top: 2px; }

.topRight{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.controls{
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 16px 14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  flex-wrap:wrap;
}

/* ✅ op mobiel: segmented scrollbaar i.p.v. proppen */
.segmented{
  display:flex;
  gap:6px;
  padding: 6px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(16,24,40,0.04);
  overflow-x:auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}
.segmented::-webkit-scrollbar{ height: 8px; }
.segmented::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.12); border-radius: 999px; }

.segBtn{
  border:0;
  background: transparent;
  padding: 9px 12px;
  border-radius: 12px;
  cursor:pointer;
  font-weight: 850;
  color: var(--muted);
  white-space: nowrap;
  flex: 0 0 auto;
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
  max-width: 460px;
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
  max-width: 1180px;
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
  font-size: 14px;
  font-weight: 800;
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

.cardEditing{
  outline: 3px solid rgba(124,58,237,0.16);
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

.left{ min-width:0; flex: 1; }
.titleRow{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}
.name{
  font-weight: 950;
  font-size: 15px;
  line-height: 1.2;
  overflow:hidden;
  text-overflow: ellipsis;
  max-width: 680px;
}
.badges{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

.subRow{
  margin-top: 6px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;
}
.mutedText{ color: var(--muted); }
.dot{ opacity: 0.5; }
.strong{ color: var(--text); font-weight: 900; }
.mono{ font-variant-numeric: tabular-nums; }

.right{
  display:flex;
  align-items:flex-start;
  gap:10px;
  flex-shrink: 0;
}
.actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  justify-content:flex-end;
  align-items:center;
}
.chev{
  color: var(--muted);
  font-size: 16px;
  transform: translateY(2px);
}
details[open] .chev{ transform: rotate(180deg) translateY(-2px); }

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
  font-weight: 900;
  margin-bottom: 6px;
}
.value{
  font-size: 14px;
  color: var(--text);
  word-break: break-word;
  font-weight: 900;
}
.pre{ white-space: pre-wrap; }

.input, .textarea{
  width:100%;
  border:1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-weight: 850;
  color: var(--text);
  background:#fff;
  outline:none;
}
.textarea{ min-height: 90px; resize: vertical; }
.input:focus, .textarea:focus{
  box-shadow: 0 0 0 4px rgba(30,99,255,0.14);
  border-color: rgba(30,99,255,0.35);
}

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
.badgeBad{ border-color: rgba(220,38,38,0.25); background: var(--badSoft); color: #7F1D1D; }
.badgeNew{ border-color: rgba(37,99,235,0.25); background: var(--newSoft); color: #0B2E9E; }
.badgeUsed{ border-color: rgba(14,165,233,0.25); background: var(--usedSoft); color: #045B7C; }
.badgeEdit{ border-color: rgba(124,58,237,0.25); background: var(--editSoft); color: #3A1A8A; }

.chip{
  display:inline-flex;
  align-items:center;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 12px;
  font-weight: 850;
  color: var(--muted);
}
.chipOk{ background: var(--okSoft); border-color: rgba(22,163,74,0.25); color: #0B5A23; }
.chipBad{ background: var(--badSoft); border-color: rgba(220,38,38,0.25); color: #7F1D1D; }
.chipSoft{ background: #fff; }

.btn{
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  padding: 9px 12px;
  border-radius: 14px;
  cursor:pointer;
  font-weight: 950;
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

.btnBad{
  border: 0;
  background: linear-gradient(135deg, #DC2626, #FB7185);
  color:#fff;
  box-shadow: 0 12px 22px rgba(220,38,38,0.18);
}
.btnBad:hover{ filter: brightness(1.03); }

.emptyCard{
  border: 1px dashed var(--line);
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  color: var(--muted);
  text-align:center;
}

/* ✅ Responsive: eerder naar 1 kolom + knoppen stacken */
@media (max-width: 980px){
  .grid{ grid-template-columns: 1fr; }
  .name{ max-width: 100%; }
}

@media (max-width: 720px){
  .topbarInner{
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .topRight{
    justify-content: space-between;
    width: 100%;
  }
  .controls{
    flex-direction: column;
    align-items: stretch;
  }
  .rightControls{
    width:100%;
    justify-content:space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  .searchWrap{ max-width: none; min-width: 0; }

  .cardSum{
    flex-direction: column;
    align-items: stretch;
  }
  .right{
    justify-content: space-between;
    align-items: center;
  }
  .actions{
    width: 100%;
    justify-content: flex-start;
  }
  .actions .btn, .actions .chip{
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}
`;
