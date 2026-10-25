import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import App from "./App"
import * as api from "./lib/api"

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, "listMessages").mockResolvedValue([])
  vi.spyOn(api, "connectChannelSocket").mockReturnValue({ close: vi.fn() } as unknown as WebSocket)
})

describe("App", () => {
  it("asks for a username first, then a target user, then shows the chat", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText(/enter a username/i)).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("Your username"), "alice")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    expect(screen.getByText(/signed in as/i)).toBeInTheDocument()
    expect(screen.getByText("alice")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("Other username"), "bob")
    await user.click(screen.getByRole("button", { name: /start chat/i }))

    expect(await screen.findByText("Chats")).toBeInTheDocument()
    expect(api.connectChannelSocket).toHaveBeenCalledWith("alice", "bob", expect.any(Function))
  })

  it("remembers the username across a remount via localStorage", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.type(screen.getByPlaceholderText("Your username"), "alice")
    await user.click(screen.getByRole("button", { name: /continue/i }))
    unmount()

    render(<App />)
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument()
  })
})
