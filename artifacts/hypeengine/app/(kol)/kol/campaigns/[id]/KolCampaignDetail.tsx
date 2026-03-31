"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import Navbar from "@/components/layout/Navbar";
import Modal from "@/components/ui/Modal";
import {
  getCompletionPercent,
  calculateKolReward,
  calculateMatchScore,
  matchScoreLabel,
  matchScoreColor,
  formatNumber,
} from "@/lib/utils";
import {
  Copy,
  Zap,
  AlertTriangle,
  CheckCircle,
  Twitter,
  Link as LinkIcon,
  Calendar,
  BarChart2,
  Target,
  Edit3,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Stage = "preview" | "scanning";
type ScanState = "idle" | "pending" | "found" | "not_found";

interface TweetData {
  matchId: string;
  kolProfileId: string;
  generatedTweetText: string | null;
  customTweetText: string | null;
  originalTemplate: string | null;
  trackingLinkVerified: boolean;
  trackingUrl: string | null;
  refCode: string | null;
  status: string;
}

export default function KolCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, updateUser } = useAuth();
  const { campaigns, refreshCampaign } = useApp();
  const { toast } = useToast();
  const router = useRouter();

  const campaign = campaigns.find((c) => c.id === id);

  // Tweet data from DB
  const [tweetData, setTweetData] = useState<TweetData | null>(null);
  const [tweetLoading, setTweetLoading] = useState(true);

  // Edit tweet state
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Regenerate state
  const [regenerating, setRegenerating] = useState(false);

  // Template fallback (used when no personalized tweet is available)
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);

  // Post tracking state
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);
  const [scanCredits, setScanCredits] = useState<number>(0);

  // Already posted / manual claim
  const [alreadyPostedMode, setAlreadyPostedMode] = useState(false);
  const [postedUrl, setPostedUrl] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Post history for this campaign
  const [campaignPosts, setCampaignPosts] = useState<import("@/lib/types").Post[]>([]);

  // API-sourced match score (avoids flicker from local calculation)
  const [apiMatchScore, setApiMatchScore] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/kol/match-scores?userId=${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((scores: { campaignId: string; matchScore: number }[] | null) => {
        if (!scores) return;
        const found = scores.find((s) => s.campaignId === id);
        if (found) setApiMatchScore(found.matchScore);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  const refreshCampaignPosts = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/posts?kolId=${user.id}&campaignId=${id}`);
      if (res.ok) {
        const data = await res.json() as import("@/lib/types").Post[];
        setCampaignPosts(data);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    void refreshCampaignPosts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  // Rehydrate scan state on mount (handles page reload mid-scan)
  useEffect(() => {
    if (!user?.id || scanState !== "idle") return;
    const hydrate = async () => {
      try {
        const res = await fetch(`/api/campaigns/${id}/post-status`);
        if (!res.ok) return;
        const data = await res.json() as { apifyStatus: string | null; status: string; creditsEarned: number; postId?: string };
        if (data.apifyStatus === "found") {
          // Post was already verified — stay in idle/preview, nothing else to show
          setScanState("idle");
          setStage("preview");
        } else if (data.apifyStatus === "not_found") {
          setScanState("not_found");
          setStage("scanning");
        } else if (data.status === "pending") {
          setScanState("pending");
          if (data.postId) setPendingPostId(data.postId);
          setStage("scanning");
        }
        // If data.status === "approved" and apifyStatus !== "found", the post is
        // already fully settled — don't lock the UI, let the user post again.
      } catch { /* silent */ }
    };
    void hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id]);

  const hasCampaignTargeting = campaign
    ? (campaign.targetNiches?.length ?? 0) > 0 ||
      (campaign.targetCountries?.length ?? 0) > 0 ||
      (campaign.targetLanguages?.length ?? 0) > 0
    : false;

  const kolProfile = {
    niches: user?.niches,
    country: user?.country,
    language: user?.language,
  };

  const localMatchFraction = campaign && hasCampaignTargeting
    ? calculateMatchScore(campaign, kolProfile)
    : 1.0;
  const matchScorePercent = apiMatchScore ?? campaign?.matchScore ?? localMatchFraction * 100;
  const matchScore = matchScorePercent / 100;

  const followers = user?.twitterFollowers ?? user?.followers ?? 50000;
  const reward = campaign?.calculatedPrice ?? (campaign ? calculateKolReward(campaign.maxPricePerPost, followers, matchScore) : 0);
  const baseReward = campaign ? calculateKolReward(campaign.maxPricePerPost, followers, 1.0) : 0;

  // Use local campaignPosts for counts so they update immediately after any action
  const todayStr = new Date().toISOString().split("T")[0];
  const localTodayPosts = campaignPosts.filter((p) => {
    const d = p.postedDate ?? p.createdAt?.slice(0, 10);
    return d === todayStr;
  });
  const localTodayCount = localTodayPosts.length;
  const localTotalCount = campaignPosts.length;
  const localTodayApproved = localTodayPosts.filter((p) => p.status === "approved").length;
  const localTodayPending = localTodayPosts.filter((p) => p.status === "pending").length;
  const localTotalApproved = campaignPosts.filter((p) => p.status === "approved").length;
  const localTotalPending = campaignPosts.filter((p) => p.status === "pending").length;

  const dailyLimit = campaign?.maxPostsPerKolPerDay ?? 1;
  const totalLimit = campaign?.maxPostsPerKolTotal ?? 5;
  const dailyLimitReached = localTodayCount >= dailyLimit;
  const totalLimitReached = localTotalCount >= totalLimit;
  const canPost = campaign?.status === "active" && !dailyLimitReached && !totalLimitReached;

  const [showModal, setShowModal] = useState(false);
  const [stage, setStage] = useState<Stage>("preview");

  // Poll scan status when pending
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (scanState !== "pending" || !user?.id) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/campaigns/${id}/post-status`);
        if (!res.ok) return;
        const data = await res.json() as {
          apifyStatus: string | null;
          status: string;
          creditsEarned: number;
        };
        if (data.apifyStatus === "found" || data.status === "approved") {
          const earned = data.creditsEarned ?? reward;
          setScanCredits(earned);
          await updateUser({ credits: (user.credits ?? 0) + earned });
          await refreshCampaignPosts();
          refreshCampaign(id).catch(() => {});
          if (pollRef.current) clearInterval(pollRef.current);
          toast(`Tweet verified! $${earned} added to your account.`, "success");
          setScanState("idle");
          setStage("preview");
        } else if (data.apifyStatus === "not_found") {
          setScanState("not_found");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* silent */ }
    };
    pollRef.current = setInterval(() => { void poll(); }, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [scanState, user?.id, id, reward, user?.credits, updateUser]);

  // Fetch tweet data from DB
  useEffect(() => {
    if (!user?.id || !id) return;
    setTweetLoading(true);
    fetch(`/api/kol/tweet?campaignId=${id}&userId=${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setTweetData(data as TweetData);
          const displayText = data.customTweetText ?? data.generatedTweetText ?? "";
          setEditedText(displayText);
        }
      })
      .catch(() => {})
      .finally(() => setTweetLoading(false));
  }, [id, user?.id]);

  // Campaign templates as fallback when no personalized tweet exists
  const allTemplates = campaign?.postTemplates?.length
    ? campaign.postTemplates
    : campaign?.postTemplate
    ? [campaign.postTemplate]
    : [];
  const safeTemplateIdx = Math.min(selectedTemplateIdx, Math.max(0, allTemplates.length - 1));
  const templateFallback = !tweetData && !tweetLoading && allTemplates.length > 0
    ? allTemplates[safeTemplateIdx]
    : null;

  const rawTweet = tweetData?.customTweetText ?? tweetData?.generatedTweetText ?? templateFallback;
  // Auto-append hashtag if not already present
  const displayTweet = rawTweet && campaign?.hashtag && !rawTweet.includes(campaign.hashtag)
    ? `${rawTweet}\n\n${campaign.hashtag}`
    : rawTweet;
  const trackingUrl = tweetData?.trackingUrl;
  const refCode = tweetData?.refCode;

  const trackingMissingInEdit = editMode && trackingUrl && !editedText.includes(refCode ?? "");

  const handleSaveEdit = async () => {
    if (!tweetData) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/campaigns/${id}/matches/${tweetData.matchId}/tweet`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customTweetText: editedText }),
        },
      );
      if (res.ok) {
        setTweetData((prev) => prev ? { ...prev, customTweetText: editedText } : prev);
        setEditMode(false);
        toast("Tweet saved!", "success");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerate = async () => {
    if (!tweetData) return;
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/campaigns/${id}/matches/${tweetData.matchId}/tweet/regenerate`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json() as { tweetText: string };
        setTweetData((prev) =>
          prev ? { ...prev, generatedTweetText: data.tweetText, customTweetText: null } : prev
        );
        setEditedText(data.tweetText);
        setEditMode(false);
        toast("New tweet generated!", "success");
      } else {
        toast("Regeneration failed - try again", "error");
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyAndPost = () => {
    const text = displayTweet ?? "";
    navigator.clipboard?.writeText(text).catch(() => {});
    toast("Tweet copied! Open Twitter to post.", "success");
  };


  // Record post intent + open Twitter (intent recorded FIRST, then Twitter opens)
  const handlePost = async () => {
    if (!user) return;
    setStage("scanning");

    // Record intent in DB first (starts background scan)
    try {
      const res = await fetch(`/api/campaigns/${id}/post-intent`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { postId: string };
        setPendingPostId(data.postId);
        setScanState("pending");
        setShowModal(false);
        await refreshCampaignPosts();
      }
    } catch (err) {
      console.error("[handlePost] post-intent failed:", err);
    }

    // Open Twitter after intent is recorded
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(displayTweet ?? "")}`,
      "_blank",
    );
  };

  // Manual claim: submit tweet URL
  const handleClaimPost = async () => {
    if (!user) return;
    if (!postedUrl) { toast("Please enter your tweet URL", "error"); return; }
    setClaimError(null);
    setSubmittingPost(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/claim-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl: postedUrl }),
      });
      const data = await res.json() as { postId?: string; creditsEarned?: number; message?: string; error?: string; hashtag?: string };
      if (!res.ok) {
        if (data.error === "already_tracked") {
          setClaimError("This tweet has already been tracked and approved.");
        } else if (data.error === "not_found") {
          setClaimError("Tweet not found. Make sure the URL is correct and the tweet is public.");
        } else if (data.error === "missing_hashtag") {
          setClaimError(`Your tweet must include the campaign hashtag ${data.hashtag ?? campaign?.hashtag ?? ""}. Please check and try again.`);
        } else if (data.error === "verification_unavailable") {
          setClaimError("Verification service is temporarily unavailable. Please try again in a few minutes.");
        } else {
          setClaimError(data.message ?? data.error ?? "Failed to verify tweet. Please try again.");
        }
        return;
      }

      const earned = data.creditsEarned ?? reward;
      setScanCredits(earned);
      await updateUser({ credits: (user.credits ?? 0) + earned });
      await refreshCampaignPosts();
      refreshCampaign(id).catch(() => {});

      toast(data.message ?? `$${earned} added to your account!`, "success");
      setAlreadyPostedMode(false);
      setScanState("idle");
      setPostedUrl("");
    } finally {
      setSubmittingPost(false);
    }
  };

  if (!campaign) {
    return (
      <>
        <Navbar showBack onBack={() => router.replace("/kol/campaigns")} />
        <div className="page-container" style={{ paddingTop: 84, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", marginTop: 40 }}>Campaign not found</p>
        </div>
      </>
    );
  }

  const completion = getCompletionPercent(campaign.usedCredits, campaign.totalCredits);
  const charCount = (displayTweet ?? "").length;

  return (
    <>
      <Navbar title={campaign.title} showBack onBack={() => router.replace("/kol/campaigns")} />
      <div className="page-container animate-in" style={{ paddingTop: 84 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {campaign.trending && <span className="badge badge-trending">🔥 Trending</span>}
          <span className="badge badge-green">Active</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 10 }}>
          {campaign.title}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
          {campaign.description}
        </p>

        {/* Reward card */}
        <div style={{ background: "linear-gradient(135deg, rgba(251,172,50,0.12), rgba(242,146,54,0.08))", border: "1px solid rgba(251,172,50,0.25)", borderRadius: 18, padding: 20, marginBottom: hasCampaignTargeting ? 12 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 12, color: "rgba(251,172,50,0.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Your Reward</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: "#FBAC32" }}>${reward}</span>
                <span style={{ fontSize: 14, color: "rgba(251,172,50,0.6)" }}>per post</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                Based on {formatNumber(followers)} followers
              </p>
            </div>
            <Zap size={36} style={{ color: "rgba(251,172,50,0.5)" }} />
          </div>
        </div>

        {/* Audience match */}
        {hasCampaignTargeting && (
          <div style={{ background: "var(--bg-card-glass)", border: `1px solid ${matchScoreColor(matchScore)}30`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Target size={14} style={{ color: matchScoreColor(matchScore) }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-body)" }}>Audience Match</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: matchScoreColor(matchScore), background: `${matchScoreColor(matchScore)}15`, border: `1px solid ${matchScoreColor(matchScore)}35`, borderRadius: 999, padding: "3px 10px" }}>
                {matchScoreLabel(matchScore)} · {Math.round(matchScore * 100)}%
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(campaign?.targetNiches?.length ?? 0) > 0 && (() => {
                const overlap = (user?.niches ?? []).filter((n) => campaign!.targetNiches!.includes(n));
                const matched = overlap.length > 0;
                return <MatchRow label="Niches" matched={matched} detail={matched ? `Matching: ${overlap.join(", ")}` : `Wants: ${campaign!.targetNiches!.join(", ")}`} />;
              })()}
              {(() => {
                const hasRestriction = (campaign?.targetCountries?.length ?? 0) > 0;
                if (!hasRestriction) return <MatchRow label="Country" matched={true} detail="Open to all countries" />;
                const matched = !!user?.country && campaign!.targetCountries!.includes(user.country);
                return <MatchRow label="Country" matched={matched} detail={matched ? user!.country! : `Targets: ${campaign!.targetCountries!.slice(0, 2).join(", ")}${campaign!.targetCountries!.length > 2 ? "…" : ""}`} />;
              })()}
              {(() => {
                const hasRestriction = (campaign?.targetLanguages?.length ?? 0) > 0;
                if (!hasRestriction) return <MatchRow label="Language" matched={true} detail="Open to all languages" />;
                const matched = !!user?.language && campaign!.targetLanguages!.includes(user.language);
                return <MatchRow label="Language" matched={matched} detail={matched ? user!.language! : `Wants: ${campaign!.targetLanguages!.join(", ")}`} />;
              })()}
            </div>
          </div>
        )}

        {/* Scan status banner + inline claim form */}
        {scanState === "pending" && (
          <div style={{ background: "rgba(29,155,240,0.06)", border: "1px solid rgba(29,155,240,0.3)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Loader2 size={18} style={{ color: "#1d9bf0", flexShrink: 0, animation: "spin 1s linear infinite" }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#1d9bf0", marginBottom: 2 }}>Scanning your timeline…</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Scanning now — if not detected within seconds, we'll retry at 5 and 10 minutes. Already posted? Claim instantly below.</p>
              </div>
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Claim now - paste your tweet URL</label>
            <input
              className="input-field"
              placeholder="https://x.com/you/status/..."
              value={postedUrl}
              onChange={(e) => { setPostedUrl(e.target.value); setClaimError(null); }}
              style={{ marginBottom: 8 }}
            />
            {claimError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", marginBottom: 8 }}>
                <ShieldAlert size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{claimError}</span>
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleClaimPost}
              disabled={submittingPost || !postedUrl}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {submittingPost ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Verifying…</>
              ) : (
                <><ShieldCheck size={14} /> Verify &amp; Claim Credits</>
              )}
            </button>
          </div>
        )}
        {scanState === "not_found" && (
          <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.3)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={18} style={{ color: "#FBAC32", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#FBAC32", marginBottom: 2 }}>Auto-scan complete - tweet not detected</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Paste your tweet URL below to claim your credits.</p>
              </div>
            </div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tweet URL *</label>
            <input
              className="input-field"
              placeholder="https://x.com/you/status/..."
              value={postedUrl}
              onChange={(e) => { setPostedUrl(e.target.value); setClaimError(null); }}
              style={{ marginBottom: 8 }}
            />
            {claimError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", marginBottom: 8 }}>
                <ShieldAlert size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{claimError}</span>
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleClaimPost}
              disabled={submittingPost || !postedUrl}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {submittingPost ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Verifying…</>
              ) : (
                <><ShieldCheck size={14} /> Verify &amp; Claim Credits</>
              )}
            </button>
          </div>
        )}

        {/* Budget */}
        <div className="card-elevated" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Budget remaining</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: completion >= 80 ? "#FBAC32" : "var(--text-body)" }}>{100 - completion}% left</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${completion}%` }} />
          </div>
          {completion >= 80 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <AlertTriangle size={13} style={{ color: "#FBAC32" }} />
              <span style={{ fontSize: 12, color: "#FBAC32", fontWeight: 700 }}>Budget filling fast! Post now.</span>
            </div>
          )}
        </div>

        {/* Post limits */}
        <div className="card-elevated" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "var(--text-body)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Your Post Activity</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
              {localTodayPending > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#FBAC32", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FBAC32", display: "inline-block" }} />
                  {localTodayPending} pending
                </span>
              )}
              {localTodayApproved > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#22c55e", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                  {localTodayApproved} verified
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Today row */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,172,50,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Calendar size={14} style={{ color: "#FBAC32" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Today</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: dailyLimitReached ? "#ef4444" : "var(--text-body)" }}>
                      {localTodayCount}/{dailyLimit}
                    </span>
                  </div>
                  {/* Segmented progress bar */}
                  <div style={{ height: 6, background: "var(--bg-card-glass)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                    {localTodayApproved > 0 && (
                      <div style={{ height: "100%", width: `${(localTodayApproved / dailyLimit) * 100}%`, background: "#22c55e", borderRadius: 999, transition: "width 0.4s ease" }} />
                    )}
                    {localTodayPending > 0 && (
                      <div style={{ height: "100%", width: `${(localTodayPending / dailyLimit) * 100}%`, background: "#FBAC32", borderRadius: 999, transition: "width 0.4s ease" }} />
                    )}
                  </div>
                </div>
              </div>
              {localTodayCount > 0 && (
                <div style={{ display: "flex", gap: 4, paddingLeft: 38, flexWrap: "wrap" }}>
                  {localTodayPosts.map((p) => (
                    <span
                      key={p.id}
                      title={p.status === "approved" ? "Verified ✓" : "Pending verification"}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                        background: p.status === "approved" ? "rgba(34,197,94,0.12)" : "rgba(251,172,50,0.12)",
                        color: p.status === "approved" ? "#22c55e" : "#FBAC32",
                        border: `1px solid ${p.status === "approved" ? "rgba(34,197,94,0.3)" : "rgba(251,172,50,0.3)"}`,
                      }}
                    >
                      {p.status === "approved" ? "✓ verified" : "⏳ pending"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Total row */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,172,50,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BarChart2 size={14} style={{ color: "#FBAC32" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>All time</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: totalLimitReached ? "#ef4444" : "var(--text-body)" }}>
                      {localTotalCount}/{totalLimit}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-card-glass)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                    {localTotalApproved > 0 && (
                      <div style={{ height: "100%", width: `${(localTotalApproved / totalLimit) * 100}%`, background: "#22c55e", borderRadius: 999, transition: "width 0.4s ease" }} />
                    )}
                    {localTotalPending > 0 && (
                      <div style={{ height: "100%", width: `${(localTotalPending / totalLimit) * 100}%`, background: "#FBAC32", borderRadius: 999, transition: "width 0.4s ease" }} />
                    )}
                  </div>
                </div>
              </div>
              {localTotalCount > 0 && localTotalApproved > 0 && (
                <p style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, marginTop: 6, paddingLeft: 38 }}>
                  {localTotalApproved} post{localTotalApproved !== 1 ? "s" : ""} earned ${localTotalApproved * reward} in credits
                </p>
              )}
            </div>
          </div>

          {(dailyLimitReached || totalLimitReached) && (
            <p style={{ fontSize: 12, color: "rgba(239,68,68,0.8)", marginTop: 12, lineHeight: 1.5, fontWeight: 600 }}>
              ⚠️ {totalLimitReached ? "Total post limit reached." : "Daily limit reached - come back tomorrow!"} Additional posts won't be tracked.
            </p>
          )}
        </div>

        {!canPost && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>
              {totalLimitReached ? "You've reached your total post limit for this campaign." : "You've reached your daily post limit. Come back tomorrow!"}
            </span>
          </div>
        )}

        {/* ── POST TEMPLATES (fallback) ─────────────────────────────────── */}
        {!tweetLoading && templateFallback && (
          <div className="card-elevated" style={{ padding: 18, marginBottom: 20 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-body)" }}>Post Templates</h3>
              {campaign.hashtag && <span className="badge badge-orange">{campaign.hashtag}</span>}
            </div>

            {/* Pagination row */}
            {allTemplates.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
                <button
                  onClick={() => setSelectedTemplateIdx((i) => Math.max(0, i - 1))}
                  disabled={safeTemplateIdx === 0}
                  style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-card-glass)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: safeTemplateIdx === 0 ? "default" : "pointer", opacity: safeTemplateIdx === 0 ? 0.4 : 1, padding: 0, flexShrink: 0 }}
                >
                  <ChevronLeft size={15} style={{ color: "var(--text-muted)" }} />
                </button>
                <div style={{ display: "flex", gap: 6 }}>
                  {allTemplates.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedTemplateIdx(i)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0,
                        background: i === safeTemplateIdx ? "#FBAC32" : "transparent",
                        outline: i === safeTemplateIdx ? "none" : "1px solid rgba(255,255,255,0.25)",
                        color: i === safeTemplateIdx ? "#11152C" : "var(--text-muted)",
                        fontSize: 12, fontWeight: 800, fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedTemplateIdx((i) => Math.min(allTemplates.length - 1, i + 1))}
                  disabled={safeTemplateIdx === allTemplates.length - 1}
                  style={{ width: 28, height: 28, borderRadius: 8, background: "var(--bg-card-glass)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: safeTemplateIdx === allTemplates.length - 1 ? "default" : "pointer", opacity: safeTemplateIdx === allTemplates.length - 1 ? 0.4 : 1, padding: 0, flexShrink: 0 }}
                >
                  <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            )}

            {/* Template label */}
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#FBAC32", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              {safeTemplateIdx === 0 ? "Primary Template" : `Template ${safeTemplateIdx + 1}`}
            </p>

            {/* Template text card */}
            <div style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <p style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {displayTweet}
              </p>
            </div>

            {/* Copy Template button */}
            <button
              onClick={handleCopyAndPost}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Copy size={13} /> Copy Template
            </button>
          </div>
        )}

        {/* ── YOUR TWEET (personalized) ────────────────────────────────────── */}
        {(tweetLoading || tweetData) && (
          <div className="card-elevated" style={{ padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-body)", marginBottom: 2 }}>Your Tweet</h3>
                <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Personalized with your unique tracking link</p>
              </div>
              {campaign.hashtag && <span className="badge badge-orange">{campaign.hashtag}</span>}
            </div>

            {tweetLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: "var(--text-muted)", fontSize: 14 }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "#FBAC32" }} />
                Generating your personalized tweet…
              </div>
            ) : displayTweet ? (
              <>
                {/* Tweet preview card */}
                {!editMode ? (
                  <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #FBAC32, #F29236)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#11152C", flexShrink: 0 }}>
                        {(user?.name ?? "?").charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e7e9ea" }}>{user?.name}</div>
                        <div style={{ fontSize: 12, color: "#71767b" }}>{user?.twitterAccount ?? "@you"}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: "#e7e9ea", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {trackingUrl ? (
                        <>
                          {displayTweet.split(trackingUrl).map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span style={{ color: "#1d9bf0", fontWeight: 700, background: "rgba(29,155,240,0.12)", borderRadius: 4, padding: "1px 4px" }}>
                                  {trackingUrl}
                                </span>
                              )}
                            </span>
                          ))}
                        </>
                      ) : (
                        displayTweet
                      )}
                    </p>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      rows={6}
                      style={{
                        width: "100%",
                        background: "#0D1117",
                        border: `1px solid ${trackingMissingInEdit ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 12,
                        padding: 14,
                        color: "#e7e9ea",
                        fontSize: 14,
                        lineHeight: 1.7,
                        resize: "vertical",
                        fontFamily: "inherit",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {trackingMissingInEdit && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.25)" }}>
                        <ShieldAlert size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>Your tracking link is missing. Clicks won't be tracked.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Char count */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: charCount > 260 ? (charCount > 280 ? "#ef4444" : "#FBAC32") : "var(--text-muted)" }}>
                    {editMode ? editedText.length : charCount}/280
                  </span>
                </div>

                {/* Action buttons */}
                {!editMode ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { setEditedText(displayTweet ?? ""); setEditMode(true); }}
                      style={{ flex: 1, background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      style={{ flex: 1, background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: regenerating ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: regenerating ? 0.6 : 1, fontFamily: "inherit" }}
                    >
                      {regenerating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RotateCcw size={14} />}
                      {regenerating ? "Generating…" : "Regenerate"}
                    </button>
                    <button
                      onClick={handleCopyAndPost}
                      title="Copy tweet"
                      style={{ width: 40, height: 40, flexShrink: 0, background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                    >
                      <Copy size={15} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setEditMode(false)}
                      style={{ flex: 1, background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="btn-primary"
                      style={{ flex: 1 }}
                    >
                      {savingEdit ? "Saving…" : "Save Tweet"}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn-primary"
            onClick={() => { setStage("preview"); setShowModal(true); }}
            disabled={!canPost || scanState === "pending"}
          >
            <Twitter size={18} /> Post to X Now
          </button>
          <button
            className="btn-secondary"
            onClick={() => { setAlreadyPostedMode((v) => !v); setClaimError(null); setPostedUrl(""); }}
            disabled={scanState === "pending" || scanState === "not_found"}
          >
            <LinkIcon size={16} /> {alreadyPostedMode ? "Cancel" : "Already Posted? Claim Credits"}
          </button>
        </div>

        {/* Inline manual claim — shown when alreadyPostedMode and no active scan */}
        {alreadyPostedMode && (
          <div style={{ background: "rgba(29,155,240,0.06)", border: "1px solid rgba(29,155,240,0.3)", borderRadius: 14, padding: 16, marginTop: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Claim now - paste your tweet URL</label>
            <input
              className="input-field"
              placeholder="https://x.com/you/status/..."
              value={postedUrl}
              onChange={(e) => { setPostedUrl(e.target.value); setClaimError(null); }}
              style={{ marginBottom: 8 }}
            />
            {claimError && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", marginBottom: 8 }}>
                <ShieldAlert size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>{claimError}</span>
              </div>
            )}
            <button
              className="btn-primary"
              onClick={handleClaimPost}
              disabled={submittingPost || !postedUrl}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {submittingPost ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Verifying…</>
              ) : (
                <><ShieldCheck size={14} /> Verify &amp; Claim Credits</>
              )}
            </button>
          </div>
        )}

        {/* Post History */}
        {campaignPosts.length > 0 && (
          <div style={{ marginTop: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-body)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Your Posts ({campaignPosts.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {campaignPosts.map((post) => (
                <div key={post.id} style={{ background: "var(--bg-card-glass)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: post.tweetText ? 8 : 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                            background: post.status === "approved" ? "rgba(34,197,94,0.12)" : post.status === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(251,172,50,0.12)",
                            color: post.status === "approved" ? "#22c55e" : post.status === "rejected" ? "#ef4444" : "#FBAC32",
                            border: `1px solid ${post.status === "approved" ? "rgba(34,197,94,0.3)" : post.status === "rejected" ? "rgba(239,68,68,0.3)" : "rgba(251,172,50,0.3)"}`,
                            textTransform: "capitalize",
                          }}
                        >
                          {post.status}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                          {post.tweetCreatedAt
                            ? new Date(post.tweetCreatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                            : new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      {post.tweetUrl && (
                        <a
                          href={post.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "#1d9bf0", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                        >
                          <LinkIcon size={10} /> {post.tweetUrl.length > 48 ? `${post.tweetUrl.slice(0, 48)}…` : post.tweetUrl}
                        </a>
                      )}
                    </div>
                    {post.creditsEarned > 0 && (
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#FBAC32", flexShrink: 0 }}>+${post.creditsEarned}</span>
                    )}
                  </div>
                  {post.tweetText && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, borderLeft: "2px solid rgba(251,172,50,0.3)", paddingLeft: 8, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {post.tweetText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Post to X modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={stage === "preview" ? "Preview Post" : "Post Sent!"}
      >
        {stage === "preview" && (
          <div>
            <div style={{ background: "#0D1117", borderRadius: 14, padding: 16, marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #FBAC32, #F29236)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#11152C" }}>
                  {(user?.name ?? "?").charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e7e9ea" }}>{user?.name}</div>
                  <div style={{ fontSize: 12, color: "#71767b" }}>{user?.twitterAccount ?? "@you"}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "#e7e9ea", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {displayTweet ?? "No tweet generated yet"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handlePost}
                style={{ flex: 1 }}
              >
                <Twitter size={16} /> Post to X
              </button>
            </div>
          </div>
        )}

        {stage === "scanning" && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(29,155,240,0.12)", border: "2px solid rgba(29,155,240,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Search size={28} style={{ color: "#1d9bf0" }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-body)", marginBottom: 8 }}>Post Sent!</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.6 }}>
              X / Twitter should be opening now. Once you've posted, we'll automatically scan your timeline — usually within seconds, or up to <strong style={{ color: "var(--text-body)" }}>10 minutes</strong> if the post takes time to index.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 24, lineHeight: 1.6 }}>
              Can't wait? Claim your credits manually right now.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                style={{ flex: 1 }}
              >
                <Clock size={14} /> Check Later
              </button>
              <button
                className="btn-primary"
                onClick={() => { setShowModal(false); setAlreadyPostedMode(true); setClaimError(null); }}
                style={{ flex: 1 }}
              >
                <LinkIcon size={14} /> Claim Now
              </button>
            </div>
          </div>
        )}
      </Modal>

    </>
  );
}

function MatchRow({ label, matched, detail }: { label: string; matched: boolean; detail: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: matched ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", border: `1px solid ${matched ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {matched
          ? <CheckCircle size={11} style={{ color: "#22c55e" }} />
          : <AlertTriangle size={10} style={{ color: "#ef4444" }} />
        }
      </div>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, width: 56 }}>{label}</span>
      <span style={{ fontSize: 12, color: matched ? "#22c55e" : "rgba(239,68,68,0.8)", fontWeight: 600, flex: 1 }}>{detail}</span>
    </div>
  );
}
