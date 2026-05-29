"use client"

import { useEffect, useState, createContext, useContext, useCallback } from "react"

export type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  toast:   (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error:   (message: string, duration?: number) => void
  info:    (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string; bar: string }> = {
  success: { bg: "rgba(10,18,10,0.98)",  border: "rgba(34,197,94,0.28)",  icon: "✅", bar: "#4ade80" },
  error:   { bg: "rgba(18,10,10,0.98)",  border: "rgba(239,68,68,0.28)",  icon: "❌", bar: "#f87171" },
  info:    { bg: "rgba(10,10,20,0.98)",  border: "rgba(96,165,250,0.28)", icon: "ℹ️", bar: "#60a5fa" },
  warning: { bg: "rgba(18,15,10,0.98)",  border: "rgba(251,191,36,0.28)", icon: "⚠️", bar: "#fbbf24" },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((
    message: string,
    type: ToastType = "info",
    duration = 3500,
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration + 300)
  }, [])

  const value: ToastContextValue = {
    toast:   addToast,
    success: (m, d) => addToast(m, "success", d ?? 3000),
    error:   (m, d) => addToast(m, "error",   d ?? 4000),
    info:    (m, d) => addToast(m, "info",    d ?? 3000),
    warning: (m, d) => addToast(m, "warning", d ?? 3500),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  )
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const s = TOAST_STYLES[t.type]
        return (
          <div
            key={t.id}
            className="animate-slide-up flex items-center gap-3 px-4 py-3 rounded-2xl pointer-events-auto relative overflow-hidden"
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${s.border}`,
              minWidth: 260,
              maxWidth: 380,
            }}
            onClick={() => onDismiss(t.id)}>
            <span className="text-base flex-shrink-0">{s.icon}</span>
            <p className="text-sm font-semibold text-white flex-1 leading-snug">{t.message}</p>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden" style={{ borderRadius: "0 0 16px 16px" }}>
              <div
                className="h-full"
                style={{
                  background: s.bar,
                  animation: `shrink ${t.duration}ms linear forwards`,
                }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
