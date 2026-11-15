eimport { getAccessToken, userManager } from "./auth"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8123"
const WS_BASE = API_BASE.replace(/^http/, "ws")

export interface ApiMessage {
  id: string
  channel_id: string
  sender: string
  text: string
  created_at: string
  mac: string
  line: number
}

/**
 * fetch() met het access token in de Authorization-header.
 * Bij een 401 proberen we één keer het token te vernieuwen en opnieuw te sturen.
 * Lukt dat niet, dan sturen we de gebruiker naar de loginpagina.
 * (Niet blind blijven proberen: 401's tellen mee voor BunkerWeb's bad behavior.)
 */
async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  if (res.status === 401 && retry) {
    const renewed = await userManager.signinSilent().catch(() => null)
    if (renewed) return authFetch(path, init, false)
    await userManager.signinRedirect()
  }
  return res
}

// De backend haalt "wie ben ik" uit het token. In de URL staat enkel de andere partij.
// De parameter currentUser blijft staan zodat de componenten niet moeten veranderen,
// maar wordt niet meer naar de server gestuurd.

export async function getOrCreateChannel(_currentUser: string, peer: string) {
  const res = await authFetch(`/api/channels/${encodeURIComponent(peer)}`)
  if (!res.ok) throw new Error(`Failed to open channel: ${res.status}`)
  return res.json() as Promise<{ id: string; members: string[] }>
}

export async function listMessages(_currentUser: string, peer: string) {
  const res = await authFetch(`/api/channels/${encodeURIComponent(peer)}/messages`)
  if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`)
  return res.json() as Promise<ApiMessage[]>
}

export async function sendMessage(
  _currentUser: string,
  peer: string,
  _sender: string,
  text: string,
  line: number,
  mac: string
) {
  const res = await authFetch(`/api/channels/${encodeURIComponent(peer)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Geen "sender" meer: de backend bepaalt de afzender uit het token.
    body: JSON.stringify({ text, line, mac }),
  })
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`)
  return res.json() as Promise<ApiMessage>
}

/**
 * Opent de WebSocket en stuurt als eerste bericht het access token.
 * Het token gaat bewust niet in de URL, anders belandt het in de logs van BunkerWeb.
 */
export function connectChannelSocket(
  _currentUser: string,
  peer: string,
  onMessage: (message: ApiMessage) => void
) {
  const ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(peer)}`)

  ws.onopen = () => {
    getAccessToken()
      .then((token) => ws.send(JSON.stringify({ type: "auth", token })))
      .catch(() => ws.close())
  }

  ws.onmessage = (event) => {
    onMessage(JSON.parse(event.data) as ApiMessage)
  }

  return ws
}
