"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Forum() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [titre, setTitre] = useState("")
  const [contenu, setContenu] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    fetchPosts()
  }, [])

  async function fetchPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*, commentaires(count)")
      .order("created_at", { ascending: false })
    if (data) setPosts(data)
  }

  async function handlePost() {
    if (!titre || !contenu) return
    setLoading(true)

    let image_url = null
    if (image) {
      const fileName = `${Date.now()}_${image.name}`
      const { data: uploadData } = await supabase.storage
        .from("forum")
        .upload(fileName, image)
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("forum")
          .getPublicUrl(fileName)
        image_url = urlData.publicUrl
      }
    }

    await supabase.from("posts").insert({
      titre,
      contenu,
      user_email: user.email,
      image_url,
    })

    setTitre("")
    setContenu("")
    setImage(null)
    setShowForm(false)
    fetchPosts()
    setLoading(false)
  }

  async function supprimerPost(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm("Supprimer ce post ?")) return
    await supabase.from("posts").delete().eq("id", id)
    fetchPosts()
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

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Forum</h1>
            <p className="text-gray-400 mt-1">Discute, partage tes analyses, pose tes questions</p>
          </div>
          {user ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              + Nouveau post
            </button>
          ) : (
            <a href="/login" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition">
              Connexion pour poster
            </a>
          )}
        </div>

        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Nouveau post</h2>
            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Titre de ton post"
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
              />
              <textarea
                value={contenu}
                onChange={(e) => setContenu(e.target.value)}
                placeholder="Écris ton message..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
              />
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Image (optionnel)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-green-500"
                />
              </div>
              <button
                onClick={handlePost}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-semibold transition w-fit"
              >
                {loading ? "Publication..." : "Publier"}
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center text-gray-400 py-24">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-xl">Aucun post pour l'instant</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => router.push(`/forum/${post.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 cursor-pointer transition"
              >
                {post.image_url && (
                  <img src={post.image_url} alt="post" className="w-full rounded-lg mb-4 max-h-64 object-cover" />
                )}
                <h2 className="text-xl font-semibold mb-2">{post.titre}</h2>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{post.contenu}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>{post.user_email}</span>
                    <span>💬 {post.commentaires?.[0]?.count ?? 0}</span>
                    <span>{timeAgo(post.created_at)}</span>
                  </div>
                  {(user?.email === post.user_email || user?.email === 'amine_cm@icloud.com') && (
                    <button
                      onClick={(e) => supprimerPost(e, post.id)}
                      className="text-red-400 hover:text-red-300 transition text-xs px-3 py-1 border border-red-400/30 rounded-lg"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}