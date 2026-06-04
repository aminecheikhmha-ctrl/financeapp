"use client"

type Shortcut = { keys: string[]; description: string }

const SECTIONS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: "Trading",
    shortcuts: [
      { keys: ["B"], description: "Ouvrir modal Achat" },
      { keys: ["S"], description: "Ouvrir modal Vente / Short" },
      { keys: ["Esc"], description: "Fermer modal" },
    ],
  },
  {
    title: "Navigation actifs",
    shortcuts: [
      { keys: ["1"], description: "Actif 1 de la watchlist" },
      { keys: ["2"], description: "Actif 2 de la watchlist" },
      { keys: ["3"], description: "Actif 3 de la watchlist" },
      { keys: ["4"], description: "Actif 4 de la watchlist" },
      { keys: ["5"], description: "Actif 5 de la watchlist" },
      { keys: ["6"], description: "Actif 6 de la watchlist" },
    ],
  },
  {
    title: "Interface",
    shortcuts: [
      { keys: ["T"], description: "Ouvrir / fermer panneau Trade" },
      { keys: ["?"], description: "Afficher les raccourcis" },
    ],
  },
]

export default function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--bg-elevated, #0d0d0d)", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-black text-white">Raccourcis clavier</h2>
            <p className="text-xs text-white/30 mt-0.5">Disponibles sur le dashboard</p>
          </div>
          <button onClick={onClose}
            className="text-white/30 hover:text-white transition text-xl leading-none">×</button>
        </div>

        <div className="space-y-5">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-black text-white/25 uppercase tracking-widest mb-2">
                {section.title}
              </p>
              <div className="space-y-1.5">
                {section.shortcuts.map(s => (
                  <div key={s.description}
                    className="flex items-center justify-between py-1.5 px-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-sm text-white/60">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map(k => (
                        <kbd key={k}
                          className="px-2 py-0.5 rounded-md text-xs font-black text-white/80 font-mono"
                          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-white/20 text-center mt-5">
          Appuie sur <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.08)" }}>?</kbd> pour afficher / masquer
        </p>
      </div>
    </div>
  )
}
