"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Modal from "@/components/ui/Modal";
import {
  getCompletionPercent,
  formatNumber,
  timeAgo,
  estimateReach,
} from "@/lib/utils";
import {
  TrendingUp,
  Eye,
  Heart,
  Repeat2,
  MessageCircle,
  Zap,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  AlertTriangle,
  Rocket,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

const TOPUP_AMOUNTS = [500, 2000, 5000, 10000];

function autoSelectPackage(shortfall: number) {
  const idx = TOPUP_AMOUNTS.findIndex((a) => a >= shortfall);
  return idx >= 0 ? idx : TOPUP_AMOUNTS.length - 1;
}

function ClientCampaignDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const { campaigns, posts, updateCampaign, addClientTransaction } = useApp();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [topUpCustom, setTopUpCustom] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const campaignPosts = posts.filter((p) => p.campaignId === id);
  const completion = campaign
    ? getCompletionPercent(campaign.usedCredits, campaign.totalCredits)
    : 0;

  const allTemplates = campaign?.postTemplates?.length
    ? campaign.postTemplates
    : campaign
    ? [campaign.postTemplate]
    : [""];

  const balance = user?.credits ?? 0;
  const shortfall = campaign ? Math.max(0, campaign.totalCredits - balance) : 0;
  const canActivate = campaign ? balance >= campaign.totalCredits : false;

  const openTopUpModal = () => {
    setSelectedPkg(autoSelectPackage(shortfall));
    setShowTopUpModal(true);
  };

  const getTopUpAmount = (): number => {
    const custom = parseFloat(topUpCustom);
    if (!isNaN(custom) && custom > 0) return custom;
    return TOPUP_AMOUNTS[selectedPkg] ?? 0;
  };

  const handleTopUp = async () => {
    if (!user || !campaign) return;
    const amount = getTopUpAmount();
    if (amount < 100) { toast("Minimum deposit is $100", "error"); return; }
    setTopUpLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    await updateUser({ credits: balance + amount });
    await addClientTransaction(user.id, {
      type: "deposit",
      amount,
      description: `Added $${amount.toLocaleString()} to account balance`,
    });
    toast(`$${amount.toLocaleString()} added to your balance!`, "success");
    setShowTopUpModal(false);
    setTopUpCustom("");
    setTopUpLoading(false);
  };

  const handleActivate = async () => {
    if (!user || !campaign) return;
    setActivateLoading(true);
    try {
      await updateCampaign(campaign.id, { status: "active" });
      await addClientTransaction(user.id, {
        type: "spend",
        amount: -campaign.totalCredits,
        description: `Activated campaign: ${campaign.title}`,
      });
      await updateUser({ credits: balance - campaign.totalCredits });
      toast("Campaign activated! 🚀 It's now live for KOLs.", "success");
    } catch {
      toast("Failed to activate. Please try again.", "error");
    } finally {
      setActivateLoading(false);
    }
  };

  if (!campaign) {
    return (
      <div style={{ background: "var(--bg-body)", minHeight: "100dvh" }}>
        <Navbar showBack onBack={() => router.replace("/campaigns")} />
        <div className="page-container" style={{ paddingTop: 84, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", marginTop: 40 }}>Campaign not found</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar title={campaign.title} showBack onBack={() => router.replace("/campaigns")} />
      <div className="page-container animate-in" style={{ paddingTop: 84 }}>
        {campaign.status === "draft" && (
          <div style={{ background: canActivate ? "rgba(34,197,94,0.06)" : "rgba(251,172,50,0.08)", border: `1px solid ${canActivate ? "rgba(34,197,94,0.25)" : "rgba(251,172,50,0.3)"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              {canActivate
                ? <Rocket size={18} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
                : <AlertTriangle size={18} style={{ color: "#FBAC32", flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: canActivate ? "#22c55e" : "#FBAC32", marginBottom: 4 }}>
                  {canActivate ? "Ready to activate!" : "Campaign is inactive - not yet funded"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
                  {canActivate
                    ? <>Your balance <strong style={{ color: "var(--text-body)" }}>${balance.toLocaleString()}</strong> covers the <strong style={{ color: "var(--text-body)" }}>${campaign.totalCredits.toLocaleString()}</strong> budget. Activate now to go live.</>
                    : <>Balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>. You need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong> to activate this campaign.</>
                  }
                </p>
              </div>
            </div>
            {canActivate ? (
              <button
                className="btn-primary"
                onClick={handleActivate}
                disabled={activateLoading}
                style={{ width: "100%", background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              >
                {activateLoading ? "Activating..." : <><Rocket size={15} /> Activate Campaign Now</>}
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={openTopUpModal}
                style={{ width: "100%" }}
              >
                <ShoppingCart size={15} /> Add Funds & Activate (${shortfall.toLocaleString()} needed)
              </button>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span
              className={`badge ${campaign.status === "active" ? "badge-green" : campaign.status === "draft" ? "badge-orange" : "badge-gray"}`}
            >
              {campaign.status === "active" ? "● Active" : campaign.status === "draft" ? "⏸ Draft" : "Completed"}
            </span>
            {campaign.trending && <span className="badge badge-trending">🔥 Trending</span>}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "var(--text-body)",
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            {campaign.title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {campaign.description}
          </p>
        </div>

        <div className="card-elevated" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
              Budget Progress
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: completion >= 80 ? "#FBAC32" : "var(--text-body)" }}>
              {completion}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 8, marginBottom: 8 }}>
            <div className="progress-fill" style={{ width: `${completion}%` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Spent: ${campaign.usedCredits.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Budget: ${campaign.totalCredits.toLocaleString()}
            </span>
          </div>
        </div>

        {(() => {
          const cpe = campaign.metrics.likes > 0 ? `$${(campaign.usedCredits / campaign.metrics.likes).toFixed(2)}` : "$—";
          const cpm = campaign.metrics.views > 0 ? `$${((campaign.usedCredits / campaign.metrics.views) * 1000).toFixed(2)}` : "$—";
          const stats = [
            { label: "Total Views", value: formatNumber(campaign.metrics.views), icon: Eye, color: "#8b5cf6" },
            { label: "Likes", value: formatNumber(campaign.metrics.likes), icon: Heart, color: "#ef4444" },
            { label: "Reposts", value: formatNumber(campaign.metrics.reposts), icon: Repeat2, color: "#22c55e" },
            { label: "Replies", value: formatNumber(campaign.metrics.replies), icon: MessageCircle, color: "#3b82f6" },
            { label: "CPE", value: cpe, icon: Zap, color: "#FBAC32" },
            { label: "CPM", value: cpm, icon: TrendingUp, color: "#a78bfa" },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}>
                    <Icon size={14} style={{ color: stat.color, marginBottom: 6 }} />
                    <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-body)" }}>{stat.value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{stat.label}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="card-elevated" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-body)" }}>
              Post Templates
              {allTemplates.length > 1 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", marginLeft: 6 }}>
                  ({allTemplates.length} variants)
                </span>
              )}
            </h3>
            <span className="badge badge-orange">{campaign.hashtag}</span>
          </div>

          {allTemplates.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setSelectedTemplateIdx((i) => Math.max(0, i - 1))}
                disabled={selectedTemplateIdx === 0}
                style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: selectedTemplateIdx === 0 ? "default" : "pointer", opacity: selectedTemplateIdx === 0 ? 0.3 : 1, display: "flex", alignItems: "center", fontFamily: "inherit" }}
              >
                <ChevronLeft size={14} style={{ color: "var(--text-muted)" }} />
              </button>

              <div style={{ flex: 1, display: "flex", gap: 6, justifyContent: "center" }}>
                {allTemplates.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedTemplateIdx(i)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: selectedTemplateIdx === i ? "#FBAC32" : "var(--bg-card-glass)",
                      border: selectedTemplateIdx === i ? "2px solid #FBAC32" : "1px solid var(--border)",
                      color: selectedTemplateIdx === i ? "#11152C" : "var(--text-muted)",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "inherit",
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSelectedTemplateIdx((i) => Math.min(allTemplates.length - 1, i + 1))}
                disabled={selectedTemplateIdx === allTemplates.length - 1}
                style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: selectedTemplateIdx === allTemplates.length - 1 ? "default" : "pointer", opacity: selectedTemplateIdx === allTemplates.length - 1 ? 0.3 : 1, display: "flex", alignItems: "center", fontFamily: "inherit" }}
              >
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          )}

          {allTemplates.length > 1 && (
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: selectedTemplateIdx === 0 ? "#FBAC32" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {selectedTemplateIdx === 0 ? "Primary Template" : `Variant ${selectedTemplateIdx + 1}`}
              </span>
            </div>
          )}

          <div
            style={{
              background: "var(--bg-card-glass)",
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 1.7,
              marginBottom: 10,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {allTemplates[selectedTemplateIdx]}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge badge-orange">{campaign.hashtag}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(allTemplates[selectedTemplateIdx]);
                toast("Post template copied!", "success");
              }}
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 10px",
                color: "var(--text-muted)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>
              Posts ({campaignPosts.length})
            </h3>
          </div>
          {campaignPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "var(--text-faint)", fontSize: 14 }}>
              No posts yet. KOLs will appear here once they post.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {campaignPosts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: "var(--bg-card-glass)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #FBAC32, #F29236)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#11152C",
                        }}
                      >
                        {(post.kolName ?? "K").charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-body)" }}>{post.kolName ?? "Unknown KOL"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{timeAgo(post.createdAt)}</div>
                      </div>
                    </div>
                    <span
                      className={`badge ${post.status === "approved" ? "badge-green" : post.status === "rejected" ? "" : "badge-orange"}`}
                      style={post.status === "rejected" ? { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 } : {}}
                    >
                      {post.status === "approved" ? "Verified" : post.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { icon: Eye, value: formatNumber(post.metrics.views), label: "views" },
                      { icon: Heart, value: formatNumber(post.metrics.likes), label: "likes" },
                      { icon: TrendingUp, value: `${post.metrics.engagement}%`, label: "engagement" },
                      { icon: Zap, value: `$${post.creditsEarned}`, label: "earned", color: "#FBAC32" },
                    ].map((m) => (
                      <div key={m.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.color || "var(--text-muted)" }}>{m.value}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showTopUpModal} onClose={() => !topUpLoading && setShowTopUpModal(false)} title="Add Funds">
        <div>
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14, marginTop: -12 }}>
            Balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>
            {shortfall > 0 && <> · Need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong> to activate</>}
          </p>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Select Amount
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {TOPUP_AMOUNTS.map((amt, i) => {
              const active = topUpCustom === "" && selectedPkg === i;
              const coversShortfall = amt >= shortfall && shortfall > 0;
              return (
                <button
                  key={i}
                  onClick={() => { setSelectedPkg(i); setTopUpCustom(""); }}
                  style={{ padding: "12px 10px", borderRadius: 12, border: active ? "2px solid #FBAC32" : "1px solid var(--input-border)", background: active ? "rgba(251,172,50,0.08)" : "var(--bg-card-glass)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", position: "relative" }}
                >
                  <div style={{ fontSize: 17, fontWeight: 900, color: active ? "#FBAC32" : "var(--text-body)" }}>
                    ${amt.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                    ≈ {formatNumber(estimateReach(amt))} reach
                  </div>
                  {coversShortfall && (
                    <span style={{ position: "absolute", top: 6, right: 8, fontSize: 9, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 999, padding: "1px 5px" }}>
                      ✓ Covers
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Or Custom Amount
          </p>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>$</span>
            <input
              className="input-field"
              type="number"
              placeholder="100"
              min="100"
              value={topUpCustom}
              onChange={(e) => setTopUpCustom(e.target.value)}
              style={{ paddingLeft: 28, fontSize: 16, fontWeight: 700, border: topUpCustom ? "1px solid #FBAC32" : undefined }}
            />
          </div>

          {getTopUpAmount() > 0 && (
            <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.15)", borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "var(--text-faint)" }}>New balance after deposit</span>
              <span style={{ fontWeight: 900, color: "#FBAC32" }}>
                ${(balance + getTopUpAmount()).toLocaleString()}
                {balance + getTopUpAmount() >= campaign.totalCredits && <span style={{ color: "#22c55e", marginLeft: 6 }}>✓ Ready!</span>}
              </span>
            </div>
          )}

          <button className="btn-primary" onClick={handleTopUp} disabled={topUpLoading || getTopUpAmount() <= 0} style={{ width: "100%" }}>
            <ShoppingCart size={16} />
            {topUpLoading ? "Processing..." : `Add $${getTopUpAmount() > 0 ? getTopUpAmount().toLocaleString() : "—"} to Balance`}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default function ClientCampaignDetailPage() {
  return (
    <Suspense fallback={
      <div style={{ background: "var(--bg-body)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-faint)" }}>Loading...</p>
      </div>
    }>
      <ClientCampaignDetailContent />
    </Suspense>
  );
}
