"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Preuve = {
  id: string
  ticker: string
  type: "LONG" | "SHORT"
  entree: number
  sortie: number
  date: string
  description: string
  image_url: string | null
  created_at: string
}

export default function Preuves() {
  const [preuves, setPreuves] = useState<Preuve[]>([])
  const [user, setUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    ticker: "",
    type: "LONG",
    entree: "",
    sortie: "",
    date: "",
    description: "",
  })
  const [image, setImage] = useState<File | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchPreuves()
  }, [])

  async function fetchPreuves() {
    const { data } = await supabase
      .from("preuves")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setPreuves(data)
  }

  async function handleSubmit() {
    if (!form.ticker || !form.entree || !form.sortie || !form.date) return
    setLoading(true)

    let image_url = null

    if (image) {
      const fileName = `${Date.now()}_${image.name}`
      const { data: uploadData } = await supabase.storage
        .from("preuves")
        .upload(fileName, image)
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("preuves")
          .getPublicUrl(fileName)
        image_url = urlData.publicUrl
      }
    }

   await supabase.from("preuves").insert({
      ticker: form.ticker.toUpperCase(),
      type: form.type,
      entree: parseFloat(form.entree),
      sortie: parseFloat(form.sortie),
      date: form.date,
      description: form.description,
      image_url,
      user_email: user.email,
      approuve: false,
    })

    setForm({ ticker: "", type: "LONG", entree: "", sortie: "", date: "", description: "" })
    setImage(null)
    setShowForm(false)
    fetchPreuves()
    setLoading(false)
  }

  function calcPnl(entree: number, sortie: number, type: string) {
    const pnl = type === "LONG" ? ((sortie - entree) / entree) * 100 : ((entree - sortie) / entree) * 100
    return pnl.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Preuves de trades</h1>
            <p className="text-gray-400 mt-1">Historique transparent de toutes les positions</p>
          </div>
          {user && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              + Ajouter une preuve
            </button>
          )}
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6">Nouveau trade</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Ticker</label>
                <input
                  type="text"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                  placeholder="AAPL"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                >
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Prix d'entrée</label>
                <input
                  type="number"
                  value={form.entree}
                  onChange={(e) => setForm({ ...form, entree: e.target.value })}
                  placeholder="150.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Prix de sortie</label>
                <input
                  type="number"
                  value={form.sortie}
                  onChange={(e) => setForm({ ...form, sortie: e.target.value })}
                  placeholder="175.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Screenshot (optionnel)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explique ton analyse, pourquoi ce trade..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              {loading ? "Publication..." : "Publier la preuve"}
            </button>
          </div>
        )}

        {/* Liste des preuves */}
        {preuves.length === 0 ? (
          <div className="text-center text-gray-400 py-24">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-xl">Aucune preuve pour l'instant</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {preuves.map((preuve) => {
              const pnl = parseFloat(calcPnl(preuve.entree, preuve.sortie, preuve.type))
              return (
                <div key={preuve.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-xl">{preuve.ticker}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${preuve.type === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {preuve.type}
                      </span>
                    </div>
                    <span className={`text-xl font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}{pnl}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-400">Entrée</p>
                      <p className="text-white font-semibold">${preuve.entree}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Sortie</p>
                      <p className="text-white font-semibold">${preuve.sortie}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Date</p>
                      <p className="text-white font-semibold">{preuve.date}</p>
                    </div>
                  </div>
                  {preuve.description && (
                    <p className="text-gray-400 text-sm mb-4">{preuve.description}</p>
                  )}
                  {preuve.image_url && (
                    <img src={preuve.image_url} alt="preuve" className="w-full rounded-lg" />
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}