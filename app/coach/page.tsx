"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n/context"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED = [
  "How to improve my win rate?",
  "Explain risk management to me",
  "When should I cut a losing position?",
  "Difference between support and resistance",
  "How to analyze a candlestick chart?",
  "What is the risk/reward ratio?",
]

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
          🤖
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-green-500 text-black font-medium rounded-tr-sm"
            : "bg-[#1a1a1a] border border-white/8 text-gray-200 rounded-tl-sm"
        }`}
        style={{ whiteSpace: "pre-wrap" }}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push("/login"); return }
      setUser(u)
      const { data } = await supabase.auth.getSession()
      setToken(data.session?.access_token ?? null)
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading || !token) return
    const userMsg: Message = { role: "user", content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8),
          lang,
        }),
      })
      const json = await res.json()
      const reply = json.reply ?? "Sorry, I couldn't generate a response."
      setMessages(prev => [...prev, { role: "assistant", content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "An error occurred. Please try again in a moment." }])
    }
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const username = user?.email?.split("@")[0] ?? "Trader"

  return (
    <div className="min-h-screen text-white overflow-x-hidden flex flex-col" style={{ background: "#080808" }}>
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1 px-4 py-6">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/15 border border-green-500/30 text-3xl mb-3">
            🤖
          </div>
          <h1 className="text-2xl font-black text-white">{t.coach.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t.coach.systemNote}
          </p>
        </div>

        {/* Chat area */}
        <div className="flex-1 space-y-4 mb-4 min-h-[300px]">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                  🤖
                </div>
                <div className="bg-[#1a1a1a] border border-white/8 text-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed max-w-[80%]">
                  Salut <span className="text-green-400 font-semibold">{username}</span> ! 👋
                  <br /><br />
                  Je suis ton coach de trading IA. Pose-moi n&apos;importe quelle question sur le trading, la gestion du risque, l&apos;analyse technique ou psychologique.
                  <br /><br />
                  Comment puis-je t&apos;aider aujourd&apos;hui ?
                </div>
              </div>

              {/* Suggestions */}
              <div className="pl-11">
                <p className="text-xs text-gray-600 mb-2 font-semibold uppercase tracking-wide">{t.coach.suggestions}</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:text-green-400 hover:border-green-500/30 hover:bg-green-500/5 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
          )}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                🤖
              </div>
              <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                <LoadingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 pt-2" style={{ background: "#080808" }}>
          {messages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {SUGGESTED.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-500 hover:text-green-400 hover:border-green-500/30 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3 items-end bg-[#111] border border-white/10 rounded-2xl p-3 focus-within:border-green-500/40 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t.coach.placeholder}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none resize-none max-h-32"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-30 disabled:cursor-not-allowed text-black flex items-center justify-center transition flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-center text-gray-700 text-[10px] mt-2">
            Powered by Groq · Llama 3.3 70B
          </p>
        </div>
      </div>
    </div>
  )
}
