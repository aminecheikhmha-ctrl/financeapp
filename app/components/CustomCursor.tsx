"use client"

import { useEffect, useRef, useState } from "react"

export default function CustomCursor() {
  const dotRef      = useRef<HTMLDivElement>(null)
  const ringRef     = useRef<HTMLDivElement>(null)
  const [visible,   setVisible]   = useState(false)
  const [clicking,  setClicking]  = useState(false)
  const [onLink,    setOnLink]    = useState(false)
  const pos = useRef({ x: 0, y: 0 })
  const ring = useRef({ x: 0, y: 0 })
  const raf  = useRef<number>(0)

  useEffect(() => {
    // Only on desktop (fine pointer = mouse)
    if (!window.matchMedia("(pointer: fine)").matches) return

    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      if (!visible) setVisible(true)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isLink = !!(el?.closest("a, button, [role='button'], input, textarea, select, label"))
      setOnLink(isLink)
    }

    const onLeave = () => setVisible(false)
    const onDown  = () => setClicking(true)
    const onUp    = () => setClicking(false)

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseleave", onLeave)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("mouseup", onUp)

    // Smooth ring follow
    function animate() {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12
      ring.current.y += (pos.current.y - ring.current.y) * 0.12

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.current.x - 5}px, ${pos.current.y - 5}px)`
      }
      if (ringRef.current) {
        const size = onLink ? 48 : clicking ? 20 : 32
        ringRef.current.style.transform = `translate(${ring.current.x - size / 2}px, ${ring.current.y - size / 2}px)`
        ringRef.current.style.width  = `${size}px`
        ringRef.current.style.height = `${size}px`
      }
      raf.current = requestAnimationFrame(animate)
    }
    raf.current = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeave)
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("mouseup", onUp)
      cancelAnimationFrame(raf.current)
    }
  }, [visible, clicking, onLink])

  if (typeof window !== "undefined" && !window.matchMedia("(pointer: fine)").matches) return null

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[99999]"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#22c55e",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
          willChange: "transform",
          mixBlendMode: "screen",
        }}
      />
      {/* Ring */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[99998]"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: `1.5px solid ${onLink ? "rgba(34,197,94,0.7)" : "rgba(34,197,94,0.35)"}`,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease, width 0.2s ease, height 0.2s ease, border-color 0.15s ease",
          willChange: "transform",
        }}
      />
    </>
  )
}
