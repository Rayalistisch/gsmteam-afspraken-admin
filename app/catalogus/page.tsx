"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardShell from "../components/DashboardShell";

type Row = {
  id: string;
  brand: string;
  model: string;
  color: string;
  repair_type: string;
  quality: string;
  price: number | null;
};


const REGULAR_REPAIR_TYPES = [
  "Schermmodule", "Batterij", "Achterpaneel", "Behuizing",
  "Camera achterzijde", "Camera voorzijde", "Cameraglas",
  "Luidspreker", "Oplaadpoort",
];
const SERVICE_REPAIR_TYPES = ["Onderzoeken", "Reinigen", "Softwarereset", "Overige"];
const REGULAR_QUALITIES = ["Officieel", "Compatible"];

type RepairSelection = { repair_type: string; qualities: string[]; prices: Record<string, string> };
type DeviceForm = { brand: string; model: string; colors: string[]; repairs: RepairSelection[] };
const EMPTY_DEVICE_FORM: DeviceForm = { brand: "", model: "", colors: [], repairs: [] };

function buildRows(form: DeviceForm) {
  const rows: { brand: string; model: string; color: string; repair_type: string; quality: string; price: number | null }[] = [];
  const brand = form.brand.trim();
  const model = form.model.trim();
  for (const color of form.colors) {
    for (const repair of form.repairs) {
      for (const quality of repair.qualities) {
        const priceStr = (repair.prices[quality] || "").trim().replace(",", ".");
        const price = priceStr !== "" ? Number(priceStr) || null : null;
        rows.push({ brand, model, color: color.trim(), repair_type: repair.repair_type, quality, price });
      }
    }
  }
  return rows;
}

function validateDeviceForm(form: DeviceForm): string | null {
  if (!form.brand.trim()) return "Vul een merk in.";
  if (!form.model.trim()) return "Vul een model in.";
  if (form.colors.length === 0) return "Voeg minimaal één kleur toe.";
  if (form.repairs.length === 0) return "Selecteer minimaal één reparatietype.";
  for (const r of form.repairs) {
    if (r.qualities.length === 0) return `Selecteer minimaal één kwaliteit voor "${r.repair_type}".`;
  }
  return null;
}

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
  const [addBrand, setAddBrand] = useState("");
  const [addModel, setAddModel] = useState("");
  const [addModels, setAddModels] = useState<string[]>([]);
  const [addExistingColors, setAddExistingColors] = useState<string[]>([]);
  const [addColors, setAddColors] = useState<string[]>([]);
  const [addColorInput, setAddColorInput] = useState("");
  const [addRepairs, setAddRepairs] = useState<RepairSelection[]>([]);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [showDeviceAdd, setShowDeviceAdd] = useState(false);
  const [deviceForm, setDeviceForm] = useState<DeviceForm>(EMPTY_DEVICE_FORM);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [colorInput, setColorInput] = useState("");

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

  // Modellen laden wanneer merk verandert in Reparatie-formulier
  useEffect(() => {
    if (!addBrand) { setAddModels([]); setAddModel(""); setAddExistingColors([]); setAddColors([]); return; }
    fetch(`/api/catalog?models=1&brand=${encodeURIComponent(addBrand)}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAddModels(data); })
      .catch(() => {});
    setAddModel("");
    setAddExistingColors([]);
    setAddColors([]);
  }, [addBrand]);

  // Bestaande kleuren laden wanneer model verandert
  useEffect(() => {
    if (!addBrand || !addModel) { setAddExistingColors([]); return; }
    fetch(`/api/catalog?brand=${encodeURIComponent(addBrand)}&model=${encodeURIComponent(addModel)}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const colors = [...new Set(data.map((r: Row) => r.color))].sort();
        setAddExistingColors(colors);
      })
      .catch(() => {});
    setAddColors([]);
  }, [addBrand, addModel]);

  function resetAddForm() {
    setAddBrand(""); setAddModel(""); setAddModels([]); setAddExistingColors([]);
    setAddColors([]); setAddColorInput(""); setAddRepairs([]);
  }

  function toggleAddRepair(repair_type: string, forService: boolean) {
    setAddRepairs(rs => {
      const exists = rs.find(r => r.repair_type === repair_type);
      if (exists) return rs.filter(r => r.repair_type !== repair_type);
      return [...rs, { repair_type, qualities: forService ? ["Standaard"] : [], prices: {} }];
    });
  }

  function toggleAddQuality(repair_type: string, quality: string) {
    setAddRepairs(rs => rs.map(r => {
      if (r.repair_type !== repair_type) return r;
      const has = r.qualities.includes(quality);
      const newPrices = { ...r.prices };
      if (has) delete newPrices[quality];
      return { ...r, qualities: has ? r.qualities.filter(q => q !== quality) : [...r.qualities, quality], prices: newPrices };
    }));
  }

  function setAddRepairPrice(repair_type: string, quality: string, price: string) {
    setAddRepairs(rs => rs.map(r =>
      r.repair_type !== repair_type ? r : { ...r, prices: { ...r.prices, [quality]: price } }
    ));
  }

  function addAddColor() {
    const val = addColorInput.trim();
    if (!val || addColors.includes(val)) return;
    setAddColors(cs => [...cs, val]);
    setAddColorInput("");
  }

  function toggleExistingColor(color: string) {
    setAddColors(cs => cs.includes(color) ? cs.filter(c => c !== color) : [...cs, color]);
  }

  async function submitAddRepairs() {
    if (addModel && addModels.length > 0 && !addModels.includes(addModel)) {
      setStatus(`Model "${addModel}" is niet bekend voor ${addBrand}. Kies een bestaand model uit de lijst.`);
      return;
    }
    const form: DeviceForm = { brand: addBrand, model: addModel, colors: addColors, repairs: addRepairs };
    const err = validateDeviceForm(form);
    if (err) { setStatus(err); return; }
    const rows = buildRows(form);
    setAddBusy(true);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    setAddBusy(false);
    if (res.ok) {
      setShowAdd(false);
      resetAddForm();
      setFilterBrand(addBrand);
      load(true);
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(j.error || "Fout bij toevoegen.");
    }
  }

  function toggleRepair(repair_type: string, forService: boolean) {
    setDeviceForm(f => {
      const exists = f.repairs.find(r => r.repair_type === repair_type);
      if (exists) return { ...f, repairs: f.repairs.filter(r => r.repair_type !== repair_type) };
      return { ...f, repairs: [...f.repairs, { repair_type, qualities: forService ? ["Standaard"] : [], prices: {} }] };
    });
  }

  function toggleQuality(repair_type: string, quality: string) {
    setDeviceForm(f => ({
      ...f,
      repairs: f.repairs.map(r => {
        if (r.repair_type !== repair_type) return r;
        const has = r.qualities.includes(quality);
        const newPrices = { ...r.prices };
        if (has) delete newPrices[quality];
        return { ...r, qualities: has ? r.qualities.filter(q => q !== quality) : [...r.qualities, quality], prices: newPrices };
      }),
    }));
  }

  function setQualityPrice(repair_type: string, quality: string, price: string) {
    setDeviceForm(f => ({
      ...f,
      repairs: f.repairs.map(r =>
        r.repair_type !== repair_type ? r : { ...r, prices: { ...r.prices, [quality]: price } }
      ),
    }));
  }

  function addColor() {
    const val = colorInput.trim();
    if (!val || deviceForm.colors.includes(val)) return;
    setDeviceForm(f => ({ ...f, colors: [...f.colors, val] }));
    setColorInput("");
  }

  function removeColor(color: string) {
    setDeviceForm(f => ({ ...f, colors: f.colors.filter(c => c !== color) }));
  }

  async function addDevice() {
    const err = validateDeviceForm(deviceForm);
    if (err) { setStatus(err); return; }
    const rows = buildRows(deviceForm);
    setDeviceBusy(true);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    setDeviceBusy(false);
    if (res.ok) {
      const brand = deviceForm.brand.trim();
      setShowDeviceAdd(false);
      setDeviceForm(EMPTY_DEVICE_FORM);
      setColorInput("");
      setFilterBrand(brand);
      load(true);
    } else {
      const j = await res.json().catch(() => ({}));
      setStatus(j.error || "Fout bij toevoegen.");
    }
  }

  const filteredAddModels = addModel.trim() === ""
    ? addModels
    : addModels.filter(m => m.toLowerCase().includes(addModel.toLowerCase().trim()));

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
    .add-grid input, .add-grid select { padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; background: #fff; color: #0f172a; }
    .add-grid input:focus, .add-grid select:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
    .add-actions { margin-top: 14px; display: flex; gap: 8px; }
    .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #3b82f6; text-decoration: none; margin-bottom: 16px; font-weight: 600; }
    .back-link:hover { text-decoration: underline; }
    .device-form { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .device-form h3 { margin: 0 0 14px; font-size: 15px; font-weight: 700; color: #166534; }
    .device-section { margin-bottom: 16px; }
    .device-section-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 8px; }
    .color-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .color-tag { display: inline-flex; align-items: center; gap: 4px; background: #fff; border: 1px solid #d1d5db; border-radius: 20px; padding: 3px 10px; font-size: 12px; font-weight: 600; color: #374151; }
    .color-tag button { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px; line-height: 1; padding: 0 0 0 2px; }
    .color-tag button:hover { color: #ef4444; }
    .color-add-row { display: flex; gap: 6px; align-items: center; }
    .color-add-row input { padding: 6px 9px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; background: #fff; color: #0f172a; }
    .repair-list { display: flex; flex-direction: column; gap: 6px; }
    .repair-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .repair-item-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #0f172a; cursor: pointer; margin: 0; }
    .repair-item-header input[type=checkbox] { width: 15px; height: 15px; cursor: pointer; accent-color: #16a34a; }
    .quality-row { display: flex; gap: 10px; margin-top: 8px; padding-left: 23px; flex-wrap: wrap; }
    .quality-check-row { display: flex; align-items: center; gap: 6px; }
    .quality-check { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #475569; cursor: pointer; }
    .quality-check input[type=checkbox] { accent-color: #3b82f6; cursor: pointer; }
    .quality-price-input { width: 100px; padding: 3px 7px; border: 1px solid #e2e8f0; border-radius: 5px; font-size: 12px; color: #0f172a; background: #fff; }
    .quality-price-input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,.12); }
    .repair-group-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .06em; margin: 10px 0 4px; padding-left: 2px; }
    .device-preview { margin-top: 4px; font-size: 12px; color: #16a34a; font-weight: 600; }
    .device-top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; overflow: visible; }
    .device-field-label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #475569; overflow: visible; }
    .device-field-label input, .device-field-label select { padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; background: #fff; color: #0f172a; }
    .device-field-label input:focus, .device-field-label select:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
    .device-select { padding: 7px 9px; border: 1px solid #e2e8f0; border-radius: 7px; font-size: 13px; background: #fff; color: #0f172a; width: 100%; }
    .device-select:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.12); }
    .device-select:disabled { opacity: .5; cursor: not-allowed; }
    .model-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.1); max-height: 220px; overflow-y: auto; z-index: 50; margin-top: 2px; }
    .model-option { padding: 8px 12px; font-size: 13px; color: #0f172a; cursor: pointer; }
    .model-option:hover { background: #f0f9ff; color: #0369a1; }
  `;

  return (
    <DashboardShell>
      <style>{styles}</style>
      <div className="cat-wrap">
        <div className="cat-header">
          <div>
            <h1 className="cat-title">Reparatie catalogus</h1>
            <div className="cat-status">{status}</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-green" onClick={() => {
              setShowDeviceAdd(v => !v);
              if (showAdd) { setShowAdd(false); resetAddForm(); }
            }}>
              {showDeviceAdd ? "✕ Annuleren" : "+ Apparaat toevoegen"}
            </button>
            <button className="btn btn-ghost" style={{ borderColor: "#16a34a", color: "#16a34a" }} onClick={() => {
              setShowAdd(v => !v);
              if (showDeviceAdd) { setShowDeviceAdd(false); setDeviceForm(EMPTY_DEVICE_FORM); setColorInput(""); }
            }}>
              {showAdd ? "✕ Annuleren" : "+ Reparatie toevoegen"}
            </button>
          </div>
        </div>

        {showAdd && (() => {
          const addForm: DeviceForm = { brand: addBrand, model: addModel, colors: addColors, repairs: addRepairs };
          const rowCount = buildRows(addForm).length;
          return (
            <div className="add-form">
              <h3>Reparaties toevoegen</h3>

              <div className="device-section">
                <div className="device-top-grid">
                  <label className="device-field-label">
                    Merk *
                    <select
                      className="device-select"
                      value={addBrand}
                      onChange={e => setAddBrand(e.target.value)}
                    >
                      <option value="">— Kies merk —</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </label>
                  <label className="device-field-label" style={{ position: "relative" }}>
                    Model *
                    <input
                      value={addModel}
                      onChange={e => { setAddModel(e.target.value); setAddModelOpen(true); }}
                      onFocus={() => setAddModelOpen(true)}
                      onBlur={() => setTimeout(() => setAddModelOpen(false), 150)}
                      placeholder={addBrand ? "Typ om te zoeken…" : "Kies eerst een merk"}
                      disabled={!addBrand}
                      autoComplete="off"
                    />
                    {addModelOpen && addBrand && filteredAddModels.length > 0 && (
                      <div className="model-dropdown">
                        {filteredAddModels.map(m => (
                          <div key={m} className="model-option" onMouseDown={() => { setAddModel(m); setAddModelOpen(false); }}>
                            {m}
                          </div>
                        ))}
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="device-section">
                <div className="device-section-title">Kleuren *</div>
                {addExistingColors.length > 0 && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, marginBottom: "5px" }}>Bestaande kleuren — klik om te selecteren</div>
                    <div className="color-tags">
                      {addExistingColors.map(c => (
                        <span
                          key={c}
                          className="color-tag"
                          style={addColors.includes(c) ? { background: "#dcfce7", borderColor: "#16a34a", color: "#166534", cursor: "pointer" } : { cursor: "pointer" }}
                          onClick={() => toggleExistingColor(c)}
                        >
                          {addColors.includes(c) ? "✓ " : ""}{c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="color-tags">
                  {addColors.filter(c => !addExistingColors.includes(c)).map(c => (
                    <span key={c} className="color-tag">
                      {c}
                      <button onClick={() => setAddColors(cs => cs.filter(x => x !== c))}>×</button>
                    </span>
                  ))}
                </div>
                <div className="color-add-row">
                  <input
                    value={addColorInput}
                    onChange={e => setAddColorInput(e.target.value)}
                    placeholder="Nieuwe kleur toevoegen…"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAddColor(); } }}
                  />
                  <button className="btn btn-ghost" onClick={addAddColor}>+ Kleur</button>
                </div>
              </div>

              <div className="device-section">
                <div className="device-section-title">Reparaties *</div>
                <div className="repair-list">
                  <div className="repair-group-label">Reguliere reparaties</div>
                  {REGULAR_REPAIR_TYPES.map(rt => {
                    const sel = addRepairs.find(r => r.repair_type === rt);
                    return (
                      <div key={rt} className="repair-item">
                        <label className="repair-item-header">
                          <input type="checkbox" checked={!!sel} onChange={() => toggleAddRepair(rt, false)} />
                          {rt}
                        </label>
                        {sel && (
                          <div className="quality-row">
                            {REGULAR_QUALITIES.map(q => (
                              <div key={q} className="quality-check-row">
                                <label className="quality-check">
                                  <input type="checkbox" checked={sel.qualities.includes(q)} onChange={() => toggleAddQuality(rt, q)} />
                                  {q}
                                </label>
                                {sel.qualities.includes(q) && (
                                  <input
                                    type="number" step="0.01" min="0"
                                    className="quality-price-input"
                                    placeholder="Op aanvraag"
                                    value={sel.prices[q] || ""}
                                    onChange={e => setAddRepairPrice(rt, q, e.target.value)}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="repair-group-label">Servicereparaties</div>
                  {SERVICE_REPAIR_TYPES.map(rt => {
                    const sel = addRepairs.find(r => r.repair_type === rt);
                    return (
                      <div key={rt} className="repair-item">
                        <label className="repair-item-header">
                          <input type="checkbox" checked={!!sel} onChange={() => toggleAddRepair(rt, true)} />
                          {rt}
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>(Standaard)</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {rowCount > 0 && (
                <div className="device-preview">{rowCount} rijen worden aangemaakt</div>
              )}

              <div className="add-actions">
                <button className="btn btn-primary" disabled={addBusy} onClick={submitAddRepairs}>
                  {addBusy ? "Opslaan…" : `Opslaan (${rowCount} rijen)`}
                </button>
                <button className="btn btn-ghost" onClick={() => { setShowAdd(false); resetAddForm(); }}>
                  Annuleren
                </button>
              </div>
            </div>
          );
        })()}

        {showDeviceAdd && (
          <div className="device-form">
            <h3>Nieuw apparaat toevoegen</h3>

            <div className="device-section">
              <div className="device-top-grid">
                <label className="device-field-label">
                  Merk *
                  <input
                    list="brand-suggestions"
                    value={deviceForm.brand}
                    onChange={e => setDeviceForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="bijv. Apple"
                  />
                  <datalist id="brand-suggestions">
                    {brands.map(b => <option key={b} value={b} />)}
                  </datalist>
                </label>
                <label className="device-field-label">
                  Model *
                  <input
                    value={deviceForm.model}
                    onChange={e => setDeviceForm(f => ({ ...f, model: e.target.value }))}
                    placeholder="bijv. iPad 12 (2026)"
                  />
                </label>
              </div>
            </div>

            <div className="device-section">
              <div className="device-section-title">Kleuren *</div>
              <div className="color-tags">
                {deviceForm.colors.map(c => (
                  <span key={c} className="color-tag">
                    {c}
                    <button onClick={() => removeColor(c)}>×</button>
                  </span>
                ))}
              </div>
              <div className="color-add-row">
                <input
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  placeholder="bijv. Spacegrijs"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }}
                />
                <button className="btn btn-ghost" onClick={addColor}>+ Kleur</button>
              </div>
            </div>

            <div className="device-section">
              <div className="device-section-title">Reparaties *</div>
              <div className="repair-list">
                <div className="repair-group-label">Reguliere reparaties</div>
                {REGULAR_REPAIR_TYPES.map(rt => {
                  const sel = deviceForm.repairs.find(r => r.repair_type === rt);
                  return (
                    <div key={rt} className="repair-item">
                      <label className="repair-item-header">
                        <input type="checkbox" checked={!!sel} onChange={() => toggleRepair(rt, false)} />
                        {rt}
                      </label>
                      {sel && (
                        <div className="quality-row">
                          {REGULAR_QUALITIES.map(q => (
                            <div key={q} className="quality-check-row">
                              <label className="quality-check">
                                <input
                                  type="checkbox"
                                  checked={sel.qualities.includes(q)}
                                  onChange={() => toggleQuality(rt, q)}
                                />
                                {q}
                              </label>
                              {sel.qualities.includes(q) && (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="quality-price-input"
                                  placeholder="Op aanvraag"
                                  value={sel.prices[q] || ""}
                                  onChange={e => setQualityPrice(rt, q, e.target.value)}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="repair-group-label">Servicereparaties</div>
                {SERVICE_REPAIR_TYPES.map(rt => {
                  const sel = deviceForm.repairs.find(r => r.repair_type === rt);
                  return (
                    <div key={rt} className="repair-item">
                      <label className="repair-item-header">
                        <input type="checkbox" checked={!!sel} onChange={() => toggleRepair(rt, true)} />
                        {rt}
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400 }}>(Standaard)</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {buildRows(deviceForm).length > 0 && (
              <div className="device-preview">{buildRows(deviceForm).length} rijen worden aangemaakt</div>
            )}

            <div className="add-actions">
              <button className="btn btn-green" disabled={deviceBusy} onClick={addDevice}>
                {deviceBusy ? "Opslaan…" : `Opslaan (${buildRows(deviceForm).length} rijen)`}
              </button>
              <button className="btn btn-ghost" onClick={() => {
                setShowDeviceAdd(false);
                setDeviceForm(EMPTY_DEVICE_FORM);
                setColorInput("");
              }}>
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
    </DashboardShell>
  );
}
