"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "./components/DashboardShell";

type Row = any;

// ── Helpers ──────────────────────────────────────────────
const AVATAR_COLORS = ["#3B7DF5","#16B364","#E5484D","#7C5CFC","#F59E0B","#0EA5E9","#EC4899","#10B981"];
function getAvatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getInitials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}
function fmtDate(d?: string) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return d;
}

// ── SVG Icons ──────────────────────────────────────────────
const I = {
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  check: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  refresh: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  trash: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  ),
};

const filterConfig = [
  { key: "pending"           as const, label: "Openstaand" },
  { key: "awaiting_approval" as const, label: "Wacht op klant" },
  { key: "approved"          as const, label: "Goedgekeurd" },
  { key: "rejected"          as const, label: "Afgewezen" },
  { key: "all"               as const, label: "Alles" },
];

type RepairItem = {
  issue: string;
  quality: string;
  price: string;
};

type Draft = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  brand: string;
  model: string;
  color: string;
  issue: string;
  quality: string;
  price_text: string;
  preferred_date: string;
  preferred_time: string;
  notes: string;
  save_to_catalog: boolean;
  repairs: RepairItem[];
};

const emptyDraft: Draft = {
  customer_name: "", customer_email: "", customer_phone: "",
  brand: "", model: "", color: "", issue: "", quality: "",
  price_text: "", preferred_date: "", preferred_time: "",
  notes: "", save_to_catalog: false, repairs: [],
};

export default function AdminPage() {
  const [rows, setRows]             = useState<Row[]>([]);
  const [filter, setFilter]         = useState<"pending" | "awaiting_approval" | "approved" | "rejected" | "all">("pending");
  const [statusMsg, setStatusMsg]   = useState("Laden…");
  const [query, setQuery]           = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [editId, setEditId]         = useState<string | null>(null);
  const [draft, setDraft]           = useState<Draft>(emptyDraft);
  const [addingRepair, setAddingRepair] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [newRepair, setNewRepair]   = useState<RepairItem>({ issue: "", quality: "Compatible", price: "" });

  const drawerOpen = editId !== null;
  const editingRow = rows.find(r => r.id === editId);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [r.customer_name, r.customer_email, r.customer_phone, r.brand, r.model, r.color, r.issue, r.price_text, r.preferred_date, r.status, r.notes]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  // Escape key → drawer sluiten
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelEdit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  async function load(silent = false) {
    if (!silent) setStatusMsg("Aanvragen laden…");
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/requests${params}`);
      const data = await res.json();
      if (!res.ok) { setRows([]); setStatusMsg("Fout bij ophalen."); return; }
      setRows(data || []);
      setStatusMsg(`Live (${(data || []).length})`);
    } catch { setRows([]); setStatusMsg("Netwerkfout."); }
  }

  async function approve(id: string) {
    if (!confirm("Aanvraag goedkeuren?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) { setStatusMsg("Fout bij goedkeuren."); setBusyId(null); return; }
      setStatusMsg("Goedgekeurd.");
      if (editId === id) cancelEdit();
      load(true);
    } catch { setStatusMsg("Netwerkfout."); }
    setBusyId(null);
  }

  async function reject(id: string) {
    const reason = prompt("Waarom afwijzen? (optioneel)");
    if (reason === null) return;
    if (!confirm("Aanvraag afwijzen?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, reason: (reason || "").trim() }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setStatusMsg("Fout bij afwijzen."); setBusyId(null); return; }
      setStatusMsg("Afgewezen.");
      if (editId === id) cancelEdit();
      load(true);
    } catch { setStatusMsg("Netwerkfout."); }
    setBusyId(null);
  }

  async function sendOffer(id: string) {
    if (!confirm("Offerte versturen ter goedkeuring door de klant?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await res.json().catch(() => ({}));
      setStatusMsg(j.mail_sent ? "Offerte verstuurd." : `Mail niet verstuurd: ${j.mail_error || j.stage || "onbekende fout"}`);
      load(true);
    } catch { setStatusMsg("Netwerkfout."); }
    setBusyId(null);
  }

  async function sendReminder(id: string) {
    if (!confirm("Herinneringsmail versturen?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/offer-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await res.json().catch(() => ({}));
      setStatusMsg(j.mail_sent ? "Herinnering verstuurd." : `Mail niet verstuurd: ${j.mail_error || j.stage || "onbekende fout"}`);
      load(true);
    } catch { setStatusMsg("Netwerkfout."); }
    setBusyId(null);
  }

  function startEdit(r: any) {
    setEditId(r.id);
    setDraft({
      customer_name:  r.customer_name  || "",
      customer_email: r.customer_email || "",
      customer_phone: r.customer_phone || "",
      brand:          r.brand          || "",
      model:          r.model          || "",
      color:          r.color          || "",
      issue:          r.issue          || "",
      quality:        r.quality        || "",
      price_text:     r.price_text     || "",
      preferred_date: r.preferred_date || "",
      preferred_time: r.preferred_time || "",
      notes:          r.notes          || "",
      save_to_catalog: false,
      repairs: Array.isArray(r.repairs) ? r.repairs : [],
    });
    setAddingRepair(false);
    setCatalogItems([]);
    setNewRepair({ issue: "", quality: "Compatible", price: "" });
  }

  function cancelEdit() {
    setEditId(null);
    setDraft(emptyDraft);
    setAddingRepair(false);
    setCatalogItems([]);
    setNewRepair({ issue: "", quality: "Compatible", price: "" });
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    setStatusMsg("Opslaan…");
    try {
      const { save_to_catalog, ...patch } = draft;
      const res = await fetch("/api/update-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setStatusMsg("Fout bij opslaan."); setBusyId(null); return; }

      if (save_to_catalog && draft.price_text) {
        const priceNum = parseFloat(draft.price_text.replace(/[€\s]/g, "").replace(",", "."));
        if (!isNaN(priceNum) && draft.brand && draft.model) {
          try {
            const catRes = await fetch(`/api/catalog?brand=${encodeURIComponent(draft.brand)}&model=${encodeURIComponent(draft.model)}`);
            if (catRes.ok) {
              const catalog: any[] = await catRes.json();
              const match = catalog.find(c =>
                c.color?.toLowerCase() === draft.color.toLowerCase() &&
                c.repair_type?.toLowerCase() === draft.issue.toLowerCase()
              );
              if (match) {
                await fetch("/api/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: match.id, price: priceNum }) });
                setStatusMsg("Opgeslagen + catalogus bijgewerkt.");
              } else {
                setStatusMsg("Opgeslagen. (Geen catalogusitem gevonden.)");
              }
            }
          } catch { setStatusMsg("Opgeslagen, maar fout bij catalogus."); }
        } else {
          setStatusMsg("Opgeslagen.");
        }
      } else {
        setStatusMsg("Opgeslagen.");
      }

      setBusyId(null);
      cancelEdit();
      load(true);
    } catch { setStatusMsg("Netwerkfout bij opslaan."); setBusyId(null); }
  }

  async function saveAndSendOffer(id: string) {
    if (!confirm("Wijzigingen opslaan en offerte versturen naar de klant?")) return;
    setBusyId(id);
    setStatusMsg("Opslaan…");
    try {
      const { save_to_catalog, ...patch } = draft;
      const saveRes = await fetch("/api/update-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch }),
      });
      const saveJ = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !saveJ?.ok) { setStatusMsg("Fout bij opslaan."); setBusyId(null); return; }

      setStatusMsg("Offerte versturen…");
      const offerRes = await fetch("/api/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const offerJ = await offerRes.json().catch(() => ({}));
      setStatusMsg(offerJ.mail_sent ? "Offerte verstuurd." : `Mail niet verstuurd: ${offerJ.mail_error || offerJ.stage || "onbekende fout"}`);
      cancelEdit();
      load(true);
    } catch { setStatusMsg("Netwerkfout."); }
    setBusyId(null);
  }

  useEffect(() => {
    load(false);
    if (!autoRefresh) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") load(true); }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, autoRefresh]);

  return (
    <DashboardShell>
      <style>{pageStyles}</style>

      {/* ── Topbar ── */}
      <div className="p-topbar">
        <h1 className="p-title">Aanvragen</h1>
        <div className="p-topright">
          <div className="p-livepill">
            <span className="p-livedot" />
            {statusMsg}
          </div>
          <button className="p-iconbtn" onClick={() => load(false)} title="Vernieuwen">
            {I.refresh}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="p-toolbar">
        <div className="p-tabs">
          {filterConfig.map(({ key, label }) => (
            <button
              key={key}
              className={`p-tab${filter === key ? " p-tab-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-toolright">
          <label className="p-autowrap">
            <div
              className="p-toggle"
              style={{ background: autoRefresh ? "var(--p-blue)" : "#D4D8E0" }}
              onClick={() => setAutoRefresh(v => !v)}
              role="switch"
              aria-checked={autoRefresh}
            />
            Auto
          </label>
          <div className="p-searchwrap">
            <span className="p-searchicon">{I.search}</span>
            <input
              className="p-searchinput"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoeken…"
            />
            {query && (
              <button className="p-searchclear" onClick={() => setQuery("")} aria-label="Wis">
                {I.x}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── List region ── */}
      <div className="p-listregion">
        <div className="p-listhead">
          <span className="p-count">{visibleRows.length}</span>
          <span className="p-countsub">
            {filter !== "all"
              ? `van ${rows.length} aanvragen`
              : "aanvragen"}
          </span>
        </div>

        {/* Tabel */}
        <div className="p-table">
          <div className="p-thead">
            <span>KLANT</span>
            <span>APPARAAT</span>
            <span>REPARATIE</span>
            <span>DATUM</span>
            <span className="p-right">PRIJS</span>
            <span className="p-right">ACTIES</span>
          </div>

          {visibleRows.length === 0 ? (
            <div className="p-empty">Geen aanvragen gevonden</div>
          ) : visibleRows.map((r: any) => {
            const dotColor =
              r.status === "approved"          ? "var(--p-green)"    :
              r.status === "rejected"           ? "var(--p-red)"      :
              r.status === "awaiting_approval"  ? "var(--p-amber-tx)" :
              "var(--p-amber-tx)";

            const avatarBg = getAvatarColor(r.customer_name || "");
            const initials = getInitials(r.customer_name || "?");
            const contact  = [r.customer_email, r.customer_phone].filter(Boolean).join(" · ");
            const device   = [r.brand, r.model].filter(Boolean).join(" ");
            const dateStr  = fmtDate(r.preferred_date);
            const isBusy   = busyId === r.id;
            const extras   = Array.isArray(r.repairs) ? r.repairs : [];
            const displayPrice = (() => {
              if (extras.length === 0) return r.price_text || null;
              const parseNum = (s: string) => { const n = parseFloat((s || "").replace(/[€\s]/g, "").replace(",", ".")); return isNaN(n) ? null : n; };
              const main = parseNum(r.price_text);
              const extraNums = extras.map((x: any) => parseNum(x.price)).filter((n: any): n is number => n !== null);
              if (main === null && extraNums.length === 0) return r.price_text || null;
              const sum = (main ?? 0) + extraNums.reduce((a: number, b: number) => a + b, 0);
              return `€${sum % 1 === 0 ? sum : sum.toFixed(2)}`;
            })();

            return (
              <div className="p-row" key={r.id}>

                {/* KLANT */}
                <div className="p-cust">
                  <span className="p-dot" style={{ background: dotColor }} />
                  <div className="p-avatar" style={{ background: avatarBg }}>{initials}</div>
                  <div className="p-custtxt">
                    <div className="p-custname">{r.customer_name || "Aanvraag"}</div>
                    <div className="p-custcontact">{contact || "–"}</div>
                  </div>
                </div>

                {/* APPARAAT */}
                <div className="p-deskonly">
                  {device ? <div className="p-celllabel">{device}</div> : null}
                  {r.color ? <div className="p-cellsub">{r.color}</div> : null}
                </div>

                {/* REPARATIE */}
                <div className="p-deskonly">
                  {r.issue ? <div className="p-celllabel" style={{ fontWeight: 500 }}>{r.issue}</div> : null}
                  {r.quality === "Officieel" && (
                    <span className="p-badge-official">Officieel</span>
                  )}
                </div>

                {/* DATUM */}
                <div className="p-deskonly">
                  {dateStr ? (
                    <>
                      <div className="p-celllabel" style={{ fontWeight: 500 }}>{dateStr}</div>
                      {r.preferred_time && <div className="p-cellsub">{r.preferred_time}</div>}
                    </>
                  ) : <span className="p-muted">–</span>}
                </div>

                {/* PRIJS */}
                <div className="p-right p-deskonly">
                  {displayPrice
                    ? <span className="p-price">{displayPrice}</span>
                    : <span className="p-muted">–</span>}
                </div>

                {/* Mobiele meta — alleen zichtbaar op mobiel */}
                <div className="p-mobilemeta">
                  {device && <span>{device}</span>}
                  {r.color && <span className="p-metasep">{r.color}</span>}
                  {r.issue && <span className="p-metasep">{r.issue}</span>}
                  {r.quality === "Officieel" && <span className="p-badge-official" style={{ fontSize: 11, padding: "2px 7px" }}>Officieel</span>}
                  {displayPrice && <span className="p-metaprice">{displayPrice}</span>}
                  {dateStr && <span className="p-metasep p-metadate">{dateStr}{r.preferred_time ? ` ${r.preferred_time}` : ""}</span>}
                </div>

                {/* ACTIES */}
                <div className="p-actions">
                  <button className="p-iconbtn" title="Bewerken" onClick={() => startEdit(r)} disabled={isBusy}>
                    {I.edit}
                  </button>

                  {r.status === "pending" && (
                    <button className="p-iconbtn" title="Stuur Offerte" onClick={() => sendOffer(r.id)} disabled={isBusy}>
                      {I.mail}
                    </button>
                  )}
                  {r.status === "awaiting_approval" && (
                    <div className="p-reminder-wrap">
                      <button
                        className="p-iconbtn"
                        title={r.reminder_sent_at ? `Herinnering verstuurd op ${new Date(r.reminder_sent_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Stuur Herinnering"}
                        onClick={() => sendReminder(r.id)}
                        disabled={isBusy}
                      >
                        {I.bell}
                        {r.reminder_sent_at && <span className="p-reminder-dot" aria-hidden="true" />}
                      </button>
                    </div>
                  )}

                  {(r.status === "pending" || r.status === "awaiting_approval") && (
                    <>
                      <button className="p-btn p-btn-danger" title="Afwijzen" onClick={() => reject(r.id)} disabled={isBusy}>
                        {I.x}<span className="p-btn-label">{isBusy ? "…" : "Afwijzen"}</span>
                      </button>
                      <button className="p-btn p-btn-primary" title="Goedkeuren" onClick={() => approve(r.id)} disabled={isBusy}>
                        {I.check}<span className="p-btn-label">{isBusy ? "…" : "Goedkeuren"}</span>
                      </button>
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scrim ── */}
      <div
        className="p-scrim"
        style={{ opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none" }}
        onClick={cancelEdit}
        aria-hidden="true"
      />

      {/* ── Slide-over Drawer ── */}
      <div
        className="p-drawer"
        style={{ transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Aanvraag bewerken"
      >
        {editingRow && (
          <>
            {/* Header */}
            <div className="p-edit-header">
              <div
                className="p-avatar"
                style={{ width: 44, height: 44, fontSize: 15, flexShrink: 0, background: getAvatarColor(editingRow.customer_name || "") }}
              >
                {getInitials(editingRow.customer_name || "?")}
              </div>
              <div className="p-edit-htxt">
                <div className="p-edit-eyebrow">AANVRAAG BEWERKEN</div>
                <h2 className="p-edit-title">{draft.customer_name || editingRow.customer_name || "Aanvraag"}</h2>
                <div className="p-edit-sub">
                  {[draft.brand, draft.model].filter(Boolean).join(" ") || "–"}
                  {editingRow.created_at
                    ? ` · Aangevraagd ${new Date(editingRow.created_at).toLocaleDateString("nl-NL")}`
                    : ""}
                </div>
              </div>
              <button className="p-iconbtn" onClick={cancelEdit} title="Sluiten">{I.x}</button>
            </div>

            {/* Body (scrollbaar) */}
            <div className="p-drawer-body">

              {/* Klantgegevens */}
              <div className="p-formsection">
                <div className="p-sectiontitle">Klantgegevens</div>
                <div className="p-field">
                  <label>Naam</label>
                  <input className="p-input" value={draft.customer_name}
                    onChange={e => setDraft(d => ({ ...d, customer_name: e.target.value }))} />
                </div>
                <div className="p-fieldrow">
                  <div className="p-field">
                    <label>E-mailadres</label>
                    <input className="p-input" type="email" value={draft.customer_email}
                      onChange={e => setDraft(d => ({ ...d, customer_email: e.target.value }))} />
                  </div>
                  <div className="p-field">
                    <label>Telefoon</label>
                    <input className="p-input" value={draft.customer_phone}
                      onChange={e => setDraft(d => ({ ...d, customer_phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Apparaat */}
              <div className="p-formsection">
                <div className="p-sectiontitle">Apparaat</div>
                <div className="p-fieldrow">
                  <div className="p-field">
                    <label>Merk</label>
                    <input className="p-input" value={draft.brand}
                      onChange={e => setDraft(d => ({ ...d, brand: e.target.value }))} />
                  </div>
                  <div className="p-field">
                    <label>Model</label>
                    <input className="p-input" value={draft.model}
                      onChange={e => setDraft(d => ({ ...d, model: e.target.value }))} />
                  </div>
                </div>
                <div className="p-field">
                  <label>Kleur</label>
                  <input className="p-input" value={draft.color}
                    onChange={e => setDraft(d => ({ ...d, color: e.target.value }))} />
                </div>
              </div>

              {/* Reparatie */}
              <div className="p-formsection">
                <div className="p-sectiontitle">Reparatie</div>
                <div className="p-field">
                  <label>Type reparatie</label>
                  <input className="p-input" value={draft.issue}
                    onChange={e => setDraft(d => ({ ...d, issue: e.target.value }))} />
                </div>
                <div
                  className="p-switchrow"
                  onClick={() => setDraft(d => ({ ...d, quality: d.quality === "Officieel" ? "Compatible" : "Officieel" }))}
                  role="switch"
                  aria-checked={draft.quality === "Officieel"}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setDraft(d => ({ ...d, quality: d.quality === "Officieel" ? "Compatible" : "Officieel" })); } }}
                >
                  <div>
                    <div className="p-switchtxt">Officieel onderdeel</div>
                    <div className="p-switchsub">Origineel onderdeel van fabrikant</div>
                  </div>
                  <div
                    className="p-switch"
                    style={{ background: draft.quality === "Officieel" ? "var(--p-blue)" : "#D4D8E0" }}
                  >
                    <span className="p-switch-thumb" style={{ left: draft.quality === "Officieel" ? 21 : 3 }} />
                  </div>
                </div>
              </div>

              {/* Extra reparaties */}
              <div className="p-formsection">
                <div className="p-sectiontitle">Extra reparaties</div>

                {draft.repairs.length > 0 && (
                  <div className="p-repair-list">
                    {draft.repairs.map((r, i) => (
                      <div key={i} className="p-repair-item">
                        <div className="p-repair-info">
                          <span className="p-repair-issue">{r.issue}</span>
                          {r.quality && <span className="p-badge-official" style={{ marginLeft: 6 }}>{r.quality}</span>}
                        </div>
                        <div className="p-repair-right">
                          {r.price && <span className="p-price" style={{ fontSize: 13 }}>€{r.price}</span>}
                          <button
                            className="p-iconbtn"
                            title="Verwijder"
                            onClick={() => setDraft(d => ({ ...d, repairs: d.repairs.filter((_, j) => j !== i) }))}
                          >
                            {I.x}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {addingRepair ? (
                  <div className="p-repair-adder">
                    {catalogItems.length > 0 && (
                      <div className="p-field">
                        <label>Kies uit catalogus</label>
                        <select
                          className="p-input"
                          value={newRepair.issue}
                          onChange={e => {
                            const found = catalogItems.find(c => c.repair_type === e.target.value);
                            if (found) {
                              setNewRepair(nr => ({
                                ...nr,
                                issue: found.repair_type,
                                price: found.price != null ? String(found.price) : nr.price,
                                quality: found.show_quality ? nr.quality : "",
                              }));
                            } else {
                              setNewRepair(nr => ({ ...nr, issue: e.target.value }));
                            }
                          }}
                        >
                          <option value="">— Kies reparatie —</option>
                          {catalogItems.map(c => (
                            <option key={c.id} value={c.repair_type}>
                              {c.repair_type}{c.price != null ? ` – €${c.price}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="p-fieldrow">
                      <div className="p-field">
                        <label>Reparatietype</label>
                        <input
                          className="p-input"
                          value={newRepair.issue}
                          onChange={e => setNewRepair(nr => ({ ...nr, issue: e.target.value }))}
                          placeholder="bijv. Batterij"
                        />
                      </div>
                      <div className="p-field">
                        <label>Prijs</label>
                        <div className="p-inputwrap">
                          <span className="p-prefix">€</span>
                          <input
                            className="p-input p-input-prefixed"
                            value={newRepair.price}
                            onChange={e => setNewRepair(nr => ({ ...nr, price: e.target.value }))}
                            placeholder="bijv. 45"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-repair-adder-btns">
                      <button
                        className="p-btn p-btn-ghost"
                        onClick={() => { setAddingRepair(false); setNewRepair({ issue: "", quality: "Compatible", price: "" }); }}
                      >
                        Annuleren
                      </button>
                      <button
                        className="p-btn p-btn-primary"
                        disabled={!newRepair.issue.trim()}
                        onClick={() => {
                          if (!newRepair.issue.trim()) return;
                          setDraft(d => ({ ...d, repairs: [...d.repairs, { issue: newRepair.issue.trim(), quality: newRepair.quality, price: newRepair.price.trim() }] }));
                          setAddingRepair(false);
                          setNewRepair({ issue: "", quality: "Compatible", price: "" });
                        }}
                      >
                        {I.check}Toevoegen
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="p-btn p-btn-ghost p-repair-add-btn"
                    onClick={async () => {
                      setAddingRepair(true);
                      if (draft.brand && draft.model) {
                        try {
                          const res = await fetch(`/api/catalog?brand=${encodeURIComponent(draft.brand)}&model=${encodeURIComponent(draft.model)}`);
                          if (res.ok) {
                            const items: any[] = await res.json();
                            const colorItems = draft.color ? items.filter(c => c.color?.toLowerCase() === draft.color.toLowerCase()) : items;
                            const source = colorItems.length > 0 ? colorItems : items;
                            const seen = new Set<string>();
                            const unique = source.filter(c => { if (seen.has(c.repair_type)) return false; seen.add(c.repair_type); return true; });
                            setCatalogItems(unique);
                          }
                        } catch { /* toon handmatig formulier */ }
                      }
                    }}
                  >
                    + Voeg reparatie toe
                  </button>
                )}
              </div>

              {/* Afspraak & prijs */}
              <div className="p-formsection">
                <div className="p-sectiontitle">Afspraak &amp; prijs</div>
                <div className="p-fieldrow">
                  <div className="p-field">
                    <label>Datum</label>
                    <input className="p-input p-input-date" type="date" value={draft.preferred_date}
                      onChange={e => setDraft(d => ({ ...d, preferred_date: e.target.value }))} />
                  </div>
                  <div className="p-field">
                    <label>Tijd</label>
                    <input className="p-input p-input-time" type="time" value={draft.preferred_time}
                      onChange={e => setDraft(d => ({ ...d, preferred_time: e.target.value }))} />
                  </div>
                </div>
                <div className="p-field">
                  <label>Prijs</label>
                  <div className="p-inputwrap">
                    <span className="p-prefix">€</span>
                    <input className="p-input p-input-prefixed" value={draft.price_text}
                      onChange={e => setDraft(d => ({ ...d, price_text: e.target.value }))}
                      placeholder="bijv. 79" />
                  </div>
                  <label className="p-cataloglabel">
                    <input type="checkbox" checked={draft.save_to_catalog}
                      onChange={e => setDraft(d => ({ ...d, save_to_catalog: e.target.checked }))} />
                    Ook opslaan in catalogus
                  </label>
                  {draft.repairs.length > 0 && (() => {
                    const parseNum = (s: string) => { const n = parseFloat(s.replace(/[€\s]/g, "").replace(",", ".")); return isNaN(n) ? null : n; };
                    const main = parseNum(draft.price_text);
                    const extras = draft.repairs.map(r => parseNum(r.price)).filter((n): n is number => n !== null);
                    if (main === null && extras.length === 0) return null;
                    const sum = (main ?? 0) + extras.reduce((a, b) => a + b, 0);
                    return (
                      <div className="p-price-total">
                        <span>Totaal</span>
                        <span className="p-price-total-val">€{sum % 1 === 0 ? sum : sum.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Notities */}
              <div className="p-formsection" style={{ borderBottom: "none" }}>
                <div className="p-sectiontitle">Notities (intern)</div>
                <div className="p-field">
                  <textarea className="p-input p-textarea" value={draft.notes}
                    onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Interne notities…" />
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-edit-footer">
              <button
                className="p-dellink"
                onClick={() => { cancelEdit(); reject(editingRow.id); }}
                disabled={busyId === editId}
              >
                {I.trash}Afwijzen
              </button>
              <div className="p-footer-right">
                <button className="p-btn p-btn-ghost p-btn-lg" onClick={cancelEdit}>
                  Annuleren
                </button>
                {editingRow.status === "pending" && (
                  <button
                    className="p-btn p-btn-offer p-btn-lg"
                    onClick={() => saveAndSendOffer(editingRow.id)}
                    disabled={busyId === editId}
                    title="Opslaan en offerte versturen naar klant"
                  >
                    {I.mail}{busyId === editId ? "Bezig…" : "Stuur Offerte"}
                  </button>
                )}
                <button
                  className="p-btn p-btn-primary p-btn-lg"
                  onClick={() => saveEdit(editingRow.id)}
                  disabled={busyId === editId}
                >
                  {I.check}{busyId === editId ? "Bezig…" : "Opslaan"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

    </DashboardShell>
  );
}

const pageStyles = `
/* ── Design tokens ── */
:root {
  --p-blue:      #2563EB;
  --p-blue-600:  #1F5AE0;
  --p-blue-50:   #EAF1FE;
  --p-green:     #16B364;
  --p-green-50:  #E7F8EF;
  --p-amber-bg:  #FFF1E0;
  --p-amber-tx:  #B45309;
  --p-red:       #E5484D;
  --p-red-50:    #FEF2F2;
  --p-ink:       #141A26;
  --p-ink-2:     #4B5566;
  --p-muted:     #8A93A6;
  --p-muted-2:   #A8AFBE;
  --p-line:      #ECEEF2;
  --p-line-2:    #E3E6EC;
  --p-bg:        #FFFFFF;
  --p-bg-soft:   #F7F8FA;
  --p-font:      var(--font-jakarta), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --p-shadow-sm: 0 1px 2px rgba(20,26,38,.05);
}

/* ── Topbar ── */
.p-topbar {
  height: 64px;
  border-bottom: 1px solid var(--p-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  font-family: var(--p-font);
  background: var(--p-bg);
  position: sticky;
  top: 0;
  z-index: 10;
}
.p-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--p-ink);
  margin: 0;
  letter-spacing: -.3px;
  font-family: var(--p-font);
}
.p-topright {
  display: flex;
  align-items: center;
  gap: 12px;
}
.p-livepill {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--p-green-50);
  color: #0E8A4C;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 13px;
  border-radius: 999px;
  white-space: nowrap;
  font-family: var(--p-font);
}
.p-livedot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--p-green);
  flex-shrink: 0;
}
.p-iconbtn {
  width: 34px; height: 34px;
  border-radius: 9px;
  border: 1px solid var(--p-line-2);
  background: var(--p-bg);
  display: grid;
  place-items: center;
  color: var(--p-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .12s, color .12s;
}
.p-iconbtn:hover { background: var(--p-bg-soft); color: var(--p-ink-2); }
.p-iconbtn:disabled { opacity: .45; cursor: not-allowed; }
.p-iconbtn svg { width: 16px; height: 16px; }
.p-reminder-wrap { position: relative; display: inline-flex; }
.p-reminder-dot {
  position: absolute;
  top: 3px; right: 3px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--p-green);
  border: 2px solid var(--p-bg);
  pointer-events: none;
}

/* ── Toolbar ── */
.p-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px 0;
  font-family: var(--p-font);
  flex-wrap: wrap;
  gap: 12px;
}
.p-tabs {
  display: flex;
  gap: 2px;
  background: var(--p-bg-soft);
  padding: 5px;
  border-radius: 12px;
  flex-wrap: wrap;
}
.p-tab {
  padding: 9px 16px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--p-ink-2);
  cursor: pointer;
  border: none;
  background: none;
  font-family: var(--p-font);
  white-space: nowrap;
  transition: background .12s, color .12s;
}
.p-tab:hover { color: var(--p-ink); }
.p-tab-active {
  background: var(--p-bg);
  color: var(--p-ink);
  box-shadow: var(--p-shadow-sm);
}
.p-toolright {
  display: flex;
  align-items: center;
  gap: 16px;
}
.p-autowrap {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--p-ink-2);
  cursor: pointer;
  font-family: var(--p-font);
  user-select: none;
}
.p-toggle {
  width: 38px; height: 22px;
  border-radius: 999px;
  position: relative;
  flex-shrink: 0;
  transition: background .15s;
}
.p-toggle::after {
  content: "";
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fff;
  top: 3px; right: 3px;
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
  transition: right .15s;
}
.p-searchwrap {
  position: relative;
  display: flex;
  align-items: center;
}
.p-searchicon {
  position: absolute;
  left: 12px;
  color: var(--p-muted);
  pointer-events: none;
  display: flex;
}
.p-searchinput {
  width: 268px;
  border: 1px solid var(--p-line-2);
  border-radius: 10px;
  padding: 9px 36px 9px 38px;
  font-size: 13.5px;
  font-family: var(--p-font);
  font-weight: 500;
  color: var(--p-ink);
  background: var(--p-bg);
  outline: none;
  transition: border-color .12s, box-shadow .12s;
}
.p-searchinput:focus {
  border-color: var(--p-blue);
  box-shadow: 0 0 0 3px var(--p-blue-50);
}
.p-searchinput::placeholder { color: var(--p-muted-2); }
.p-searchclear {
  position: absolute;
  right: 8px;
  width: 22px; height: 22px;
  border-radius: 6px;
  border: none;
  background: var(--p-bg-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--p-muted);
}
.p-searchclear:hover { background: var(--p-line); color: var(--p-ink-2); }
.p-searchclear svg { width: 12px; height: 12px; }

/* ── List region ── */
.p-listregion {
  padding: 22px 28px 28px;
  font-family: var(--p-font);
}
.p-listhead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
}
.p-count {
  font-size: 19px;
  font-weight: 800;
  color: var(--p-ink);
  font-family: var(--p-font);
}
.p-countsub {
  font-size: 14px;
  color: var(--p-muted);
  font-weight: 500;
  white-space: nowrap;
  font-family: var(--p-font);
}

/* ── Table ── */
.p-table {
  width: 100%;
  border: 1px solid var(--p-line);
  border-radius: 14px;
  overflow: hidden;
  background: var(--p-bg);
}
.p-thead,
.p-row {
  display: grid;
  grid-template-columns: 2.3fr 1.7fr 1.6fr .95fr .8fr 340px;
  align-items: center;
  column-gap: 18px;
}
.p-thead {
  padding: 11px 20px;
  background: var(--p-bg-soft);
  border-bottom: 1px solid var(--p-line);
}
.p-thead span {
  font-size: 11px;
  letter-spacing: .08em;
  font-weight: 700;
  color: var(--p-muted);
  font-family: var(--p-font);
  text-transform: uppercase;
}
.p-row {
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-line);
  transition: background .1s;
}
.p-row:last-child { border-bottom: none; }
.p-row:hover { background: #FBFCFE; }

.p-right { text-align: right; }

/* ── Row cells ── */
.p-cust {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.p-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.p-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  font-family: var(--p-font);
  letter-spacing: .02em;
}
.p-custtxt { min-width: 0; }
.p-custname {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--p-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--p-font);
}
.p-custcontact {
  font-size: 12.5px;
  color: var(--p-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--p-font);
}
.p-celllabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--p-ink);
  font-family: var(--p-font);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-cellsub {
  font-size: 12.5px;
  color: var(--p-muted);
  margin-top: 2px;
  font-family: var(--p-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-price {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: -.2px;
  font-family: var(--p-font);
  color: var(--p-ink);
  white-space: nowrap;
}
.p-muted {
  color: var(--p-muted-2);
  font-size: 13px;
  font-family: var(--p-font);
}
.p-badge-official {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 7px;
  background: var(--p-blue-50);
  color: var(--p-blue);
  font-family: var(--p-font);
  line-height: 1.4;
}

/* ── Action buttons ── */
.p-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  justify-content: flex-end;
}
.p-btn {
  font-family: var(--p-font);
  font-size: 13px;
  font-weight: 600;
  border-radius: 9px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  padding: 8px 13px;
  line-height: 1;
  white-space: nowrap;
  transition: background .12s;
}
.p-btn:disabled { opacity: .45; cursor: not-allowed; }
.p-btn svg { width: 15px; height: 15px; }
.p-btn-primary { background: var(--p-blue); color: #fff; }
.p-btn-primary:not(:disabled):hover { background: var(--p-blue-600); }
.p-btn-ghost { background: var(--p-bg); border-color: var(--p-line-2); color: var(--p-ink-2); }
.p-btn-ghost:not(:disabled):hover { background: var(--p-bg-soft); }
.p-btn-offer { background: var(--p-amber-bg); color: var(--p-amber-tx); border-color: #F5C77E; }
.p-btn-offer:not(:disabled):hover { background: #FDEACB; }
.p-btn-danger { background: transparent; color: var(--p-red); border-color: transparent; }
.p-btn-danger:not(:disabled):hover { background: var(--p-red-50); }
.p-btn-lg { padding: 11px 20px; font-size: 14px; border-radius: 10px; }

/* ── Empty state ── */
.p-empty {
  padding: 64px 24px;
  text-align: center;
  color: var(--p-muted);
  font-size: 14px;
  font-weight: 500;
  font-family: var(--p-font);
}

/* ── Scrim ── */
.p-scrim {
  position: fixed;
  inset: 0;
  background: rgba(20,26,38,.32);
  backdrop-filter: blur(1.5px);
  z-index: 40;
  transition: opacity .2s ease;
}

/* ── Drawer ── */
.p-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 480px;
  background: var(--p-bg);
  box-shadow: -12px 0 40px rgba(20,26,38,.16);
  display: flex;
  flex-direction: column;
  z-index: 50;
  transition: transform 220ms ease-out;
  font-family: var(--p-font);
}
.p-edit-header {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--p-line);
  flex-shrink: 0;
}
.p-edit-htxt { flex: 1; min-width: 0; }
.p-edit-eyebrow {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--p-blue);
  letter-spacing: .04em;
  font-family: var(--p-font);
}
.p-edit-title {
  margin: 3px 0 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -.3px;
  font-family: var(--p-font);
  color: var(--p-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-edit-sub {
  font-size: 12.5px;
  color: var(--p-muted);
  margin-top: 3px;
  font-family: var(--p-font);
}

/* ── Drawer body (scrollable) ── */
.p-drawer-body {
  flex: 1;
  overflow-y: auto;
}
.p-formsection {
  padding: 15px 24px;
  border-bottom: 1px solid var(--p-line);
}
.p-sectiontitle {
  font-size: 11px;
  letter-spacing: .1em;
  font-weight: 700;
  color: var(--p-muted);
  margin-bottom: 11px;
  text-transform: uppercase;
  font-family: var(--p-font);
}
.p-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 11px;
}
.p-field:last-child { margin-bottom: 0; }
.p-field label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--p-ink-2);
  font-family: var(--p-font);
}
.p-fieldrow {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.p-input {
  border: 1px solid var(--p-line-2);
  border-radius: 10px;
  background: var(--p-bg);
  padding: 10px 13px;
  font-size: 14px;
  font-family: var(--p-font);
  color: var(--p-ink);
  font-weight: 500;
  outline: none;
  transition: border-color .12s, box-shadow .12s;
  width: 100%;
}
.p-input:focus {
  border-color: var(--p-blue);
  box-shadow: 0 0 0 3px var(--p-blue-50);
}
.p-input::placeholder { color: var(--p-muted-2); }
.p-input-prefixed { padding-left: 32px; }
.p-inputwrap { position: relative; display: flex; }
.p-inputwrap .p-input { flex: 1; }
.p-prefix {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-muted);
  font-weight: 600;
  font-size: 14px;
  pointer-events: none;
  font-family: var(--p-font);
}
.p-textarea {
  min-height: 80px;
  resize: vertical;
}
.p-input-date,
.p-input-time {
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}
.p-input-date::-webkit-calendar-picker-indicator,
.p-input-time::-webkit-calendar-picker-indicator {
  opacity: .5;
  cursor: pointer;
}
.p-input-date::-webkit-calendar-picker-indicator:hover,
.p-input-time::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}
.p-cataloglabel {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--p-muted);
  cursor: pointer;
  font-family: var(--p-font);
  font-weight: 500;
}

/* ── Toggle switch ── */
.p-switchrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--p-line-2);
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: background .1s;
}
.p-switchrow:hover { background: var(--p-bg-soft); }
.p-switchtxt { font-size: 13.5px; font-weight: 600; color: var(--p-ink); font-family: var(--p-font); }
.p-switchsub { font-size: 12px; color: var(--p-muted); font-weight: 500; margin-top: 1px; font-family: var(--p-font); }
.p-switch {
  width: 42px; height: 24px;
  border-radius: 999px;
  position: relative;
  flex-shrink: 0;
  transition: background .15s;
}
.p-switch-thumb {
  position: absolute;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  transition: left .15s;
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
}

/* ── Drawer footer ── */
.p-edit-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--p-line);
  background: var(--p-bg-soft);
  flex-shrink: 0;
}
.p-footer-right { display: flex; gap: 10px; }
.p-dellink {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-red);
  background: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--p-font);
  padding: 0;
}
.p-dellink:hover { text-decoration: underline; }
.p-dellink:disabled { opacity: .45; cursor: not-allowed; }
.p-dellink svg { width: 15px; height: 15px; }

/* ── Extra reparaties ── */
.p-repair-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.p-repair-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border: 1px solid var(--p-line-2);
  border-radius: 10px;
  background: var(--p-bg-soft);
  gap: 10px;
}
.p-repair-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.p-repair-issue {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--p-ink);
  font-family: var(--p-font);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-repair-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.p-repair-adder {
  border: 1px solid var(--p-blue);
  border-radius: 12px;
  padding: 14px;
  background: var(--p-blue-50);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.p-repair-adder-btns {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.p-repair-add-btn {
  width: 100%;
  justify-content: center;
  border-style: dashed;
  color: var(--p-blue);
  font-size: 13.5px;
}
.p-repair-add-btn:hover { background: var(--p-blue-50); border-style: solid; }
.p-price-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 9px 13px;
  background: var(--p-blue-50);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-ink-2);
  font-family: var(--p-font);
}
.p-price-total-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--p-blue);
}

/* ── Desktop only / mobile meta ── */
.p-mobilemeta { display: none; }

/* ── Responsive: tablet ── */
@media (max-width: 1100px) {
  .p-thead,
  .p-row {
    grid-template-columns: 2fr 1.5fr 1.5fr 1fr 340px;
  }
  .p-thead span:nth-child(5),
  .p-row > div:nth-child(5) { display: none; }
}

/* ── Responsive: smal tablet ── */
@media (max-width: 900px) {
  .p-thead,
  .p-row {
    grid-template-columns: 2fr 1.5fr 1fr 180px;
  }
  .p-thead span:nth-child(3),
  .p-row > div:nth-child(3) { display: none; }
  .p-btn-label { display: none; }
  .p-btn { padding: 8px; gap: 0; }
}

/* ── Responsive: mobile ── */
@media (max-width: 720px) {
  .p-topbar { padding: 0 16px; height: 56px; }
  .p-title { font-size: 18px; }
  .p-toolbar { padding: 12px 16px 0; }
  .p-tabs { gap: 1px; overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .p-tabs::-webkit-scrollbar { display: none; }
  .p-tab { padding: 7px 12px; font-size: 12.5px; flex-shrink: 0; }
  .p-toolright { display: none; }
  .p-listregion { padding: 14px 12px 80px; }
  .p-thead { display: none; }
  .p-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px 14px 10px;
    gap: 0;
    text-align: left;
  }
  .p-deskonly { display: none; }
  .p-mobilemeta {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 4px;
    padding-left: 46px;
    margin-top: 4px;
    margin-bottom: 6px;
    font-size: 12.5px;
    color: var(--p-ink-2);
    font-weight: 500;
    font-family: var(--p-font);
    text-align: left;
    width: 100%;
  }
  .p-metasep::before {
    content: "·";
    margin-right: 4px;
    color: var(--p-muted-2);
  }
  .p-metaprice {
    font-weight: 700;
    color: var(--p-ink);
    margin-left: 2px;
  }
  .p-metadate {
    color: var(--p-muted);
  }
  .p-cust { width: 100%; }
  .p-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
    padding-left: 46px;
    width: 100%;
  }
  .p-topbar { justify-content: space-between; }
  .p-toolbar { justify-content: flex-start; }
  .p-listhead { justify-content: flex-start; }
  .p-drawer { width: 100%; }
  .p-searchinput { width: 200px; }
}
`;
