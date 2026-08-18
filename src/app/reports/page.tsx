"use client";

// /reports lands on the trial balance — the report that proves the rest.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports/trial-balance");
  }, [router]);
  return null;
}
