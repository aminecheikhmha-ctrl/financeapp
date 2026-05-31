"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/i18n/context"

export default function CookieBanner() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent")
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  if (pathname.startsWith("/legal")) return null
  if (!visible) return null

  function accept() {
    localStorage.setItem("cookie_consent", "all")
    setVisible(false)
  }

  function essential() {
    localStorage.setItem("cookie_consent", "essential")
    setVisible(false)
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[80] animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#111] border border-white/12 rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xl flex-shrink-0">🍪</span>
          <div>
            <p className="text-white font-bold text-sm">{t.cookies.title}</p>
            <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
              {t.cookies.description}
              <a href="/legal/cookies" className="text-green-400 hover:underline ml-1">{t.cookies.learnMore}</a>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={essential}
            className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 transition"
          >
            {t.cookies.essentialOnly}
          </button>
          <button
            onClick={accept}
            className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-400 rounded-xl text-xs font-bold text-black transition"
          >
            {t.cookies.acceptAll}
          </button>
        </div>
      </div>
    </div>
  )
}
