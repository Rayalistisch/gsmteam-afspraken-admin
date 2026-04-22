"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["⌫", "0", "✓"],
];

function PinPad() {
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async (currentPin: string) => {
    if (!currentPin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });
      if (res.ok) {
        window.location.href = from;
      } else {
        setPin("");
        setError("Onjuiste pincode");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }, [from, router]);

  const handleKey = useCallback((key: string) => {
    if (loading) return;
    if (key === "⌫") {
      setPin(p => p.slice(0, -1));
      setError("");
    } else if (key === "✓") {
      submit(pin);
    } else {
      const next = pin + key;
      setPin(next);
      setError("");
    }
  }, [loading, pin, submit]);

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
        padding: "36px 32px 32px",
        width: "100%",
        maxWidth: "320px",
        textAlign: "center",
      }}>
        {/* Logo */}
        <img
          src="/favicon.ico"
          alt="GSM Team"
          style={{ width: 52, height: 52, borderRadius: 12, marginBottom: 16, objectFit: "cover" }}
        />
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          GSM Team
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
          Voer de pincode in
        </div>

        {/* Dots */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 12,
          marginBottom: 28,
          minHeight: 18,
          animation: shake ? "gsm-shake 0.45s ease" : "none",
        }}>
          {pin.split("").map((_, i) => (
            <div key={i} style={{
              width: 14, height: 14, borderRadius: "50%",
              background: error ? "#ef4444" : "#3b82f6",
              transition: "background 0.15s",
            }} />
          ))}
          {pin.length === 0 && (
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>●●●●</div>
          )}
        </div>

        {/* Keypad */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {KEYS.flat().map((key) => {
            const isConfirm = key === "✓";
            const isDelete = key === "⌫";
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                disabled={loading || (isConfirm && pin.length === 0)}
                style={{
                  padding: "16px 0",
                  borderRadius: 12,
                  border: "none",
                  fontSize: isConfirm || isDelete ? 20 : 22,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  background: isConfirm
                    ? (pin.length > 0 ? "#3b82f6" : "#e2e8f0")
                    : isDelete
                    ? "#f1f5f9"
                    : "#f8fafc",
                  color: isConfirm
                    ? (pin.length > 0 ? "#fff" : "#94a3b8")
                    : "#0f172a",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "background 0.12s, transform 0.08s",
                  transform: "scale(1)",
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseDown={e => (e.currentTarget.style.transform = "scale(0.95)")}
                onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16,
            fontSize: 13,
            color: "#ef4444",
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gsm-shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <PinPad />
    </Suspense>
  );
}
