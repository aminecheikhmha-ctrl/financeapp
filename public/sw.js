const CACHE_VERSION = "tradex-v5"
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const API_CACHE     = `${CACHE_VERSION}-api`
const API_TTL       = 5 * 60 * 1000 // 5 min

// Only cache truly static assets — NOT app pages (they update with each deploy)
const STATIC_ASSETS = [
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Activate — purge old caches ────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Same-origin only
  if (url.origin !== self.location.origin) return

  // API → Network first with short cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstAPI(request))
    return
  }

  // Static Next.js assets → Cache first (immutable)
  if (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icon") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".svg") ||
      url.pathname === "/manifest.json") {
    event.respondWith(cacheFirst(request))
    return
  }

  // Pages → Network first (always fresh), fallback to cache only when offline
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request))
    return
  }
})

// ── Strategies ─────────────────────────────────────────────────────────────────

async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) })
    if (response.ok) {
      const body = await response.text()
      const cached = new Response(body, {
        status: response.status,
        headers: new Headers({
          "Content-Type": response.headers.get("Content-Type") || "application/json",
          "sw-cached-at": String(Date.now()),
        }),
      })
      cache.put(request, cached.clone())
      return new Response(body, { status: response.status, headers: response.headers })
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      const cachedAt = cached.headers.get("sw-cached-at")
      if (cachedAt && Date.now() - Number(cachedAt) < API_TTL) {
        const headers = new Headers(cached.headers)
        headers.set("sw-from-cache", "true")
        return new Response(cached.body, { status: cached.status, headers })
      }
    }
    return new Response(JSON.stringify({ error: "Offline", cached: false }), {
      headers: { "Content-Type": "application/json" },
      status: 503,
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response("Not found", { status: 404 })
  }
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      // Cache for offline fallback only
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Offline fallback
    const cached = await caches.match(request)
    return cached ?? caches.match("/offline") ?? new Response("Offline", { status: 503 })
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "TradEx", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: data.url ?? "/dashboard" },
      tag: "tradex-notification",
      renotify: true,
      requireInteraction: false,
      actions: [
        { action: "open",    title: "Voir →"    },
        { action: "dismiss", title: "Ignorer"   },
      ],
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "dismiss") return
  const url = event.notification.data?.url ?? "/dashboard"
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
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

// ── Background Sync ────────────────────────────────────────────────────────────
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
      try {
        const response = await fetch("/api/trading/order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${order.token ?? ""}` },
          body: JSON.stringify(order.payload ?? order),
        })
        if (response.ok) await db.delete("pending-orders", order.id)
      } catch {}
    }
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tradex-offline", 1)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("pending-orders", { keyPath: "id", autoIncrement: true })
    }
    req.onsuccess = (e) => {
      const db = e.target.result
      db.getAll = (store) => new Promise((res, rej) => {
        const tx = db.transaction(store, "readonly")
        const r = tx.objectStore(store).getAll()
        r.onsuccess = () => res(r.result)
        r.onerror = rej
      })
      db.delete = (store, id) => new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite")
        const r = tx.objectStore(store).delete(id)
        r.onsuccess = res
        r.onerror = rej
      })
      resolve(db)
    }
    req.onerror = reject
  })
}
