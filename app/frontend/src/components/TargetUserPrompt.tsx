import { useState } from "react"

export function TargetUserPrompt({
  currentUser,
  onSubmit,
}: {
  currentUser: string
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed && trimmed !== currentUser) onSubmit(trimmed)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-50">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Chat with</h1>
          <p className="text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-700">{currentUser}</span>. Enter who you want to
            chat with.
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Other username"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={!name.trim() || name.trim() === currentUser}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Start chat
        </button>
      </form>
    </div>
  )
}
