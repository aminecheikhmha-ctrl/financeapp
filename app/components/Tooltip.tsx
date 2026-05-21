"use client"

import { useState, useRef, useEffect } from "react"

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: "top" | "bottom" | "left" | "right"
}

export default function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  function show() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    let x = rect.left + scrollX + rect.width / 2
    let y = rect.top + scrollY

    if (position === "bottom") y = rect.bottom + scrollY + 8
    else y = rect.top + scrollY - 8

    setCoords({ x, y })
    setVisible(true)
  }

  function hide() { setVisible(false) }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center gap-1 cursor-help"
      >
        {children}
        <span className="w-3.5 h-3.5 rounded-full bg-white/10 text-gray-500 text-[9px] font-black flex items-center justify-center flex-shrink-0 hover:bg-white/20 transition">?</span>
      </span>

      {visible && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: coords.x,
            top: coords.y,
            transform: position === "bottom"
              ? "translateX(-50%)"
              : "translateX(-50%) translateY(-100%)",
          }}
        >
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl px-3 py-2 shadow-2xl max-w-[220px]">
            <p className="text-xs text-gray-300 leading-relaxed whitespace-normal">{content}</p>
          </div>
          {position !== "bottom" && (
            <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-white/15 rotate-45 mx-auto -mt-1" />
          )}
        </div>
      )}
    </>
  )
}
