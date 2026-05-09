"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const ADMIN_EMAIL = "amine_cm@icloud.com"

export default function AdminPreuves() {
  const router = useRouter()
  const [preuves, setPreuves] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || data.user.email !== ADMIN_EMAIL) {
        router.push("/")
        return
      }
      setUser(data.user)
      fetchPreuves()
    })
  }, [])

  async function fetchPreuves() {
    const { data } = await supabase
      .from("preuves")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setPreuves(data)
  }

  async function approuver(id: string) {
    await supabase.from("preuves").update({ approuve: true }).eq("id", id)
    fetchPreuves()
  }

  async function supprimer(id: string) {
    await supabase.from("preuves").delete().eq("id", id)
    fetchPreuves()
  }

  const enAttente = preuves.filter((p) => !p.approuve)
  const approuvees = preuves.filter((p) => p.approuve)

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-3xl font-bold mb-2">Admin — Modération preuves</h1>
        <p className="text-gray-400 mb-8">Approuve ou supprime les preuves soumises</p>

        {/* En attente */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">
            ⏳ En attente ({enAttente.length})
          </h2>
          {enAttente.length === 0 ? (
            <p className="text-gray-400">Aucune preuve en attente</p>
          ) : (
            <div className="flex flex-col gap-4">
              {enAttente.map((p) => (
                <div key={p.id} className="bg-gray-900 border border-yellow-500/30 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-xl">{p.ticker}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${p.type === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {p.type}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">{p.user_email}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                    <div><p className="text-gray-400">Entrée</p><p>${p.entree}</p></div>
                    <div><p className="text-gray-400">Sortie</p><p>${p.sortie}</p></div>
                    <div><p className="text-gray-400">Date</p><p>{p.date}</p></div>
                  </div>
                  {p.description && <p className="text-gray-400 text-sm mb-4">{p.description}</p>}
                  {p.image_url && <img src={p.image_url} alt="preuve" className="w-full rounded-lg mb-4" />}
                  <div className="flex gap-3">
                    <button
                      onClick={() => approuver(p.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold transition"
                    >
                      ✓ Approuver
                    </button>
                    <button
                      onClick={() => supprimer(p.id)}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-6 py-2 rounded-lg font-semibold transition"
                    >
                      ✕ Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approuvées */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-green-400">
            ✓ Approuvées ({approuvees.length})
          </h2>
          {approuvees.length === 0 ? (
            <p className="text-gray-400">Aucune preuve approuvée</p>
          ) : (
            <div className="flex flex-col gap-4">
              {approuvees.map((p) => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{p.ticker}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${p.type === "LONG" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {p.type}
                      </span>
                    </div>
                    <button
                      onClick={() => supprimer(p.id)}
                      className="text-red-400 hover:text-red-300 text-sm transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}