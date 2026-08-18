"use client";

// /purchases lands on bills — what you owe is the reason you came.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PurchasesIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/purchases/bill");
  }, [router]);
  return null;
}
