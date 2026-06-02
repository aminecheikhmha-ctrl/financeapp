export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="border-b border-white/5 px-6 py-4">
        <a href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm text-black"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>T</div>
          <span className="font-black text-white">Tradex</span>
        </a>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {children}
      </div>
      <footer className="border-t border-white/5 py-6 px-6 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-white/25 flex-wrap">
          <a href="/legal/terms"    className="hover:text-white transition">CGU</a>
          <a href="/legal/privacy"  className="hover:text-white transition">Confidentialité</a>
          <a href="/legal/cookies"  className="hover:text-white transition">Cookies</a>
          <a href="/legal/mentions" className="hover:text-white transition">Mentions légales</a>
        </div>
      </footer>
    </div>
  )
}
