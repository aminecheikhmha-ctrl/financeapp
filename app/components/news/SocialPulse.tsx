"use client"

type SentimentItem = {
  symbol: string
  buzz_score: number
  reddit_mentions: number
  dominant_sentiment: string
}

type Props = {
  sentiments: SentimentItem[]
  onSelect: (symbol: string) => void
}

function sentimentEmoji(s: string): string {
  if (s === "bullish") return "🟢"
  if (s === "bearish") return "🔴"
  return "🟡"
}

function trendArrow(buzz: number): string {
  if (buzz > 50) return "↑"
  if (buzz < 20) return "↓"
  return "→"
}

export default function SocialPulse({ sentiments, onSelect }: Props) {
  const sorted = [...sentiments]
    .filter(s => s.buzz_score > 0 || s.reddit_mentions > 0)
    .sort((a, b) => b.buzz_score - a.buzz_score)
    .slice(0, 8)

  return (
    <div
      className="rounded-3xl p-4"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
        🔥 Buzz Social
      </p>

      {sorted.length === 0 ? (
        <div className="space-y-1.5 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((s, i) => (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className="w-full flex items-center gap-2 group hover:bg-white/[0.03] rounded-lg px-1 py-1.5 transition"
            >
              <span className="text-[10px] text-white/30 w-4 flex-shrink-0">{i + 1}.</span>
              <span className="text-[11px] font-black text-white flex-shrink-0 w-12 text-left group-hover:text-green-400 transition">
                {s.symbol.replace("-USD", "")}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, s.buzz_score)}%`,
                    background: s.buzz_score > 60 ? "#f97316" : s.buzz_score > 30 ? "#facc15" : "#6b7280",
                  }}
                />
              </div>
              <span className="text-[9px] text-white/30 flex-shrink-0 w-8 text-right">
                {s.reddit_mentions > 0 ? `${s.reddit_mentions}m` : ""}
              </span>
              <span className="text-sm flex-shrink-0">{sentimentEmoji(s.dominant_sentiment)}</span>
              <span
                className="text-[10px] font-bold flex-shrink-0"
                style={{ color: s.buzz_score > 50 ? "#4ade80" : s.buzz_score < 20 ? "#ef4444" : "#6b7280" }}
              >
                {trendArrow(s.buzz_score)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
