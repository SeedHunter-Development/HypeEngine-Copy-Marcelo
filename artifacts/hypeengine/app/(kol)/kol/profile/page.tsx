"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatNumber } from "@/lib/utils";
import Navbar from "@/components/layout/Navbar";
import {
  LogOut,
  Edit3,
  Check,
  Twitter,
  Users,
  Award,
  MapPin,
  Globe,
  Tag,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Languages,
  BarChart2,
  Star,
  MousePointerClick,
  ArrowRightLeft,
  Info,
} from "lucide-react";
import ScrollableSelector from "@/components/ui/ScrollableSelector";

const NICHES = [
  "Crypto", "DeFi", "NFT", "Web3", "Gaming", "GameFi", "Metaverse",
  "AI / Tech", "Finance", "Investing", "Technology", "Lifestyle",
  "Fitness", "Health", "Fashion", "Beauty", "Food", "Travel",
  "Music", "Sports", "Education", "Business", "Entertainment",
  "Art", "Meme / Culture",
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Switzerland",
  "Japan", "South Korea", "China", "Singapore", "Hong Kong",
  "India", "UAE", "Saudi Arabia", "Turkey", "Ukraine",
  "Brazil", "Mexico", "Argentina", "Colombia",
  "Philippines", "Indonesia", "Thailand", "Malaysia", "Vietnam",
  "Nigeria", "South Africa", "Kenya", "Egypt",
  "Russia", "Poland", "Sweden", "Norway", "Denmark",
];

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese",
  "Japanese", "Korean", "Chinese (Simplified)", "Chinese (Traditional)",
  "Arabic", "Hindi", "Russian", "Indonesian", "Malay",
  "Thai", "Turkish", "Vietnamese", "Italian", "Dutch",
  "Polish", "Ukrainian", "Swedish", "Norwegian", "Danish",
];

function formatFollowers(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function MetricTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10, padding: "7px 10px", textAlign: "center",
    }}>
      <div style={{
        fontSize: 14, fontWeight: 800,
        color: highlight ? "#FBAC32" : "var(--text-body)",
        lineHeight: 1.1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function mockFollowersForHandle(handle: string) {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) hash = (hash * 31 + handle.charCodeAt(i)) >>> 0;
  return 8000 + (hash % 92000);
}

interface KolCampaignScore {
  id: string;
  campaignId: string;
  campaignTitle: string;
  campaignGoal: string | null;
  clicks: number | null;
  conversions: number | null;
  conversionValue: number | null;
  deliveryScore: number | null;
  clientRating: number | null;
  clientFeedback: string | null;
  costPerAcquisition: number | null;
  createdAt: string | null;
}

interface KolPerfProfile {
  id: string;
  authenticityScore: number | null;
  clientSatisfaction: number | null;
  campaignsCompleted: number | null;
  priceCompetitiveness: number | null;
  avgCpaByGoal: Record<string, number> | null;
}

export default function KolProfilePage() {
  const { user, updateUser, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [perfProfile, setPerfProfile] = useState<KolPerfProfile | null>(null);
  const [campaignScores, setCampaignScores] = useState<KolCampaignScore[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/kol/performance?userId=${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setPerfProfile(d.kolProfile);
          setCampaignScores(d.campaignScores ?? []);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [niches, setNiches] = useState<string[]>(user?.niches ?? []);
  const [country, setCountry] = useState(user?.country ?? "");
  const [language, setLanguage] = useState(user?.language ?? "");

  // Twitter connection state
  const isTwitterConnected = !!(user?.twitterAccount);
  const [twitterHandle, setTwitterHandle] = useState(
    user?.twitterAccount ? user.twitterAccount.replace(/^@/, "") : ""
  );
  const [connectStep, setConnectStep] = useState<"idle" | "ts" | "apify" | "done" | "error" | "needsFollowers">("idle");
  const [connectMsg, setConnectMsg] = useState("");
  const [manualFollowers, setManualFollowers] = useState("");
  const [savingFollowers, setSavingFollowers] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jobIdRef = useRef<string>("");
  const isConnecting = connectStep === "ts" || connectStep === "apify";

  // ── handlers ──────────────────────────────────────────────
  const handleNicheToggle = (niche: string) => {
    setNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : prev.length < 3 ? [...prev, niche] : prev
    );
  };

  const handleSave = () => {
    updateUser({ name, niches, country: country || undefined, language: language || undefined });
    toast("Profile updated!", "success");
    setEditing(false);
  };

  const handleCancel = () => {
    setName(user?.name ?? "");
    setNiches(user?.niches ?? []);
    setCountry(user?.country ?? "");
    setLanguage(user?.language ?? "");
    setEditing(false);
  };

  // Clean up any pending poll on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback((jobId: string) => {
    jobIdRef.current = jobId;
    const check = async () => {
      try {
        const res = await fetch(`/kol-api/connect-twitter?jobId=${encodeURIComponent(jobId)}`, {
          credentials: "include", cache: "no-store",
        });
        if (res.status === 404) { setConnectStep("error"); setConnectMsg("Session expired - please try again."); return; }
        if (!res.ok) { setConnectStep("error"); setConnectMsg("Poll failed. Please try again."); return; }
        const job = await res.json() as {
          done: boolean; error?: string; step: string; statusMessage: string;
          tsStep: string; apifyStep: string; needsManualFollowers?: boolean;
          twitterFollowers: number; twitterScore: number; displayName: string;
          engagementRate: number; avgLikes: number; avgRetweets: number;
          avgReplies: number; avgPostsPerDay: number;
        };
        setConnectMsg(job.statusMessage);
        if (job.step === "apify" || job.apifyStep === "pending") setConnectStep("apify");
        else if (job.tsStep === "pending") setConnectStep("ts");
        if (job.done) {
          stopPolling();
          if (job.error) {
            setConnectStep("error");
            setConnectMsg(job.error);
            toast(job.error, "error");
          } else if (job.needsManualFollowers) {
            setConnectStep("needsFollowers");
            setConnectMsg(job.statusMessage);
            await refreshUser();
          } else {
            setConnectStep("done");
            await refreshUser();
            toast("X account verified and connected!", "success");
          }
        } else {
          pollRef.current = setTimeout(check, 3000);
        }
      } catch {
        pollRef.current = setTimeout(check, 4000);
      }
    };
    pollRef.current = setTimeout(check, 3000);
  }, [stopPolling, toast, refreshUser]);

  const handleTwitterConnect = async () => {
    const handle = twitterHandle.trim().replace(/^@/, "");
    if (!handle) { toast("Enter your X handle first", "error"); return; }
    stopPolling();
    setConnectStep("ts");
    setConnectMsg("Verifying handle…");
    try {
      const res = await fetch(
        `/kol-api/connect-twitter?action=start&handle=${encodeURIComponent(handle)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to start" })) as { error?: string };
        setConnectStep("error");
        setConnectMsg(err.error ?? "Failed to start verification");
        return;
      }
      const { jobId } = await res.json() as { jobId: string };
      poll(jobId);
    } catch {
      setConnectStep("error");
      setConnectMsg("Network error - please try again.");
    }
  };

  const handleSetFollowers = async () => {
    const count = parseInt(manualFollowers.replace(/[^0-9]/g, ""), 10);
    if (isNaN(count) || count < 0) { toast("Please enter a valid follower count", "error"); return; }
    setSavingFollowers(true);
    try {
      const res = await fetch(
        `/kol-api/connect-twitter?action=set-followers&jobId=${encodeURIComponent(jobIdRef.current)}&followers=${count}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) { toast("Failed to save follower count - please try again", "error"); return; }
      await refreshUser();
      setConnectStep("done");
      toast("X account connected!", "success");
    } catch {
      toast("Network error - please try again", "error");
    } finally {
      setSavingFollowers(false);
    }
  };

  const handleTwitterDisconnect = async () => {
    setTwitterHandle("");
    try {
      await fetch("/kol-api/disconnect-twitter", { credentials: "include", cache: "no-store" });
    } catch {}
    await refreshUser();
    toast("X account disconnected", "success");
  };

  const handleLogout = () => { logout(); router.replace("/auth"); };

  const cleanHandle = (user?.twitterAccount ?? "").replace(/^@/, "");

  // ── render ─────────────────────────────────────────────────
  return (
    <>
    <Navbar title="Profile" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">

        <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 20 }}>
          My Profile
        </h1>

        {/* ── Twitter / X Connection Card ─────────────────── */}
        <div style={{
          background: isTwitterConnected ? "rgba(29,155,240,0.06)" : "var(--bg-card-glass)",
          border: `1px solid ${isTwitterConnected ? "rgba(29,155,240,0.28)" : "var(--border)"}`,
          borderRadius: 16, padding: 16, marginBottom: 14,
        }}>
          {isTwitterConnected ? (
            /* Connected state */
            <div>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: "linear-gradient(135deg,#FBAC32,#F29236)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 900, color: "#11152C", flexShrink: 0,
                }}>
                  {cleanHandle.charAt(0).toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text-body)" }}>@{cleanHandle}</span>
                    <CheckCircle2 size={14} style={{ color: "#1d9bf0", flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#1d9bf0",
                      background: "rgba(29,155,240,0.12)", border: "1px solid rgba(29,155,240,0.25)",
                      borderRadius: 999, padding: "1px 7px",
                    }}>Verified</span>
                  </div>
                </div>
                <button
                  onClick={handleTwitterDisconnect}
                  style={{
                    fontSize: 12, fontWeight: 700, color: "var(--text-faint)",
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "inherit", padding: "4px 0", flexShrink: 0,
                  }}
                >
                  Disconnect
                </button>
              </div>
              {/* Metrics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: connectStep === "needsFollowers" ? 14 : 0 }}>
                <MetricTile label="Followers" value={formatFollowers(user?.twitterFollowers ?? user?.followers ?? 0)} />
                {(user?.twitterScoreValue ?? 0) > 0 && (
                  <MetricTile label="Score" value={(user!.twitterScoreValue!).toFixed(1)} highlight />
                )}
                {(user?.engagementRate ?? 0) > 0 && (
                  <MetricTile label="Eng. Rate" value={`${(user!.engagementRate!).toFixed(2)}%`} />
                )}
                {(user?.avgLikes ?? 0) > 0 && (
                  <MetricTile label="Avg Likes" value={formatFollowers(Math.round(user!.avgLikes!))} />
                )}
                {(user?.avgPostsPerDay ?? 0) > 0 && (
                  <MetricTile label="Posts/Day" value={(user!.avgPostsPerDay!).toFixed(1)} />
                )}
              </div>

              {/* Manual followers prompt if TwitterScore failed during connection */}
              {connectStep === "needsFollowers" && (
                <div style={{ padding: 14, background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.25)", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)", marginBottom: 4 }}>
                    How many followers do you have?
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    We couldn't fetch your follower count automatically. Enter it below to complete your profile.
                  </div>
                  <input
                    className="input-field"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 25000"
                    value={manualFollowers}
                    onChange={(e) => setManualFollowers(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && !savingFollowers && handleSetFollowers()}
                    disabled={savingFollowers}
                    style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <button
                    onClick={handleSetFollowers}
                    disabled={savingFollowers || !manualFollowers}
                    className="btn-primary"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    {savingFollowers ? "Saving…" : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Not connected state */
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: "rgba(29,155,240,0.12)", border: "1px solid rgba(29,155,240,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Twitter size={18} style={{ color: "#1d9bf0" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-body)", marginBottom: 3 }}>
                    Connect Twitter / X to Unlock Verified Metrics
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    Connecting your X account lets us verify your follower count, compute real engagement rates, and pre-fill your profile. This dramatically improves your campaign match scores.
                  </div>
                </div>
              </div>

              {/* Feature pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  { icon: TrendingUp, label: "Real engagement rate" },
                  { icon: ShieldCheck, label: "Authenticity score" },
                  { icon: Sparkles, label: "Auto niche detection" },
                  { icon: Languages, label: "Language detection" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                    background: "var(--bg-card-glass)", border: "1px solid var(--border)",
                    borderRadius: 999, padding: "3px 9px",
                  }}>
                    <Icon size={10} style={{ color: "#FBAC32" }} /> {label}
                  </span>
                ))}
              </div>

              {/* Handle input + connect button */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input-field"
                  placeholder="@yourhandle"
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isConnecting && handleTwitterConnect()}
                  disabled={isConnecting}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleTwitterConnect}
                  disabled={isConnecting}
                  style={{
                    padding: "0 18px", borderRadius: 10, flexShrink: 0,
                    background: isConnecting ? "rgba(29,155,240,0.10)" : "rgba(29,155,240,0.18)",
                    border: "1px solid rgba(29,155,240,0.35)",
                    color: "#1d9bf0", fontSize: 13, fontWeight: 700,
                    cursor: isConnecting ? "default" : "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <Twitter size={14} />
                  {isConnecting ? (connectStep === "apify" ? "Analyzing…" : "Verifying…") : "Connect"}
                </button>
              </div>
              {/* Status message */}
              {(isConnecting || connectStep === "error") && connectMsg && (
                <div style={{
                  marginTop: 8, fontSize: 11, fontWeight: 600,
                  color: connectStep === "error" ? "#ef4444" : "var(--text-muted)",
                }}>
                  {connectMsg}
                </div>
              )}

              {/* Manual followers input (shown when TwitterScore fails) */}
              {connectStep === "needsFollowers" && (
                <div style={{ marginTop: 14, padding: 14, background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.25)", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)", marginBottom: 4 }}>
                    How many followers do you have?
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                    We couldn't fetch your follower count automatically. Enter it below to complete your profile.
                  </div>
                  <input
                    className="input-field"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 25000"
                    value={manualFollowers}
                    onChange={(e) => setManualFollowers(e.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && !savingFollowers && handleSetFollowers()}
                    disabled={savingFollowers}
                    style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
                  />
                  <button
                    onClick={handleSetFollowers}
                    disabled={savingFollowers || !manualFollowers}
                    className="btn-primary"
                    style={{ width: "100%", fontSize: 13 }}
                  >
                    {savingFollowers ? "Saving…" : "Confirm"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Main Profile Card ───────────────────────────── */}
        <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          {/* Avatar + name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg,#FBAC32,#F29236)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#11152C", flexShrink: 0,
            }}>
              {(user?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-body)" }}>{user?.name || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user?.email}</div>
              <span className="badge badge-orange" style={{ marginTop: 4 }}>KOL</span>
            </div>
            <button
              onClick={() => editing ? handleCancel() : setEditing(true)}
              style={{
                background: editing ? "rgba(251,172,50,0.15)" : "var(--bg-card-glass)",
                border: editing ? "1px solid rgba(251,172,50,0.3)" : "1px solid var(--border)",
                borderRadius: 8, padding: "7px 10px", cursor: "pointer",
                color: editing ? "#FBAC32" : "var(--text-muted)",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              }}
            >
              <Edit3 size={14} /> {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing ? (
            /* ── EDIT MODE ──────────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <ProfileField label="Display Name">
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
              </ProfileField>

              <ProfileField label="Country / Location">
                <ScrollableSelector
                  options={COUNTRIES}
                  value={country}
                  onChange={setCountry}
                  placeholder="Search countries..."
                  emptyLabel="Global / Any"
                />
              </ProfileField>

              <ProfileField label="Primary Language">
                <ScrollableSelector
                  options={LANGUAGES}
                  value={language}
                  onChange={setLanguage}
                  placeholder="Search languages..."
                  emptyLabel="Any language"
                />
              </ProfileField>

              <ProfileField label={`Niches (${niches.length}/3)`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {NICHES.map((niche) => {
                    const selected = niches.includes(niche);
                    const disabled = !selected && niches.length >= 3;
                    return (
                      <button key={niche} onClick={() => handleNicheToggle(niche)} disabled={disabled}
                        style={{
                          padding: "5px 11px", borderRadius: 999,
                          border: selected ? "1.5px solid #FBAC32" : "1px solid var(--border)",
                          background: selected ? "rgba(251,172,50,0.15)" : "transparent",
                          color: selected ? "#FBAC32" : disabled ? "var(--text-faint)" : "var(--text-muted)",
                          fontSize: 12, fontWeight: 700,
                          cursor: disabled ? "not-allowed" : "pointer",
                          fontFamily: "inherit", transition: "all 0.15s",
                          opacity: disabled ? 0.45 : 1,
                        }}>
                        {selected && <Check size={10} style={{ display: "inline", marginRight: 4 }} />}
                        {niche}
                      </button>
                    );
                  })}
                </div>
              </ProfileField>

              <button className="btn-primary" onClick={handleSave} style={{ marginTop: 4 }}>
                <Check size={16} /> Save Changes
              </button>
            </div>
          ) : (
            /* ── VIEW MODE ──────────────────────────────── */
            <div>
              {[
                { label: "KOL Score", value: user?.kolValue ? `${user.kolValue}/100` : undefined, icon: Award },
                { label: "Location", value: user?.country, icon: MapPin },
                { label: "Language", value: user?.language, icon: Globe },
              ].map((row) =>
                row.value ? (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                    <row.icon size={14} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-body)" }}>{row.value}</div>
                    </div>
                  </div>
                ) : null
              )}

              {/* Niches */}
              {(user?.niches?.length ?? 0) > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0" }}>
                  <Tag size={14} style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                      Niches
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {user?.niches?.map((n) => (
                        <span key={n} style={{
                          fontSize: 12, fontWeight: 700, color: "#FBAC32",
                          background: "rgba(251,172,50,0.1)", border: "1px solid rgba(251,172,50,0.25)",
                          borderRadius: 999, padding: "3px 10px",
                        }}>{n}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} style={{
                  marginTop: 10, width: "100%", padding: "10px 0",
                  borderRadius: 10, border: "1px dashed rgba(251,172,50,0.3)",
                  background: "rgba(251,172,50,0.04)", color: "rgba(251,172,50,0.75)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  + Add niches, location & language
                </button>
              )}
            </div>
          )}
        </div>


        {/* ── Performance History ─────────────────────────── */}
        {(perfProfile || campaignScores.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <BarChart2 size={16} style={{ color: "#8b5cf6" }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)" }}>Performance History</h2>
            </div>

            {perfProfile && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  {
                    label: "Delivery Score",
                    value: campaignScores.length > 0
                      ? `${Math.round(campaignScores.filter((s) => s.deliveryScore !== null).reduce((acc, s, _, arr) => acc + (s.deliveryScore ?? 0) / arr.length, 0))}/100`
                      : "—",
                    color: (() => {
                      const avg = campaignScores.filter((s) => s.deliveryScore !== null).reduce((acc, s, _, arr) => acc + (s.deliveryScore ?? 0) / arr.length, 0);
                      return avg >= 70 ? "#22c55e" : avg >= 50 ? "#FBAC32" : "#ef4444";
                    })(),
                  },
                  {
                    label: "Client Rating",
                    value: perfProfile.clientSatisfaction !== null
                      ? `${perfProfile.clientSatisfaction.toFixed(1)} ★`
                      : "No ratings",
                    color: perfProfile.clientSatisfaction !== null && perfProfile.clientSatisfaction >= 4 ? "#22c55e" : "var(--text-body)",
                  },
                  {
                    label: "Campaigns Done",
                    value: (perfProfile.campaignsCompleted ?? 0).toString(),
                    color: "var(--text-body)",
                  },
                  {
                    label: "Price Tier",
                    value: perfProfile.priceCompetitiveness !== null
                      ? `${perfProfile.priceCompetitiveness.toFixed(2)}x`
                      : "Base",
                    color: perfProfile.priceCompetitiveness !== null && perfProfile.priceCompetitiveness >= 1.1 ? "#22c55e" : "var(--text-body)",
                  },
                ].map((s) => (
                  <div key={s.label} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {perfProfile?.priceCompetitiveness !== null && perfProfile?.priceCompetitiveness !== undefined && (
              <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Info size={14} style={{ color: "#8b5cf6", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                  Your price competitiveness is <strong style={{ color: "#8b5cf6" }}>{perfProfile.priceCompetitiveness.toFixed(2)}x</strong>. {perfProfile.priceCompetitiveness >= 1.1
                    ? `You earn ${Math.round((perfProfile.priceCompetitiveness - 1) * 100)}% above base rate due to strong historical performance.`
                    : perfProfile.priceCompetitiveness < 0.9
                    ? "Your rate is below average for your tier. Complete more campaigns to improve."
                    : "You're priced competitively with peers in your follower tier."}
                </p>
              </div>
            )}

            {campaignScores.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {campaignScores.map((score) => {
                  const scoreColor = score.deliveryScore !== null
                    ? score.deliveryScore >= 70 ? "#22c55e" : score.deliveryScore >= 50 ? "#FBAC32" : "#ef4444"
                    : "var(--text-faint)";
                  return (
                    <div key={score.id} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {score.campaignTitle}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {score.campaignGoal && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 999, padding: "1px 7px" }}>
                                {score.campaignGoal}
                              </span>
                            )}
                            {score.clientRating !== null && (
                              <span style={{ fontSize: 10, color: "#FBAC32" }}>
                                {"★".repeat(Math.round(score.clientRating))}{"☆".repeat(5 - Math.round(score.clientRating))}
                              </span>
                            )}
                          </div>
                        </div>
                        {score.deliveryScore !== null && (
                          <div style={{ textAlign: "center", flexShrink: 0, marginLeft: 12 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: scoreColor }}>{Math.round(score.deliveryScore)}</div>
                            <div style={{ fontSize: 10, color: "var(--text-faint)" }}>score</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        {[
                          { icon: MousePointerClick, value: (score.clicks ?? 0).toLocaleString(), label: "clicks" },
                          { icon: ArrowRightLeft, value: (score.conversions ?? 0).toLocaleString(), label: "conv." },
                          { icon: TrendingUp, value: score.costPerAcquisition !== null ? `$${score.costPerAcquisition.toFixed(2)}` : "—", label: "CPA" },
                          { icon: Star, value: score.clientRating !== null ? `${score.clientRating}/5` : "—", label: "rating", color: "#FBAC32" },
                        ].map((m) => {
                          const Icon = m.icon;
                          return (
                            <div key={m.label} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: m.color ?? "var(--text-muted)" }}>{m.value}</div>
                              <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{m.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      {score.clientFeedback && (
                        <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8, fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                          &ldquo;{score.clientFeedback}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button onClick={handleLogout} className="btn-secondary" style={{ borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
    </>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700,
        color: "var(--text-muted)", marginBottom: 5,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
