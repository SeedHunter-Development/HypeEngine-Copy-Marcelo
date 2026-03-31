"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/lib/utils";
import {
  DollarSign, Clock, ArrowUpRight, Wallet,
  Plus, Shield, ChevronUp, ChevronDown, ArrowDownLeft, Send, X, Check,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Modal from "@/components/ui/Modal";

const CREDIT_TO_USD = 1;

function formatUSD(credits: number) {
  return (credits * CREDIT_TO_USD).toFixed(2);
}

const METAMASK_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M21.4 2L13.2 8l1.5-3.6L21.4 2z" fill="#E2761B" />
    <path d="M2.6 2l8.1 6.1L9.3 4.4 2.6 2z" fill="#E4761B" />
    <path d="M18.4 16.6l-2.2 3.4 4.7 1.3 1.3-4.6-3.8-.1z" fill="#E4761B" />
    <path d="M1.8 16.7l1.3 4.6 4.7-1.3-2.2-3.4-3.8.1z" fill="#E4761B" />
    <path d="M7.5 10.5l-1.3 1.9 4.6.2-.2-5-3.1 2.9z" fill="#E4761B" />
    <path d="M16.5 10.5l-3.1-3L13 12.6l4.6-.2-1.1-1.9z" fill="#E4761B" />
    <path d="M7.8 20l2.8-1.3-2.4-1.9-.4 3.2z" fill="#E4761B" />
    <path d="M13.4 18.7l2.8 1.3-.4-3.2-2.4 1.9z" fill="#E4761B" />
  </svg>
);

const COINBASE_ICON = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#1652F0" />
    <path d="M12 7a5 5 0 100 10A5 5 0 0012 7zm0 7.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="white" />
  </svg>
);

export default function KolCreditsPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { kolTransactions, addKolTransaction, refreshForUser } = useApp();
  const { toast } = useToast();

  const [walletAddress, setWalletAddress] = useState("");
  const [savedWallets, setSavedWallets] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");

  const CONNECTED_WALLETS = [
    { id: "metamask", label: "MetaMask", short: "MetaMask (detected)" },
    { id: "coinbase", label: "Coinbase Wallet", short: "Coinbase Wallet (detected)" },
  ];

  const allWallets = [
    ...CONNECTED_WALLETS.map((w) => ({ id: w.id, display: w.short })),
    ...savedWallets.map((addr) => ({ id: addr, display: addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-6)}` : addr })),
  ];

  useEffect(() => {
    if (user?.id) {
      refreshUser();
      refreshForUser(user.id, "kol");
    }
  }, [user?.id]);

  const totalEarned = kolTransactions
    .filter((t) => t.type === "earn")
    .reduce((a, t) => a + t.amount, 0);

  const totalPaidOut = kolTransactions
    .filter((t) => t.type === "withdraw")
    .reduce((a, t) => a + Math.abs(t.amount), 0);

  const available = totalEarned - totalPaidOut;
  const pending = 0;

  const handleAddWallet = () => {
    const addr = walletAddress.trim();
    if (!addr) return;
    if (savedWallets.includes(addr)) {
      toast("Address already added", "error");
      return;
    }
    setSavedWallets([...savedWallets, addr]);
    setWalletAddress("");
    toast("Wallet address saved", "success");
  };

  const handleRemoveWallet = (addr: string) => {
    setSavedWallets(savedWallets.filter((w) => w !== addr));
    if (selectedWallet === addr) setSelectedWallet("");
    toast("Wallet removed", "success");
  };

  const openWithdrawModal = () => {
    setSelectedWallet(allWallets[0]?.id ?? "");
    setShowWithdrawModal(true);
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amt = Math.round(parseFloat(withdrawAmount));
    if (isNaN(amt) || amt <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (amt > available) {
      toast("Insufficient balance", "error");
      return;
    }
    if (amt < 10) {
      toast("Minimum withdrawal is $10", "error");
      return;
    }
    if (!selectedWallet) {
      toast("Select a payout wallet first", "error");
      return;
    }
    const walletLabel = allWallets.find((w) => w.id === selectedWallet)?.display ?? selectedWallet;
    setWithdrawLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    await updateUser({ credits: available - amt });
    await addKolTransaction(user.id, {
      type: "withdraw",
      amount: -amt,
      description: `Withdrawal to ${walletLabel}`,
    });
    refreshForUser(user.id, "kol");
    toast(`$${formatUSD(amt)} withdrawal submitted!`, "success");
    setShowWithdrawModal(false);
    setWithdrawAmount("");
    setWithdrawLoading(false);
  };

  const statCards = [
    {
      label: "Total Earned",
      value: `$${formatUSD(totalEarned)}`,
      icon: DollarSign,
      bg: "rgba(34,197,94,0.13)",
      border: "rgba(34,197,94,0.25)",
      iconColor: "#22c55e",
      textColor: "#22c55e",
    },
    {
      label: "Pending",
      value: `$${formatUSD(pending)}`,
      icon: Clock,
      bg: "rgba(251,172,50,0.13)",
      border: "rgba(251,172,50,0.25)",
      iconColor: "#FBAC32",
      textColor: "#FBAC32",
    },
    {
      label: "Paid Out",
      value: `$${formatUSD(totalPaidOut)}`,
      icon: ArrowUpRight,
      bg: "rgba(148,163,184,0.1)",
      border: "rgba(148,163,184,0.2)",
      iconColor: "var(--text-muted)",
      textColor: "var(--text-body)",
    },
    {
      label: "Available",
      value: `$${formatUSD(available)}`,
      icon: Wallet,
      bg: "rgba(139,92,246,0.13)",
      border: "rgba(139,92,246,0.25)",
      iconColor: "#8b5cf6",
      textColor: "#8b5cf6",
    },
  ];

  return (
    <>
      <Navbar title="Earnings" />
      <div className="page-container" style={{ paddingTop: 84 }}>
        <div className="animate-in">

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                Earnings &amp; Payouts
              </h1>
              <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                Manage your campaign payments and crypto wallets
              </p>
            </div>
            <button
              onClick={openWithdrawModal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(139,92,246,0.4)",
                background: "rgba(139,92,246,0.12)",
                color: "#a78bfa",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <Send size={14} />
              Withdraw
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  style={{
                    background: card.bg,
                    border: `1px solid ${card.border}`,
                    borderRadius: 14,
                    padding: "14px 14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Icon size={13} style={{ color: card.iconColor }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: card.iconColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {card.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: card.textColor, letterSpacing: "-0.02em" }}>
                    {card.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet size={14} style={{ color: "#8b5cf6" }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-body)" }}>Crypto Payout Wallets</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(228,118,27,0.3)",
                  background: "rgba(228,118,27,0.08)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                {METAMASK_ICON}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>MetaMask</div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)" }}>Browser extension detected</div>
                </div>
              </button>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(22,82,240,0.3)",
                  background: "rgba(22,82,240,0.08)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                {COINBASE_ICON}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>Coinbase Wallet</div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)" }}>Browser extension detected</div>
                </div>
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 8 }}>
              Or add any wallet address manually (ETH, SOL, BTC, etc.)
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                className="input-field"
                placeholder="0x... or bc1... or any address"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
                style={{ flex: 1, fontSize: 13 }}
              />
              <button
                onClick={handleAddWallet}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid rgba(139,92,246,0.4)",
                  background: "rgba(139,92,246,0.12)",
                  color: "#a78bfa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            {savedWallets.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {savedWallets.map((addr, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(139,92,246,0.06)",
                      border: "1px solid rgba(139,92,246,0.15)",
                    }}
                  >
                    <Wallet size={12} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {addr}
                    </span>
                    <button
                      onClick={() => handleRemoveWallet(addr)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 6,
                        padding: "3px 6px",
                        cursor: "pointer",
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <Shield size={11} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.4 }}>
                Wallet addresses are only used for campaign payouts. We never request private keys or seed phrases.
              </p>
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-body)" }}>Payment History</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>
                  {kolTransactions.filter((t) => t.type === "withdraw").length} records
                </span>
                {historyOpen ? (
                  <ChevronUp size={16} style={{ color: "var(--text-faint)" }} />
                ) : (
                  <ChevronDown size={16} style={{ color: "var(--text-faint)" }} />
                )}
              </div>
            </button>

            {historyOpen && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {kolTransactions.length === 0 ? (
                  <div style={{ padding: "40px 24px", textAlign: "center" }}>
                    <DollarSign size={40} style={{ color: "var(--text-faint)", opacity: 0.3, marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
                      No payments yet
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                      Complete campaign deliverables to start earning
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: "8px 0" }}>
                    {kolTransactions.map((tx) => {
                      const isPositive = tx.amount > 0;
                      return (
                        <div
                          key={tx.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px 18px",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: isPositive ? "rgba(34,197,94,0.12)" : "rgba(139,92,246,0.12)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isPositive ? (
                              <ArrowDownLeft size={15} style={{ color: "#22c55e" }} />
                            ) : (
                              <ArrowUpRight size={15} style={{ color: "#8b5cf6" }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.description}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{timeAgo(tx.createdAt)}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isPositive ? "#22c55e" : "#8b5cf6", flexShrink: 0 }}>
                            {isPositive ? "+" : ""}${formatUSD(Math.abs(tx.amount))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <Modal isOpen={showWithdrawModal} onClose={() => !withdrawLoading && setShowWithdrawModal(false)} title="Withdraw Earnings">
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 16, marginTop: -12 }}>
          Available: <strong style={{ color: "#8b5cf6" }}>${formatUSD(available)}</strong>
        </p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Payout Wallet
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {allWallets.map((w) => {
            const isSelected = selectedWallet === w.id;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedWallet(w.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${isSelected ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                  background: isSelected ? "rgba(139,92,246,0.1)" : "var(--bg-card-glass)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Wallet size={14} style={{ color: isSelected ? "#a78bfa" : "var(--text-faint)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: isSelected ? "#a78bfa" : "var(--text-muted)", fontWeight: isSelected ? 700 : 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.display}
                </span>
                {isSelected && <Check size={14} style={{ color: "#a78bfa", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Amount (USD)
        </label>
        <input
          className="input-field"
          type="number"
          placeholder="0"
          min="10"
          step="1"
          max={available}
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          onBlur={(e) => { const n = parseFloat(e.target.value); setWithdrawAmount(isNaN(n) ? "" : String(Math.round(n))); }}
          style={{ marginBottom: 16, fontSize: 20, fontWeight: 700 }}
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[25, 50, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setWithdrawAmount(String(Math.round(available * pct / 100)))}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card-glass)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {pct}%
            </button>
          ))}
          <button
            onClick={() => setWithdrawAmount(formatUSD(available))}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: 8,
              border: "1px solid rgba(139,92,246,0.3)",
              background: "rgba(139,92,246,0.08)",
              color: "#a78bfa",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Max
          </button>
        </div>

        <button
          className="btn-primary"
          onClick={handleWithdraw}
          disabled={withdrawLoading || !selectedWallet || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
          style={{ width: "100%" }}
        >
          {withdrawLoading ? "Processing..." : `Withdraw $${withdrawAmount || "0.00"}`}
        </button>
      </Modal>
    </>
  );
}
