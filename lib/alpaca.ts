export function getAlpacaHeaders(mode?: string) {
  return {
    "APCA-API-KEY-ID": process.env.ALPACA_API_KEY!,
    "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY!,
    "Content-Type": "application/json",
  }
}

export function getAlpacaBase(mode?: string) {
  return process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets"
}