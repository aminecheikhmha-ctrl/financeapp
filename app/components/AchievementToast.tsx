"use client"

import { useState, useCallback, useRef } from "react"
import { RARITY_COLORS, type Rarity } from "@/lib/achievements"

export interface Achievement {
  icon: string
  title: string
  description?: string
  xp: number
  rarity?: Rarity
}

interface AchievementToastProps {
  achievement: Achievement | null
  onDismiss: () => void
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  if (!achievement) return null

  const rarity = achievement.rarity ?? "common"
  const colors = RARITY_COLORS[rarity]
  const confettiColors = ["#4ade80", "#facc15", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"]

  return (
    <>
      <style>{`
        @keyframes achievementSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes confettiFly0 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-12px,-20px) rotate(180deg); opacity:0; } }
        @keyframes confettiFly1 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(14px,-18px) rotate(-120deg); opacity:0; } }
        @keyframes confettiFly2 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-8px,-24px) rotate(90deg); opacity:0; } }
        @keyframes confettiFly3 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(16px,-14px) rotate(200deg); opacity:0; } }
        @keyframes confettiFly4 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-6px,-22px) rotate(-80deg); opacity:0; } }
        @keyframes confettiFly5 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(10px,-26px) rotate(140deg); opacity:0; } }
        .achievement-toast-enter { animation: achievementSlideIn 0.4s ease-out forwards; }
      `}</style>
      <div className="fixed bottom-24 md:bottom-8 right-4 z-[300] achievement-toast-enter">
        <div
          className="w-72 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "#111",
            border: `1px solid ${colors.hex}40`,
            boxShadow: `0 0 32px ${colors.hex}20`,
          }}
        >
          <div className="p-4 flex items-start gap-3 relative">
            {/* Confetti */}
            {confettiColors.map((color, i) => (
              <span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-sm pointer-events-none"
                style={{
                  background: color,
                  top: "50%",
                  left: "50%",
                  animation: `confettiFly${i} 1.2s ease-out ${i * 0.1}s forwards`,
                }}
              />
            ))}

            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: `${colors.hex}18`, border: `1px solid ${colors.hex}35` }}
            >
              {achievement.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                  style={{ background: `${colors.hex}18`, color: colors.hex, border: `1px solid ${colors.hex}30` }}
                >
                  {colors.label}
                </span>
                <span className="text-[10px] text-yellow-400 font-bold">+{achievement.xp} XP</span>
              </div>
              <p className="text-white font-black text-sm truncate">{achievement.title}</p>
              {achievement.description && (
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{achievement.description}</p>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="text-gray-600 hover:text-gray-400 transition text-base leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="px-4 py-2 border-t border-white/5 bg-white/2">
            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide">
              🏅 Succès débloqué !
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

interface UseAchievementToastReturn {
  achievement: Achievement | null
  show: (a: Achievement) => void
  dismiss: () => void
}

export function useAchievementToast(): UseAchievementToastReturn {
  const [achievement, setAchievement] = useState<Achievement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setAchievement(null)
  }, [])

  const show = useCallback((a: Achievement) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setAchievement(a)
    timerRef.current = setTimeout(() => {
      setAchievement(null)
      timerRef.current = null
    }, 4500)
  }, [])

  return { achievement, show, dismiss }
}
