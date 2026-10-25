import { render, screen } from "@testing-library/react"
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as api from "@/lib/api"
import { ChatScreen } from "./ChatScreen"

function message(id: string, sender: string, text: string) {
  return { id, channel_id: "alice__bob", sender, text, created_at: "2026-01-01T00:00:00Z" }
}

let onMessageCallback: ((msg: ReturnType<typeof message>) => void) | undefined

beforeEach(() => {
  onMessageCallback = undefined
  vi.spyOn(api, "connectChannelSocket").mockImplementation((_a, _b, onMessage) => {
    onMessageCallback = onMessage
    return { close: vi.fn() } as unknown as WebSocket
  })
})

describe("ChatScreen", () => {
  it("renders message history fetched on mount", async () => {
    vi.spyOn(api, "listMessages").mockResolvedValue([message("1", "alice", "hello bob")])

    render(<ChatScreen currentUser="alice" targetUser="bob" onSwitchTarget={vi.fn()} />)

    expect(await screen.findByText("hello bob")).toBeInTheDocument()
  })

  it("appends a message received over the websocket", async () => {
    vi.spyOn(api, "listMessages").mockResolvedValue([])

    render(<ChatScreen currentUser="alice" targetUser="bob" onSwitchTarget={vi.fn()} />)

    await act(async () => {
      onMessageCallback?.(message("1", "bob", "hi alice"))
    })

    expect(await screen.findByText("hi alice")).toBeInTheDocument()
  })

  it("keeps a live message that arrives before the history fetch resolves", async () => {
    let resolveHistory: (history: ReturnType<typeof message>[]) => void = () => {}
    vi.spyOn(api, "listMessages").mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve
      })
    )

    render(<ChatScreen currentUser="alice" targetUser="bob" onSwitchTarget={vi.fn()} />)

    // The live message arrives first, the history fetch resolves after:
    // the late (empty) history must not wipe out the live message.
    await act(async () => {
      onMessageCallback?.(message("1", "bob", "hi alice"))
    })
    await act(async () => {
      resolveHistory([])
    })

    expect(await screen.findByText("hi alice")).toBeInTheDocument()
  })

  it("does not duplicate a message already present in history", async () => {
    vi.spyOn(api, "listMessages").mockResolvedValue([message("1", "bob", "hi alice")])

    render(<ChatScreen currentUser="alice" targetUser="bob" onSwitchTarget={vi.fn()} />)
    await screen.findByText("hi alice")

    await act(async () => {
      onMessageCallback?.(message("1", "bob", "hi alice"))
    })

    expect(screen.getAllByText("hi alice")).toHaveLength(1)
  })
})
