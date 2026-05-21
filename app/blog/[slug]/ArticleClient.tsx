"use client"

import { useState, useEffect } from "react"
import NewsletterSignup from "@/app/components/NewsletterSignup"

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  tags?: string[]
  reading_time?: number
  featured?: boolean
  created_at: string
  updated_at?: string
}

type SimilarPost = {
  id: string
  slug: string
  title: string
  category: string
  reading_time?: number
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

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bg: "rgba(255,255,255,0.08)", text: "#9ca3af", border: "rgba(255,255,255,0.12)" }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
}

// Extract headings for table of contents
function extractHeadings(content: string): { level: number; text: string; id: string }[] {
  const lines = content.split("\n")
  const headings: { level: number; text: string; id: string }[] = []
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+)/)
    if (m) {
      const text = m[2].replace(/[*`]/g, "")
      const id   = text.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, "-").replace(/^-|-$/g, "")
      headings.push({ level: m[1].length, text, id })
    }
  }
  return headings
}

// Minimal markdown renderer (no external dependency)
function renderMarkdown(content: string): string {
  let html = content
    // Headings
    .replace(/^### (.+)$/gm, (_m, t) => {
      const id = t.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, "-").replace(/^-|-$/g, "")
      return `<h3 id="${id}" class="md-h3">${t}</h3>`
    })
    .replace(/^## (.+)$/gm, (_m, t) => {
      const id = t.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, "-").replace(/^-|-$/g, "")
      return `<h2 id="${id}" class="md-h2">${t}</h2>`
    })
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li">$1</li>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="md-bq">$1</blockquote>')
    // Paragraphs (lines not already wrapped)
    .replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="md-p">$1</p>')
    // Double newlines -> spacing
    .replace(/\n\n/g, "\n")

  return html
}

export default function ArticleClient({
  post,
  similar,
  baseUrl,
}: {
  post: Post
  similar: SimilarPost[]
  baseUrl: string
}) {
  const [copied, setCopied] = useState(false)
  const headings = extractHeadings(post.content)
  const catStyle = getCategoryStyle(post.category)
  const articleUrl = `${baseUrl}/blog/${post.slug}`

  function copyLink() {
    navigator.clipboard.writeText(articleUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Scroll spy for TOC
  const [activeId, setActiveId] = useState("")
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id)
        }
      },
      { rootMargin: "-20% 0% -70% 0%" }
    )
    headings.forEach(h => {
      const el = document.getElementById(h.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  return (
    <div className="min-h-screen" style={{ background: "#080808", color: "#e5e7eb" }}>
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <a href="/" className="hover:text-gray-400 transition">Accueil</a>
          <span>/</span>
          <a href="/blog" className="hover:text-gray-400 transition">Blog</a>
          <span>/</span>
          <span className="text-gray-400 truncate max-w-xs">{post.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="flex gap-12">
          {/* ── Article ── */}
          <article className="flex-1 min-w-0">
            {/* Header */}
            <header className="mb-10 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}
                >
                  {post.category}
                </span>
                {post.featured && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    ⭐ À la une
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">{post.title}</h1>
              <p className="text-gray-400 text-base leading-relaxed mb-5">{post.excerpt}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 pb-5 border-b border-white/[0.06]">
                <span>📅 {formatDate(post.created_at)}</span>
                <span>⏱ {post.reading_time ?? 5} min de lecture</span>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {post.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 bg-white/5">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Share buttons */}
              <div className="flex items-center gap-2 pt-4">
                <span className="text-xs text-gray-600">Partager :</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(articleUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{ background: "rgba(29,161,242,0.1)", color: "#1da1f2", border: "1px solid rgba(29,161,242,0.2)" }}
                >
                  𝕏 Twitter
                </a>
                <a
                  href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                  style={{ background: "rgba(10,102,194,0.1)", color: "#0a66c2", border: "1px solid rgba(10,102,194,0.2)" }}
                >
                  in LinkedIn
                </a>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition text-gray-400 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {copied ? "✅ Copié" : "🔗 Copier"}
                </button>
              </div>
            </header>

            {/* Article content */}
            <div
              className="article-content"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
            />

            {/* Newsletter CTA */}
            <div className="mt-12">
              <NewsletterSignup source="blog-article" />
            </div>

            {/* CTA to dashboard */}
            <div
              className="mt-8 rounded-2xl p-6 text-center"
              style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <h3 className="text-white font-black text-lg mb-2">Pratiquer ce que tu viens d'apprendre →</h3>
              <p className="text-gray-400 text-sm mb-4">
                Applique ces concepts en temps réel avec les signaux IA et le paper trading FinanceApp.
              </p>
              <a
                href="/dashboard"
                className="inline-block px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-sm transition shadow-lg shadow-green-500/25"
              >
                Accéder au Dashboard →
              </a>
            </div>

            {/* Similar articles */}
            {similar.length > 0 && (
              <div className="mt-12">
                <h2 className="text-white font-black text-lg mb-4">Articles similaires</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {similar.map(s => {
                    const sc = getCategoryStyle(s.category)
                    return (
                      <a
                        key={s.slug}
                        href={`/blog/${s.slug}`}
                        className="rounded-xl p-4 hover:scale-[1.02] transition group"
                        style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-2"
                          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                        >
                          {s.category}
                        </span>
                        <p className="text-white text-sm font-semibold leading-snug group-hover:text-green-400 transition">{s.title}</p>
                        <p className="text-gray-700 text-xs mt-1">{s.reading_time ?? 5} min</p>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </article>

          {/* ── Sidebar ── */}
          <aside className="hidden xl:flex flex-col gap-6 w-64 flex-shrink-0 pt-4">
            {/* TOC */}
            {headings.length > 0 && (
              <div className="sticky top-20 rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-white font-black text-xs uppercase tracking-wider mb-3">📑 Sommaire</h3>
                <nav className="space-y-1">
                  {headings.map(h => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="block text-xs leading-relaxed transition truncate"
                      style={{
                        paddingLeft: h.level === 3 ? 12 : 0,
                        color: activeId === h.id ? "#4ade80" : "#6b7280",
                        fontWeight: activeId === h.id ? 600 : 400,
                      }}
                    >
                      {h.level === 3 ? "↳ " : ""}{h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* Share */}
            <div className="rounded-2xl p-5" style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-white font-black text-xs uppercase tracking-wider mb-3">Partager</h3>
              <div className="space-y-2">
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(articleUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition w-full"
                  style={{ background: "rgba(29,161,242,0.08)", color: "#1da1f2", border: "1px solid rgba(29,161,242,0.15)" }}>
                  𝕏 Partager sur Twitter
                </a>
                <a href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition w-full"
                  style={{ background: "rgba(10,102,194,0.08)", color: "#0a66c2", border: "1px solid rgba(10,102,194,0.15)" }}>
                  in Partager sur LinkedIn
                </a>
                <button onClick={copyLink}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition w-full text-gray-400 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {copied ? "✅ Lien copié !" : "🔗 Copier le lien"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Article styles */}
      <style>{`
        .article-content .md-h1 { font-size:28px; font-weight:900; color:#fff; margin:32px 0 16px; line-height:1.2; }
        .article-content .md-h2 { font-size:22px; font-weight:800; color:#fff; margin:28px 0 12px; line-height:1.3; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06); }
        .article-content .md-h3 { font-size:17px; font-weight:700; color:#e5e7eb; margin:20px 0 8px; }
        .article-content .md-p  { font-size:15px; line-height:1.8; color:#9ca3af; margin:0 0 14px; }
        .article-content .md-ul { margin:0 0 14px 20px; }
        .article-content .md-li { font-size:15px; line-height:1.7; color:#9ca3af; margin-bottom:4px; list-style:disc; }
        .article-content .md-code { font-family:monospace; font-size:13px; background:rgba(255,255,255,0.06); color:#a78bfa; padding:2px 6px; border-radius:4px; }
        .article-content .md-bq  { border-left:3px solid #4ade80; padding:8px 16px; color:#6b7280; font-style:italic; background:rgba(74,222,128,0.05); border-radius:0 8px 8px 0; margin:16px 0; }
        .article-content strong  { color:#e5e7eb; font-weight:700; }
        .article-content em      { color:#d1d5db; font-style:italic; }
      `}</style>
    </div>
  )
}
