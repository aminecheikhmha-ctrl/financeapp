// Gère les deep links universels
// tradex://dashboard?symbol=AAPL
// tradex://signal/NVDA

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get("path") ?? "/dashboard"
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradex-kappa-six.vercel.app"
  return Response.redirect(`${base}${path}`)
}
