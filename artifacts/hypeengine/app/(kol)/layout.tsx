"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";

export default function KolLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthGuard("kol");
  const pathname = usePathname();

  const isDetailPage =
    pathname === "/kol/campaigns/detail" ||
    (pathname.startsWith("/kol/campaigns/") && pathname !== "/kol/campaigns");
  const showBottomNav = !isDetailPage;

  if (isLoading || !user) {
    return (
      <div
        style={{
          background: "var(--bg-body)",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    );
  }

  return (
    <div style={{ background: "var(--bg-body)", minHeight: "100dvh" }}>
      {children}
      {showBottomNav && <BottomNav role="kol" />}
    </div>
  );
}
