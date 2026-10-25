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

export async function getOrCreateChannel(userA: string, userB: string) {
  const res = await fetch(`${API_BASE}/api/channels/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}`)
  if (!res.ok) throw new Error(`Failed to open channel: ${res.status}`)
  return res.json() as Promise<{ id: string; members: string[] }>
}

export async function listMessages(userA: string, userB: string) {
  const res = await fetch(
    `${API_BASE}/api/channels/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}/messages`
  )
  if (!res.ok) throw new Error(`Failed to load messages: ${res.status}`)
  return res.json() as Promise<ApiMessage[]>
}

export async function sendMessage(userA: string, userB: string, sender: string, text: string, line: number, mac: string) {
  const res = await fetch(
    `${API_BASE}/api/channels/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender, text, line, mac }),
    }
  )
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`)
  return res.json() as Promise<ApiMessage>
}

export function connectChannelSocket(
  userA: string,
  userB: string,
  onMessage: (message: ApiMessage) => void
) {
  const ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}`)
  ws.onmessage = (event) => {
    onMessage(JSON.parse(event.data) as ApiMessage)
  }
  return ws
}
