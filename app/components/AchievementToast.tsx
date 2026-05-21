"use client"

import { useState, useCallback, useRef } from "react"

export interface Achievement {
  icon: string
  title: string
  xp: number
}

interface AchievementToastProps {
  achievement: Achievement | null
  onDismiss: () => void
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  if (!achievement) return null

  const confettiColors = ["#4ade80", "#facc15", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"]

  return (
    <>
      <style>{`
        @keyframes achievementSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes achievementFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes confettiFly0 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-12px,-20px) rotate(180deg); opacity:0; } }
        @keyframes confettiFly1 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(14px,-18px) rotate(-120deg); opacity:0; } }
        @keyframes confettiFly2 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-8px,-24px) rotate(90deg); opacity:0; } }
        @keyframes confettiFly3 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(16px,-14px) rotate(200deg); opacity:0; } }
        @keyframes confettiFly4 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(-6px,-22px) rotate(-80deg); opacity:0; } }
        @keyframes confettiFly5 { from { transform: translate(0,0) rotate(0deg); opacity:1; } to { transform: translate(10px,-26px) rotate(140deg); opacity:0; } }
        .achievement-toast-enter { animation: achievementSlideIn 0.4s ease-out forwards; }
        .achievement-toast-exit { animation: achievementFadeOut 0.5s ease-in forwards; }
      `}</style>
      <div
        className="fixed bottom-24 md:bottom-8 right-4 z-[300] achievement-toast-enter"
        style={{ animationDelay: "0s" }}
      >
        <div
          className="w-72 rounded-2xl p-4 shadow-2xl flex items-center gap-3 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #111 0%, #0d1f0d 100%)",
            border: "1px solid rgba(74,222,128,0.3)",
          }}
        >
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
            style={{
              background: "rgba(74,222,128,0.15)",
              border: "1px solid rgba(74,222,128,0.3)",
            }}
          >
            {achievement.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-green-400 font-black uppercase tracking-widest">
              Achievement débloqué !
            </p>
            <p className="text-white font-black text-sm truncate">{achievement.title}</p>
            <p className="text-yellow-400 text-xs font-bold">+{achievement.xp} XP</p>
          </div>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 text-xs leading-none"
          >
            ✕
          </button>
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

  const show = useCallback(
    (a: Achievement) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setAchievement(a)
      timerRef.current = setTimeout(() => {
        setAchievement(null)
        timerRef.current = null
      }, 4000)
    },
    []
  )

  return { achievement, show, dismiss }
}
