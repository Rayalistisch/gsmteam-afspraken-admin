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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = height - margin;

  const line = (dy = 10) => {
    y -= dy;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.9, 0.92, 0.96),
    });
    y -= 16;
  };

  const draw = (txt: string, size = 11, bold = false, color = rgb(0.06, 0.07, 0.1)) => {
    page.drawText(txt, { x: margin, y, size, font: bold ? fontBold : font, color });
    y -= size + 7;
  };

  const drawKV = (k: string, v: string) => {
    page.drawText(`${k}:`, { x: margin, y, size: 10, font: fontBold, color: rgb(0.35, 0.4, 0.48) });
    page.drawText(v || "-", { x: margin + 120, y, size: 10, font, color: rgb(0.06, 0.07, 0.1) });
    y -= 16;
  };

  const toestel = [input.brand, input.model, input.color].filter(Boolean).join(" ").trim();
  const voorkeur = [input.preferred_date, input.preferred_time].filter(Boolean).join(" ").trim();

  const incl = parseEuroAmount(input.price_text);
  const computed = incl != null ? calcFromIncl21(incl) : null;

  // Header
  draw("GSM Team", 18, true);
  draw("Offerte – Reparatie (goedgekeurd)", 12, true, rgb(0.12, 0.39, 1));
  line(8);

  // Klant
  draw("Klantgegevens", 12, true);
  drawKV("Naam", input.customer_name || "-");
  drawKV("E-mail", input.customer_email || "-");
  drawKV("Telefoon", input.customer_phone || "-");
  y -= 6;

  // Aanvraag
  draw("Aanvraag", 12, true);
  drawKV("Referentie", input.id);
  drawKV("Toestel", toestel || "-");
  drawKV("Reparatie", input.issue || "-");
  drawKV("Kwaliteit", input.quality || "-");
  drawKV("Voorkeur", voorkeur || "-");
  y -= 6;

  // Prijs
  draw("Prijsindicatie", 12, true);
  if (computed) {
    drawKV("Richtprijs (incl. 21% btw)", fmtEUR(computed.incl));
    drawKV("Richtprijs (excl. btw)", fmtEUR(computed.excl));
    drawKV("BTW (21%)", fmtEUR(computed.btw));
  } else {
    drawKV("Richtprijs", input.price_text || "-");
    draw("Let op: kon geen bedrag herkennen om excl./btw te berekenen.", 10, false, rgb(0.45, 0.47, 0.52));
    y -= 6;
  }

  draw(
    "Deze prijs is een indicatie. Definitieve prijs volgt na controle van het toestel.",
    10,
    false,
    rgb(0.45, 0.47, 0.52)
  );

  // Footer
  page.drawText("GSM Team • Dit document is automatisch gegenereerd.", {
    x: margin,
    y: 28,
    size: 9,
    font,
    color: rgb(0.42, 0.45, 0.5),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export function buildOfferEmail(data: {
  customer_name?: string;
  quality?: string;
  id?: string;
}): string {
  const name = data.customer_name ? ` ${data.customer_name}` : "";
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
        Referentie: ${data.id ?? "-"}
      </p>
    </div>
  `;
}
