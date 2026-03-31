"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo, formatNumber } from "@/lib/utils";
import { DollarSign, Plus, ArrowDownLeft, ArrowUpRight, Zap } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Navbar from "@/components/layout/Navbar";

const PRESET_AMOUNTS = [500, 2000, 5000, 10000];

export default function ClientCreditsPage() {
  const { user, updateUser } = useAuth();
  const { clientTransactions, addClientTransaction, refreshForUser } = useApp();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) refreshForUser(user.id, "client");
  }, [user?.id]);

  const balance = user?.credits ?? 0;

  const getAmount = (): number => {
    if (selectedPreset !== null) return PRESET_AMOUNTS[selectedPreset];
    const n = parseFloat(customAmount);
    return isNaN(n) ? 0 : n;
  };

  const handleCustomChange = (v: string) => {
    setCustomAmount(v);
    setSelectedPreset(null);
  };

  const handleSelectPreset = (i: number) => {
    setSelectedPreset(i);
    setCustomAmount("");
  };

  const handleAddFunds = async () => {
    if (!user) return;
    const amount = getAmount();
    if (amount <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (amount < 100) {
      toast("Minimum deposit is $100", "error");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    await updateUser({ credits: balance + amount });
    await addClientTransaction(user.id, {
      type: "deposit",
      amount,
      description: `Added $${amount.toLocaleString()} to account balance`,
    });
    toast(`$${amount.toLocaleString()} added to your balance!`, "success");
    setShowModal(false);
    setLoading(false);
    setSelectedPreset(1);
    setCustomAmount("");
  };

  return (
    <>
    <Navbar title="Account Balance" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 20 }}>
          Account Balance
        </h1>

        <div
          style={{
            background: "linear-gradient(135deg, rgba(251,172,50,0.15), rgba(242,146,54,0.08))",
            border: "1px solid rgba(251,172,50,0.25)",
            borderRadius: 20,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(251,172,50,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Current Balance
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: "rgba(251,172,50,0.7)" }}>$</span>
            <span style={{ fontSize: 42, fontWeight: 900, color: "#FBAC32", letterSpacing: "-0.03em" }}>
              {balance.toLocaleString()}
            </span>
            <span style={{ fontSize: 15, color: "rgba(251,172,50,0.5)", fontWeight: 600 }}>USD</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
            ≈ {formatNumber(Math.round(balance * 200))} estimated reach
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: 16, maxWidth: 200 }}
          >
            <Plus size={16} /> Add Funds
          </button>
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-body)", marginBottom: 12 }}>
          Transaction History
        </h2>

        {clientTransactions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--text-faint)" }}>
            No transactions yet
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  style={{
                    background: "var(--bg-card-glass)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: isPositive ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isPositive ? (
                      <ArrowDownLeft size={16} style={{ color: "#22c55e" }} />
                    ) : (
                      <ArrowUpRight size={16} style={{ color: "#ef4444" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                      {timeAgo(tx.createdAt)}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isPositive ? "#22c55e" : "#ef4444", flexShrink: 0 }}>
                    {isPositive ? "+" : "-"}${Math.abs(tx.amount).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal isOpen={showModal} onClose={() => !loading && setShowModal(false)} title="Add Funds">
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 16, marginTop: -12 }}>
            Current balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()} USD</strong>
          </p>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Select Amount
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {PRESET_AMOUNTS.map((amt, i) => (
              <button
                key={i}
                onClick={() => handleSelectPreset(i)}
                style={{
                  padding: "14px 12px",
                  borderRadius: 12,
                  border: selectedPreset === i ? "2px solid #FBAC32" : "1px solid var(--input-border)",
                  background: selectedPreset === i ? "rgba(251,172,50,0.08)" : "var(--bg-card-glass)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 900, color: selectedPreset === i ? "#FBAC32" : "var(--text-body)" }}>
                  ${amt.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  ≈ {formatNumber(Math.round(amt * 200))} est. reach
                </div>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Or Enter Custom Amount
          </p>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>$</span>
            <input
              className="input-field"
              type="number"
              placeholder="100"
              min="100"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 18, fontWeight: 700, border: selectedPreset === null && customAmount ? "1px solid #FBAC32" : undefined }}
            />
          </div>

          {getAmount() > 0 && (
            <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>New balance after top-up</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#FBAC32" }}>${(balance + getAmount()).toLocaleString()}</span>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleAddFunds}
            disabled={loading || getAmount() <= 0}
          >
            <Zap size={16} />
            {loading ? "Processing..." : `Add $${getAmount() > 0 ? getAmount().toLocaleString() : "—"} to Balance`}
          </button>
        </Modal>
      </div>
    </div>
    </>
  );
}
