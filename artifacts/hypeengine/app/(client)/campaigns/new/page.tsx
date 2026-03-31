"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/context/ToastContext";
import Navbar from "@/components/layout/Navbar";
import Modal from "@/components/ui/Modal";
import { suggestHashtag, estimateReach, formatNumber } from "@/lib/utils";
import { rephraseDescription } from "@/app/actions/rephrase";
import { generatePostTemplates } from "@/app/actions/generateTemplates";
import {
  Zap, ChevronRight, ChevronLeft, Check, Image as ImageIcon,
  DollarSign, Calendar, BarChart2, Plus, X, FileText, ShoppingCart, AlertTriangle,
  Target, Sparkles, Save, Wallet, RefreshCw,
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

const STEP_LABELS = ["Campaign Info", "Post Settings", "Review & Launch"];
const MAX_TEMPLATES = 5;
const MAX_BUDGET = 10000;

const TOPUP_AMOUNTS = [500, 2000, 5000, 10000];

function autoSelectPackage(shortfall: number): number {
  const idx = TOPUP_AMOUNTS.findIndex((a) => a >= shortfall);
  return idx >= 0 ? idx : TOPUP_AMOUNTS.length - 1;
}

export default function NewCampaignPage() {
  const { user, updateUser } = useAuth();
  const { addCampaign, addClientTransaction } = useApp();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreedDeduct, setAgreedDeduct] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [hashtag, setHashtag] = useState("");
  const [postTemplates, setPostTemplates] = useState<string[]>([""]);
  const [credits, setCredits] = useState(500);
  const [maxPricePerPost, setMaxPricePerPost] = useState(50);
  const [maxPostsPerKolPerDay, setMaxPostsPerKolPerDay] = useState(1);
  const [maxPostsPerKolTotal, setMaxPostsPerKolTotal] = useState(5);

  const [targetNiches, setTargetNiches] = useState<string[]>([]);
  const [targetCountry, setTargetCountry] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(0);
  const [topUpCustom, setTopUpCustom] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const [aiRephrasing, setAiRephrasing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showAiTemplateModal, setShowAiTemplateModal] = useState(false);
  const [aiGeneratedTemplates, setAiGeneratedTemplates] = useState<string[]>([]);
  const [selectedAiTemplates, setSelectedAiTemplates] = useState<Set<number>>(new Set());

  const [campaignGoal, setCampaignGoal] = useState<"conversion" | "awareness" | "community">("awareness");
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [ctaText, setCtaText] = useState("Learn more");
  const [ctaPlacement, setCtaPlacement] = useState<"end_of_tweet" | "replace_in_template">("end_of_tweet");
  const [aiPersonalization, setAiPersonalization] = useState(true);

  const toggleTargetNiche = (niche: string) => {
    if (targetNiches.includes(niche)) {
      setTargetNiches(targetNiches.filter((n) => n !== niche));
    } else if (targetNiches.length < 3) {
      setTargetNiches([...targetNiches, niche]);
    } else {
      toast("Max 3 niches. Remove one to add another.", "error");
    }
  };

  const handleRephrase = async () => {
    if (!description.trim()) {
      toast("Enter a description first to rephrase it.", "error");
      return;
    }
    setAiRephrasing(true);
    try {
      const result = await rephraseDescription(description);
      if (result.error) throw new Error(result.error);
      setDescription(result.description!);
      toast("Description enhanced by AI!", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "AI rephrase failed. Try again.", "error");
    } finally {
      setAiRephrasing(false);
    }
  };

  const handleGenerateTemplates = async () => {
    if (!description.trim()) {
      toast("Enter a campaign description first.", "error");
      return;
    }
    setAiGenerating(true);
    setAiGeneratedTemplates([]);
    setSelectedAiTemplates(new Set());
    setShowAiTemplateModal(true);
    try {
      const result = await generatePostTemplates(description, campaignGoal, landingPageUrl || undefined);
      if (result.error) throw new Error(result.error);
      setAiGeneratedTemplates(result.templates ?? []);
      setSelectedAiTemplates(new Set(result.templates?.map((_, i) => i) ?? []));
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "AI generation failed. Try again.", "error");
      setShowAiTemplateModal(false);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddAiTemplates = () => {
    const picked = aiGeneratedTemplates.filter((_, i) => selectedAiTemplates.has(i));
    if (picked.length === 0) { toast("Select at least one template.", "error"); return; }
    const existing = postTemplates.filter((t) => t.trim());
    const combined = [...existing, ...picked].slice(0, MAX_TEMPLATES);
    setPostTemplates(combined.length > 0 ? combined : [""]);
    setShowAiTemplateModal(false);
    toast(`${picked.length} template${picked.length > 1 ? "s" : ""} added!`, "success");
  };

  const handleRegenerateSelected = async () => {
    if (selectedAiTemplates.size === 0) { toast("Select templates to regenerate.", "error"); return; }
    const selectedIndices = Array.from(selectedAiTemplates).sort((a, b) => a - b);
    setAiGenerating(true);
    try {
      const result = await generatePostTemplates(description, campaignGoal, landingPageUrl || undefined, selectedIndices.length);
      if (result.error) throw new Error(result.error);
      const fresh = result.templates ?? [];
      setAiGeneratedTemplates((prev) => {
        const next = [...prev];
        selectedIndices.forEach((idx, pos) => {
          if (fresh[pos] !== undefined) next[idx] = fresh[pos];
        });
        return next;
      });
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "AI generation failed. Try again.", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  const balance = user?.credits ?? 0;
  const shortfall = Math.max(0, credits - balance);
  const needsTopUp = shortfall > 0;

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
    if (!user) return;
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

  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (v && !hashtag) setHashtag(suggestHashtag(v));
  };

  const handleImageUpload = (file: File | null) => {
    if (!file) { setImageFile(null); setImageUrl(""); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const updateTemplate = (i: number, val: string) => {
    setPostTemplates((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  };

  const addTemplate = () => {
    if (postTemplates.length >= MAX_TEMPLATES) return;
    setPostTemplates((prev) => [...prev, ""]);
  };

  const removeTemplate = (i: number) => {
    if (postTemplates.length <= 1) return;
    setPostTemplates((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canNext = () => {
    if (step === 0) return title.trim().length > 0 && description.trim().length > 0;
    if (step === 1) {
      const baseValid = postTemplates[0].trim().length > 0 && hashtag.trim().length > 0 && credits >= 100;
      if (!baseValid) return false;
      if (campaignGoal === "conversion" && !landingPageUrl.trim()) return false;
      if (ctaPlacement === "replace_in_template") {
        const filledTemplates = postTemplates.filter((t) => t.trim().length > 0);
        if (!filledTemplates.every((t) => t.includes("{link}"))) return false;
      }
      return true;
    }
    return true;
  };

  const openAgreementModal = () => {
    if (!user) return;
    setAgreedDeduct(false);
    setAgreedTerms(false);
    setShowAgreementModal(true);
  };

  const campaignPayload = () => {
    if (!user) return null;
    const filledTemplates = postTemplates.filter((t) => t.trim().length > 0);
    return {
      clientId: user.id,
      title,
      description,
      hashtag,
      postTemplate: filledTemplates[0],
      postTemplates: filledTemplates.length > 1 ? filledTemplates : undefined,
      imageUrl: imageUrl || undefined,
      totalCredits: credits,
      trending: false,
      maxPricePerPost,
      maxPostsPerKolPerDay,
      maxPostsPerKolTotal,
      targetNiches: targetNiches.length > 0 ? targetNiches : undefined,
      targetCountries: targetCountry ? [targetCountry] : undefined,
      targetLanguages: targetLanguage ? [targetLanguage] : undefined,
      campaignGoal,
      landingPageUrl: landingPageUrl || undefined,
      ctaText: ctaText || undefined,
      ctaPlacement,
      aiPersonalization,
    };
  };

  const GOAL_OPTIONS = [
    { value: "conversion" as const, label: "User conversion (sign-ups, deposits, swaps)", ctaDefault: "Sign up here" },
    { value: "awareness" as const, label: "Brand awareness (reach, impressions, visibility)", ctaDefault: "Learn more" },
    { value: "community" as const, label: "Community growth (followers, engagement, discussion)", ctaDefault: "Join us" },
  ];

  const handleGoalChange = (v: "conversion" | "awareness" | "community") => {
    setCampaignGoal(v);
    const opt = GOAL_OPTIONS.find((o) => o.value === v);
    if (opt) setCtaText(opt.ctaDefault);
  };

  const handleLaunch = async () => {
    if (!user) return;
    setShowAgreementModal(false);
    setLoading(true);
    try {
      const payload = campaignPayload();
      if (!payload) return;
      await addCampaign({ ...payload, status: "active" });
      await addClientTransaction(user.id, { type: "spend", amount: -credits, description: title });
      await updateUser({ credits: balance - credits });
      toast("Campaign launched successfully! 🚀", "success");
      router.replace("/campaigns");
    } catch {
      toast("Failed to launch campaign. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const payload = campaignPayload();
      if (!payload) return;
      await addCampaign({ ...payload, status: "draft" });
      toast("Campaign saved as draft. Fund it anytime to activate.", "success");
      router.replace("/campaigns");
    } catch {
      toast("Failed to save draft. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar title="New Campaign" showBack onBack={() => router.replace("/campaigns")} />
      <div className="page-container" style={{ paddingTop: 84 }}>
        <div className="animate-in">
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: "100%", height: 3, borderRadius: 999, background: i < step ? "#FBAC32" : i === step ? "rgba(251,172,50,0.5)" : "var(--progress-track)" }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: i <= step ? "#FBAC32" : "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <FormField label="Campaign Title *">
                <input className="input-field" placeholder="MetaVerse Token Launch" value={title} onChange={(e) => handleTitleChange(e.target.value)} />
              </FormField>
              <FormField label="Description *">
                <textarea className="input-field" placeholder="Describe your campaign goals, target audience, and key message..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ resize: "vertical", minHeight: 100 }} />
                <button
                  type="button"
                  onClick={handleRephrase}
                  disabled={aiRephrasing || !description.trim()}
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 20,
                    border: "1px solid rgba(251,172,50,0.35)",
                    background: aiRephrasing ? "rgba(251,172,50,0.06)" : "rgba(251,172,50,0.1)",
                    color: !description.trim() ? "var(--text-faint)" : "#FBAC32",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: aiRephrasing || !description.trim() ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                    opacity: !description.trim() ? 0.5 : 1,
                  }}
                >
                  {aiRephrasing ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.8s linear infinite" }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Enhancing…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Rephrase with AI
                    </>
                  )}
                </button>
              </FormField>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Target size={14} style={{ color: "#FBAC32" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-body)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Target Audience</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>Optional - improves KOL matching &amp; pricing</span>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Niches ({targetNiches.length}/3) - select up to 3
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {NICHES.map((niche) => {
                      const sel = targetNiches.includes(niche);
                      return (
                        <button
                          key={niche}
                          type="button"
                          onClick={() => toggleTargetNiche(niche)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            border: sel ? "1.5px solid #FBAC32" : "1px solid var(--border)",
                            background: sel ? "rgba(251,172,50,0.12)" : "var(--bg-card-glass)",
                            color: sel ? "#FBAC32" : "var(--text-muted)",
                            fontSize: 12,
                            fontWeight: sel ? 700 : 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "all 0.15s",
                          }}
                        >
                          {sel && <span style={{ marginRight: 4 }}>✓</span>}
                          {niche}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Country
                    </label>
                    <ScrollableSelector
                      options={COUNTRIES}
                      value={targetCountry}
                      onChange={setTargetCountry}
                      placeholder="Search countries..."
                      emptyLabel="Any country"
                      maxHeight={160}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Language
                    </label>
                    <ScrollableSelector
                      options={LANGUAGES}
                      value={targetLanguage}
                      onChange={setTargetLanguage}
                      placeholder="Search languages..."
                      emptyLabel="Any language"
                      maxHeight={160}
                    />
                  </div>
                </div>
              </div>

              <FormField label="Campaign Image (optional)">
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: "2px dashed rgba(251,172,50,0.3)", borderRadius: 12, padding: imageUrl ? 0 : "24px 16px", cursor: "pointer", overflow: "hidden", position: "relative", background: imageUrl ? "transparent" : "rgba(251,172,50,0.04)", transition: "border-color 0.2s" }}>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImageUpload(e.target.files?.[0] ?? null)} />
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Campaign preview" style={{ width: "100%", height: 130, objectFit: "cover", display: "block", borderRadius: 10 }} />
                      <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(17,21,44,0.85)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600, backdropFilter: "blur(4px)" }}>
                        Tap to change
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon size={28} style={{ color: "rgba(251,172,50,0.5)" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Tap to upload image</span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>JPG, PNG, GIF - shown as campaign banner</span>
                    </>
                  )}
                </label>
                {imageUrl && (
                  <button type="button" onClick={() => handleImageUpload(null)} style={{ marginTop: 6, background: "none", border: "none", color: "rgba(239,68,68,0.7)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    Remove image
                  </button>
                )}
              </FormField>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Zap size={14} style={{ color: "#FBAC32" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-body)", textTransform: "uppercase", letterSpacing: "0.06em" }}>CTA & Personalization</span>
                </div>
                <FormField label="Call-to-action text">
                  <input
                    className="input-field"
                    placeholder="e.g. Sign up now, Try it free, Start trading"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                  />
                  <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>This text will be hyperlinked in every KOL&apos;s tweet</p>
                </FormField>
                <FormField label="Where should the link appear?">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { value: "end_of_tweet", label: "End of tweet (recommended)" },
                      { value: "replace_in_template", label: "Replace in template - use {link} placeholder" },
                    ].map((opt) => (
                      <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: ctaPlacement === opt.value ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)", border: ctaPlacement === opt.value ? "1px solid rgba(251,172,50,0.25)" : "1px solid var(--border)", borderRadius: 10, transition: "all 0.2s" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: ctaPlacement === opt.value ? "5px solid #FBAC32" : "2px solid var(--text-faint)", transition: "all 0.2s", flexShrink: 0 }} onClick={() => setCtaPlacement(opt.value as typeof ctaPlacement)} />
                        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: ctaPlacement === opt.value ? 700 : 400 }} onClick={() => setCtaPlacement(opt.value as typeof ctaPlacement)}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FormField>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: aiPersonalization ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)", border: aiPersonalization ? "1px solid rgba(251,172,50,0.25)" : "1px solid var(--border)", borderRadius: 10, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setAiPersonalization(!aiPersonalization)}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Sparkles size={14} style={{ color: "#FBAC32" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>AI-personalize tweets for each KOL</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>Our AI will adapt your templates to match each KOL&apos;s writing style</p>
                  </div>
                  <div style={{ width: 40, height: 22, borderRadius: 999, background: aiPersonalization ? "#FBAC32" : "var(--input-border)", position: "relative", flexShrink: 0, transition: "all 0.2s" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: aiPersonalization ? 21 : 3, transition: "all 0.2s" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <FormField label="Campaign Goal *">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { value: "conversion" as const, label: "User conversion (sign-ups, deposits, swaps)" },
                    { value: "awareness" as const, label: "Brand awareness (reach, impressions, visibility)" },
                    { value: "community" as const, label: "Community growth (followers, engagement, discussion)" },
                  ].map((opt) => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: campaignGoal === opt.value ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)", border: campaignGoal === opt.value ? "1px solid rgba(251,172,50,0.25)" : "1px solid var(--border)", borderRadius: 10, transition: "all 0.2s" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: campaignGoal === opt.value ? "5px solid #FBAC32" : "2px solid var(--text-faint)", transition: "all 0.2s", flexShrink: 0 }} onClick={() => handleGoalChange(opt.value)} />
                      <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: campaignGoal === opt.value ? 700 : 400 }} onClick={() => handleGoalChange(opt.value)}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label={`Landing Page URL${campaignGoal === "conversion" ? " *" : " (optional)"}`}>
                <input
                  className="input-field"
                  placeholder="https://yourproject.com/signup"
                  value={landingPageUrl}
                  onChange={(e) => setLandingPageUrl(e.target.value)}
                />
                <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>Where should KOL traffic go? Your tracking links will point here.</p>
              </FormField>

              <FormField label="Hashtag *">
                <input className="input-field" placeholder="#HE_YourCampaign" value={hashtag} onChange={(e) => setHashtag(e.target.value)} />
                <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>Auto-generated from title. You can customize it.</p>
              </FormField>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Post Templates * ({postTemplates.length}/{MAX_TEMPLATES})
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateTemplates}
                    disabled={aiGenerating || !description.trim()}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 20,
                      border: "1px solid rgba(251,172,50,0.4)",
                      background: "rgba(251,172,50,0.1)",
                      color: !description.trim() ? "var(--text-faint)" : "#FBAC32",
                      fontSize: 12, fontWeight: 700, cursor: !description.trim() ? "not-allowed" : "pointer",
                      fontFamily: "inherit", opacity: !description.trim() ? 0.5 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <Sparkles size={12} />
                    Generate with AI
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {postTemplates.map((tmpl, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#FBAC32" : "var(--bg-card-glass)", border: i === 0 ? "none" : "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: i === 0 ? "#11152C" : "var(--text-muted)", flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "var(--text-body)" : "var(--text-muted)" }}>
                          {i === 0 ? "Primary Template" : `Variant ${i + 1}`}
                        </span>
                        {postTemplates.length > 1 && (
                          <button onClick={() => removeTemplate(i)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "rgba(239,68,68,0.6)", display: "flex", alignItems: "center", padding: 4, borderRadius: 6, fontFamily: "inherit" }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <textarea className="input-field" placeholder={i === 0 ? "Write the main tweet template KOLs will use..." : `Write alternative variant ${i + 1}...`} value={tmpl} onChange={(e) => updateTemplate(i, e.target.value)} rows={4} style={{ resize: "vertical" }} />
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: tmpl.length > 280 ? "#ef4444" : "var(--text-faint)" }}>{tmpl.length} / 280</span>
                      </div>
                    </div>
                  ))}
                </div>

                {postTemplates.length < MAX_TEMPLATES && (
                  <button
                    onClick={addTemplate}
                    style={{ marginTop: 10, width: "100%", padding: "10px 0", background: "transparent", border: "1px dashed var(--input-border)", borderRadius: 10, color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", transition: "border-color 0.2s, color 0.2s" }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#FBAC32"; (e.currentTarget as HTMLButtonElement).style.color = "#FBAC32"; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = ""; (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                  >
                    <Plus size={14} /> Add Template Variant
                  </button>
                )}
                {ctaPlacement === "replace_in_template" && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.25)", borderRadius: 10 }}>
                    <p style={{ fontSize: 12, color: "#FBAC32", fontWeight: 700, margin: 0 }}>Use <code style={{ background: "rgba(251,172,50,0.15)", padding: "1px 5px", borderRadius: 4 }}>{"{link}"}</code> in each template to insert the tracking link.</p>
                    {postTemplates.filter((t) => t.trim()).some((t) => !t.includes("{link}")) && (
                      <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4, marginBottom: 0 }}>⚠ All templates must contain {"{link}"} to continue.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Campaign Budget
                  </label>
                  <span style={{ fontSize: 18, fontWeight: 900, color: needsTopUp ? "#ef4444" : "#FBAC32" }}>
                    ${credits.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={MAX_BUDGET}
                  step={100}
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  style={{ width: "100%", accentColor: needsTopUp ? "#ef4444" : "#FBAC32" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>$100</span>
                  <span style={{ fontSize: 12, color: needsTopUp ? "#ef4444" : "#FBAC32", fontWeight: 700 }}>
                    ≈ {formatNumber(estimateReach(credits))} estimated reach
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>${MAX_BUDGET.toLocaleString()}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.2)", borderRadius: 10 }}>
                  <Wallet size={15} style={{ color: "#FBAC32", flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                    Your balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>
                    {needsTopUp && (
                      <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> - you&apos;re <strong style={{ color: "#f97316" }}>${shortfall.toLocaleString()} short</strong>, add funds or save as draft on the next step</span>
                    )}
                  </p>
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: -4 }}>
                  <DollarSign size={15} style={{ color: "#FBAC32" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-body)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Post Limits & Pricing</span>
                </div>
                <SliderField label="Max Price per Post" value={maxPricePerPost} min={50} max={250} step={10} onChange={setMaxPricePerPost} display={`$${maxPricePerPost}`} hint="Maximum payout per KOL post. Actual amount scales with follower count." icon={<DollarSign size={13} style={{ color: "#FBAC32" }} />} />
                <div style={{ height: 1, background: "var(--border)" }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Max Posts per KOL</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <SliderField label="Per Day" value={maxPostsPerKolPerDay} min={1} max={5} step={1} onChange={setMaxPostsPerKolPerDay} display={`${maxPostsPerKolPerDay} post${maxPostsPerKolPerDay > 1 ? "s" : ""}/day`} hint="" icon={<Calendar size={13} style={{ color: "rgba(251,172,50,0.7)" }} />} />
                    <SliderField label="In Total" value={maxPostsPerKolTotal} min={1} max={10} step={1} onChange={setMaxPostsPerKolTotal} display={`${maxPostsPerKolTotal} posts total`} hint="" icon={<BarChart2 size={13} style={{ color: "rgba(251,172,50,0.7)" }} />} />
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(239,68,68,0.7)", marginTop: 10, lineHeight: 1.5, fontWeight: 600 }}>
                    ⚠️ Participations over these limits will not be verified or paid for.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {imageUrl && (
                <div style={{ borderRadius: 14, overflow: "hidden", maxHeight: 160 }}>
                  <img src={imageUrl} alt={title} style={{ width: "100%", height: 160, objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <div className="card-elevated" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-body)", marginBottom: 14 }}>Campaign Summary</h3>
                {[
                  { label: "Title", value: title },
                  { label: "Hashtag", value: hashtag },
                  { label: "Templates", value: `${postTemplates.filter((t) => t.trim()).length} variant${postTemplates.filter((t) => t.trim()).length > 1 ? "s" : ""}` },
                  { label: "Budget", value: `$${credits.toLocaleString()}` },
                  { label: "Max Price/Post", value: `$${maxPricePerPost}` },
                  { label: "Max Posts/Day", value: `${maxPostsPerKolPerDay}` },
                  { label: "Max Posts Total", value: `${maxPostsPerKolTotal}` },
                  { label: "Est. Reach", value: formatNumber(estimateReach(credits)) },
                  ...(targetNiches.length > 0 ? [{ label: "Target Niches", value: targetNiches.join(", ") }] : []),
                  ...(targetCountry ? [{ label: "Target Country", value: targetCountry }] : []),
                  ...(targetLanguage ? [{ label: "Target Language", value: targetLanguage }] : []),
                  { label: "Campaign Goal", value: campaignGoal === "conversion" ? "User Conversion" : campaignGoal === "awareness" ? "Brand Awareness" : "Community Growth" },
                  ...(landingPageUrl ? [{ label: "Landing Page", value: landingPageUrl }] : []),
                  { label: "CTA Text", value: ctaText || "—" },
                  { label: "Link Placement", value: ctaPlacement === "end_of_tweet" ? "End of tweet" : "Replace in template" },
                  { label: "AI Personalization", value: aiPersonalization ? "Enabled ✓" : "Disabled" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {postTemplates.filter((t) => t.trim()).length > 1 && (
                <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.15)", borderRadius: 12, padding: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#FBAC32", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText size={13} /> Template Variants Preview
                  </p>
                  {postTemplates.filter((t) => t.trim()).map((t, i) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: i < postTemplates.filter((x) => x.trim()).length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {i === 0 ? "Primary" : `Variant ${i + 1}`}
                      </span>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {t}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: needsTopUp ? "rgba(239,68,68,0.06)" : "rgba(251,172,50,0.06)", border: `1px solid ${needsTopUp ? "rgba(239,68,68,0.2)" : "rgba(251,172,50,0.2)"}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: needsTopUp ? 12 : 0 }}>
                  {needsTopUp
                    ? <AlertTriangle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
                    : <Zap size={16} style={{ color: "#FBAC32", flexShrink: 0 }} />
                  }
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: needsTopUp ? "#ef4444" : "var(--text-body)", margin: 0 }}>
                      {needsTopUp ? "Insufficient Balance" : "Ready to Launch"}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0, marginTop: 2 }}>
                      {needsTopUp
                        ? <>Your balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>. You need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong></>
                        : <>Your balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>. After launch: <strong style={{ color: "var(--text-body)" }}>${(balance - credits).toLocaleString()}</strong></>
                      }
                    </p>
                  </div>
                </div>
                {needsTopUp && (
                  <button className="btn-primary" onClick={openTopUpModal} style={{ background: "#ef4444", width: "100%" }}>
                    <ShoppingCart size={16} /> Add Funds (${shortfall.toLocaleString()} needed)
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>
            {step === 2 ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
                  <ChevronLeft size={16} /> Back
                </button>
                {needsTopUp ? (
                  <button
                    className="btn-primary"
                    onClick={handleSaveDraft}
                    disabled={loading}
                    style={{ flex: 1, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", whiteSpace: "nowrap" }}
                  >
                    {loading ? "Saving..." : <><Save size={15} /> Save &amp; Pay Later</>}
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={openAgreementModal}
                    disabled={loading}
                    style={{ flex: 1, whiteSpace: "nowrap" }}
                  >
                    {loading ? "Launching..." : "🚀 Launch Campaign"}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                {step > 0 && (
                  <button className="btn-secondary" onClick={() => setStep(step - 1)} style={{ flex: 1 }}>
                    <ChevronLeft size={16} /> Back
                  </button>
                )}
                <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext()} style={{ flex: 1 }}>
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showAgreementModal} onClose={() => setShowAgreementModal(false)} title="Service Agreement">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>Before launching your campaign, please review and accept the following:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <CheckItem checked={agreedDeduct} onToggle={() => setAgreedDeduct(!agreedDeduct)} label={`I authorize deduction of $${credits.toLocaleString()} from my account balance upon campaign launch.`} />
            <CheckItem checked={agreedTerms} onToggle={() => setAgreedTerms(!agreedTerms)} label="I agree to HypeEngine's Terms of Service and confirm this campaign content complies with platform guidelines and applicable laws." />
          </div>
          <div style={{ background: "rgba(251,172,50,0.06)", border: "1px solid rgba(251,172,50,0.15)", borderRadius: 10, padding: 12, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.6 }}>
            Campaign &ldquo;{title}&rdquo; will be immediately visible to all KOLs on the platform once launched.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn-secondary" onClick={() => setShowAgreementModal(false)} style={{ flex: 1 }}>Cancel</button>
            <button className="btn-primary" onClick={handleLaunch} disabled={!agreedDeduct || !agreedTerms || loading} style={{ flex: 1 }}>
              {loading ? "Launching..." : "Confirm & Launch"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showTopUpModal} onClose={() => !topUpLoading && setShowTopUpModal(false)} title="Add Funds">
        <div>
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14, marginTop: -12 }}>
            Balance: <strong style={{ color: "#FBAC32" }}>${balance.toLocaleString()}</strong>
            {shortfall > 0 && <> · Need <strong style={{ color: "#ef4444" }}>${shortfall.toLocaleString()} more</strong></>}
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
                  style={{
                    padding: "12px 10px",
                    borderRadius: 12,
                    border: active ? "2px solid #FBAC32" : "1px solid var(--input-border)",
                    background: active ? "rgba(251,172,50,0.08)" : "var(--bg-card-glass)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                    textAlign: "left",
                    position: "relative",
                  }}
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
                {balance + getTopUpAmount() >= credits && <span style={{ color: "#22c55e", marginLeft: 6 }}>✓ Ready!</span>}
              </span>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleTopUp}
            disabled={topUpLoading || getTopUpAmount() <= 0}
            style={{ width: "100%" }}
          >
            <ShoppingCart size={16} />
            {topUpLoading ? "Processing..." : `Add $${getTopUpAmount() > 0 ? getTopUpAmount().toLocaleString() : "—"} to Balance`}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showAiTemplateModal} onClose={() => !aiGenerating && setShowAiTemplateModal(false)} title="AI-Generated Templates">
        <div>
          {aiGenerating ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0" }}>
              <div style={{ width: 40, height: 40, border: "3px solid rgba(251,172,50,0.2)", borderTopColor: "#FBAC32", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Generating tweet templates…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: -12, marginBottom: 14 }}>
                Check templates to add them, or select the ones you don&apos;t like and hit <strong style={{ color: "var(--text-muted)" }}>Regenerate</strong> for fresh variations.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto", paddingRight: 2 }}>
                {aiGeneratedTemplates.map((tmpl, i) => {
                  const isSelected = selectedAiTemplates.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedAiTemplates((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        });
                      }}
                      style={{
                        textAlign: "left", width: "100%", padding: "12px 14px",
                        borderRadius: 12, fontFamily: "inherit",
                        border: isSelected ? "1.5px solid rgba(251,172,50,0.5)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)",
                        cursor: "pointer", transition: "all 0.15s", position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{
                          flexShrink: 0, marginTop: 1,
                          width: 18, height: 18, borderRadius: 4,
                          border: isSelected ? "none" : "1.5px solid var(--border)",
                          background: isSelected ? "#FBAC32" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s",
                        }}>
                          {isSelected && <Check size={11} color="#11152C" strokeWidth={3} />}
                        </div>
                        <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13, color: "var(--text-body)", whiteSpace: "pre-wrap", lineHeight: 1.55, flex: 1 }}>{tmpl}</pre>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: tmpl.length > 280 ? "#ef4444" : "var(--text-faint)" }}>{tmpl.length} / 280</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={handleRegenerateSelected}
                  disabled={selectedAiTemplates.size === 0}
                  style={{
                    width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "11px 0", borderRadius: 10, fontFamily: "inherit",
                    border: "1px solid rgba(251,172,50,0.4)",
                    background: "rgba(251,172,50,0.08)",
                    color: selectedAiTemplates.size === 0 ? "var(--text-faint)" : "#FBAC32",
                    fontSize: 13, fontWeight: 700, cursor: selectedAiTemplates.size === 0 ? "not-allowed" : "pointer",
                    opacity: selectedAiTemplates.size === 0 ? 0.5 : 1, transition: "all 0.15s",
                  }}
                >
                  <RefreshCw size={13} />
                  Regenerate {selectedAiTemplates.size > 0 ? `${selectedAiTemplates.size} selected` : "selected"}
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAiTemplateModal(false)}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAiTemplates}
                    disabled={selectedAiTemplates.size === 0}
                    className="btn-primary"
                    style={{ flex: 2, opacity: selectedAiTemplates.size === 0 ? 0.5 : 1 }}
                  >
                    <Check size={14} />
                    Add {selectedAiTemplates.size} Template{selectedAiTemplates.size !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange, display, hint, icon }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string; hint: string; icon: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{label}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#FBAC32" }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "#FBAC32" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{min}</span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{max}</span>
      </div>
      {hint && <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function CheckItem({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string; }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, background: checked ? "rgba(251,172,50,0.06)" : "var(--bg-card-glass)", border: checked ? "1px solid rgba(251,172,50,0.25)" : "1px solid var(--border)", borderRadius: 12, cursor: "pointer", transition: "all 0.2s" }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, border: checked ? "2px solid #FBAC32" : "2px solid var(--text-faint)", background: checked ? "#FBAC32" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, transition: "all 0.2s" }}>
        {checked && <Check size={12} style={{ color: "#11152C" }} />}
      </div>
      <span style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>{label}</span>
    </div>
  );
}
