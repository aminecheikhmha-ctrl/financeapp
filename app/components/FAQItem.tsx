"use client"

import { useState } from "react"

export default function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        background: open ? "rgba(34,197,94,0.04)" : "#0a0a0a",
        border: `1px solid ${open ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
      }}
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between p-5">
        <p className="text-sm font-bold text-white pr-4">{question}</p>
        <span
          className="text-white/30 flex-shrink-0 text-xl leading-none transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", display: "inline-block" }}
        >
          +
        </span>
      </div>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-white/50 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}
