"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    } else if (!user.setupComplete) {
      router.replace("/setup");
    } else if (user.role === "admin") {
      router.replace("/admin/pricing-test");
    } else if (user.role === "client") {
      router.replace("/dashboard");
    } else {
      router.replace("/kol");
    }
  }, [user, isLoading, router]);

  return (
    <div
      style={{
        background: "var(--bg-body)",
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <img
          src="/logo.jpg"
          alt="HypeEngine"
          style={{ width: 56, height: 56, borderRadius: 12 }}
        />
        <div
          style={{
            width: 32,
            height: 3,
            background: "linear-gradient(90deg, #FBAC32, #F29236)",
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}
