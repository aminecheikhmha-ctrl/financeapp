"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  useEffect(() => {
    const saved = localStorage.getItem("tradex_theme") as Theme | null
    const initial = saved ?? "dark"
    setThemeState(initial)
    document.documentElement.setAttribute("data-theme", initial)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem("tradex_theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
