"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Row = any;

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [status, setStatus] = useState("Laden…");

  async function load() {
    setStatus("Aanvragen laden…");

    let q = supabase.from("repair_requests").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setRows([]);
      setStatus("Fout bij ophalen.");
      return;
    }

    setRows(data || []);
    setStatus(`Aanvragen geladen (${(data || []).length}).`);
  }

  async function approve(id: string) {
    if (!confirm("Weet je zeker dat je deze aanvraag wilt goedkeuren?")) return;
    setStatus("Goedkeuren…");

    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error(json);
      setStatus("Fout bij goedkeuren.");
      return;
    }

    setStatus("Goedgekeurd.");
    load();
  }

  useEffect(() => { load(); }, [filter]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Reparatie-aanvragen (beheer)</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>Alleen intern gebruik.</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: "#555", fontSize: 14 }}>{status}</div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={{ padding: "6px 10px" }}>
          <option value="pending">Alleen pending</option>
          <option value="approved">Alleen approved</option>
          <option value="all">Alles</option>
        </select>
        <button onClick={load} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd" }}>
          Refresh
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              {["Datum","Naam","Contact","Toestel","Reparatie","Richtprijs","Voorkeur","Status","Acties"].map(h => (
                <th key={h} style={{ border: "1px solid #ddd", padding: 8, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ border: "1px solid #ddd", padding: 12, textAlign: "center" }}>
                  Geen aanvragen.
                </td>
              </tr>
            ) : rows.map((r: any) => {
              const createdAt = r.created_at ? new Date(r.created_at).toLocaleString("nl-NL") : "";
              const toestel = [r.brand||"", r.model||"", r.color?`(${r.color})`:""].join(" ").trim();
              const contact = `${r.customer_email||""}${r.customer_phone?` / ${r.customer_phone}`:""}`;
              const voorkeur = `${r.preferred_date||""}${r.preferred_time?` ${r.preferred_time}`:""}`;

              return (
                <tr key={r.id}>
                  {[createdAt, r.customer_name||"", contact, toestel, r.issue||"", r.price_text||"", voorkeur, r.status||""]
                    .map((t, i) => <td key={i} style={{ border: "1px solid #ddd", padding: 8 }}>{t}</td>)}

                  <td style={{ border: "1px solid #ddd", padding: 8 }}>
                    {r.status === "approved" ? (
                      <span style={{ color: "#16a34a", fontWeight: 800 }}>✔ Goedgekeurd</span>
                    ) : (
                      <button
                        onClick={() => approve(r.id)}
                        style={{ padding: "6px 10px", border: 0, borderRadius: 10, background: "#16a34a", color: "#fff", cursor: "pointer" }}
                      >
                        Goedkeuren
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
