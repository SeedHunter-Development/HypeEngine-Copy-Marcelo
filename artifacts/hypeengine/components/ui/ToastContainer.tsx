"use client";

import { useToast } from "@/context/ToastContext";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "calc(100% - 32px)",
        maxWidth: 420,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="slide-up"
          style={{
            background:
              t.type === "success"
                ? "rgba(34, 197, 94, 0.12)"
                : t.type === "error"
                ? "rgba(239, 68, 68, 0.12)"
                : "rgba(251, 172, 50, 0.12)",
            border:
              t.type === "success"
                ? "1px solid rgba(34, 197, 94, 0.3)"
                : t.type === "error"
                ? "1px solid rgba(239, 68, 68, 0.3)"
                : "1px solid rgba(251, 172, 50, 0.3)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            pointerEvents: "all",
            backdropFilter: "blur(12px)",
          }}
        >
          {t.type === "success" && (
            <CheckCircle size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
          )}
          {t.type === "error" && (
            <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
          )}
          {t.type === "info" && (
            <Info size={18} style={{ color: "#fbac32", flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: "#FFF5E7", flex: 1 }}>
            {t.message}
          </span>
          <button
            onClick={() => dismiss(t.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255, 245, 231, 0.5)",
              padding: 2,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
