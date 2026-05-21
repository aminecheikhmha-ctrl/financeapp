/**
 * Simple A/B testing utility based on localStorage persistence.
 * 50% users see variant A (control), 50% see variant B (trial).
 */

export type ABVariant = "control" | "trial"

export function getPricingVariant(): ABVariant {
  if (typeof window === "undefined") return "control"

  const stored = localStorage.getItem("ab_pricing")
  if (stored === "control" || stored === "trial") return stored

  const variant: ABVariant = Math.random() < 0.5 ? "control" : "trial"
  localStorage.setItem("ab_pricing", variant)
  return variant
}

export function trackABEvent(variant: ABVariant, event: "shown" | "clicked_cta" | "converted") {
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: `ab_pricing_${event}`,
      metadata: { variant },
    }),
  }).catch(() => {})
}
