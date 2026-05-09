"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams, useRouter } from "next/navigation"

export default function Post() {
  const { id } = useParams()
  const router = useRouter()
  const [post, setPost] = useState<any>(null)
  const [commentaires, setCommentaires] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [contenu, setContenu] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchPost()
    fetchCommentaires()
  }, [])

  async function fetchPost() {
    const { data } = await supabase.from("posts").select("*").eq("id", id).single()
    if (data) setPost(data)
  }

  async function fetchCommentaires() {
    const { data } = await supabase
      .from("commentaires")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true })
    if (data) setCommentaires(data)
  }

  async function handleComment() {
    if (!contenu) return
    setLoading(true)
    await supabase.from("commentaires").insert({
      post_id: id,
      contenu,
      user_email: user.email,
    })
    setContenu("")
    fetchCommentaires()
    setLoading(false)
  }

  async function supprimerCommentaire(commentId: string) {
    if (!confirm("Supprimer ce commentaire ?")) return
    await supabase.from("commentaires").delete().eq("id", commentId)
    fetchCommentaires()
  }

  async function supprimerPost() {
    if (!confirm("Supprimer ce post et tous ses commentaires ?")) return
    await supabase.from("posts").delete().eq("id", id)
    router.push("/forum")
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date + "Z").getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 2) return "à l'instant"
    if (mins < 60) return `il y a ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `il y a ${hours}h`
    return `il y a ${Math.floor(hours / 24)}j`
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(date + "Z"))
  }

  if (!post) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-400">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        <button
          onClick={() => router.push("/forum")}
          className="text-gray-400 hover:text-white transition mb-6 flex items-center gap-2"
        >
          ← Retour au forum
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
          {post.image_url && (
            <img src={post.image_url} alt="post" className="w-full rounded-lg mb-6" />
          )}
          <h1 className="text-3xl font-bold mb-4">{post.titre}</h1>
          <p className="text-gray-300 leading-relaxed mb-6">{post.contenu}</p>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>{post.user_email}</span>
              <span>{formatDate(post.created_at)}</span>
            </div>
            {(user?.email === post.user_email || user?.email === 'amine_cm@icloud.com') && (
              <button
                onClick={supprimerPost}
                className="text-red-400 hover:text-red-300 transition text-xs px-3 py-1 border border-red-400/30 rounded-lg"
              >
                Supprimer le post
              </button>
            )}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">
          {commentaires.length} commentaire{commentaires.length > 1 ? "s" : ""}
        </h2>

        <div className="flex flex-col gap-4 mb-8">
          {commentaires.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-300 mb-3">{c.contenu}</p>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span>{c.user_email}</span>
                  <span>{timeAgo(c.created_at)}</span>
                </div>
                {(user?.email === c.user_email || user?.email === 'amine_cm@icloud.com') && (
                  <button
                    onClick={() => supprimerCommentaire(c.id)}
                    className="text-red-400 hover:text-red-300 transition text-xs px-3 py-1 border border-red-400/30 rounded-lg"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {user ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Ajouter un commentaire</h3>
            <textarea
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Écris ton commentaire..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500 mb-4"
            />
            <button
              onClick={handleComment}
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              {loading ? "Envoi..." : "Commenter"}
            </button>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-gray-400 mb-4">Connecte-toi pour commenter</p>
            <a href="/login" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition">
              Se connecter
            </a>
          </div>
        )}

      </div>
    </div>
  )
}