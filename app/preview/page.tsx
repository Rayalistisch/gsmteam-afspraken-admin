"use client";

import { useState, useMemo } from "react";

const DEFAULTS = {
  id: "VOORBEELD-001",
  name: "Jan de Vries",
  email: "jan@example.com",
  phone: "06 12345678",
  brand: "Apple",
  model: "iPhone 15",
  color: "Zwart",
  issue: "Schermmodule",
  quality: "Officieel",
  price: "€ 149,95",
  date: "2026-04-15",
  time: "14:00",
};

type Field = keyof typeof DEFAULTS;

const FIELDS: { key: Field; label: string }[] = [
  { key: "name",    label: "Naam" },
  { key: "email",   label: "E-mail" },
  { key: "phone",   label: "Telefoon" },
  { key: "brand",   label: "Merk" },
  { key: "model",   label: "Model" },
  { key: "color",   label: "Kleur" },
  { key: "issue",   label: "Reparatie" },
  { key: "quality", label: "Kwaliteit" },
  { key: "price",   label: "Prijs" },
  { key: "date",    label: "Voorkeursdatum" },
  { key: "time",    label: "Voorkeurstijd" },
];

export default function PreviewPage() {
  const [tab, setTab] = useState<"email" | "pdf">("email");
  const [data, setData] = useState(DEFAULTS);

  const pdfUrl = useMemo(() => {
    const p = new URLSearchParams({
      id:      data.id,
      name:    data.name,
      email:   data.email,
      phone:   data.phone,
      brand:   data.brand,
      model:   data.model,
      color:   data.color,
      issue:   data.issue,
      quality: data.quality,
      price:   data.price,
      date:    data.date,
      time:    data.time,
    });
    return `/api/preview-pdf?${p}`;
  }, [data]);

  const emailHtml = useMemo(() => {
    const name = data.name ? ` ${data.name}` : "";
    return `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;line-height:1.5;color:#111">
        <div style="padding:18px;border:1px solid #e6ecf5;border-radius:14px;background:#fff">
          <h2 style="margin:0 0 10px 0;">Goedgekeurd ✅</h2>
          <p style="margin:0 0 14px 0;color:#444">
            Hallo${name},<br>
            Je reparatie-aanvraag is goedgekeurd. In de bijlage vind je de offerte als PDF.<br>
            ${data.quality ? `<strong>Kwaliteit onderdeel:</strong> ${data.quality}<br>` : ""}
          </p>
          <p style="margin:0;color:#444">
            Met vriendelijke groet,<br><strong>GSM Team</strong>
          </p>
        </div>
        <p style="font-size:12px;color:#6b7280;margin:10px 0 0 0;">
          Referentie: ${data.id}
        </p>
      </div>
    `;
  }, [data]);

  const styles = `
    * { box-sizing: border-box; }
    body { margin: 0; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; }
    .back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #3b82f6; text-decoration: none; margin-bottom: 20px; font-weight: 600; }
    .back:hover { text-decoration: underline; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
    .sub { font-size: 13px; color: #64748b; margin: 0 0 24px; }
    .layout { display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start; }
    .sidebar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .sidebar h2 { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin: 0 0 12px; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .field label { font-size: 11px; font-weight: 600; color: #64748b; }
    .field input { padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; background: #fff; color: #0f172a; }
    .field input:focus { outline: none; border-color: #93c5fd; box-shadow: 0 0 0 2px rgba(59,130,246,.12); }
    .preview { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .tabs { display: flex; border-bottom: 1px solid #e2e8f0; }
    .tab { padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: none; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
    .tab:hover:not(.active) { color: #0f172a; }
    .preview-body { padding: 24px; }
    .email-frame { width: 100%; border: none; height: 280px; background: #f8fafc; border-radius: 8px; }
    .pdf-frame { width: 100%; border: none; height: 700px; border-radius: 8px; background: #f1f5f9; }
    .open-btn { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 14px; background: #3b82f6; color: #fff; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; }
    .open-btn:hover { background: #2563eb; }
    @media (max-width: 700px) {
      .layout { grid-template-columns: 1fr; }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="wrap">
        <a href="/" className="back">← Terug naar aanvragen</a>
        <h1>Preview: e-mail & offerte PDF</h1>
        <p className="sub">Pas de voorbeelddata aan om te zien hoe de e-mail en PDF eruit zien.</p>

        <div className="layout">
          {/* Sidebar: voorbeelddata */}
          <div className="sidebar">
            <h2>Voorbeelddata</h2>
            {FIELDS.map(({ key, label }) => (
              <div key={key} className="field">
                <label>{label}</label>
                <input
                  value={data[key]}
                  onChange={e => setData(d => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="preview">
            <div className="tabs">
              <button className={`tab ${tab === "email" ? "active" : ""}`} onClick={() => setTab("email")}>
                E-mail
              </button>
              <button className={`tab ${tab === "pdf" ? "active" : ""}`} onClick={() => setTab("pdf")}>
                PDF offerte
              </button>
            </div>

            <div className="preview-body">
              {tab === "email" && (
                <>
                  <iframe
                    className="email-frame"
                    srcDoc={emailHtml}
                    title="E-mail preview"
                  />
                </>
              )}
              {tab === "pdf" && (
                <>
                  <iframe
                    key={pdfUrl}
                    className="pdf-frame"
                    src={pdfUrl}
                    title="PDF preview"
                  />
                  <a className="open-btn" href={pdfUrl} target="_blank" rel="noreferrer">
                    ↗ Openen in nieuw tabblad
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
