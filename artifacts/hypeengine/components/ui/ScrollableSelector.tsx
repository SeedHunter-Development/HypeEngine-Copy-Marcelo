"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface ScrollableSelectProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  maxHeight?: number;
}

export default function ScrollableSelector({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "None",
  maxHeight = 172,
}: ScrollableSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const rows = emptyLabel ? [emptyLabel, ...filtered] : filtered;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--bg-card-glass)",
      }}
    >
      <div
        style={{
          padding: "9px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-card-glass)",
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            color: "var(--text-body)",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ maxHeight, overflowY: "auto" }}>
        {rows.map((opt) => {
          const isEmpty = opt === emptyLabel;
          const actualVal = isEmpty ? "" : opt;
          const selected = value === actualVal;

          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(selected ? "" : actualVal)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "9px 12px",
                background: selected ? "rgba(139,92,246,0.1)" : "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: selected ? "#a78bfa" : isEmpty ? "var(--text-faint)" : "var(--text-body)",
                textAlign: "left",
                transition: "background 0.1s",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: selected ? 4 : "50%",
                  border: selected ? "2px solid #a78bfa" : "1.5px solid var(--text-faint)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                {selected && <Check size={9} style={{ color: "#a78bfa" }} />}
              </span>
              {opt}
            </button>
          );
        })}

        {filtered.length === 0 && search && (
          <p
            style={{
              padding: "12px 14px",
              fontSize: 13,
              color: "var(--text-faint)",
              textAlign: "center",
            }}
          >
            No results for "{search}"
          </p>
        )}
      </div>
    </div>
  );
}
