"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Wallet, Check, ExternalLink, Twitter, Users,
  CheckCircle2, Loader2, TrendingUp, BarChart2, Activity,
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

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toFixed(0);
}

interface TwitterProfile {
  twitterFollowers: number;
  twitterScore: number;
  displayName: string;
  engagementRate: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  avgPostsPerDay: number;
  apifyDone: boolean;
}

export default function SetupPage() {
  const { user, updateUser, isLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [website, setWebsite] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [twitterHandle, setTwitterHandle] = useState("");
  const [connectStep, setConnectStep] = useState<"idle" | "ts" | "apify" | "done" | "error">("idle");
  const [connectMsg, setConnectMsg] = useState("");
  const [profile, setProfile] = useState<TwitterProfile | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth");
  }, [user, isLoading, router]);

  // Clean up any pending poll on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const isConnecting = connectStep === "ts" || connectStep === "apify";
  const isConnected = connectStep === "done" && profile !== null;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  const poll = useCallback((jobId: string) => {
    const check = async () => {
      try {
        const res = await fetch(`/kol-api/connect-twitter?jobId=${encodeURIComponent(jobId)}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 404) {
          setConnectStep("error");
          setConnectMsg("Session expired - please try again.");
          return;
        }
        if (!res.ok) {
          setConnectStep("error");
          setConnectMsg("Poll failed. Please try again.");
          return;
        }
        const job = await res.json() as {
          done: boolean;
          error?: string;
          step: string;
          statusMessage: string;
          tsStep: string;
          apifyStep: string;
          twitterFollowers: number;
          twitterScore: number;
          displayName: string;
          engagementRate: number;
          avgLikes: number;
          avgRetweets: number;
          avgReplies: number;
          avgPostsPerDay: number;
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
          } else {
            setProfile({
              twitterFollowers: job.twitterFollowers,
              twitterScore: job.twitterScore,
              displayName: job.displayName,
              engagementRate: job.engagementRate,
              avgLikes: job.avgLikes,
              avgRetweets: job.avgRetweets,
              avgReplies: job.avgReplies,
              avgPostsPerDay: job.avgPostsPerDay,
              apifyDone: job.apifyStep === "ok",
            });
            setConnectStep("done");
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
  }, [stopPolling, toast]);

  const handleTwitterConnect = async () => {
    const handle = twitterHandle.replace(/^@/, "").trim();
    if (!handle) { toast("Enter your Twitter handle first", "error"); return; }
    stopPolling();
    setConnectStep("ts");
    setConnectMsg("Verifying handle…");
    setProfile(null);

    try {
      const res = await fetch(
        `/kol-api/connect-twitter?action=start&handle=${encodeURIComponent(handle)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setConnectStep("error");
        setConnectMsg(d.error ?? "Failed to start verification.");
        toast(d.error ?? "Failed to start verification.", "error");
        return;
      }
      const { jobId } = await res.json() as { jobId: string };
      poll(jobId);
    } catch {
      setConnectStep("error");
      setConnectMsg("Network error - please try again.");
      toast("Network error - please try again.", "error");
    }
  };

  const handleTwitterDisconnect = () => {
    stopPolling();
    setConnectStep("idle");
    setConnectMsg("");
    setProfile(null);
  };

  const handleWalletConnect = () => {
    setWalletConnected(true);
    toast("Wallet connected successfully!", "success");
  };

  const toggleNiche = (niche: string) => {
    if (selectedNiches.includes(niche)) {
      setSelectedNiches(selectedNiches.filter((n) => n !== niche));
    } else if (selectedNiches.length < 3) {
      setSelectedNiches([...selectedNiches, niche]);
    } else {
      toast("Max 3 niches. Remove one to add another.", "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    if (user?.role === "kol" && !agreedTerms) { toast("Please agree to the Terms of Service", "error"); return; }
    if (user?.role === "kol" && !isConnected) { toast("Please connect your X account", "error"); return; }
    setLoading(true);
    const handle = twitterHandle.replace(/^@/, "");
    updateUser({
      name,
      companyName: company || undefined,
      title: title || undefined,
      twitterAccount: isConnected ? `@${handle}` : undefined,
      website: website || undefined,
      walletConnected,
      agreedToTerms: agreedTerms,
      setupComplete: true,
      bio: bio || undefined,
      country: country || undefined,
      language: language || undefined,
      niches: selectedNiches.length > 0 ? selectedNiches : undefined,
      twitterFollowers: profile?.twitterFollowers ?? undefined,
    });
    toast("Profile set up successfully!", "success");
    if (user?.role === "client") router.replace("/dashboard");
    else router.replace("/kol");
    setLoading(false);
  };

  if (isLoading || !user) return null;

  const isClient = user.role === "client";
  const cleanHandle = twitterHandle.replace(/^@/, "");

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-body)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 60px" }}>
      <div className="animate-in" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <Image src="/logo.jpg" alt="HypeEngine" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em" }}>Complete Setup</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {isClient ? "Set up your Crypto Project account" : "Set up your KOL account"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section label="Basic Info">
            <Field label="Full Name *">
              <input className="input-field" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            {isClient && (
              <>
                <Field label="Company Name">
                  <input className="input-field" placeholder="CryptoVentures Inc." value={company} onChange={(e) => setCompany(e.target.value)} />
                </Field>
                <Field label="Title / Role">
                  <input className="input-field" placeholder="CMO / Marketing Lead" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
              </>
            )}
          </Section>

          {isClient && (
            <Section label="Details">
              <Field label="Twitter / X Handle">
                <input className="input-field" placeholder="@yourhandle" value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} />
              </Field>
              <Field label="Website">
                <input className="input-field" placeholder="yourproject.io" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </Field>
              <div>
                <label className="section-title">Wallet</label>
                <button
                  type="button"
                  onClick={handleWalletConnect}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: walletConnected ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--input-border)", background: walletConnected ? "rgba(34,197,94,0.08)" : "var(--bg-card-glass)", cursor: walletConnected ? "default" : "pointer", display: "flex", alignItems: "center", gap: 10, color: walletConnected ? "#22c55e" : "var(--text-muted)", fontSize: 14, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}
                >
                  {walletConnected ? <Check size={18} /> : <Wallet size={18} />}
                  {walletConnected ? "Wallet Connected ✓" : "Connect Wallet"}
                </button>
              </div>
            </Section>
          )}

          {!isClient && (
            <>
              <Section label="X / Twitter Account">
                {isConnected && profile ? (
                  <ConnectedCard handle={cleanHandle} profile={profile} onDisconnect={handleTwitterDisconnect} />
                ) : isConnecting ? (
                  <ConnectingCard step={connectStep} msg={connectMsg} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Field label="Your X Handle">
                      <input
                        className="input-field"
                        placeholder="@yourhandle"
                        value={twitterHandle}
                        onChange={(e) => setTwitterHandle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleTwitterConnect(); } }}
                      />
                    </Field>
                    {connectStep === "error" && (
                      <p style={{ fontSize: 12, color: "#ef4444", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
                        {connectMsg}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleTwitterConnect}
                      style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(29,155,240,0.35)", background: "rgba(29,155,240,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#1d9bf0", fontSize: 14, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}
                    >
                      <Twitter size={18} />
                      Connect with X
                    </button>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                      We verify your handle and fetch real engagement metrics
                    </p>
                  </div>
                )}
              </Section>

              <Section label="Bio">
                <Field label={`About You (${bio.length}/160)`}>
                  <textarea
                    className="input-field"
                    placeholder="Tell campaigns what makes your audience unique: your style, content focus, and community vibe…"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    rows={3}
                    style={{ resize: "none", lineHeight: 1.5 }}
                  />
                </Field>
              </Section>

              <Section label="Audience">
                <Field label="Primary Country">
                  <ScrollableSelector options={COUNTRIES} value={country} onChange={setCountry} placeholder="Search countries..." emptyLabel="Global / Any" />
                </Field>
                <Field label="Primary Language">
                  <ScrollableSelector options={LANGUAGES} value={language} onChange={setLanguage} placeholder="Search languages..." emptyLabel="Any language" />
                </Field>
              </Section>

              <Section label={`Niches (${selectedNiches.length}/3)`}>
                <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 12, marginTop: -4 }}>
                  Select up to 3 that best describe your audience
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {NICHES.map((niche) => {
                    const selected = selectedNiches.includes(niche);
                    return (
                      <button key={niche} type="button" onClick={() => toggleNiche(niche)}
                        style={{ padding: "8px 14px", borderRadius: 999, border: selected ? "1.5px solid #FBAC32" : "1px solid var(--border)", background: selected ? "rgba(251,172,50,0.12)" : "var(--bg-card-glass)", color: selected ? "#FBAC32" : "var(--text-muted)", fontSize: 13, fontWeight: selected ? 700 : 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                      >
                        {selected && <span style={{ marginRight: 5 }}>✓</span>}
                        {niche}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section label="Terms">
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: 16, background: "var(--bg-card-glass)", border: agreedTerms ? "1px solid rgba(251,172,50,0.3)" : "1px solid var(--border)", borderRadius: 12, transition: "all 0.2s" }}>
                  <div
                    onClick={() => setAgreedTerms(!agreedTerms)}
                    style={{ width: 20, height: 20, borderRadius: 5, border: agreedTerms ? "2px solid #FBAC32" : "2px solid var(--text-faint)", background: agreedTerms ? "#FBAC32" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", marginTop: 2, cursor: "pointer" }}
                  >
                    {agreedTerms && <Check size={12} style={{ color: "#11152C" }} />}
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <span style={{ color: "#FBAC32", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      Terms of Service <ExternalLink size={12} />
                    </span>
                  </span>
                </label>
              </Section>
            </>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (user.role === "kol" && !agreedTerms) || isConnecting}
            style={{ marginTop: 4 }}
          >
            {loading ? "Setting up..." : isClient ? "Complete Setup" : "Accept & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Connecting in-progress card ───────────────────────────────────────────────

function ConnectingCard({ step, msg }: { step: string; msg: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, border: "1px solid rgba(29,155,240,0.25)", background: "rgba(29,155,240,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Loader2 size={16} style={{ color: "#1d9bf0", flexShrink: 0, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1d9bf0" }}>
          {step === "ts" ? "Verifying handle…" : "Fetching engagement metrics…"}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>{msg || "Please wait…"}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <StepPill label="TwitterScore" done={step === "apify" || step === "done"} active={step === "ts"} />
        <StepPill label="Engagement data" done={step === "done"} active={step === "apify"} />
      </div>
    </div>
  );
}

function StepPill({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const bg = done ? "rgba(34,197,94,0.12)" : active ? "rgba(29,155,240,0.12)" : "rgba(255,255,255,0.04)";
  const border = done ? "rgba(34,197,94,0.3)" : active ? "rgba(29,155,240,0.3)" : "var(--border)";
  const color = done ? "#22c55e" : active ? "#1d9bf0" : "var(--text-faint)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: bg, border: `1px solid ${border}` }}>
      {done
        ? <CheckCircle2 size={11} style={{ color }} />
        : active
          ? <Loader2 size={11} style={{ color, animation: "spin 1s linear infinite" }} />
          : <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--border)", display: "inline-block" }} />
      }
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

// ── Connected card ────────────────────────────────────────────────────────────

function ConnectedCard({ handle, profile, onDisconnect }: { handle: string; profile: TwitterProfile; onDisconnect: () => void }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(29,155,240,0.3)", background: "rgba(29,155,240,0.06)", overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid rgba(29,155,240,0.12)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FBAC32", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#11152C", flexShrink: 0 }}>
          {handle.charAt(0).toUpperCase() || "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text-body)" }}>@{handle}</span>
            <CheckCircle2 size={14} style={{ color: "#1d9bf0", flexShrink: 0 }} />
          </div>
          {profile.displayName && profile.displayName !== handle && (
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{profile.displayName}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onDisconnect}
          style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 8px", flexShrink: 0 }}
        >
          Disconnect
        </button>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
        <MetricCell icon={<Users size={12} />} value={fmt(profile.twitterFollowers)} label="Followers" />
        <MetricCell icon={<TrendingUp size={12} />} value={profile.twitterScore.toFixed(1)} label="Score" highlight />
        <MetricCell icon={<CheckCircle2 size={12} />} value="Verified" label="Status" verified />
        {profile.apifyDone && (
          <>
            <MetricCell icon={<Activity size={12} />} value={`${profile.engagementRate.toFixed(2)}%`} label="Eng. Rate" />
            <MetricCell icon={<BarChart2 size={12} />} value={fmt(profile.avgLikes)} label="Avg Likes" />
            <MetricCell icon={<Twitter size={12} />} value={`${profile.avgPostsPerDay.toFixed(1)}/day`} label="Post Rate" />
          </>
        )}
      </div>
    </div>
  );
}

function MetricCell({ icon, value, label, highlight, verified }: { icon: React.ReactNode; value: string; label: string; highlight?: boolean; verified?: boolean }) {
  const color = verified ? "#22c55e" : highlight ? "#FBAC32" : "var(--text-body)";
  return (
    <div style={{ padding: "12px 14px", borderRight: "1px solid rgba(29,155,240,0.1)", borderBottom: "1px solid rgba(29,155,240,0.1)", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-faint)" }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: -2 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
