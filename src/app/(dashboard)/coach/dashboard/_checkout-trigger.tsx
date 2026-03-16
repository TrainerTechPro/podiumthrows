"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

/**
 * Reads `?checkout=pro` or `?checkout=elite` from the URL and
 * auto-initiates a Stripe Checkout session.
 *
 * Used in the register → dashboard → Stripe flow when a new coach
 * selected a paid plan during registration.
 *
 * `replaceState` removes the param immediately so a page refresh
 * won't re-trigger checkout.
 */
export function CheckoutTrigger() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const triggered = useRef(false);

  useEffect(() => {
    const plan = searchParams.get("checkout");
    if (!plan || triggered.current) return;
    triggered.current = true;

    const interval = searchParams.get("interval") || "monthly";

    // Clean the URL immediately to prevent re-triggers on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("interval");
    window.history.replaceState({}, "", url.pathname + url.search);

    // Initiate checkout
    (async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({ plan, interval }),
        });
        const data = await res.json();
        if (data.url) {
          router.push(data.url);
        } else {
          console.error("[CheckoutTrigger] Checkout error:", data.error);
        }
      } catch (err) {
        console.error("[CheckoutTrigger] Network error:", err);
      }
    })();
  }, [searchParams, router]);

  return null;
}
