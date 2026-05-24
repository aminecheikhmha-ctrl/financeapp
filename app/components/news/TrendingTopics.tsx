"use client"

import { useState, useEffect } from "react"

type TrendingTopic = {
  topic: string
  count: number
  sentiment: string
  tickers: string[]
  emoji: string
}

function sentimentColor(sentiment: string): string {
  if (sentiment.includes("très positif")) return "#4ade80"
  if (sentiment.includes("positif")) return "#86efac"
  if (sentiment.includes("très négatif")) return "#ef4444"
  if (sentiment.includes("négatif")) return "#fca5a5"
  return "#facc15"
}

function Skeleton() {
  return (
    <div className="flex flex-wrap gap-1.5 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-7 rounded-full bg-white/[0.04]" style={{ width: `${60 + i * 15}px` }} />
      ))}
    </div>
  )
}

type Props = {
  onTopicClick: (topic: string) => void
  activeTopics: string[]
}

export default function TrendingTopics({ onTopicClick, activeTopics }: Props) {
  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/news/trending")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTopics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest">🔥 Trending en ce moment</p>
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
          style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
        >
          LIVE
        </span>
      </div>

      {loading ? (
        <Skeleton />
      ) : topics.length === 0 ? (
        <p className="text-[10px] text-white/30">Aucun topic disponible</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t, i) => {
            const isActive = activeTopics.includes(t.topic)
            const color = sentimentColor(t.sentiment)
            const isHigh = t.count > 5

            return (
              <button
                key={i}
                onClick={() => onTopicClick(t.topic)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition border ${isHigh ? "animate-pulse" : ""}`}
                style={{
                  background: isActive ? `${color}22` : "rgba(255,255,255,0.04)",
                  borderColor: isActive ? color : "rgba(255,255,255,0.08)",
                  color: isActive ? color : "rgba(255,255,255,0.5)",
                }}
              >
                <span>{t.emoji}</span>
                <span>{t.topic}</span>
                {t.count > 1 && (
                  <span
                    className="px-1 py-0.5 rounded-full text-[8px] font-black"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
