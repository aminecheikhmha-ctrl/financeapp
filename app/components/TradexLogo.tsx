type Props = {
  size?: number
  showText?: boolean
  textSize?: "xs" | "sm" | "md" | "lg" | "xl"
  variant?: "default" | "white" | "black"
  className?: string
}

export default function TradexLogo({
  size = 32,
  showText = false,
  textSize = "md",
  variant = "default",
  className = "",
}: Props) {
  const textSizeMap = {
    xs: "11px",
    sm: "13px",
    md: "15px",
    lg: "20px",
    xl: "26px",
  }

  const iconBg =
    variant === "white"
      ? "rgba(255,255,255,0.15)"
      : variant === "black"
      ? "rgba(0,0,0,0.2)"
      : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"

  const iconShadow =
    variant === "default"
      ? `0 0 ${Math.round(size * 0.5)}px rgba(34,197,94,0.3), 0 ${Math.round(size * 0.1)}px ${Math.round(size * 0.35)}px rgba(0,0,0,0.3)`
      : "none"

  const letterColor = variant === "black" ? "#000" : "#fff"
  const textColor   = variant === "black" ? "#000" : "#fff"

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      style={{ userSelect: "none" }}
    >
      {/* Icon box */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          background: iconBg,
          boxShadow: iconShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* SVG — lettre T stylisée avec tendance haussière */}
        <svg
          viewBox="0 0 100 100"
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Barre horizontale */}
          <rect x="12" y="18" width="76" height="18" rx="9" fill={letterColor} />
          {/* Barre verticale */}
          <rect x="38" y="32" width="24" height="40" rx="8" fill={letterColor} />
          {/* Mini flèche trend */}
          <polyline
            points="64,58 78,40 92,58"
            stroke={`${letterColor}55`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <line
            x1="78" y1="40" x2="78" y2="72"
            stroke={`${letterColor}55`}
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <span
          style={{
            fontSize: textSizeMap[textSize],
            fontWeight: 900,
            color: textColor,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Tradex
        </span>
      )}
    </div>
  )
}
