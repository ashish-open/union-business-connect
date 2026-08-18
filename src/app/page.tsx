"use client";

import { useEffect } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/app/BrandMark";
import { useStore } from "@/store/useStore";

export default function RootPage() {
  const mounted = useHydrated();
  const router = useRouter();
  const mobile = useStore((s) => s.mobile);
  const entityId = useStore((s) => s.entityId);
  const onboarded = useStore((s) => s.onboarded);
  useEffect(() => {
    if (!mounted) return;
    router.replace(mobile && entityId && onboarded ? "/today" : "/signin");
  }, [mounted, mobile, entityId, onboarded, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="animate-pulse-soft">
        <BrandMark size="lg" withName={false} />
      </div>
    </div>
  );
}
