"use client";

// /sales lands on invoices — the document the owner actually opens this for.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SalesIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sales/invoice");
  }, [router]);
  return null;
}
