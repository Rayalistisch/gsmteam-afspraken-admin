"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function OfferResult() {
  const params = useSearchParams();
  const result = params.get("result");

  const accepted = result === "accepted";
  const rejected = result === "rejected";
  const invalid  = !accepted && !rejected;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
        padding: "40px 36px",
        width: "100%",
        maxWidth: "400px",
        textAlign: "center",
      }}>
        {accepted && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              Offerte geaccepteerd
            </div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              Bedankt voor uw bevestiging!<br />
              U ontvangt zo dadelijk een bevestigingsmail.<br />
              We nemen contact met u op om de afspraak in te plannen.
            </div>
            <div style={{ marginTop: 28, padding: "16px 20px", background: "#f0fdf4", borderRadius: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>
              GSM Team · 053-4363949 · info@gsmteam.nl
            </div>
          </>
        )}
        {rejected && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📩</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              Offerte afgewezen
            </div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              We hebben uw keuze ontvangen.<br />
              Neem gerust contact met ons op als u vragen heeft of een alternatief wilt bespreken.
            </div>
            <div style={{ marginTop: 28, padding: "16px 20px", background: "#f8fafc", borderRadius: 12, fontSize: 13, color: "#475569", fontWeight: 600 }}>
              GSM Team · 053-4363949 · info@gsmteam.nl
            </div>
          </>
        )}
        {invalid && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>❓</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>
              Ongeldige link
            </div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              Deze link is niet (meer) geldig.<br />
              Neem contact op met GSM Team als u vragen heeft.
            </div>
            <div style={{ marginTop: 28, padding: "16px 20px", background: "#f8fafc", borderRadius: 12, fontSize: 13, color: "#475569", fontWeight: 600 }}>
              GSM Team · 053-4363949 · info@gsmteam.nl
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OfferConfirmPage() {
  return (
    <Suspense>
      <OfferResult />
    </Suspense>
  );
}
