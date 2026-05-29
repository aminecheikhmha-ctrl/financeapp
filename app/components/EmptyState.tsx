type Props = {
  icon: string
  title: string
  desc: string
  cta?: { label: string; href?: string; onClick?: () => void }
  size?: "sm" | "md" | "lg"
}

export default function EmptyState({ icon, title, desc, cta, size = "md" }: Props) {
  const sizes = {
    sm: { py: "py-8",  icon: "text-3xl", title: "text-sm",  desc: "text-xs"  },
    md: { py: "py-16", icon: "text-4xl", title: "text-base",desc: "text-sm"  },
    lg: { py: "py-24", icon: "text-5xl", title: "text-lg",  desc: "text-base"},
  }
  const s = sizes[size]

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.py} px-6`}>
      <p className={`${s.icon} mb-4`}>{icon}</p>
      <p className={`font-black text-white ${s.title} mb-2`}>{title}</p>
      <p className={`text-white/35 ${s.desc} max-w-sm leading-relaxed mb-5`}>{desc}</p>
      {cta && (
        cta.href ? (
          <a
            href={cta.href}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--green)" }}
          >
            {cta.label}
          </a>
        ) : (
          <button
            onClick={cta.onClick}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--green)" }}
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  )
}
