"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { LogOut, User, Sun, Moon, Bell, ShieldCheck, CreditCard, XCircle, CheckCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NavbarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  verification_passed: <CheckCircle size={14} color="#10b981" />,
  verification_failed: <XCircle size={14} color="#ef4444" />,
  payout_released: <CreditCard size={14} color="#FBAC32" />,
  escrow_returned: <ShieldCheck size={14} color="#8b5cf6" />,
};

export default function Navbar({ title, showBack, onBack }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json() as { notifications: Notification[]; unreadCount: number };
        setNotifications(data.notifications.slice(0, 10));
        setUnreadCount(data.unreadCount);
      }
    } catch { /* silent */ }
  }, [user?.id]);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => { void fetchNotifications(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    try {
      await fetch(`/api/notifications/read-all?userId=${user.id}`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--nav-bg)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "background 0.25s ease",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 16px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {showBack ? (
          <button
            onClick={onBack || (() => router.back())}
            className="btn-ghost"
            style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 600 }}
          >
            ← Back
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/logo.jpg"
              alt="HypeEngine"
              width={34}
              height={34}
              style={{ borderRadius: 8 }}
            />
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "var(--text-body)",
                letterSpacing: "-0.02em",
              }}
            >
              {title || "HypeEngine"}
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "var(--bg-card-glass)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: theme === "dark" ? "rgba(255,245,231,0.6)" : "rgba(26,31,60,0.6)",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Notification Bell */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowMenu(false); }}
              style={{
                background: "var(--bg-card-glass)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: unreadCount > 0 ? "#FBAC32" : "var(--text-muted)",
                position: "relative",
                flexShrink: 0,
              }}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 15,
                    height: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 0,
                  width: 300,
                  maxHeight: 400,
                  overflowY: "auto",
                  boxShadow: "var(--card-shadow)",
                  zIndex: 200,
                }}
              >
                <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{ fontSize: 11, color: "#FBAC32", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: "24px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => { if (!n.read) void markRead(n.id); }}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid var(--border)",
                        background: n.read ? "transparent" : "rgba(251,172,50,0.05)",
                        cursor: n.read ? "default" : "pointer",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        {NOTIF_ICONS[n.type] ?? <Bell size={14} color="var(--text-muted)" />}
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-body)", flex: 1 }}>{n.title}</span>
                        {!n.read && (
                          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#FBAC32", flexShrink: 0 }} />
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                      <p style={{ fontSize: 10, color: "var(--text-faint)", margin: "4px 0 0", fontFamily: "monospace" }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setShowMenu(!showMenu); setShowNotifs(false); }}
              style={{
                background: "rgba(251, 172, 50, 0.1)",
                border: "1px solid rgba(251, 172, 50, 0.25)",
                borderRadius: 999,
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#FBAC32",
              }}
            >
              <User size={16} />
            </button>
            {showMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 8,
                  minWidth: 180,
                  boxShadow: "var(--card-shadow)",
                  zIndex: 200,
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  {user?.name || user?.email}
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    padding: "10px 12px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#ef4444",
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "inherit",
                  }}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {(showMenu || showNotifs) && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 150 }}
          onClick={() => { setShowMenu(false); setShowNotifs(false); }}
        />
      )}
    </header>
  );
}
