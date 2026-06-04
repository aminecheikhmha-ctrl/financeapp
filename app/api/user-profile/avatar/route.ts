import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'placeholder'
  )
}

export async function POST(req: NextRequest) {
  // Auth
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = getServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Parse multipart form
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const file = formData.get("avatar") as File | null
  if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

  // Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Format invalide. Utilisez JPEG, PNG ou WebP." }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Fichier trop volumineux. Maximum 2 Mo." }, { status: 400 })
  }

  // Build storage path: avatars/{userId}/avatar.{ext}
  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const path = `${user.id}/avatar.${ext}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error("[avatar] upload error:", uploadError)
    return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
  // Append cache-busting timestamp so browsers reload
  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

  // Update user_profiles
  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id)

  if (updateError) {
    console.error("[avatar] db update error:", updateError)
    return NextResponse.json({ error: "Erreur lors de la mise à jour du profil" }, { status: 500 })
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = getServiceClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Remove all avatar files for this user
  const { data: files } = await supabase.storage.from("avatars").list(user.id)
  if (files && files.length > 0) {
    const paths = files.map(f => `${user.id}/${f.name}`)
    await supabase.storage.from("avatars").remove(paths)
  }

  // Clear avatar_url in profile
  await supabase.from("user_profiles").update({ avatar_url: null }).eq("id", user.id)

  return NextResponse.json({ success: true })
}
