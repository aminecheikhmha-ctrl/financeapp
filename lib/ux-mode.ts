"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type UXLevel = "débutant" | "intermédiaire" | "avancé"

export interface UXConfig {
  level: UXLevel
  showTooltips: boolean
  showAdvancedIndicators: boolean
  simplifiedKPIs: boolean
  defaultTab: "chart" | "technique" | "ia"
  greeting: string
  sidebarLabels: {
    dashboard: string
    portfolio: string
    signaux: string
    analyses: string
    social: string
    apprendre: string
    forum: string
    reports: string
  }
}

const UX_CONFIGS: Record<UXLevel, UXConfig> = {
  "débutant": {
    level: "débutant",
    showTooltips: true,
    showAdvancedIndicators: false,
    simplifiedKPIs: true,
    defaultTab: "ia",
    greeting: "Bonjour 👋 — voici ton tableau de bord simplifié",
    sidebarLabels: {
      dashboard: "Mon tableau de bord",
      portfolio: "Mon portefeuille",
      signaux: "Signaux de trading",
      analyses: "Analyses en direct",
      social: "Communauté",
      apprendre: "Apprendre",
      forum: "Forum",
      reports: "Mes rapports",
    },
  },
  "intermédiaire": {
    level: "intermédiaire",
    showTooltips: true,
    showAdvancedIndicators: true,
    simplifiedKPIs: false,
    defaultTab: "chart",
    greeting: "Content de te revoir 📈",
    sidebarLabels: {
      dashboard: "Dashboard",
      portfolio: "Portfolio",
      signaux: "Signaux",
      analyses: "Analyses",
      social: "Social",
      apprendre: "Apprendre",
      forum: "Forum",
      reports: "Rapports",
    },
  },
  "avancé": {
    level: "avancé",
    showTooltips: false,
    showAdvancedIndicators: true,
    simplifiedKPIs: false,
    defaultTab: "technique",
    greeting: "Bons trades aujourd'hui 🎯",
    sidebarLabels: {
      dashboard: "Dashboard",
      portfolio: "Portfolio",
      signaux: "Signaux",
      analyses: "Analyses",
      social: "Social",
      apprendre: "Apprendre",
      forum: "Forum",
      reports: "Rapports",
    },
  },
}

const DEFAULT_CONFIG = UX_CONFIGS["intermédiaire"]

export function useUXMode(): UXConfig {
  const [config, setConfig] = useState<UXConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: up } = await supabase
        .from("user_profiles")
        .select("level")
        .eq("id", data.user.id)
        .single()
      if (up?.level && up.level in UX_CONFIGS) {
        setConfig(UX_CONFIGS[up.level as UXLevel])
      }
    })
  }, [])

  return config
}

export { UX_CONFIGS }
