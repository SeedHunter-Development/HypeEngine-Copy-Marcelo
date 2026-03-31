"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, UserRole } from "@/context/AuthContext";

export function useAuthGuard(requiredRole?: UserRole) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!user.setupComplete) {
      router.replace("/setup");
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      if (user.role === "admin") router.replace("/admin/pricing-test");
      else if (user.role === "client") router.replace("/dashboard");
      else router.replace("/kol");
    }
  }, [user, isLoading, router, requiredRole]);

  return { user, isLoading };
}
