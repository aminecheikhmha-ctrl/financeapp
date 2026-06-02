"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n/context"

const EXCLUDED_PATHS = ["/login", "/signup", "/onboarding", "/"]

export default function ChatBot() {
  const pathname = usePathname()

  // Ne pas afficher sur les pages publiques
  if (EXCLUDED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return null

  return <ChatBotInner />
}

type Corner = "br" | "bl" | "tr" | "tl"

function snapToCorner(x: number, y: number): Corner {
  const sidebarW = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-w") || "64")
  const cx = (window.innerWidth + sidebarW) / 2
  const cy = window.innerHeight / 2
  if (x < cx && y < cy) return "tl"
  if (x >= cx && y < cy) return "tr"
  if (x < cx && y >= cy) return "bl"
  return "br"
}

const LEFT_OFFSET = "calc(var(--sidebar-w, 64px) + 16px)"

function getButtonPos(corner: Corner): React.CSSProperties {
  const topOffset = 72
  switch (corner) {
    case "br": return { bottom: 16, right: 16 }
    case "bl": return { bottom: 16, left: LEFT_OFFSET }
    case "tr": return { top: topOffset, right: 16 }
    case "tl": return { top: topOffset, left: LEFT_OFFSET }
  }
}

function getPanelPos(corner: Corner): React.CSSProperties {
  const btnSize = 48 + 8
  const topOffset = 72
  switch (corner) {
    case "br": return { bottom: 16 + btnSize, right: 16 }
    case "bl": return { bottom: 16 + btnSize, left: LEFT_OFFSET }
    case "tr": return { top: topOffset + btnSize, right: 16 }
    case "tl": return { top: topOffset + btnSize, left: LEFT_OFFSET }
  }
}

function ChatBotInner() {
  const pathname = usePathname()
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [corner, setCorner] = useState<Corner>("br")
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = dragPos !== null
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem("chatbot-corner") as Corner | null
    if (saved) setCorner(saved)
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    function onMove(ev: MouseEvent) {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        moved = true
      }
      if (moved) setDragPos({ x: ev.clientX, y: ev.clientY })
    }

    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      if (moved) {
        const c = snapToCorner(ev.clientX, ev.clientY)
        setCorner(c)
        localStorage.setItem("chatbot-corner", c)
        setDragPos(null)
      } else {
        setDragPos(null)
        setOpen(v => !v)
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    const startX = t.clientX
    const startY = t.clientY
    let moved = false

    function onMove(ev: TouchEvent) {
      ev.preventDefault()
      const touch = ev.touches[0]
      if (!moved && Math.hypot(touch.clientX - startX, touch.clientY - startY) > 5) {
        moved = true
      }
      if (moved) setDragPos({ x: touch.clientX, y: touch.clientY })
    }

    function onEnd(ev: TouchEvent) {
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      const touch = ev.changedTouches[0]
      if (moved) {
        const c = snapToCorner(touch.clientX, touch.clientY)
        setCorner(c)
        localStorage.setItem("chatbot-corner", c)
        setDragPos(null)
      } else {
        setDragPos(null)
        setOpen(v => !v)
      }
    }

    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend", onEnd)
  }

  // Charge l'historique au montage
  useEffect(() => {
    async function loadHistory() {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const params = new URLSearchParams({ page_context: pathname })
      const res = await fetch(`/api/ai/chat?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.history && json.history.length > 0) {
        setMessages(json.history)
      } else {
        setMessages([
          {
            role: "assistant",
            content:
              "Bonjour ! Je suis ton assistant IA Tradex 🧠 Je connais ton portfolio et tes trades. Que puis-je analyser pour toi ?",
          },
        ])
      }
      if (json.suggestions) setSuggestions(json.suggestions)
      setHistoryLoaded(true)
    }
    loadHistory()
  }, [pathname])

  // Scroll automatique vers le bas
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, open])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: text }])
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, page_context: pathname, lang }),
      })
      const json = await res.json()
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: json.response ?? "Désolé, une erreur s'est produite.",
        },
      ])
      if (json.suggestions) setSuggestions(json.suggestions)
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Désolé, je suis temporairement indisponible.",
        },
      ])
    }
    setLoading(false)
  }

  const btnStyle: React.CSSProperties = dragging && dragPos
    ? { position: "fixed", left: dragPos.x - 24, top: dragPos.y - 24, zIndex: 201, cursor: "grabbing", transition: "none" }
    : { ...getButtonPos(corner), position: "fixed", zIndex: 199, cursor: "grab", transition: "top 0.25s, bottom 0.25s, left 0.25s, right 0.25s" }

  return (
    <>
      {/* Panel chat */}
      {open && !dragging && (
        <div
          className="w-80 md:w-96 h-[480px] flex flex-col rounded-2xl shadow-2xl z-[200]"
          style={{ ...getPanelPos(corner), position: "fixed", background: "#111", border: "1px solid #1a1a1a" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-lg">
                🧠
              </div>
              <div>
                <p className="text-white font-black text-sm">Assistant IA</p>
                <p className="text-green-400 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />{" "}
                  En ligne
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 hover:text-white text-sm transition"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-green-500 text-black font-semibold rounded-br-sm"
                      : "text-gray-200 rounded-bl-sm"
                  }`}
                  style={m.role === "assistant" ? { background: "#1a1a1a" } : {}}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-3 py-2 rounded-2xl rounded-bl-sm"
                  style={{ background: "#1a1a1a" }}
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-[10px] px-2 py-1 rounded-lg text-gray-400 hover:text-white transition border border-white/10 hover:border-white/20 whitespace-nowrap"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/5 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Pose ta question..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/40"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 flex items-center justify-center text-black font-black text-lg transition"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Floating button — draggable */}
      <button
        ref={btnRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl select-none"
        style={{
          ...btnStyle,
          background: "linear-gradient(135deg, #4ade80, #059669)",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <span className="text-xl">{open && !dragging ? "✕" : "🧠"}</span>
      </button>
    </>
  )
}
