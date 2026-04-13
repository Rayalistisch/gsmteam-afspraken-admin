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
    const name = data.name || "klant";

    function detailRow(label: string, value?: string) {
      if (!value) return "";
      return `<tr>
        <td style="padding:10px 12px 10px 0;border-bottom:1px solid #f1f5f9;width:130px;vertical-align:top">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">${label}</span>
        </td>
        <td style="padding:10px 0 10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#0f172a">${value}</span>
        </td>
      </tr>`;
    }

    // Format date
    let voorkeur = "";
    if (data.date) {
      try {
        const d = new Date(data.date + "T00:00:00");
        voorkeur = d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
      } catch { voorkeur = data.date; }
    }
    if (data.time) voorkeur += (voorkeur ? " om " : "") + data.time;

    const detailRows = [
      detailRow("Merk",      data.brand),
      detailRow("Model",     data.model),
      detailRow("Kleur",     data.color),
      detailRow("Reparatie", data.issue),
      detailRow("Kwaliteit", data.quality),
      detailRow("Prijs",     data.price),
      detailRow("Voorkeur",  voorkeur),
    ].join("");

    return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f9f9f9">
  <tbody><tr><td style="padding-right:10px;padding-left:10px" align="center" valign="top">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px"><tbody><tr><td align="center" valign="top">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff;border-color:#e5e5e5;border-style:solid;border-width:0 1px 1px 1px"><tbody>
        <tr><td style="background-color:#3b82f6;font-size:1px;line-height:3px" height="3">&nbsp;</td></tr>
        <tr><td style="padding-top:40px;padding-bottom:16px" align="center" valign="middle">
          <img src="/favicon.ico" alt="GSM Team" width="48" height="48" border="0" style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover">
        </td></tr>
        <tr><td style="padding-bottom:8px;padding-left:20px;padding-right:20px" align="center" valign="top">
          <h2 style="color:#0f172a;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;line-height:34px;text-align:center;padding:0;margin:0">Reparatie goedgekeurd ✅</h2>
        </td></tr>
        <tr><td style="padding-bottom:20px;padding-left:20px;padding-right:20px" align="center" valign="top">
          <h4 style="color:#64748b;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">Hallo ${name}</h4>
        </td></tr>
        <tr><td style="padding-left:40px;padding-right:40px" align="center">
          <p style="color:#475569;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">Je reparatie-aanvraag is goedgekeurd.<br>In de bijlage vind je de offerte als PDF.</p>
        </td></tr>
        <tr><td style="padding:24px 60px 0" align="center" valign="top">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e2e8f0"><tbody>
            ${detailRows}
          </tbody></table>
        </td></tr>
        <tr><td style="font-size:1px;line-height:1px" height="28">&nbsp;</td></tr>
        <tr><td style="padding-bottom:40px;padding-left:60px;padding-right:60px" align="center" valign="middle">
          <p style="color:#475569;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">Met vriendelijke groet,<br><strong style="color:#0f172a">GSM Team</strong></p>
        </td></tr>
      </tbody></table>
      <table border="0" cellpadding="0" cellspacing="0" width="100%"><tbody><tr><td style="font-size:1px;line-height:1px" height="30">&nbsp;</td></tr></tbody></table>
    </td></tr></tbody></table>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px"><tbody><tr><td align="center" valign="top">
      <table border="0" cellpadding="0" cellspacing="0" width="100%"><tbody>
        <tr><td style="padding:10px" align="center"><p style="color:#bbb;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;text-align:center;padding:0;margin:0">© GSM Team</p></td></tr>
        <tr><td style="padding:0 10px 20px" align="center"><p style="color:#bbb;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;text-align:center;padding:0;margin:0">Referentie: ${data.id}</p></td></tr>
        <tr><td style="font-size:1px;line-height:1px" height="30">&nbsp;</td></tr>
      </tbody></table>
    </td></tr></tbody></table>
  </td></tr></tbody>
</table>
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
    .email-frame { width: 100%; border: none; height: 520px; background: #f9f9f9; border-radius: 8px; }
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
