"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Navbar from "@/components/layout/Navbar";
import { LogOut, Edit3, Check, Globe, Twitter, Building2, User } from "lucide-react";

export default function ClientProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(user?.name ?? "");
  const [company, setCompany] = useState(user?.companyName ?? "");
  const [title, setTitle] = useState(user?.title ?? "");
  const [twitter, setTwitter] = useState(user?.twitterAccount ?? "");
  const [website, setWebsite] = useState(user?.website ?? "");

  const handleSave = () => {
    updateUser({ name, companyName: company, title, twitterAccount: twitter, website });
    toast("Profile updated!", "success");
    setEditing(false);
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  return (
    <>
    <Navbar title="Profile" />
    <div className="page-container" style={{ paddingTop: 84 }}>
      <div className="animate-in">
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-body)", letterSpacing: "-0.02em", marginBottom: 24 }}>
          Profile
        </h1>

        <div
          style={{
            background: "var(--bg-card-glass)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FBAC32, #F29236)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                color: "#11152C",
                flexShrink: 0,
              }}
            >
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-body)" }}>{user?.name || "—"}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.email}</div>
              <span className="badge badge-orange" style={{ marginTop: 4 }}>Crypto Project</span>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              style={{
                background: editing ? "rgba(251,172,50,0.15)" : "var(--bg-card-glass)",
                border: editing ? "1px solid rgba(251,172,50,0.3)" : "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                color: editing ? "#FBAC32" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              <Edit3 size={14} /> {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ProfileInput label="Full Name" icon={User} value={name} onChange={setName} />
              <ProfileInput label="Company" icon={Building2} value={company} onChange={setCompany} />
              <ProfileInput label="Title" icon={User} value={title} onChange={setTitle} />
              <ProfileInput label="Twitter / X" icon={Twitter} value={twitter} onChange={setTwitter} />
              <ProfileInput label="Website" icon={Globe} value={website} onChange={setWebsite} />
              <button className="btn-primary" onClick={handleSave} style={{ marginTop: 8 }}>
                <Check size={16} /> Save Changes
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Company", value: user?.companyName, icon: Building2 },
                { label: "Title", value: user?.title, icon: User },
                { label: "Twitter / X", value: user?.twitterAccount, icon: Twitter },
                { label: "Website", value: user?.website, icon: Globe },
              ].map(
                (row) =>
                  row.value && (
                    <div
                      key={row.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <row.icon size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {row.label}
                        </div>
                        <div style={{ fontSize: 14, color: "var(--text-body)" }}>{row.value}</div>
                      </div>
                    </div>
                  )
              )}
            </div>
          )}
        </div>

        {user?.walletConnected && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
              borderRadius: 14,
              padding: 14,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Check size={18} style={{ color: "#22c55e" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>Wallet Connected</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>0x1a2b...3c4d</div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="btn-secondary"
          style={{ borderColor: "rgba(239,68,68,0.25)", color: "#ef4444" }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
    </>
  );
}

function ProfileInput({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: typeof User;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <Icon size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--input-placeholder)" }} />
        <input
          className="input-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>
    </div>
  );
}
