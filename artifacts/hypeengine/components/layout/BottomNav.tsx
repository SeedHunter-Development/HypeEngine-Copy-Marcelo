"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Wallet, User } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
}

const CLIENT_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Campaigns", href: "/campaigns", icon: BarChart2 },
  { label: "Balance", href: "/credits", icon: Wallet },
  { label: "Profile", href: "/profile", icon: User },
];

const KOL_NAV: NavItem[] = [
  { label: "Home", href: "/kol", icon: Home },
  { label: "Campaigns", href: "/kol/campaigns", icon: BarChart2 },
  { label: "Earnings", href: "/kol/credits", icon: Wallet },
  { label: "Profile", href: "/kol/profile", icon: User },
];

export default function BottomNav({ role }: { role: "client" | "kol" }) {
  const pathname = usePathname();
  const items = role === "client" ? CLIENT_NAV : KOL_NAV;

  const isActive = (href: string) => {
    if (href === "/kol") return pathname === "/kol" || pathname === "/kol/";
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/dashboard/";
    return pathname.startsWith(href);
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--nav-bg)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
        }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "10px 8px 12px",
                textDecoration: "none",
                color: active ? "#FBAC32" : "var(--text-faint)",
                transition: "color 0.2s",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -6,
                      background: "rgba(251, 172, 50, 0.1)",
                      borderRadius: 8,
                    }}
                  />
                )}
                <Icon
                  size={22}
                  style={{
                    strokeWidth: active ? 2.5 : 2,
                    position: "relative",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
