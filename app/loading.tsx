export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-400 animate-spin" />
        </div>
        <p className="text-gray-600 text-sm font-medium tracking-wide">Chargement…</p>
      </div>
    </div>
  )
}
