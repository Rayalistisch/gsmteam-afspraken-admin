import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function parseEuroAmount(input?: string | null): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const m = s.match(/-?\d+(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtEUR(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

function calcFromIncl21(incl: number) {
  const excl = incl / 1.21;
  const btw = incl - excl;
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return { excl: round2(excl), btw: round2(btw), incl: round2(incl) };
}

export type OfferInput = {
  id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  brand?: string;
  model?: string;
  color?: string;
  issue?: string;
  quality?: string;
  price_text?: string;
  preferred_date?: string;
  preferred_time?: string;
};

export async function buildOfferPdf(input: OfferInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page   = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Palet ────────────────────────────────────────────────
  const blue      = rgb(0.231, 0.510, 0.965);  // #3B82F6
  const blueDark  = rgb(0.114, 0.306, 0.847);  // #1D4ED8
  const dark      = rgb(0.059, 0.078, 0.102);
  const grayLabel = rgb(0.396, 0.451, 0.529);
  const grayLine  = rgb(0.878, 0.898, 0.929);
  const rowAltBg  = rgb(0.969, 0.976, 0.988);
  const white     = rgb(1, 1, 1);

  const mL = 48;
  const mR = 48;
  const cW = width - mL - mR; // 499.28

  let y = height;

  // ── Helpers ──────────────────────────────────────────────

  // Horizontale scheidingslijn
  const divider = (gap = 14) => {
    y -= gap;
    page.drawLine({ start: { x: mL, y }, end: { x: width - mR, y }, thickness: 0.5, color: grayLine });
    y -= gap;
  };

  // Sectie-koptekst (blauw vlak + witte tekst)
  const ROW_H = 22;
  const sectionHeader = (title: string) => {
    page.drawRectangle({ x: mL, y: y - ROW_H, width: cW, height: ROW_H, color: blue });
    page.drawText(title, { x: mL + 10, y: y - 15, size: 8, font: fontBold, color: white });
    y -= ROW_H + 1;
  };

  // Tabelrij (label links, waarde rechts of op vaste kolom)
  const tableRow = (label: string, value: string, alt: boolean, rightAlign = false) => {
    if (alt) page.drawRectangle({ x: mL, y: y - ROW_H, width: cW, height: ROW_H, color: rowAltBg });
    page.drawText(label, { x: mL + 10, y: y - 15, size: 10, font: fontBold, color: grayLabel });
    if (rightAlign) {
      const vW = font.widthOfTextAtSize(value, 10);
      page.drawText(value, { x: width - mR - vW, y: y - 15, size: 10, font, color: dark });
    } else {
      page.drawText(value, { x: mL + 155, y: y - 15, size: 10, font, color: dark });
    }
    y -= ROW_H;
  };

  // ── HEADER BAND ──────────────────────────────────────────
  const hH = 80;
  page.drawRectangle({ x: 0, y: y - hH, width, height: hH, color: blue });

  // Logoblok: donkerblauw vierkant met "G" erin
  const logoSz = 44;
  const logoX  = mL;
  const logoY  = y - hH + (hH - logoSz) / 2;
  page.drawRectangle({ x: logoX, y: logoY, width: logoSz, height: logoSz, color: blueDark });
  page.drawText("G", { x: logoX + 11, y: logoY + 14, size: 24, font: fontBold, color: white });

  // Bedrijfsnaam + tagline
  page.drawText("GSM Team", { x: logoX + logoSz + 10, y: y - hH + 48, size: 20, font: fontBold, color: white });
  page.drawText("Reparatie & Service", { x: logoX + logoSz + 10, y: y - hH + 30, size: 9, font, color: rgb(0.7, 0.82, 1) });

  // "OFFERTE" rechts
  const ofText = "OFFERTE";
  const ofW = fontBold.widthOfTextAtSize(ofText, 24);
  page.drawText(ofText, { x: width - mR - ofW, y: y - hH + 33, size: 24, font: fontBold, color: white });

  y -= hH;

  // Accentlijn onder header
  page.drawRectangle({ x: 0, y: y - 3, width, height: 3, color: blueDark });
  y -= 3;

  // ── DOCUMENT-INFO ─────────────────────────────────────────
  y -= 18;

  // Links: referentienummer
  page.drawText("REFERENTIENUMMER", { x: mL, y, size: 7, font: fontBold, color: grayLabel });
  page.drawText(input.id || "-", { x: mL, y: y - 14, size: 11, font: fontBold, color: dark });

  // Rechts: datum
  let dateStr = "";
  if (input.preferred_date) {
    try {
      const d = new Date(input.preferred_date + "T00:00:00");
      dateStr = d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
    } catch { dateStr = input.preferred_date; }
  } else {
    dateStr = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  }
  const dateLabel = "DATUM OFFERTE";
  const dateValW  = fontBold.widthOfTextAtSize(dateStr, 11);
  const dateLblW  = fontBold.widthOfTextAtSize(dateLabel, 7);
  page.drawText(dateLabel, { x: width - mR - dateLblW, y, size: 7, font: fontBold, color: grayLabel });
  page.drawText(dateStr,   { x: width - mR - dateValW, y: y - 14, size: 11, font: fontBold, color: dark });

  y -= 32;

  // ── KLANTGEGEVENS & APPARAAT (twee kolommen) ─────────────
  divider(0);
  y -= 14;

  const colW = (cW - 24) / 2;

  // Kolomkoppen
  page.drawText("KLANTGEGEVENS", { x: mL, y, size: 7, font: fontBold, color: blue });
  page.drawLine({ start: { x: mL, y: y - 3 }, end: { x: mL + colW, y: y - 3 }, thickness: 1, color: blue });

  page.drawText("APPARAAT", { x: mL + colW + 24, y, size: 7, font: fontBold, color: blue });
  page.drawLine({ start: { x: mL + colW + 24, y: y - 3 }, end: { x: width - mR, y: y - 3 }, thickness: 1, color: blue });

  y -= 16;

  // Klantgegevens links
  const clientRows: [string, string?][] = [
    ["Naam",     input.customer_name],
    ["E-mail",   input.customer_email],
    ["Telefoon", input.customer_phone],
  ];
  let leftY = y;
  for (const [k, v] of clientRows) {
    if (!v) continue;
    page.drawText(k, { x: mL, y: leftY, size: 8, font: fontBold, color: grayLabel });
    page.drawText(v, { x: mL, y: leftY - 12, size: 10, font, color: dark });
    leftY -= 26;
  }

  // Apparaatgegevens rechts
  const deviceRows: [string, string?][] = [
    ["Merk",  input.brand],
    ["Model", input.model],
    ["Kleur", input.color],
  ];
  let rightY = y;
  for (const [k, v] of deviceRows) {
    if (!v) continue;
    page.drawText(k, { x: mL + colW + 24, y: rightY, size: 8, font: fontBold, color: grayLabel });
    page.drawText(v, { x: mL + colW + 24, y: rightY - 12, size: 10, font, color: dark });
    rightY -= 26;
  }

  y = Math.min(leftY, rightY);

  // ── REPARATIEDETAILS ─────────────────────────────────────
  divider(16);
  sectionHeader("REPARATIEDETAILS");

  const voorkeur = [input.preferred_date, input.preferred_time].filter(Boolean).join(" om ").trim();
  const repairRows: [string, string?][] = [
    ["Reparatie", input.issue],
    ["Kwaliteit", input.quality],
    ["Voorkeur",  voorkeur || undefined],
  ];
  let alt = false;
  for (const [k, v] of repairRows) {
    if (!v) continue;
    tableRow(k, v, alt);
    alt = !alt;
  }

  // ── PRIJSINDICATIE ────────────────────────────────────────
  y -= 14;
  sectionHeader("PRIJSINDICATIE");

  const incl     = parseEuroAmount(input.price_text);
  const computed = incl != null ? calcFromIncl21(incl) : null;

  if (computed) {
    alt = false;
    tableRow("Subtotaal (excl. BTW)", fmtEUR(computed.excl), alt, true); alt = !alt;
    tableRow("BTW (21%)",             fmtEUR(computed.btw),  alt, true); alt = !alt;

    // Totaalrij: lichtblauwe achtergrond, vette blauwe prijs
    page.drawRectangle({ x: mL, y: y - ROW_H, width: cW, height: ROW_H, color: rgb(0.937, 0.949, 0.992) });
    page.drawText("Totaal incl. BTW", { x: mL + 10, y: y - 15, size: 11, font: fontBold, color: dark });
    const totalStr = fmtEUR(computed.incl);
    const totalW   = fontBold.widthOfTextAtSize(totalStr, 11);
    page.drawText(totalStr, { x: width - mR - totalW, y: y - 15, size: 11, font: fontBold, color: blue });
    y -= ROW_H;
  } else {
    tableRow("Richtprijs", input.price_text || "-", false, true);
  }

  // ── DISCLAIMER ────────────────────────────────────────────
  y -= 18;
  page.drawText(
    "Deze prijs is een indicatie. De definitieve prijs volgt na controle van het toestel.",
    { x: mL, y, size: 8, font, color: grayLabel }
  );

  // ── FOOTER ────────────────────────────────────────────────
  page.drawLine({ start: { x: mL, y: 42 }, end: { x: width - mR, y: 42 }, thickness: 0.5, color: grayLine });
  page.drawText("GSM Team  •  Dit document is automatisch gegenereerd.", {
    x: mL, y: 26, size: 8, font, color: grayLabel,
  });
  const refW = font.widthOfTextAtSize(input.id, 8);
  page.drawText(input.id, { x: width - mR - refW, y: 26, size: 8, font, color: grayLabel });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function emailDetailRow(label: string, value?: string | null): string {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:10px 12px 10px 0;border-bottom:1px solid #f1f5f9;width:130px;vertical-align:top">
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">${label}</span>
      </td>
      <td style="padding:10px 0 10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top">
        <span style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;color:#0f172a">${value}</span>
      </td>
    </tr>`;
}

function fmtEmailDate(date?: string | null, time?: string | null): string {
  const parts: string[] = [];
  if (date) {
    try {
      const d = new Date(date + "T00:00:00");
      parts.push(d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }));
    } catch {
      parts.push(date);
    }
  }
  if (time) parts.push(`om ${time}`);
  return parts.join(" ");
}

export function buildOfferEmail(data: {
  customer_name?: string;
  id?: string;
  logoUrl?: string;
  brand?: string;
  model?: string;
  color?: string;
  issue?: string;
  quality?: string;
  price_text?: string;
  preferred_date?: string;
  preferred_time?: string;
}): string {
  const name = data.customer_name || "klant";

  const logoHtml = data.logoUrl
    ? `<img src="${data.logoUrl}" alt="GSM Team" width="48" height="48" border="0" style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover">`
    : `<span style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#1e3a5f">GSM Team</span>`;

  const toestel = [data.brand, data.model, data.color].filter(Boolean).join(" ") || null;
  const voorkeur = fmtEmailDate(data.preferred_date, data.preferred_time) || null;

  const detailRows = [
    emailDetailRow("Merk",      data.brand),
    emailDetailRow("Model",     data.model),
    emailDetailRow("Kleur",     data.color),
    emailDetailRow("Reparatie", data.issue),
    emailDetailRow("Kwaliteit", data.quality),
    emailDetailRow("Prijs",     data.price_text),
    emailDetailRow("Voorkeur",  voorkeur),
  ].join("");

  return `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f9f9f9">
  <tbody>
    <tr>
      <td style="padding-right:10px;padding-left:10px" align="center" valign="top">

        <!-- Hoofdkaart -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px">
          <tbody>
            <tr>
              <td align="center" valign="top">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fff;border-color:#e5e5e5;border-style:solid;border-width:0 1px 1px 1px">
                  <tbody>
                    <!-- Blauwe accentlijn boven -->
                    <tr>
                      <td style="background-color:#3b82f6;font-size:1px;line-height:3px" height="3">&nbsp;</td>
                    </tr>
                    <!-- Logo -->
                    <tr>
                      <td style="padding-top:40px;padding-bottom:16px" align="center" valign="middle">
                        ${logoHtml}
                      </td>
                    </tr>
                    <!-- Titel -->
                    <tr>
                      <td style="padding-bottom:8px;padding-left:20px;padding-right:20px" align="center" valign="top">
                        <h2 style="color:#0f172a;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:600;line-height:34px;text-align:center;padding:0;margin:0">Reparatie goedgekeurd ✅</h2>
                      </td>
                    </tr>
                    <!-- Subtitel -->
                    <tr>
                      <td style="padding-bottom:20px;padding-left:20px;padding-right:20px" align="center" valign="top">
                        <h4 style="color:#64748b;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">Hallo ${name}</h4>
                      </td>
                    </tr>
                    <!-- Intro tekst -->
                    <tr>
                      <td style="padding-left:40px;padding-right:40px" align="center" valign="top">
                        <p style="color:#475569;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">
                          Je reparatie-aanvraag is goedgekeurd.<br>
                          In de bijlage vind je de offerte als PDF.
                        </p>
                      </td>
                    </tr>
                    <!-- Detail tabel -->
                    <tr>
                      <td style="padding:24px 60px 0" align="center" valign="top">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e2e8f0">
                          <tbody>
                            ${detailRows}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <!-- Spacer -->
                    <tr>
                      <td style="font-size:1px;line-height:1px" height="28">&nbsp;</td>
                    </tr>
                    <!-- Ondertekening -->
                    <tr>
                      <td style="padding-bottom:40px;padding-left:60px;padding-right:60px" align="center" valign="middle">
                        <p style="color:#475569;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;line-height:22px;text-align:center;padding:0;margin:0">
                          Met vriendelijke groet,<br>
                          <strong style="color:#0f172a">GSM Team</strong>
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <!-- Spacer onder kaart -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tbody>
                    <tr><td style="font-size:1px;line-height:1px" height="30">&nbsp;</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px">
          <tbody>
            <tr>
              <td align="center" valign="top">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tbody>
                    <tr>
                      <td style="padding:10px" align="center" valign="top">
                        <p style="color:#bbb;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;line-height:20px;text-align:center;padding:0;margin:0">© GSM Team</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 10px 20px" align="center" valign="top">
                        <p style="color:#bbb;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;line-height:20px;text-align:center;padding:0;margin:0">Referentie: ${data.id ?? "-"}</p>
                      </td>
                    </tr>
                    <tr><td style="font-size:1px;line-height:1px" height="30">&nbsp;</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

      </td>
    </tr>
  </tbody>
</table>
  `;
}
