import { useEffect, useState } from "react"
import type { User } from "oidc-client-ts"
import { ChatScreen } from "@/components/ChatScreen"
import { TargetUserPrompt } from "@/components/TargetUserPrompt"
import { initAuth, login, logout } from "@/lib/auth"

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User }

function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" })
  const [targetUser, setTargetUser] = useState<string | null>(null)

  useEffect(() => {
    initAuth()
      .then((user) => setAuth(user ? { status: "authenticated", user } : { status: "anonymous" }))
      .catch((err: Error) => setAuth({ status: "error", message: err.message }))
  }, [])

  if (auth.status === "loading") {
    return <CenteredMessage>Laden…</CenteredMessage>
  }

  if (auth.status === "error" || auth.status === "anonymous") {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">SecureChat</h1>
        {auth.status === "error" && (
          <p className="text-sm text-red-600">Inloggen mislukt: {auth.message}</p>
        )}
        <button
          type="button"
          onClick={() => login()}
          className="rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
        >
          Inloggen
        </button>
      </div>
    )
  }

  // De gebruikersnaam komt nu uit het token van Keycloak, niet meer uit een invulveld.
  const username = auth.user.profile.preferred_username ?? auth.user.profile.sub

  return (
    <div className="relative h-screen w-screen">
      <button
        type="button"
        onClick={() => logout()}
        className="absolute right-3 top-3 z-10 rounded-md border px-3 py-1 text-sm hover:bg-gray-100"
      >
        Uitloggen ({username})
      </button>

      {!targetUser ? (
        <TargetUserPrompt currentUser={username} onSubmit={setTargetUser} />
      ) : (
        <ChatScreen
          key={targetUser}
          currentUser={username}
          targetUser={targetUser}
          onSwitchTarget={() => setTargetUser(null)}
        />
      )}
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen w-screen items-center justify-center">{children}</div>
}

export default App
