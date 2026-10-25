import { beforeEach, describe, expect, it, vi } from "vitest"
import { connectChannelSocket, getOrCreateChannel, listMessages, sendMessage } from "./api"

// Mirrors api.ts's own default so the test works regardless of a local
// .env override (e.g. a developer's LAN IP for testing from another device).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8123"
const WS_BASE = API_BASE.replace(/^http/, "ws")

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("getOrCreateChannel", () => {
  it("GETs the channel endpoint with URL-encoded usernames", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ id: "alice__bob", members: ["alice", "bob"] }))

    const result = await getOrCreateChannel("alice", "bob")

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/channels/alice/bob`)
    expect(result).toEqual({ id: "alice__bob", members: ["alice", "bob"] })
  })

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, false, 500))
    await expect(getOrCreateChannel("alice", "bob")).rejects.toThrow("Failed to open channel: 500")
  })
})

describe("listMessages", () => {
  it("GETs the messages endpoint and returns the parsed list", async () => {
    const messages = [{ id: "1", channel_id: "alice__bob", sender: "alice", text: "hi", created_at: "now" }]
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(messages))

    const result = await listMessages("alice", "bob")

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/channels/alice/bob/messages`)
    expect(result).toEqual(messages)
  })
})

describe("sendMessage", () => {
  it("POSTs sender and text as JSON", async () => {
    const sent = { id: "1", channel_id: "alice__bob", sender: "alice", text: "hi", created_at: "now" }
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(sent))

    const result = await sendMessage("alice", "bob", "alice", "hi")

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/api/channels/alice/bob/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: "alice", text: "hi" }),
    })
    expect(result).toEqual(sent)
  })

  it("throws when the response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}, false, 400))
    await expect(sendMessage("alice", "bob", "alice", "hi")).rejects.toThrow("Failed to send message: 400")
  })
})

describe("connectChannelSocket", () => {
  it("opens a ws:// URL derived from the API base and forwards parsed messages", () => {  // nosemgrep: javascript.lang.security.detect-insecure-websocket.detect-insecure-websocket
    const sockets: FakeWebSocket[] = []

    class FakeWebSocket {
      url: string
      onmessage: ((event: { data: string }) => void) | null = null
      constructor(url: string) {
        this.url = url
        sockets.push(this)
      }
    }
    vi.stubGlobal("WebSocket", FakeWebSocket)

    const received: unknown[] = []
    connectChannelSocket("alice", "bob", (msg) => received.push(msg))

    expect(sockets).toHaveLength(1)
    expect(sockets[0].url).toBe(`${WS_BASE}/ws/alice/bob`)

    const payload = { id: "1", channel_id: "alice__bob", sender: "bob", text: "hey", created_at: "now" }
    sockets[0].onmessage?.({ data: JSON.stringify(payload) })

    expect(received).toEqual([payload])
  })
})
