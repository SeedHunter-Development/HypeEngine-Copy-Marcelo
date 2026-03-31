"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";

const NO_BOTTOM_NAV = ["/campaigns/new", "/campaigns/detail"];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthGuard("client");
  const pathname = usePathname();

  const showBottomNav = !NO_BOTTOM_NAV.some((p) => pathname.startsWith(p));

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
      {showBottomNav && <BottomNav role="client" />}
    </div>
  );
}
