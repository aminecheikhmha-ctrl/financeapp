/**
 * Tradex UI — Composants unifiés
 * Tous les éléments de base doivent venir d'ici.
 */

import { cn } from "@/lib/utils"
import { type ReactNode, forwardRef } from "react"

// ── Card ──────────────────────────────────────────────────────────────────────
type CardProps = {
  children: ReactNode
  className?: string
  variant?: "default" | "elevated" | "accent" | "ghost"
  interactive?: boolean
  style?: React.CSSProperties
  onClick?: () => void
}

export function Card({ children, className, variant = "default", interactive, style, onClick }: CardProps) {
  const base = "rounded-[14px] transition-all"
  const variants = {
    default:  "bg-[var(--bg-surface)] border border-[var(--border-subtle)]",
    elevated: "bg-[var(--bg-elevated)] border border-[var(--border-subtle)]",
    accent:   "bg-[var(--bg-surface)] border border-[var(--border-accent)] shadow-[0_0_32px_var(--green-glow)]",
    ghost:    "bg-transparent border border-[var(--border-faint)]",
  }
  const hoverClass = interactive
    ? "cursor-pointer hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px]"
    : ""

  return (
    <div className={cn(base, variants[variant], hoverClass, className)} style={style} onClick={onClick}>
      {children}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
type StatCardProps = {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: string
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function StatCard({ label, value, sub, color, icon, trend, className }: StatCardProps) {
  const trendColor = trend === "up" ? "var(--green-light)" : trend === "down" ? "var(--red-light)" : undefined
  const trendIcon  = trend === "up" ? "▲" : trend === "down" ? "▼" : undefined
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </p>
        {icon && <span className="text-base opacity-60">{icon}</span>}
      </div>
      <p className="text-[22px] font-black tabular-nums leading-none"
        style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </p>
      {(sub || trendIcon) && (
        <p className="text-[11px] mt-1.5 flex items-center gap-1"
          style={{ color: trendColor ?? "var(--text-tertiary)" }}>
          {trendIcon && <span>{trendIcon}</span>}
          {sub}
        </p>
      )}
    </Card>
  )
}

// ── PageHeader ────────────────────────────────────────────────────────────────
type PageHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6 flex-wrap", className)}>
      <div>
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--green-light)" }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-[20px] font-black text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] mt-1" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeProps = {
  children: ReactNode
  variant?: "green" | "red" | "yellow" | "blue" | "purple" | "neutral"
  size?: "sm" | "md"
  dot?: boolean
  className?: string
}

export function Badge({ children, variant = "neutral", size = "md", dot, className }: BadgeProps) {
  const variants = {
    green:  "bg-[var(--green-dim)]  text-[var(--green-light)]  border border-[var(--green-border)]",
    red:    "bg-[var(--red-dim)]    text-[var(--red-light)]    border border-[var(--red-border)]",
    yellow: "bg-[var(--yellow-dim)] text-[var(--yellow-light)] border border-[rgba(245,158,11,0.22)]",
    blue:   "bg-[var(--blue-dim)]   text-[var(--blue-light)]   border border-[rgba(59,130,246,0.22)]",
    purple: "bg-[var(--purple-dim)] text-[var(--purple-light)] border border-[rgba(139,92,246,0.22)]",
    neutral:"bg-[var(--bg-active)]  text-[var(--text-secondary)] border border-[var(--border-default)]",
  }
  const sizes = {
    sm: "px-1.5 py-0.5 text-[9px]",
    md: "px-2 py-0.5 text-[10px]",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full font-bold", variants[variant], sizes[size], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{
        background: variant === "green" ? "var(--green-light)" :
                    variant === "red"   ? "var(--red-light)"   :
                    variant === "yellow"? "var(--yellow-light)" : "currentColor",
        animation: "live-pulse 2s infinite",
      }} />}
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
type ButtonProps = {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
  type?: "button" | "submit"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "primary", size = "md", loading, disabled, className, onClick, style, type = "button" }, ref) => {
    const variants = {
      primary:   "bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-black font-black shadow-[var(--shadow-green-strong)] hover:shadow-[0_6px_28px_rgba(34,197,94,0.42)] hover:-translate-y-px",
      secondary: "bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[rgba(255,255,255,0.09)] hover:border-[var(--border-strong)]",
      ghost:     "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
      danger:    "bg-[rgba(239,68,68,0.10)] text-[var(--red-light)] border border-[rgba(239,68,68,0.22)] hover:bg-[rgba(239,68,68,0.18)]",
    }
    const sizes = {
      sm: "h-7 px-3 text-[11px] rounded-[8px]",
      md: "h-9 px-4 text-[13px] rounded-[10px]",
      lg: "h-11 px-5 text-[14px] rounded-[12px]",
    }
    return (
      <button ref={ref} type={type} onClick={onClick} disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold",
          "transition-all cursor-pointer select-none",
          "active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none",
          variants[variant], sizes[size], className,
        )}
        style={style}>
        {loading && (
          <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

// ── EmptyState ────────────────────────────────────────────────────────────────
type EmptyStateProps = {
  icon: string
  title: string
  description: string
  action?: () => void
  actionLabel?: string
  className?: string
}

export function EmptyState({ icon, title, description, action, actionLabel, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center", className)}>
      <div className="text-5xl mb-4 opacity-50">{icon}</div>
      <p className="text-[16px] font-black text-white mb-2">{title}</p>
      <p className="text-[13px] max-w-[260px] leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
      {action && actionLabel && (
        <Button variant="primary" onClick={action}>{actionLabel}</Button>
      )}
    </div>
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────
export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px", className)} style={{ background: "var(--border-subtle)" }} />
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
type SkeletonProps = { className?: string; width?: string; height?: string }

export function Skeleton({ className, width, height }: SkeletonProps) {
  return <div className={cn("skeleton", className)} style={{ width, height }} />
}

// ── Section ───────────────────────────────────────────────────────────────────
type SectionProps = {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <div className={cn("mb-6", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              {title}
            </p>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
