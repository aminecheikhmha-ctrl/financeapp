"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps { className?: string }

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn("rounded-2xl animate-pulse", className)}
      style={{ background: "rgba(255,255,255,0.05)" }}
    />
  )
}

export function SkeletonText({ width = "100%", className }: { width?: string; className?: string }) {
  return (
    <div
      className={cn("h-3 rounded-full animate-pulse", className)}
      style={{ background: "rgba(255,255,255,0.055)", width }}
    />
  )
}

export function SkeletonRow({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-2xl", className)}
      style={{ background: "rgba(255,255,255,0.025)" }}>
      <SkeletonCard className="w-10 h-10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonText width="40%" />
        <SkeletonText width="65%" />
      </div>
      <SkeletonText width="70px" />
    </div>
  )
}

export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {[...Array(count)].map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
