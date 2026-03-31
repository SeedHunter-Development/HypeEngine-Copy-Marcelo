"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function Redirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    if (id) {
      router.replace(`/kol/campaigns/${id}`);
    } else {
      router.replace("/kol/campaigns");
    }
  }, [id, router]);

  return null;
}

export default function KolCampaignDetailPage() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  );
}
