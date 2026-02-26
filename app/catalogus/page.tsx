"use client";

import { useEffect, useState, useCallback } from "react";

type Row = {
  id: string;
  brand: string;
  model: string;
  color: string;
  repair_type: string;
  quality: string;
  price: number | null;
};

type AddForm = {
  brand: string;
  model: string;
  color: string;
  repair_type: string;
  quality: string;
  price: string;
};

const EMPTY_FORM: AddForm = {
  brand: "", model: "", color: "", repair_type: "", quality: "Standaard", price: "",
};

export default function CatalogusPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Laden…");
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_FORM);
  const [addBusy, setAddBusy] = useState(false);

  // Alle merken eenmalig laden via RPC (geen 500-rij limiet)
  useEffect(() => {
    fetch("/api/catalog?brands=1")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBrands(data); })
      .catch(() => {});
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setStatus("Laden…");
    const params = new URLSearchParams();
    if (filterBrand) params.set("brand", filterBrand);
    if (search) params.set("q", search);

    const res = await fetch(`/api/catalog?${params}`);
    const data = await res.json();
    if (!res.ok) { setStatus("Fout bij laden."); return; }

    setRows(data);
    setStatus(`${data.length} reparaties geladen${filterBrand ? ` voor ${filterBrand}` : ""}.`);
  }, [filterBrand, search]);

  useEffect(() => { load(); }, [load]);

  async function savePrice(id: string) {
    setBusyId(id);
    const res = await fetch("/api/catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, price: editPrice }),
    });
    setBusyId(null);
    if (res.ok) { setEditId(null); load(true); }
    else setStatus("Fout bij opslaan.");
  }

  async function deleteRow(id: string, label: string) {
    if (!confirm(`Verwijder "${label}"?`)) return;
    setBusyId(id);
    const res = await fetch("/api/catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusyId(null);
    if (res.ok) load(true);
    else setStatus("Fout bij verwijderen.");
  }

  async function addRepair() {
    if (!addForm.brand || !addForm.model || !addForm.color || !addForm.repair_type) {
      setStatus("Vul alle verplichte velden in.");
      return;
    }
    setAddBusy(true);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    setAddBusy(false);
    if (res.ok) {
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      setFilterBrand(addForm.brand);
      load(true);
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(j.error || "Fout bij toevoegen.");
    }
  }

  const fmtPrice = (p: number | null) =>
    p == null ? <span style={{ color: "#94a3b8" }}>Op aanvraag</span>
              : `€ ${p.toFixed(2).replace(".", ",")}`;

  const styles = `
    .cat-wrap { max-width: 1200px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; }
    .cat-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .cat-title { font-size: 22px; font-weight: 800; margin: 0; }
    .cat-status { font-size: 13px; color: #64748b; margin-top: 4px; }
    .cat-controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .cat-select, .cat-search { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #fff; color: #0f172a; }
    .cat-search { min-width: 200px; }
    .cat-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f8fafc; }
    th { padding: 10px 12px; text-align: left; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: 0; }
    tr:hover td { background: #f8fafc; }
    .btn { appearance: none; border: 0; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-ghost { background: transparent; border: 1px solid #e2e8f0; color: #475569; }
    .btn-danger { background: #fee2e2; color: #b91c1c; }
    .btn-green { background: #16a34a; color: #fff; }
    .price-input { width: 90px; padding: 5px 8px; border: 1px solid #93c5fd; border-radius: 6px; font-size: 13px; }
    .add-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .add-form h3 { margin: 0 0 14px; font-size: 15px; font-weight: 700; }
    .add-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .add-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #475569; }
    .add-grid input { padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; }
    .add-grid input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
    .add-actions { margin-top: 14px; display: flex; gap: 8px; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #3b82f6; text-decoration: none; margin-bottom: 16px; font-weight: 600; }
    .back-link:hover { text-decoration: underline; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="cat-wrap">
        <a href="/" className="back-link">← Terug naar aanvragen</a>

        <div className="cat-header">
          <div>
            <h1 className="cat-title">Reparatie catalogus</h1>
            <div className="cat-status">{status}</div>
          </div>
          <button className="btn btn-green" onClick={() => setShowAdd(v => !v)}>
            {showAdd ? "✕ Annuleren" : "+ Reparatie toevoegen"}
          </button>
        </div>

        {showAdd && (
          <div className="add-form">
            <h3>Nieuwe reparatie toevoegen</h3>
            <div className="add-grid">
              {(["brand","model","color","repair_type","quality","price"] as (keyof AddForm)[]).map(field => (
                <label key={field}>
                  {field === "brand" ? "Merk *" : field === "model" ? "Model *" : field === "color" ? "Kleur *" : field === "repair_type" ? "Reparatietype *" : field === "quality" ? "Kwaliteit" : "Prijs (€)"}
                  <input
                    type={field === "price" ? "number" : "text"}
                    value={addForm[field]}
                    placeholder={field === "price" ? "bijv. 79.95" : ""}
                    onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="add-actions">
              <button className="btn btn-primary" disabled={addBusy} onClick={addRepair}>
                {addBusy ? "Opslaan…" : "Opslaan"}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); }}>
                Annuleren
              </button>
            </div>
          </div>
        )}

        <div className="cat-controls">
          <select className="cat-select" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
            <option value="">Alle merken</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input
            className="cat-search"
            placeholder="Zoek op model of reparatie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={() => load()}>Vernieuwen</button>
        </div>

        <div className="cat-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Merk</th>
                <th>Model</th>
                <th>Kleur</th>
                <th>Reparatietype</th>
                <th>Kwaliteit</th>
                <th>Prijs</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>Geen reparaties gevonden.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.brand}</td>
                  <td>{r.model}</td>
                  <td>{r.color}</td>
                  <td>{r.repair_type}</td>
                  <td>{r.quality}</td>
                  <td>
                    {editId === r.id ? (
                      <input
                        className="price-input"
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") savePrice(r.id); if (e.key === "Escape") setEditId(null); }}
                      />
                    ) : (
                      <span onClick={() => { setEditId(r.id); setEditPrice(r.price != null ? String(r.price) : ""); }} style={{ cursor: "pointer" }}>
                        {fmtPrice(r.price)}
                      </span>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {editId === r.id ? (
                      <>
                        <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => savePrice(r.id)}>
                          {busyId === r.id ? "…" : "Opslaan"}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setEditId(null)}>Annuleren</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-ghost" onClick={() => { setEditId(r.id); setEditPrice(r.price != null ? String(r.price) : ""); }}>
                          Prijs
                        </button>
                        <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => deleteRow(r.id, `${r.brand} ${r.model} – ${r.repair_type}`)}>
                          {busyId === r.id ? "…" : "Verwijder"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
