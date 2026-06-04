"use client"

import { useEffect } from "react"

export type ShortcutHandler = {
  key: string
  meta?: boolean
  shift?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      // Ne pas déclencher si l'utilisateur tape dans un input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      for (const s of shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : true
        const shiftMatch = s.shift ? e.shiftKey : true

        if (keyMatch && metaMatch && shiftMatch) {
          e.preventDefault()
          s.action()
          return
        }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [shortcuts, enabled])
}
