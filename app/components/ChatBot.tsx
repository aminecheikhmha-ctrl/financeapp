"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

const EXCLUDED_PATHS = ["/login", "/signup", "/onboarding", "/"]

export default function ChatBot() {
  const pathname = usePathname()

  // Ne pas afficher sur les pages publiques
  if (EXCLUDED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) return null

  return <ChatBotInner />
}

function ChatBotInner() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
              "Bonjour ! Je suis ton assistant IA FinanceApp 🧠 Je connais ton portfolio et tes trades. Que puis-je analyser pour toi ?",
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
        body: JSON.stringify({ message: text, page_context: pathname }),
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

  return (
    <>
      {/* Panel chat */}
      {open && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 w-80 md:w-96 h-[480px] flex flex-col rounded-2xl shadow-2xl z-[200]"
          style={{ background: "#111", border: "1px solid #1a1a1a" }}
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

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-20 md:bottom-6 right-4 z-[199] w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(135deg, #4ade80, #059669)" }}
      >
        <span className="text-xl">{open ? "✕" : "🧠"}</span>
      </button>
    </>
  )
}
