"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Eye, EyeOff, Building2, Mic2 } from "lucide-react";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<UserRole>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, signup, user, isLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (!user.setupComplete) router.replace("/setup");
      else if (user.role === "admin") router.replace("/admin/pricing-test");
      else if (user.role === "client") router.replace("/dashboard");
      else router.replace("/kol");
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === "signup" && role === "kol" && !twitterHandle.trim()) {
      toast("Twitter handle is required for KOL accounts.", "error");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const ok = await login(email, password);
        if (!ok) {
          toast("Invalid credentials - check email and password.", "error");
        }
      } else {
        const handle = twitterHandle.trim().replace(/^@/, "");
        const result = await signup(email, password, role, role === "kol" ? handle : undefined);
        if (!result.ok) {
          toast(result.error ?? "Sign up failed. Please try again.", "error");
        } else {
          toast("Account created! Complete your profile.", "success");
          router.replace("/setup");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg-body)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      <div className="animate-in" style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <Image
            src="/logo.jpg"
            alt="HypeEngine"
            width={72}
            height={72}
            priority
            style={{ borderRadius: 16, marginBottom: 16 }}
          />
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "var(--text-body)",
              letterSpacing: "-0.03em",
              marginBottom: 6,
            }}
          >
            HypeEngine
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", textAlign: "center" }}>
            Crypto Influencer Marketing Platform
          </p>
        </div>

        <div
          style={{
            background: "var(--bg-card-glass)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--bg-card-glass)",
              borderRadius: 12,
              padding: 3,
              marginBottom: 24,
            }}
          >
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: mode === m ? "#FBAC32" : "transparent",
                  color: mode === m ? "#11152C" : "var(--text-muted)",
                  transition: "all 0.2s",
                }}
              >
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                I am a...
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  { value: "client", label: "Crypto Project", icon: Building2 },
                  { value: "kol", label: "KOL / Creator", icon: Mic2 },
                ] as const).map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      style={{
                        padding: "14px 12px",
                        borderRadius: 12,
                        border: role === r.value
                          ? "2px solid #FBAC32"
                          : "1px solid var(--input-border)",
                        background: role === r.value
                          ? "rgba(251, 172, 50, 0.1)"
                          : "var(--bg-card-glass)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        transition: "all 0.2s",
                        fontFamily: "inherit",
                      }}
                    >
                      <Icon
                        size={22}
                        style={{ color: role === r.value ? "#FBAC32" : "var(--text-muted)" }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: role === r.value ? "var(--text-body)" : "var(--text-muted)",
                        }}
                      >
                        {r.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Email
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 44 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-faint)",
                    display: "flex",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === "signup" && role === "kol" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Twitter / X Handle <span style={{ color: "#FBAC32" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    fontSize: 15,
                    fontWeight: 600,
                    pointerEvents: "none",
                  }}>@</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="yourhandle"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace(/^@+/, ""))}
                    style={{ paddingLeft: 28 }}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading
                ? "Loading..."
                : mode === "login"
                ? "Log In"
                : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <div
              style={{
                marginTop: 20,
                padding: 12,
                background: "rgba(251, 172, 50, 0.06)",
                border: "1px solid rgba(251, 172, 50, 0.15)",
                borderRadius: 10,
              }}
            >
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, fontWeight: 700 }}>
                Demo accounts - password: <span style={{ color: "#FBAC32" }}>demo123</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Admin: <span style={{ color: "#FBAC32", cursor: "pointer" }} onClick={() => { setEmail("admin@demo.com"); setPassword("demo123"); }}>admin@demo.com</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Client: <span style={{ color: "#FBAC32", cursor: "pointer" }} onClick={() => { setEmail("client@demo.com"); setPassword("demo123"); }}>client@demo.com</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                KOL (Dave · DeFi): <span style={{ color: "#FBAC32", cursor: "pointer" }} onClick={() => { setEmail("kol@demo.com"); setPassword("demo123"); }}>kol@demo.com</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                KOL (Sarah · Web3): <span style={{ color: "#FBAC32", cursor: "pointer" }} onClick={() => { setEmail("kol2@demo.com"); setPassword("demo123"); }}>kol2@demo.com</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                KOL (Marcus · Gaming): <span style={{ color: "#FBAC32", cursor: "pointer" }} onClick={() => { setEmail("kol3@demo.com"); setPassword("demo123"); }}>kol3@demo.com</span>
              </p>
              <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                Click an email above to auto-fill
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
