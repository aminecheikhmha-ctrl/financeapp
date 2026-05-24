const CACHE_NAME = "financeapp-v1"
const API_CACHE  = "financeapp-api-v1"
const API_TTL    = 5 * 60 * 1000 // 5 minutes

// Static assets to pre-cache
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  )
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // API routes — cache with TTL
  if (url.pathname.startsWith("/api/quote") ||
      url.pathname.startsWith("/api/signals") ||
      url.pathname.startsWith("/api/price")) {
    event.respondWith(apiCacheStrategy(request))
    return
  }

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Pages — network first, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request))
    return
  }
})

// ── Strategies ─────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response("Offline", { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response(offlinePage(), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })
  }
}

async function apiCacheStrategy(request) {
  const cache = await caches.open(API_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    const cachedTime = cached.headers.get("sw-cached-at")
    if (cachedTime && Date.now() - Number(cachedTime) < API_TTL) {
      // Add offline indicator header
      const offlineResponse = new Response(cached.body, {
        status: cached.status,
        headers: new Headers(cached.headers),
      })
      offlineResponse.headers.set("sw-from-cache", "true")
      return offlineResponse
    }
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const body = await response.text()
      const newResponse = new Response(body, {
        status: response.status,
        headers: new Headers({
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "sw-cached-at": String(Date.now()),
        }),
      })
      cache.put(request, newResponse.clone())
      return new Response(body, { status: response.status, headers: response.headers })
    }
    return response
  } catch {
    if (cached) {
      const offlineResponse = new Response(cached.body, {
        status: 200,
        headers: new Headers({
          "Content-Type": "application/json",
          "sw-from-cache": "true",
          "sw-offline": "true",
        }),
      })
      return offlineResponse
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }
}

// ── Background Sync (ordres hors ligne) ────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    event.waitUntil(syncPendingOrders())
  }
})

async function syncPendingOrders() {
  try {
    const db = await openDB()
    const pendingOrders = await db.getAll("pending-orders")
    for (const order of pendingOrders) {
      const response = await fetch("/api/trading/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${order.token}` },
        body: JSON.stringify(order.payload),
      })
      if (response.ok) {
        await db.delete("pending-orders", order.id)
      }
    }
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("financeapp-offline", 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("pending-orders", { keyPath: "id", autoIncrement: true })
    }
    req.onsuccess = (e) => {
      const db = e.target.result
      db.getAll = (store) => new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly")
        const req = tx.objectStore(store).getAll()
        req.onsuccess = () => res(req.result)
        req.onerror = rej
      })
      db.delete = (store, id) => new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite")
        const req = tx.objectStore(store).delete(id)
        req.onsuccess = res
        req.onerror = rej
      })
      resolve(db)
    }
    req.onerror = reject
  })
}

self.addEventListener("push", (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url },
      actions: [
        { action: "open", title: "Voir le signal" },
        { action: "close", title: "Fermer" },
      ],
      tag: "financeapp-notification",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "close") return
  const url = event.notification.data?.url ?? "/dashboard"
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

function offlinePage() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinanceApp — Hors ligne</title>
  <style>
    body { margin:0; background:#080808; color:#fff; font-family:system-ui,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; text-align:center; }
    .logo { width:56px; height:56px; border-radius:12px; background:linear-gradient(135deg,#4ade80,#059669); display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; color:#000; margin:0 auto 24px; }
    h1 { font-size:24px; font-weight:900; margin-bottom:8px; }
    p { color:#6b7280; font-size:14px; margin-bottom:24px; }
    a { background:#4ade80; color:#000; padding:12px 24px; border-radius:12px; text-decoration:none; font-weight:700; font-size:14px; }
  </style>
</head>
<body>
  <div>
    <div class="logo">F</div>
    <h1>Vous êtes hors ligne</h1>
    <p>Vérifiez votre connexion internet et réessayez.</p>
    <a href="/dashboard">Réessayer</a>
  </div>
</body>
</html>`
}
