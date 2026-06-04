"use client"

import { useState } from "react"
import NewsletterSignup from "@/app/components/NewsletterSignup"

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  tags?: string[]
  reading_time?: number
  featured?: boolean
  created_at: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "débutant":          { bg: "rgba(74,222,128,0.12)",  text: "#4ade80", border: "rgba(74,222,128,0.25)"  },
  "analyse-technique": { bg: "rgba(96,165,250,0.12)",  text: "#60a5fa", border: "rgba(96,165,250,0.25)"  },
  "crypto":            { bg: "rgba(167,139,250,0.12)", text: "#a78bfa", border: "rgba(167,139,250,0.25)" },
  "stratégie":         { bg: "rgba(245,158,11,0.12)",  text: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  "macro":             { bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" },
  "psychologie":       { bg: "rgba(251,146,60,0.12)",  text: "#fb923c", border: "rgba(251,146,60,0.25)"  },
  "actions":           { bg: "rgba(52,211,153,0.12)",  text: "#34d399", border: "rgba(52,211,153,0.25)"  },
  "technologie":       { bg: "rgba(34,211,238,0.12)",  text: "#22d3ee", border: "rgba(34,211,238,0.25)"  },
  "avancé":            { bg: "rgba(232,121,249,0.12)", text: "#e879f9", border: "rgba(232,121,249,0.25)" },
  "analyses":          { bg: "rgba(250,204,21,0.12)",  text: "#facc15", border: "rgba(250,204,21,0.25)"  },
}

const CATEGORY_ICONS: Record<string, string> = {
  "débutant": "🌱", "analyse-technique": "📊", "crypto": "₿",
  "stratégie": "♟️", "macro": "🌍", "psychologie": "🧠",
  "actions": "📈", "technologie": "🤖", "avancé": "🏆", "analyses": "🔍",
}

const ALL_CATEGORIES = ["Tout", "débutant", "analyse-technique", "crypto", "stratégie", "macro", "psychologie", "actions", "technologie", "avancé"]

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "rgba(255,255,255,0.08)", text: "#9ca3af", border: "rgba(255,255,255,0.12)" }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

function CategoryBadge({ category, small }: { category: string; small?: boolean }) {
  const style = getCategoryStyle(category)
  const icon  = CATEGORY_ICONS[category] ?? "📝"
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {icon} {category}
    </span>
  )
}

function FeaturedCard({ post }: { post: Post }) {
  const style = getCategoryStyle(post.category)
  return (
    <a
      href={`/blog/${post.slug}`}
      className="group relative rounded-2xl overflow-hidden flex flex-col md:flex-row gap-0 hover:scale-[1.01] transition-transform"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Visual panel */}
      <div
        className="w-full md:w-72 h-48 md:h-auto flex-shrink-0 flex items-center justify-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${style.bg}, #0d0d0d)`, borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${style.text}18 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
        <span className="text-6xl relative z-10">{CATEGORY_ICONS[post.category] ?? "📝"}</span>
      </div>
      {/* Content */}
      <div className="flex flex-col justify-center p-6 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <CategoryBadge category={post.category} />
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-yellow-400" style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)" }}>
            ⭐ À la une
          </span>
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white mb-2 group-hover:text-green-400 transition leading-tight">{post.title}</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-3">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{formatDate(post.created_at)}</span>
          <span>·</span>
          <span>{post.reading_time ?? 5} min de lecture</span>
          <span className="ml-auto text-green-400 font-semibold group-hover:translate-x-1 transition-transform">Lire →</span>
        </div>
      </div>
    </a>
  )
}

function PostCard({ post }: { post: Post }) {
  const style = getCategoryStyle(post.category)
  return (
    <a
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden hover:scale-[1.02] transition-transform"
      style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Color strip */}
      <div
        className="h-32 flex items-center justify-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${style.bg}, #111)` }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${style.text}15 1px, transparent 1px)`, backgroundSize: "20px 20px" }} />
        <span className="text-4xl relative z-10">{CATEGORY_ICONS[post.category] ?? "📝"}</span>
      </div>
      {/* Text */}
      <div className="p-4 flex flex-col flex-1">
        <CategoryBadge category={post.category} small />
        <h3 className="text-white font-bold text-sm mt-2 mb-1.5 leading-snug group-hover:text-green-400 transition line-clamp-2">{post.title}</h3>
        <p className="text-gray-600 text-xs leading-relaxed line-clamp-2 flex-1">{post.excerpt}</p>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-700">
          <span>{formatDate(post.created_at)}</span>
          <span>·</span>
          <span>{post.reading_time ?? 5} min</span>
        </div>
      </div>
    </a>
  )
}

export default function BlogPageClient({ initialPosts }: { initialPosts: Post[] }) {
  const [activeCategory, setActiveCategory] = useState("Tout")

  const featured = initialPosts.filter(p => p.featured)
  const filtered = activeCategory === "Tout"
    ? initialPosts
    : initialPosts.filter(p => p.category === activeCategory)

  const featuredInFiltered = filtered.filter(p => p.featured)
  const regularInFiltered  = filtered.filter(p => !p.featured)

  const popular = [...initialPosts].sort(() => Math.random() - 0.5).slice(0, 5)

  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-16 pb-10">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full mb-4">
            📰 Blog Tradex
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 leading-tight">
            Apprendre à trader,{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">
              intelligemment
            </span>
          </h1>
          <p className="text-gray-400 text-base">
            Articles, guides et analyses pour progresser en trading — du débutant au niveau avancé.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="flex gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                  style={{
                    background: activeCategory === cat
                      ? (cat === "Tout" ? "rgba(74,222,128,0.15)" : getCategoryStyle(cat).bg)
                      : "rgba(255,255,255,0.04)",
                    color: activeCategory === cat
                      ? (cat === "Tout" ? "#4ade80" : getCategoryStyle(cat).text)
                      : "#6b7280",
                    border: activeCategory === cat
                      ? `1px solid ${cat === "Tout" ? "rgba(74,222,128,0.3)" : getCategoryStyle(cat).border}`
                      : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {cat === "Tout" ? "Tout" : `${CATEGORY_ICONS[cat] ?? ""} ${cat}`}
                </button>
              ))}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 font-semibold">Aucun article dans cette catégorie.</p>
                <p className="text-gray-700 text-sm mt-1">Les articles sont générés automatiquement. Revenez bientôt !</p>
              </div>
            )}

            {/* Featured articles */}
            {featuredInFiltered.length > 0 && (
              <div className="space-y-4 mb-8">
                {featuredInFiltered.map(post => (
                  <FeaturedCard key={post.slug} post={post} />
                ))}
              </div>
            )}

            {/* Regular grid */}
            {regularInFiltered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {regularInFiltered.map(post => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            )}

            {/* Newsletter CTA in middle */}
            {filtered.length > 6 && (
              <div className="mt-10">
                <NewsletterSignup source="blog-listing" />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden xl:flex flex-col gap-6 w-72 flex-shrink-0">
            {/* Newsletter */}
            <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-white font-black text-sm mb-1">📬 Newsletter hebdo</h3>
              <p className="text-gray-600 text-xs mb-3">Signaux + articles chaque semaine.</p>
              <NewsletterSignup source="blog-sidebar" compact />
            </div>

            {/* Popular articles */}
            <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-white font-black text-sm mb-4">🔥 Articles populaires</h3>
              <div className="space-y-3">
                {popular.map((post, i) => (
                  <a
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="flex items-start gap-3 group"
                  >
                    <span className="text-gray-700 font-black text-lg w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-snug group-hover:text-green-400 transition line-clamp-2">{post.title}</p>
                      <CategoryBadge category={post.category} small />
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* CTA */}
            <a
              href="/signup"
              className="rounded-2xl p-5 text-center block"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <p className="text-2xl mb-2">🚀</p>
              <h3 className="text-white font-black text-sm mb-1">Pratiquer ce que tu apprends</h3>
              <p className="text-gray-600 text-xs mb-3">Paper trading + signaux IA gratuits.</p>
              <span className="inline-block px-4 py-2 rounded-xl bg-green-500 text-black font-black text-xs">
                Essai gratuit →
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
